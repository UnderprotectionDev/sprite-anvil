import type {
	AssetVersionBatchReviewInput,
	AssetVersionReviewInput,
	CompositeVersionReviewInput,
	UnitVersionCorrectionInput,
} from "@sprite-anvil/api/asset-versions";
import { compareCodeUnits } from "@sprite-anvil/api/compare-code-units";
import type { ProviderGenerationRecordCreateInput } from "@sprite-anvil/api/provider-generation-records";
import { assetVersionProductionSourceHeader } from "@sprite-anvil/api/provider-generation-records";
import { useMutation } from "@tanstack/react-query";
import type { SyntheticEvent } from "react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { ENV } from "@/env";
import { isWriteOutcomeUncertain } from "@/utils/error-notification";
import { getErrorMessage } from "@/utils/get-error-message";
import { mutationMeta } from "@/utils/mutation-meta";
import { orpc } from "@/utils/orpc";
import { usePendingIdempotencyKey } from "@/utils/pending-idempotency-key";

const serverUrl = ENV.VITE_SERVER_URL?.replace(/\/$/u, "") ?? "";

interface RefreshResult {
	isError: boolean;
}

type ReviewDecision = AssetVersionReviewInput["decision"];
type CompositeReviewDecision = CompositeVersionReviewInput["decision"];

function getUploadErrorMessage(result: unknown, fallback: string) {
	if (
		typeof result === "object" &&
		result !== null &&
		"error" in result &&
		typeof result.error === "string"
	) {
		return result.error;
	}
	return fallback;
}

function createUploadResponseError(message: string, status: number) {
	return Object.assign(new Error(message), {
		code: "HTTP_RESPONSE_ERROR",
		status,
	});
}

interface UploadOptions {
	managedSnapshot?: File;
	productionSource?: "user_reported_provider";
	sourceKind?: "external_working_file_edit";
	unitCorrection?: UnitVersionCorrectionInput;
}
type ProviderGenerationRecordFields = Omit<
	ProviderGenerationRecordCreateInput,
	"assetVersionId" | "projectId"
>;

const reviewSuccessMessages: Record<ReviewDecision, string> = {
	approved: "Asset Version approved.",
	candidate: "Asset Version returned to Candidate.",
	rejected: "Asset Version rejected.",
};

const compositeReviewSuccessMessages: Record<CompositeReviewDecision, string> =
	{
		approved: "Composite Version approved.",
		candidate: "Composite Version returned to Candidate.",
		rejected: "Composite Version rejected.",
	};

export function useAssetVersionWrites(
	projectId: string,
	refreshCatalogs: () => Promise<RefreshResult>
) {
	const pendingUploadRef = useRef<{
		assetRecordId: string;
		fileFingerprint: string;
		idempotencyKey: string;
		managedSnapshotIdempotencyKey?: string;
	} | null>(null);
	const pendingCompositeCreateRef = useRef<{
		fingerprint: string;
		idempotencyKey: string;
	} | null>(null);
	const pendingReviewKey = usePendingIdempotencyKey();
	const pendingCompositeReviewKey = usePendingIdempotencyKey();
	const recordProviderGenerationMutation = useMutation(
		orpc.assetVersions.recordProviderGeneration.mutationOptions(mutationMeta)
	);
	const reviewBatchMutation = useMutation(
		orpc.assetVersions.reviewBatch.mutationOptions(mutationMeta)
	);
	const reviewMutation = useMutation(
		orpc.assetVersions.review.mutationOptions(mutationMeta)
	);
	const createCompositeVersionMutation = useMutation(
		orpc.assetVersions.createCompositeVersion.mutationOptions(mutationMeta)
	);
	const reviewCompositeVersionMutation = useMutation(
		orpc.assetVersions.reviewCompositeVersion.mutationOptions(mutationMeta)
	);
	const selectCanonicalDesignMutation = useMutation(
		orpc.assetVersions.selectCanonicalDesign.mutationOptions(mutationMeta)
	);
	const actionMutation = useMutation({
		...mutationMeta,
		mutationKey: ["asset-version-write", projectId],
		networkMode: "always",
		mutationFn: ({
			execute,
		}: {
			action: string;
			execute: () => Promise<boolean>;
		}) => execute(),
	});
	const activeAction = actionMutation.isPending
		? actionMutation.variables.action
		: null;
	const [writeOutcomeUncertain, setWriteOutcomeUncertain] = useState(false);
	const checkOutcome = useMutation({
		...mutationMeta,
		mutationFn: refreshCatalogs,
	});
	const isCheckingOutcome = checkOutcome.isPending;
	const [statusMessage, setStatusMessage] = useState<string | null>(null);

	async function refreshAfterWrite(successMessage: string) {
		await refreshCatalogs();
		setStatusMessage(successMessage);
	}

	function runAction(
		action: string,
		write: () => Promise<unknown>,
		successMessage: string
	) {
		if (writeOutcomeUncertain) {
			return Promise.resolve(false);
		}
		setStatusMessage(null);
		return actionMutation.mutateAsync({
			action,
			execute: async () => {
				try {
					await write();
					await refreshAfterWrite(successMessage);
					return true;
				} catch (error) {
					if (isWriteOutcomeUncertain(error)) {
						setWriteOutcomeUncertain(true);
					}
					toast.error(
						getErrorMessage(
							error,
							"Could not verify the Asset Version operation. Check the list."
						)
					);
					return false;
				}
			},
		});
	}

	function upload(
		assetRecordId: string,
		file: File,
		options: UploadOptions = {}
	) {
		if (writeOutcomeUncertain) {
			return Promise.resolve(false);
		}
		setStatusMessage(null);
		return actionMutation.mutateAsync({
			action: `upload:${assetRecordId}`,
			execute: () => uploadAndRefresh(assetRecordId, file, options),
		});
	}

	// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Upload outcome recovery keeps uncertain writes and retries tied to one idempotency key.
	async function uploadAndRefresh(
		assetRecordId: string,
		file: File,
		options: UploadOptions
	) {
		const {
			managedSnapshot,
			productionSource: requestedProductionSource,
			sourceKind: requestedSourceKind,
			unitCorrection,
		} = options;
		const productionSource = requestedProductionSource ?? "unknown";
		if (unitCorrection && productionSource !== "unknown") {
			return false;
		}
		let responseReceived = false;
		let responseStatus: number | undefined;
		let writeConfirmed = false;
		let candidateConfirmed = false;
		const sourceKind = requestedSourceKind ?? "manual_import";
		const fileFingerprint = [
			file.name,
			file.type,
			file.size.toString(),
			file.lastModified.toString(),
			sourceKind,
			managedSnapshot?.name ?? "",
			managedSnapshot?.type ?? "",
			managedSnapshot?.size.toString() ?? "",
			managedSnapshot?.lastModified.toString() ?? "",
			unitCorrection?.sourceAssetVersionId ?? "",
			unitCorrection?.unitType ?? "",
			unitCorrection?.unitKey ?? "",
			productionSource,
		].join("\u0000");
		const pendingUpload = pendingUploadRef.current;
		const idempotencyKey =
			pendingUpload?.assetRecordId === assetRecordId &&
			pendingUpload.fileFingerprint === fileFingerprint
				? pendingUpload.idempotencyKey
				: crypto.randomUUID();
		const managedSnapshotIdempotencyKey =
			pendingUpload?.assetRecordId === assetRecordId &&
			pendingUpload.fileFingerprint === fileFingerprint
				? (pendingUpload.managedSnapshotIdempotencyKey ??
					`${idempotencyKey}-snapshot`)
				: `${idempotencyKey}-snapshot`;
		pendingUploadRef.current = {
			assetRecordId,
			fileFingerprint,
			idempotencyKey,
			...(managedSnapshot ? { managedSnapshotIdempotencyKey } : {}),
		};
		try {
			const endpoint = unitCorrection ? "unit-versions" : "versions";
			const headers: Record<string, string> = {
				"Content-Type": file.type,
				"X-Asset-Version-File-Name": encodeURIComponent(file.name),
				"X-Asset-Version-Size": file.size.toString(),
				"Idempotency-Key": idempotencyKey,
			};
			if (sourceKind === "external_working_file_edit") {
				headers["X-Asset-Version-Source-Kind"] = sourceKind;
			}
			if (productionSource === "user_reported_provider") {
				headers[assetVersionProductionSourceHeader] = productionSource;
			}
			if (unitCorrection) {
				headers["X-Source-Asset-Version-Id"] =
					unitCorrection.sourceAssetVersionId;
				headers["X-Unit-Version-Type"] = unitCorrection.unitType;
				headers["X-Unit-Version-Key"] = unitCorrection.unitKey;
			}
			// conventions-exception: raw-fetch Candidate Version and Managed Snapshot uploads stream the raw file body with size and idempotency headers to the verifying Hono upload routes; the RPC link sends buffered JSON or multipart.
			const response = await fetch(
				`${serverUrl}/api/projects/${encodeURIComponent(projectId)}/asset-records/${encodeURIComponent(assetRecordId)}/${endpoint}`,
				{
					method: "POST",
					credentials: "include",
					headers,
					body: file,
				}
			);
			responseReceived = true;
			responseStatus = response.status;
			const result: unknown = await response.json();
			if (!response.ok) {
				throw createUploadResponseError(
					getUploadErrorMessage(result, "Could not upload Asset Version."),
					response.status
				);
			}
			candidateConfirmed = true;
			if (managedSnapshot) {
				const assetVersionId =
					result && typeof result === "object" && "id" in result
						? String(result.id)
						: "";
				if (!assetVersionId) {
					throw new Error(
						"Candidate Version saved, but the Managed Snapshot target could not be obtained."
					);
				}
				const snapshotResponse = await fetch(
					`${serverUrl}/api/projects/${encodeURIComponent(projectId)}/asset-versions/${encodeURIComponent(assetVersionId)}/managed-snapshots`,
					{
						method: "POST",
						credentials: "include",
						headers: {
							"Content-Type": "application/octet-stream",
							"X-Managed-Snapshot-File-Name": encodeURIComponent(
								managedSnapshot.name
							),
							"X-Managed-Snapshot-Size": managedSnapshot.size.toString(),
							"Idempotency-Key": managedSnapshotIdempotencyKey,
						},
						body: managedSnapshot,
					}
				);
				responseReceived = true;
				responseStatus = snapshotResponse.status;
				const snapshotResult: unknown = await snapshotResponse.json();
				if (!snapshotResponse.ok) {
					throw createUploadResponseError(
						getUploadErrorMessage(
							snapshotResult,
							"Could not save Managed Snapshot."
						),
						snapshotResponse.status
					);
				}
			}
			writeConfirmed = true;
			pendingUploadRef.current = null;
			let successMessage = "Candidate Asset Version saved.";
			if (managedSnapshot) {
				successMessage = "New Candidate Version and Managed Snapshot saved.";
			} else if (unitCorrection) {
				successMessage = "New Unit Version and Candidate Version saved.";
			} else if (productionSource === "user_reported_provider") {
				successMessage = "User-reported provider result saved.";
			}
			await refreshAfterWrite(successMessage);
			return true;
		} catch (error) {
			if (
				[400, 409, 415, 422].includes(responseStatus ?? 0) &&
				!managedSnapshot
			) {
				pendingUploadRef.current = null;
			}
			if (candidateConfirmed && managedSnapshot && !writeConfirmed) {
				if (
					!responseReceived ||
					(responseStatus !== undefined && responseStatus >= 500) ||
					(responseStatus !== undefined &&
						responseStatus >= 200 &&
						responseStatus < 300)
				) {
					setWriteOutcomeUncertain(true);
				}
				try {
					await refreshCatalogs();
				} catch {
					// Keep the original upload error visible; the candidate remains retryable.
				}
				toast.error(
					"Candidate Version saved, but the Managed Snapshot could not be completed. Retry the same export."
				);
				return false;
			}
			if (writeConfirmed) {
				toast.error(
					"Asset Version saved, but the list could not be refreshed. Reload the page and check the result."
				);
				return true;
			}
			if (
				!responseReceived ||
				(responseStatus !== undefined && responseStatus >= 500) ||
				(responseStatus !== undefined &&
					responseStatus >= 200 &&
					responseStatus < 300) ||
				isWriteOutcomeUncertain(error)
			) {
				setWriteOutcomeUncertain(true);
			}
			toast.error(
				getErrorMessage(
					error,
					"Could not verify the upload result. Check the Asset Versions list."
				)
			);
			return false;
		}
	}

	function recordProviderGeneration(
		assetVersionId: string,
		input: ProviderGenerationRecordFields
	) {
		return runAction(
			`provider-record:${assetVersionId}`,
			() =>
				recordProviderGenerationMutation.mutateAsync({
					...input,
					assetVersionId,
					projectId,
				}),
			"Provider Generation Record saved."
		);
	}

	function reviewBatch(input: AssetVersionBatchReviewInput) {
		return runAction(
			"batch-review",
			() => reviewBatchMutation.mutateAsync(input),
			"Batch review complete. Each version’s Review Record was saved separately."
		);
	}

	async function review(
		assetVersionId: string,
		decision: ReviewDecision,
		rationale: string
	) {
		const normalizedRationale = rationale.trim();
		// A retry of the same decision reuses the key, so a lost response cannot add a second Review Event.
		const idempotencyKey = pendingReviewKey.keyFor(
			[assetVersionId, decision, normalizedRationale].join("\u0000")
		);
		const reviewed = await runAction(
			`review:${assetVersionId}`,
			() =>
				reviewMutation.mutateAsync({
					projectId,
					assetVersionId,
					decision,
					idempotencyKey,
					rationale: normalizedRationale,
				}),
			reviewSuccessMessages[decision]
		);
		if (reviewed) {
			pendingReviewKey.clear();
		}
		return reviewed;
	}

	async function createCompositeVersion(
		assetRecordId: string,
		unitVersionIds: string[]
	) {
		const normalizedUnitVersionIds = [...unitVersionIds].sort(compareCodeUnits);
		const fingerprint = [assetRecordId, ...normalizedUnitVersionIds].join(
			"\u0000"
		);
		const pendingCreate = pendingCompositeCreateRef.current;
		const idempotencyKey =
			pendingCreate?.fingerprint === fingerprint
				? pendingCreate.idempotencyKey
				: crypto.randomUUID();
		pendingCompositeCreateRef.current = { fingerprint, idempotencyKey };
		const created = await runAction(
			`composite:${assetRecordId}`,
			() =>
				createCompositeVersionMutation.mutateAsync({
					projectId,
					assetRecordId,
					unitVersionIds: normalizedUnitVersionIds,
					idempotencyKey,
				}),
			"New Composite Version saved as Candidate."
		);
		if (created) {
			pendingCompositeCreateRef.current = null;
		}
		return created;
	}

	async function reviewCompositeVersion(
		compositeVersionId: string,
		decision: CompositeReviewDecision,
		rationale: string
	) {
		const normalizedRationale = rationale.trim();
		const idempotencyKey = pendingCompositeReviewKey.keyFor(
			[compositeVersionId, decision, normalizedRationale].join("\u0000")
		);
		const reviewed = await runAction(
			`composite-review:${compositeVersionId}`,
			() =>
				reviewCompositeVersionMutation.mutateAsync({
					projectId,
					compositeVersionId,
					decision,
					idempotencyKey,
					rationale: normalizedRationale,
				}),
			compositeReviewSuccessMessages[decision]
		);
		if (reviewed) {
			pendingCompositeReviewKey.clear();
		}
		return reviewed;
	}

	function selectCanonicalDesign(
		assetFamilyId: string,
		assetVersionId: string
	) {
		return runAction(
			`canonical:${assetVersionId}`,
			() =>
				selectCanonicalDesignMutation.mutateAsync({
					projectId,
					assetFamilyId,
					assetVersionId,
				}),
			"Canonical Design selected."
		);
	}

	async function checkWriteOutcome(event?: SyntheticEvent<HTMLFormElement>) {
		event?.preventDefault();
		const result = await checkOutcome.mutateAsync();
		if (result.isError) {
			return;
		}
		setWriteOutcomeUncertain(false);
		setStatusMessage(
			"Asset Versions list refreshed. Check the records for the result."
		);
	}

	return {
		activeAction,
		checkWriteOutcome,
		createCompositeVersion,
		isCheckingOutcome,
		recordProviderGeneration,
		review,
		reviewBatch,
		reviewCompositeVersion,
		refreshCatalogs,
		selectCanonicalDesign,
		statusMessage,
		upload,
		writeOutcomeUncertain,
		writesDisabled: activeAction !== null || writeOutcomeUncertain,
	};
}

import type {
	AssetVersionReviewInput,
	CompositeVersionReviewInput,
	UnitVersionCorrectionInput,
} from "@sprite-anvil/api/asset-versions";
import type { ProviderGenerationRecordCreateInput } from "@sprite-anvil/api/provider-generation-records";
import { assetVersionProductionSourceHeader } from "@sprite-anvil/api/provider-generation-records";
import { type SyntheticEvent, useRef, useState } from "react";
import { toast } from "sonner";
import { ENV } from "@/env";
import { isWriteOutcomeUncertain } from "@/utils/error-notification";
import { getErrorMessage } from "@/utils/get-error-message";
import { client } from "@/utils/orpc";

const serverUrl = ENV.VITE_SERVER_URL?.replace(/\/$/, "") ?? "";

interface RefreshResult {
	isError: boolean;
}

type ReviewDecision = AssetVersionReviewInput["decision"];
type CompositeReviewDecision = CompositeVersionReviewInput["decision"];
interface UploadOptions {
	productionSource?: "user_reported_provider";
	unitCorrection?: UnitVersionCorrectionInput;
}
type ProviderGenerationRecordFields = Omit<
	ProviderGenerationRecordCreateInput,
	"assetVersionId" | "projectId"
>;

const reviewSuccessMessages: Record<ReviewDecision, string> = {
	approved: "Varlık Sürümü onaylandı.",
	candidate: "Varlık Sürümü yeniden Aday yapıldı.",
	rejected: "Varlık Sürümü reddedildi.",
};

const compositeReviewSuccessMessages: Record<CompositeReviewDecision, string> =
	{
		approved: "Birleşik Sürüm onaylandı.",
		candidate: "Birleşik Sürüm yeniden Aday yapıldı.",
		rejected: "Birleşik Sürüm reddedildi.",
	};

export function useAssetVersionWrites(
	projectId: string,
	refreshCatalogs: () => Promise<RefreshResult>
) {
	const pendingUploadRef = useRef<{
		assetRecordId: string;
		fileFingerprint: string;
		idempotencyKey: string;
	} | null>(null);
	const pendingCompositeCreateRef = useRef<{
		fingerprint: string;
		idempotencyKey: string;
	} | null>(null);
	const [activeAction, setActiveAction] = useState<string | null>(null);
	const [writeOutcomeUncertain, setWriteOutcomeUncertain] = useState(false);
	const [isCheckingOutcome, setIsCheckingOutcome] = useState(false);
	const [statusMessage, setStatusMessage] = useState<string | null>(null);

	async function refreshAfterWrite(successMessage: string) {
		await refreshCatalogs();
		setStatusMessage(successMessage);
	}

	async function runAction(
		action: string,
		write: () => Promise<unknown>,
		successMessage: string
	) {
		if (writeOutcomeUncertain) {
			return false;
		}
		setActiveAction(action);
		setStatusMessage(null);
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
					"Varlık Sürümü işleminin sonucu doğrulanamadı. Listeyi kontrol edin."
				)
			);
			return false;
		} finally {
			setActiveAction(null);
		}
	}

	// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Upload outcome recovery keeps uncertain writes and retries tied to one idempotency key.
	async function upload(
		assetRecordId: string,
		file: File,
		options: UploadOptions = {}
	) {
		if (writeOutcomeUncertain) {
			return false;
		}
		const { unitCorrection, productionSource: requestedProductionSource } =
			options;
		const productionSource = requestedProductionSource ?? "unknown";
		if (unitCorrection && productionSource !== "unknown") {
			return false;
		}
		setActiveAction(`upload:${assetRecordId}`);
		setStatusMessage(null);
		let responseReceived = false;
		let responseStatus: number | undefined;
		let writeConfirmed = false;
		const fileFingerprint = [
			file.name,
			file.type,
			file.size.toString(),
			file.lastModified.toString(),
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
		pendingUploadRef.current = {
			assetRecordId,
			fileFingerprint,
			idempotencyKey,
		};
		try {
			const endpoint = unitCorrection ? "unit-versions" : "versions";
			const headers: Record<string, string> = {
				"Content-Type": file.type,
				"X-Asset-Version-File-Name": encodeURIComponent(file.name),
				"X-Asset-Version-Size": file.size.toString(),
				"Idempotency-Key": idempotencyKey,
			};
			if (productionSource === "user_reported_provider") {
				headers[assetVersionProductionSourceHeader] = productionSource;
			}
			if (unitCorrection) {
				headers["X-Source-Asset-Version-Id"] =
					unitCorrection.sourceAssetVersionId;
				headers["X-Unit-Version-Type"] = unitCorrection.unitType;
				headers["X-Unit-Version-Key"] = unitCorrection.unitKey;
			}
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
				const message =
					result && typeof result === "object" && "error" in result
						? String(result.error)
						: "Varlık Sürümü yüklenemedi.";
				throw new Error(message);
			}
			writeConfirmed = true;
			pendingUploadRef.current = null;
			let successMessage = "Aday Varlık Sürümü kaydedildi.";
			if (unitCorrection) {
				successMessage = "Yeni Birim Sürümü ve Aday Sürüm kaydedildi.";
			} else if (productionSource === "user_reported_provider") {
				successMessage = "Kullanıcı bildirimli sağlayıcı sonucu kaydedildi.";
			}
			await refreshAfterWrite(successMessage);
			return true;
		} catch (error) {
			if ([400, 409, 415, 422].includes(responseStatus ?? 0)) {
				pendingUploadRef.current = null;
			}
			if (writeConfirmed) {
				toast.error(
					"Varlık Sürümü kaydedildi ancak liste yenilenemedi. Sayfayı yeniden yükleyip sonucu kontrol edin."
				);
				return false;
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
					"Yükleme sonucu doğrulanamadı. Varlık Sürümleri listesini kontrol edin."
				)
			);
			return false;
		} finally {
			setActiveAction(null);
		}
	}

	function recordProviderGeneration(
		assetVersionId: string,
		input: ProviderGenerationRecordFields
	) {
		return runAction(
			`provider-record:${assetVersionId}`,
			() =>
				client.assetVersions.recordProviderGeneration({
					...input,
					assetVersionId,
					projectId,
				}),
			"Sağlayıcı Üretim Kaydı kaydedildi."
		);
	}

	function review(
		assetVersionId: string,
		decision: ReviewDecision,
		rationale: string
	) {
		const normalizedRationale = rationale.trim();
		return runAction(
			`review:${assetVersionId}`,
			() =>
				client.assetVersions.review({
					projectId,
					assetVersionId,
					decision,
					rationale: normalizedRationale,
				}),
			reviewSuccessMessages[decision]
		);
	}

	async function createCompositeVersion(
		assetRecordId: string,
		unitVersionIds: string[]
	) {
		const normalizedUnitVersionIds = [...unitVersionIds].sort();
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
				client.assetVersions.createCompositeVersion({
					projectId,
					assetRecordId,
					unitVersionIds: normalizedUnitVersionIds,
					idempotencyKey,
				}),
			"Yeni Birleşik Sürüm Aday olarak kaydedildi."
		);
		if (created) {
			pendingCompositeCreateRef.current = null;
		}
		return created;
	}

	function reviewCompositeVersion(
		compositeVersionId: string,
		decision: CompositeReviewDecision,
		rationale: string
	) {
		return runAction(
			`composite-review:${compositeVersionId}`,
			() =>
				client.assetVersions.reviewCompositeVersion({
					projectId,
					compositeVersionId,
					decision,
					rationale: rationale.trim(),
				}),
			compositeReviewSuccessMessages[decision]
		);
	}

	function selectCanonicalDesign(
		assetFamilyId: string,
		assetVersionId: string
	) {
		return runAction(
			`canonical:${assetVersionId}`,
			() =>
				client.assetVersions.selectCanonicalDesign({
					projectId,
					assetFamilyId,
					assetVersionId,
				}),
			"Ana Tasarım seçildi."
		);
	}

	async function checkWriteOutcome(event?: SyntheticEvent<HTMLFormElement>) {
		event?.preventDefault();
		setIsCheckingOutcome(true);
		try {
			const result = await refreshCatalogs();
			if (result.isError) {
				return;
			}
			setWriteOutcomeUncertain(false);
			setStatusMessage(
				"Varlık Sürümleri listesi yenilendi. İşlemin sonucunu kayıtlarda kontrol edin."
			);
		} finally {
			setIsCheckingOutcome(false);
		}
	}

	return {
		activeAction,
		checkWriteOutcome,
		createCompositeVersion,
		isCheckingOutcome,
		recordProviderGeneration,
		review,
		reviewCompositeVersion,
		selectCanonicalDesign,
		statusMessage,
		upload,
		writeOutcomeUncertain,
		writesDisabled: activeAction !== null || writeOutcomeUncertain,
	};
}

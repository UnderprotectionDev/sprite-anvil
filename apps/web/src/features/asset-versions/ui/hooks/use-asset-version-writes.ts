import type { AssetVersionReviewInput } from "@sprite-anvil/api/asset-versions";
import { type SyntheticEvent, useRef, useState } from "react";
import { ENV } from "@/env";
import { isWriteOutcomeUncertain } from "@/utils/error-notification";
import { getErrorMessage } from "@/utils/get-error-message";
import { client } from "@/utils/orpc";

const serverUrl = ENV.VITE_SERVER_URL?.replace(/\/$/, "") ?? "";

interface RefreshResult {
	isError: boolean;
}

type ReviewDecision = AssetVersionReviewInput["decision"];

const reviewSuccessMessages: Record<ReviewDecision, string> = {
	approved: "Varlık Sürümü onaylandı.",
	candidate: "Varlık Sürümü yeniden Aday yapıldı.",
	rejected: "Varlık Sürümü reddedildi.",
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
	const [activeAction, setActiveAction] = useState<string | null>(null);
	const [writeOutcomeUncertain, setWriteOutcomeUncertain] = useState(false);
	const [isCheckingOutcome, setIsCheckingOutcome] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [statusMessage, setStatusMessage] = useState<string | null>(null);

	async function refreshAfterWrite(successMessage: string) {
		const result = await refreshCatalogs();
		setStatusMessage(successMessage);
		if (result.isError) {
			setErrorMessage(
				"Kayıt kaydedildi ancak liste yenilenemedi. Sayfayı yeniden yükleyip sonucu kontrol edin."
			);
		}
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
		setErrorMessage(null);
		setStatusMessage(null);
		try {
			await write();
			await refreshAfterWrite(successMessage);
			return true;
		} catch (error) {
			if (isWriteOutcomeUncertain(error)) {
				setWriteOutcomeUncertain(true);
			}
			setErrorMessage(
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
	async function upload(assetRecordId: string, file: File) {
		if (writeOutcomeUncertain) {
			return false;
		}
		setActiveAction(`upload:${assetRecordId}`);
		setErrorMessage(null);
		setStatusMessage(null);
		let responseReceived = false;
		let responseStatus: number | undefined;
		let writeConfirmed = false;
		const fileFingerprint = [
			file.name,
			file.type,
			file.size.toString(),
			file.lastModified.toString(),
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
			const response = await fetch(
				`${serverUrl}/api/projects/${encodeURIComponent(projectId)}/asset-records/${encodeURIComponent(assetRecordId)}/versions`,
				{
					method: "POST",
					credentials: "include",
					headers: {
						"Content-Type": file.type,
						"X-Asset-Version-File-Name": encodeURIComponent(file.name),
						"X-Asset-Version-Size": file.size.toString(),
						"Idempotency-Key": idempotencyKey,
					},
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
			await refreshAfterWrite("Aday Varlık Sürümü kaydedildi.");
			return true;
		} catch (error) {
			if ([400, 409, 415, 422].includes(responseStatus ?? 0)) {
				pendingUploadRef.current = null;
			}
			if (writeConfirmed) {
				setErrorMessage(
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
			setErrorMessage(
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
				setErrorMessage(
					"Varlık Sürümleri listesi yenilenemedi. Yeniden deneyin."
				);
				return;
			}
			setWriteOutcomeUncertain(false);
			setErrorMessage(null);
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
		errorMessage,
		isCheckingOutcome,
		review,
		selectCanonicalDesign,
		statusMessage,
		upload,
		writeOutcomeUncertain,
		writesDisabled: activeAction !== null || writeOutcomeUncertain,
	};
}

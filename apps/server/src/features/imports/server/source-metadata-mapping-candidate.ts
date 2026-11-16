import {
	AssetVersionContentLengthError,
	AssetVersionIntegrityError,
	type CreateAssetVersionIntegrityTransform,
} from "@sprite-anvil/api/asset-version-integrity";
import type {
	AssetVersionFileRecord,
	AssetVersionStore,
} from "@sprite-anvil/api/asset-versions";
import type { ImportInboxFileRecord } from "@sprite-anvil/api/import-inbox";
import type { createStorage } from "../../../cloudflare";
import {
	createProjectAssetVersionObjectKey,
	importInboxObjectKeySchema,
} from "../../../cloudflare";
import {
	ImportInboxContentLengthError,
	ImportInboxIntegrityError,
	verifyImportInboxStream,
} from "./import-inbox-integrity";

export function isInvalidSourceImageError(error: unknown) {
	return (
		error instanceof AssetVersionIntegrityError ||
		error instanceof AssetVersionContentLengthError ||
		error instanceof ImportInboxIntegrityError ||
		error instanceof ImportInboxContentLengthError
	);
}

export async function createCandidateFromInbox({
	userId,
	projectId,
	proposalId,
	target,
	source,
	contentType,
	storage,
	versionStore,
	createAssetVersionIntegrityTransform,
}: {
	userId: string;
	projectId: string;
	proposalId: string;
	target: Pick<
		AssetVersionFileRecord,
		"assetRecordId" | "assetFamilyId" | "projectId"
	>;
	source: ImportInboxFileRecord;
	contentType: "image/png" | "image/webp";
	storage: Pick<ReturnType<typeof createStorage>, "delete" | "get" | "put">;
	versionStore: Pick<AssetVersionStore, "createCandidateVersion">;
	createAssetVersionIntegrityTransform: CreateAssetVersionIntegrityTransform;
}): Promise<"created" | "existing" | "not_found" | "conflict"> {
	const sourceKey = importInboxObjectKeySchema.safeParse(source.objectKey);
	if (!sourceKey.success) {
		throw new Error("Import Inbox file unavailable");
	}
	const object = await storage.get(sourceKey.data);
	if (
		object?.contentType !== "application/octet-stream" ||
		(object?.contentLength !== undefined &&
			object.contentLength !== source.contentLength)
	) {
		await object?.body.cancel();
		throw new Error("Import Inbox file unavailable");
	}
	const objectKey = createProjectAssetVersionObjectKey(
		projectId,
		target.assetRecordId,
		crypto.randomUUID()
	);
	const integrity = createAssetVersionIntegrityTransform(
		contentType,
		source.contentLength
	);
	let publicationAttempted = false;
	try {
		await storage.put(
			objectKey,
			verifyImportInboxStream(
				object.body,
				source.contentLength,
				source.sha256
			).pipeThrough(integrity.body),
			contentType,
			source.contentLength
		);
		const digest = integrity.getContentDigest();
		if (digest !== source.sha256) {
			throw new AssetVersionIntegrityError();
		}
		publicationAttempted = true;
		const version = await versionStore.createCandidateVersion(userId, {
			...target,
			id: proposalId,
			objectKey,
			contentType,
			contentLength: source.contentLength,
			fileName: source.fileName,
			contentDigest: digest,
			idempotencyKey: proposalId,
			integrityVerified: true,
		});
		if (version?.kind !== "created") {
			// Every attempt owns a fresh key, including idempotent replays. Never
			// remove a published attempt when the database outcome is unknown.
			await storage.delete(objectKey);
		}
		if (!version) {
			return "not_found";
		}
		return version.kind === "created" || version.kind === "existing"
			? version.kind
			: "conflict";
	} catch (error) {
		if (!publicationAttempted) {
			try {
				await storage.delete(objectKey);
			} catch {
				// Preserve the original failure if storage cleanup is unavailable.
			}
		}
		throw error;
	}
}

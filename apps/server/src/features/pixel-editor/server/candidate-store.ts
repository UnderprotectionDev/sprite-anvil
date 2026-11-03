import { createHash } from "node:crypto";
import type { UnitVersionCorrectionInput } from "@sprite-anvil/api/asset-versions";
import { createProjectAssetVersionObjectKey } from "../../../cloudflare";
import { type ErrorName, newId, type Scope } from "./pixel-editor-context";

const fileExtensionPattern = /\.[^.]+$/;

export type StoredCandidate =
	| {
			assetVersionId: string;
			created: boolean;
			ok: true;
			unitVersionId: string | null;
	  }
	| { error: ErrorName; ok: false; status: 404 | 409 | 503 };

export interface PngCandidate {
	assetFamilyId: string;
	assetRecordId: string;
	/** Source file name; the stored name drops its extension and adds `suffix`. */
	baseFileName: string | null;
	fallbackName: string;
	idempotencyKey: string;
	png: Uint8Array<ArrayBuffer>;
	suffix: string;
	unitCorrection?: UnitVersionCorrectionInput;
}

export function candidateFileName({
	baseFileName,
	fallbackName,
	suffix,
}: Pick<PngCandidate, "baseFileName" | "fallbackName" | "suffix">) {
	const base = baseFileName
		? baseFileName.replace(fileExtensionPattern, "")
		: fallbackName;
	return `${base}${suffix}.png`;
}

function pngStream(png: Uint8Array<ArrayBuffer>) {
	return new ReadableStream<Uint8Array>({
		start(controller) {
			controller.enqueue(png);
			controller.close();
		},
	});
}

/**
 * Stores a rendered PNG and creates one derived Candidate Version for it.
 * Fails closed: an object whose version row was rejected or whose upload failed
 * is deleted again. When the row write threw, the row's id is probed first and
 * the object is kept if the row exists; the idempotency key lets the retry reuse it.
 */
export async function storePngCandidate(
	{ access, dependencies }: Scope,
	candidate: PngCandidate
): Promise<StoredCandidate> {
	const versionId = newId(dependencies);
	const objectKey = createProjectAssetVersionObjectKey(
		access.projectId,
		candidate.assetRecordId,
		versionId
	);
	const storage = dependencies.createStorage();
	let persistenceAttempted = false;
	try {
		await storage.put(
			objectKey,
			pngStream(candidate.png),
			"image/png",
			candidate.png.byteLength
		);
		persistenceAttempted = true;
		const created = await dependencies.assetVersionStore.createCandidateVersion(
			access.userId,
			{
				id: versionId,
				assetFamilyId: candidate.assetFamilyId,
				assetRecordId: candidate.assetRecordId,
				projectId: access.projectId,
				objectKey,
				contentType: "image/png",
				contentLength: candidate.png.byteLength,
				contentDigest: createHash("sha256").update(candidate.png).digest("hex"),
				fileName: candidateFileName(candidate),
				idempotencyKey: candidate.idempotencyKey,
				integrityVerified: true,
				sourceKind: "derived",
				...(candidate.unitCorrection
					? { unitCorrection: candidate.unitCorrection }
					: {}),
			}
		);
		const usable =
			created &&
			(created.kind === "created" || created.kind === "existing") &&
			(candidate.unitCorrection ? created.unitVersion : true);
		if (!usable) {
			await storage.delete(objectKey);
			return created
				? { ok: false, error: "Working Draft commit failed", status: 409 }
				: { ok: false, error: "Not found", status: 404 };
		}
		if (created.kind === "existing") {
			await storage.delete(objectKey);
		}
		return {
			ok: true,
			assetVersionId: created.version.id,
			created: created.kind === "created",
			unitVersionId: created.unitVersion?.id ?? null,
		};
	} catch {
		await removeUnreferencedObject(
			{ access, dependencies },
			storage,
			objectKey,
			versionId,
			persistenceAttempted
		);
		return { ok: false, error: "Working Draft commit failed", status: 503 };
	}
}

/**
 * After a failure, deletes the stored object unless a version row may point at
 * it: a row write that threw is probed by its id, and an unreadable answer keeps the object.
 */
async function removeUnreferencedObject(
	{ access, dependencies }: Scope,
	storage: ReturnType<Scope["dependencies"]["createStorage"]>,
	objectKey: string,
	versionId: string,
	rowWriteAttempted: boolean
) {
	try {
		if (rowWriteAttempted) {
			const row = await dependencies.assetVersionStore.getFileRecord(
				access.userId,
				access.projectId,
				versionId
			);
			if (row) {
				return;
			}
		}
		await storage.delete(objectKey);
	} catch {
		// Failed closed; an orphaned object is harmless, a dangling row is not.
	}
}

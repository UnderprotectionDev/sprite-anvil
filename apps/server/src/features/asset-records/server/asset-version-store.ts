import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import type {
	AssetRecordTrackingStoreResult,
	AssetVersionCreateInput,
	AssetVersionSummary,
} from "@sprite-anvil/api/asset-record-tracking";
import {
	assetVersionReviewDispositionSchema,
	assetVersionSummarySchema,
} from "@sprite-anvil/api/asset-record-tracking";
import { type Database, getProjectForUser } from "@sprite-anvil/db";
import { legacyAssetAttestations } from "@sprite-anvil/db/schema/asset-production-history";
import { assetRecords } from "@sprite-anvil/db/schema/asset-records";
import {
	assetVersionQualityEvidence,
	assetVersionReviewEvents,
	assetVersions,
} from "@sprite-anvil/db/schema/asset-versions";
import { project } from "@sprite-anvil/db/schema/project";
import { and, desc, eq, max } from "drizzle-orm";
import { createAssetVersionObjectKey } from "../../../cloudflare";

export interface AssetVersionObjectStorage {
	delete: (key: string) => Promise<void>;
	put: (
		key: string,
		body: ReadableStream<Uint8Array>,
		contentType: "image/png" | "image/webp",
		contentLength?: number
	) => Promise<void>;
}

const maxAssetVersionBytes = 5 * 1024 * 1024;
const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function toISOString(value: Date | string) {
	return value instanceof Date
		? value.toISOString()
		: new Date(value).toISOString();
}

function toVersionSummary(
	version: typeof assetVersions.$inferSelect,
	disposition: "candidate" | "approved" | "rejected"
): AssetVersionSummary {
	return assetVersionSummarySchema.parse({
		createdAt: toISOString(version.createdAt),
		fileName: version.fileName,
		id: version.id,
		reviewDisposition: disposition,
		sha256: version.sha256,
		sourceImageHeight: version.sourceImageHeight,
		sourceImageWidth: version.sourceImageWidth,
		versionNumber: version.versionNumber,
	});
}

function isDatabaseErrorCode(error: unknown, codes: readonly string[]) {
	if (!error || typeof error !== "object") {
		return false;
	}
	const candidate = error as { code?: unknown; cause?: { code?: unknown } };
	return codes.includes(String(candidate.code ?? candidate.cause?.code ?? ""));
}

function isSupportedImage(
	bytes: Buffer,
	contentType: AssetVersionCreateInput["contentType"]
) {
	if (contentType === "image/png") {
		return (
			bytes.length >= pngSignature.length &&
			bytes.subarray(0, 8).equals(pngSignature)
		);
	}
	return (
		bytes.length >= 12 &&
		bytes.toString("ascii", 0, 4) === "RIFF" &&
		bytes.toString("ascii", 8, 12) === "WEBP"
	);
}

export interface SourceImageDimensions {
	height: number;
	width: number;
}

const maxSearchableImageDimension = 100_000;

function validDimensions(
	width: number,
	height: number
): SourceImageDimensions | null {
	return Number.isSafeInteger(width) &&
		Number.isSafeInteger(height) &&
		width > 0 &&
		height > 0 &&
		width <= maxSearchableImageDimension &&
		height <= maxSearchableImageDimension
		? { height, width }
		: null;
}

function readWebPDimensions(bytes: Buffer): SourceImageDimensions | null {
	if (
		bytes.length < 20 ||
		bytes.toString("ascii", 0, 4) !== "RIFF" ||
		bytes.toString("ascii", 8, 12) !== "WEBP"
	) {
		return null;
	}

	const riffLength = Math.min(bytes.length, bytes.readUInt32LE(4) + 8);
	let offset = 12;
	while (offset + 8 <= riffLength) {
		const chunkName = bytes.toString("ascii", offset, offset + 4);
		const chunkLength = bytes.readUInt32LE(offset + 4);
		const dataOffset = offset + 8;
		const dataEnd = dataOffset + chunkLength;
		if (dataEnd > riffLength) {
			return null;
		}

		if (chunkName === "VP8X" && chunkLength >= 10) {
			const width = 1 + bytes.readUIntLE(dataOffset + 4, 3);
			const height = 1 + bytes.readUIntLE(dataOffset + 7, 3);
			return validDimensions(width, height);
		}
		if (
			chunkName === "VP8L" &&
			chunkLength >= 5 &&
			bytes[dataOffset] === 0x2f
		) {
			const bits = bytes.readUInt32LE(dataOffset + 1);
			const width = 1 + (bits % 16_384);
			const height = 1 + (Math.floor(bits / 16_384) % 16_384);
			return validDimensions(width, height);
		}
		if (
			chunkName === "VP8 " &&
			chunkLength >= 10 &&
			bytes[dataOffset + 3] === 0x9d &&
			bytes[dataOffset + 4] === 0x01 &&
			bytes[dataOffset + 5] === 0x2a
		) {
			const width = bytes.readUInt16LE(dataOffset + 6) % 16_384;
			const height = bytes.readUInt16LE(dataOffset + 8) % 16_384;
			return validDimensions(width, height);
		}
		offset = dataEnd + (chunkLength % 2);
	}
	return null;
}

export function getSourceImageDimensions(
	bytes: Uint8Array,
	contentType: AssetVersionCreateInput["contentType"]
): SourceImageDimensions | null {
	const image = Buffer.from(bytes);
	if (contentType === "image/png") {
		if (
			image.length < 24 ||
			!image.subarray(0, 8).equals(pngSignature) ||
			image.readUInt32BE(8) < 13 ||
			image.toString("ascii", 12, 16) !== "IHDR"
		) {
			return null;
		}
		return validDimensions(image.readUInt32BE(16), image.readUInt32BE(20));
	}
	return readWebPDimensions(image);
}

function prepareUpload(input: AssetVersionCreateInput) {
	const bytes = Buffer.from(input.contentBase64, "base64");
	if (
		bytes.length === 0 ||
		bytes.length > maxAssetVersionBytes ||
		bytes.toString("base64") !== input.contentBase64 ||
		!isSupportedImage(bytes, input.contentType)
	) {
		return null;
	}
	const sha256 = createHash("sha256").update(bytes).digest("hex");
	const dimensions = getSourceImageDimensions(bytes, input.contentType);
	return {
		bytes,
		objectKey: createAssetVersionObjectKey(input.projectId, input.id, sha256),
		sha256,
		sourceImageHeight: dimensions?.height ?? null,
		sourceImageWidth: dimensions?.width ?? null,
	};
}

async function getCurrentDisposition(
	db: Database,
	projectId: string,
	versionId: string
) {
	const [latestReview] = await db
		.select({ decision: assetVersionReviewEvents.decision })
		.from(assetVersionReviewEvents)
		.where(
			and(
				eq(assetVersionReviewEvents.projectId, projectId),
				eq(assetVersionReviewEvents.versionId, versionId)
			)
		)
		.orderBy(
			desc(assetVersionReviewEvents.createdAt),
			desc(assetVersionReviewEvents.id)
		)
		.limit(1);
	return latestReview
		? assetVersionReviewDispositionSchema.parse(latestReview.decision)
		: ("candidate" as const);
}

function sameVersionPayload(
	version: typeof assetVersions.$inferSelect,
	attestation: typeof legacyAssetAttestations.$inferSelect | undefined,
	userId: string,
	input: AssetVersionCreateInput,
	upload: NonNullable<ReturnType<typeof prepareUpload>>
) {
	return Boolean(
		version.projectId === input.projectId &&
			version.assetRecordId === input.assetRecordId &&
			version.fileName === input.fileName &&
			version.contentType === input.contentType &&
			version.sha256 === upload.sha256 &&
			version.byteSize === upload.bytes.length &&
			((version.sourceImageWidth === upload.sourceImageWidth &&
				version.sourceImageHeight === upload.sourceImageHeight) ||
				(version.sourceImageWidth === null &&
					version.sourceImageHeight === null)) &&
			version.objectKey ===
				createAssetVersionObjectKey(input.projectId, input.id, upload.sha256) &&
			version.createdByUserId === userId &&
			attestation?.projectId === input.projectId &&
			attestation.versionId === input.id &&
			attestation.attestedByUserId === userId &&
			attestation.knownSource === input.knownSource &&
			attestation.supportingEvidence === input.supportingEvidence &&
			attestation.userRelationship === input.userRelationship &&
			attestation.historyUnknown === input.historyUnknown
	);
}

async function findExistingVersion(
	db: Database,
	userId: string,
	input: AssetVersionCreateInput,
	upload: NonNullable<ReturnType<typeof prepareUpload>>
): Promise<
	| { kind: "absent" }
	| { kind: "conflict" }
	| { kind: "existing"; value: AssetVersionSummary }
> {
	const [version] = await db
		.select()
		.from(assetVersions)
		.where(eq(assetVersions.id, input.id))
		.limit(1);
	if (!version) {
		return { kind: "absent" };
	}
	const [attestation] = await db
		.select()
		.from(legacyAssetAttestations)
		.where(
			and(
				eq(legacyAssetAttestations.projectId, input.projectId),
				eq(legacyAssetAttestations.versionId, input.id)
			)
		)
		.limit(1);
	if (!sameVersionPayload(version, attestation, userId, input, upload)) {
		return { kind: "conflict" };
	}
	return {
		kind: "existing",
		value: toVersionSummary(
			version,
			await getCurrentDisposition(db, input.projectId, input.id)
		),
	};
}

async function getNextVersionNumber(
	db: Database,
	projectId: string,
	assetRecordId: string
) {
	const [currentMax] = await db
		.select({ versionNumber: max(assetVersions.versionNumber) })
		.from(assetVersions)
		.where(
			and(
				eq(assetVersions.projectId, projectId),
				eq(assetVersions.assetRecordId, assetRecordId)
			)
		);
	return (currentMax?.versionNumber ?? 0) + 1;
}

async function insertVersionRows(
	db: Database,
	userId: string,
	input: AssetVersionCreateInput,
	upload: NonNullable<ReturnType<typeof prepareUpload>>,
	versionNumber: number,
	createdAt: Date
) {
	const [versionRows] = await db.batch([
		db
			.insert(assetVersions)
			.values({
				id: input.id,
				projectId: input.projectId,
				assetRecordId: input.assetRecordId,
				versionNumber,
				fileName: input.fileName,
				contentType: input.contentType,
				sourceImageWidth: upload.sourceImageWidth,
				sourceImageHeight: upload.sourceImageHeight,
				sha256: upload.sha256,
				byteSize: upload.bytes.length,
				objectKey: upload.objectKey,
				createdByUserId: userId,
				createdAt,
			})
			.returning(),
		db
			.insert(assetVersionQualityEvidence)
			.values({
				id: crypto.randomUUID(),
				projectId: input.projectId,
				versionId: input.id,
				gate: "format_signature",
				result: "matched",
				sha256: upload.sha256,
				byteSize: upload.bytes.length,
				createdByUserId: userId,
				createdAt,
			})
			.returning(),
		db
			.insert(legacyAssetAttestations)
			.values({
				id: crypto.randomUUID(),
				projectId: input.projectId,
				versionId: input.id,
				knownSource: input.knownSource,
				userRelationship: input.userRelationship,
				supportingEvidence: input.supportingEvidence,
				historyUnknown: input.historyUnknown,
				attestedByUserId: userId,
				createdAt,
			})
			.returning(),
	]);
	const [version] = versionRows as (typeof assetVersions.$inferSelect)[];
	return version ?? null;
}

async function persistVersionWithRetries(
	db: Database,
	userId: string,
	input: AssetVersionCreateInput,
	upload: NonNullable<ReturnType<typeof prepareUpload>>
): Promise<AssetRecordTrackingStoreResult<AssetVersionSummary>> {
	for (let attempt = 0; attempt < 3; attempt += 1) {
		// biome-ignore lint/performance/noAwaitInLoops: Re-read the assigned number after each unique-index race before trying again.
		const versionNumber = await getNextVersionNumber(
			db,
			input.projectId,
			input.assetRecordId
		);
		try {
			const version = await insertVersionRows(
				db,
				userId,
				input,
				upload,
				versionNumber,
				new Date()
			);
			if (version) {
				return { ok: true, value: toVersionSummary(version, "candidate") };
			}
		} catch (error) {
			if (!isDatabaseErrorCode(error, ["23505"])) {
				throw error;
			}
			const existing = await findExistingVersion(db, userId, input, upload);
			if (existing.kind === "existing") {
				return { ok: true, value: existing.value };
			}
			if (existing.kind === "conflict" || attempt === 2) {
				return { ok: false, reason: "conflict" };
			}
		}
	}
	return { ok: false, reason: "conflict" };
}

async function createVersion(
	db: Database,
	storage: AssetVersionObjectStorage | null,
	userId: string,
	input: AssetVersionCreateInput
): Promise<AssetRecordTrackingStoreResult<AssetVersionSummary>> {
	const ownedProject = await getProjectForUser(db, userId, input.projectId);
	if (!ownedProject) {
		return { ok: false, reason: "not_found" };
	}
	const [record] = await db
		.select({ record: assetRecords })
		.from(assetRecords)
		.innerJoin(project, eq(project.id, assetRecords.projectId))
		.where(
			and(
				eq(assetRecords.id, input.assetRecordId),
				eq(assetRecords.projectId, input.projectId),
				eq(project.ownerUserId, userId)
			)
		)
		.limit(1);
	if (record?.record.availability !== "active") {
		return { ok: false, reason: "not_found" };
	}
	if (!storage) {
		return { ok: false, reason: "storage_unavailable" };
	}
	const upload = prepareUpload(input);
	if (!upload) {
		return { ok: false, reason: "conflict" };
	}
	const existing = await findExistingVersion(db, userId, input, upload);
	if (existing.kind === "conflict") {
		return { ok: false, reason: "conflict" };
	}
	await storage.put(
		upload.objectKey,
		new Blob([upload.bytes]).stream(),
		input.contentType,
		upload.bytes.length
	);
	if (existing.kind === "existing") {
		return { ok: true, value: existing.value };
	}

	const result = await persistVersionWithRetries(db, userId, input, upload);
	if (!result.ok) {
		await storage.delete(upload.objectKey);
	}
	return result;
}

export function createAssetVersionWriter(
	db: Database,
	storage: AssetVersionObjectStorage | null
) {
	return {
		create: (userId: string, input: AssetVersionCreateInput) =>
			createVersion(db, storage, userId, input),
	};
}

import { z } from "zod";
import type { AssetRecordStore } from "./asset-records";
import {
	type AssetVersionStore,
	type CompositeVersion,
	type CompositionMembership,
	compositionMembershipSchema,
	type UnitVersion,
	unitVersionSchema,
} from "./asset-versions";
import {
	type GameplayMetadataFrame,
	type GameplayMetadataRecord,
	type GameplayMetadataStore,
	gameplayMetadataFrameSchema,
	gameplayMetadataRecordSchema,
} from "./gameplay-metadata";
import {
	canonicalGameplayMetadataJson,
	getGameplayMetadataIntegrityErrors,
	getGameplayMetadataReviewSourceErrors,
} from "./gameplay-metadata-integrity";

const identifier = z.string().trim().min(1).max(128);
export const animationMetadataPackageSizeLimit = 524_288;

export const animationMetadataPackageInputSchema = z
	.object({
		projectId: identifier,
		assetRecordId: identifier,
		compositeVersionId: identifier,
	})
	.strict();

export const animationMetadataAssetVersionPinSchema = z
	.object({
		id: identifier,
		assetRecordId: identifier,
		versionNumber: z.number().int().positive(),
		contentType: z.enum(["image/png", "image/webp"]),
		contentLength: z.number().int().positive(),
		contentDigest: z
			.string()
			.regex(/^[0-9a-f]{64}$/)
			.nullable(),
		integrityVerified: z.boolean(),
	})
	.strict();

export const animationMetadataCompositeVersionSchema = z
	.object({
		id: identifier,
		projectId: identifier,
		assetRecordId: identifier,
		versionNumber: z.number().int().positive(),
		createdAt: z.string().datetime(),
		compositionMemberships: z.array(compositionMembershipSchema),
	})
	.strict();

export const animationMetadataPackageTargetSchema = z
	.object({
		compositeVersion: animationMetadataCompositeVersionSchema,
		unitVersions: z.array(unitVersionSchema),
		assetVersionPins: z.array(animationMetadataAssetVersionPinSchema),
		frames: z.array(gameplayMetadataFrameSchema),
		records: z.array(gameplayMetadataRecordSchema),
	})
	.strict();

const payloadSchema = animationMetadataPackageTargetSchema
	.extend({
		format: z.literal("sprite-anvil.animation-metadata"),
		schemaVersion: z.literal("1.0.0"),
	})
	.strict();

export const animationMetadataPackageSchema = payloadSchema
	.extend({
		contentDigest: z.string().regex(/^[0-9a-f]{64}$/),
	})
	.strict()
	.refine(
		(value) =>
			new TextEncoder().encode(JSON.stringify(value)).length <=
			animationMetadataPackageSizeLimit,
		"Animasyon Metadata Paketi 512 KiB sınırını aşıyor."
	);

const packageJsonSchema = z
	.json()
	.refine(
		(value) =>
			new TextEncoder().encode(JSON.stringify(value)).length <=
			animationMetadataPackageSizeLimit,
		"Animasyon Metadata Paketi 512 KiB sınırını aşıyor."
	);

export const animationMetadataPackageReadInputSchema =
	animationMetadataPackageInputSchema
		.extend({ package: packageJsonSchema })
		.strict();

export type AnimationMetadataAssetVersionPin = z.infer<
	typeof animationMetadataAssetVersionPinSchema
>;
export type AnimationMetadataCompositeVersion = z.infer<
	typeof animationMetadataCompositeVersionSchema
>;
export type AnimationMetadataPackage = z.infer<
	typeof animationMetadataPackageSchema
>;
export type AnimationMetadataPackageTarget = z.infer<
	typeof animationMetadataPackageTargetSchema
>;

export type AnimationMetadataPackageTargetReader = (request: {
	userId: string;
	input: z.infer<typeof animationMetadataPackageInputSchema>;
	assetRecordStore: AssetRecordStore;
	assetVersionStore: AssetVersionStore;
	gameplayMetadataStore: GameplayMetadataStore;
}) => Promise<AnimationMetadataPackageTarget>;

function getCompositionMembershipIntegrityErrors(
	composite: AnimationMetadataCompositeVersion,
	unitVersions: Map<string, UnitVersion>,
	unitVersionCount: number
) {
	const errors: string[] = [];
	const membershipIds = new Set<string>();
	const membershipSlots = new Set<string>();

	for (const membership of composite.compositionMemberships) {
		const unitVersion = unitVersions.get(membership.unitVersionId);
		const slot = `${membership.unitType}:${membership.unitKey}`;
		if (
			membershipIds.has(membership.unitVersionId) ||
			membershipSlots.has(slot)
		) {
			errors.push("Bileşim Üyeliği yineleniyor.");
		}
		membershipIds.add(membership.unitVersionId);
		membershipSlots.add(slot);
		if (
			!unitVersion ||
			membership.compositeVersionId !== composite.id ||
			membership.projectId !== composite.projectId ||
			membership.assetRecordId !== composite.assetRecordId ||
			unitVersion.projectId !== composite.projectId ||
			unitVersion.assetRecordId !== composite.assetRecordId ||
			unitVersion.unitType !== membership.unitType ||
			unitVersion.unitKey !== membership.unitKey
		) {
			errors.push("Birim Sürümü ve Bileşim Üyeliği eşleşmiyor.");
		}
	}

	if (
		unitVersionCount !== composite.compositionMemberships.length ||
		membershipIds.size !== unitVersionCount
	) {
		errors.push("Birleşik Sürümün kesin Birim Sürümleri korunamadı.");
	}
	return errors;
}

function getAssetVersionPinIntegrityErrors(
	target: AnimationMetadataPackageTarget,
	assetVersionIds: Set<string>
) {
	const errors: string[] = [];
	const assetVersionPinIds = new Set<string>();
	for (const pin of target.assetVersionPins) {
		if (assetVersionPinIds.has(pin.id)) {
			errors.push("Asset Version kimliği yineleniyor.");
		}
		assetVersionPinIds.add(pin.id);
		if (pin.assetRecordId !== target.compositeVersion.assetRecordId) {
			errors.push("Asset Version başka bir Varlık Kaydına bağlı.");
		}
	}
	if (
		assetVersionPinIds.size !== assetVersionIds.size ||
		[...assetVersionIds].some((id) => !assetVersionPinIds.has(id))
	) {
		errors.push("Birleşik Sürümün kesin Asset Version kimlikleri korunamadı.");
	}
	return errors;
}

function getFrameMetadataIntegrityErrors(
	target: AnimationMetadataPackageTarget,
	unitVersions: Map<string, UnitVersion>,
	assetVersionIds: Set<string>
) {
	const errors: string[] = [];
	const framesByAssetVersion = new Map<string, GameplayMetadataFrame[]>();
	const selectedFrameIdentities = new Set(
		[...unitVersions.values()]
			.filter((unitVersion) => unitVersion.unitType === "frame")
			.map((unitVersion) =>
				JSON.stringify([unitVersion.assetVersionId, unitVersion.unitKey])
			)
	);
	for (const frame of target.frames) {
		const frames = framesByAssetVersion.get(frame.assetVersionId) ?? [];
		if (frames.some((candidate) => candidate.frameKey === frame.frameKey)) {
			errors.push("Kare kimliği yineleniyor.");
		}
		frames.push(frame);
		framesByAssetVersion.set(frame.assetVersionId, frames);
		if (!assetVersionIds.has(frame.assetVersionId)) {
			errors.push("Kare, seçili Birleşik Sürümün dışında kalıyor.");
		}
		if (
			!selectedFrameIdentities.has(
				JSON.stringify([frame.assetVersionId, frame.frameKey])
			)
		) {
			errors.push("Kare metadata'sı seçili Kare Birim Sürümüne bağlı değil.");
		}
	}

	for (const unitVersion of target.unitVersions) {
		if (
			unitVersion.unitType === "frame" &&
			!framesByAssetVersion
				.get(unitVersion.assetVersionId)
				?.some((frame) => frame.frameKey === unitVersion.unitKey)
		) {
			errors.push("Kare Birim Sürümünün kesin kare metadata'sı bulunamadı.");
		}
	}
	return errors;
}

function getGameplayRecordIntegrityErrors(
	target: AnimationMetadataPackageTarget,
	assetVersionIds: Set<string>
) {
	const errors: string[] = [];
	for (const record of target.records) {
		if (
			record.projectId !== target.compositeVersion.projectId ||
			record.assetRecordId !== target.compositeVersion.assetRecordId ||
			!assetVersionIds.has(record.assetVersionId)
		) {
			errors.push("Oyun İçi Bilgi kaydı seçili Birleşik Sürümün dışında.");
		}
		errors.push(...getGameplayMetadataIntegrityErrors(record, target.frames));
		errors.push(
			...getGameplayMetadataReviewSourceErrors(record, target.records)
		);
	}

	return errors;
}

function getAnimationMetadataIntegrityErrors(
	target: AnimationMetadataPackageTarget
) {
	const errors: string[] = [];
	const unitVersions = new Map<string, UnitVersion>();
	const assetVersionIds = new Set<string>();
	for (const unitVersion of target.unitVersions) {
		if (unitVersions.has(unitVersion.id)) {
			errors.push("Birim Sürümü kimliği yineleniyor.");
		}
		unitVersions.set(unitVersion.id, unitVersion);
		assetVersionIds.add(unitVersion.assetVersionId);
	}
	errors.push(
		...getCompositionMembershipIntegrityErrors(
			target.compositeVersion,
			unitVersions,
			target.unitVersions.length
		)
	);
	errors.push(...getAssetVersionPinIntegrityErrors(target, assetVersionIds));
	errors.push(
		...getFrameMetadataIntegrityErrors(target, unitVersions, assetVersionIds)
	);
	errors.push(...getGameplayRecordIntegrityErrors(target, assetVersionIds));
	return errors;
}

function getAnimationMetadataPackageSnapshotErrors(
	snapshot: AnimationMetadataPackageTarget,
	current: AnimationMetadataPackageTarget
) {
	const errors: string[] = [];
	if (
		canonicalGameplayMetadataJson(snapshot.compositeVersion) !==
		canonicalGameplayMetadataJson(current.compositeVersion)
	) {
		errors.push("Seçili Composite Version değişti.");
	}
	if (
		canonicalGameplayMetadataJson(snapshot.unitVersions) !==
		canonicalGameplayMetadataJson(current.unitVersions)
	) {
		errors.push(
			"Seçili Composite Version'ın kesin Unit Version pinleri değişti."
		);
	}
	if (
		canonicalGameplayMetadataJson(snapshot.assetVersionPins) !==
		canonicalGameplayMetadataJson(current.assetVersionPins)
	) {
		errors.push(
			"Seçili Composite Version'ın kesin Asset Version pinleri değişti."
		);
	}

	const currentFrames = new Map<string, GameplayMetadataFrame[]>();
	for (const frame of current.frames) {
		const identity = JSON.stringify([frame.assetVersionId, frame.frameKey]);
		const frames = currentFrames.get(identity) ?? [];
		frames.push(frame);
		currentFrames.set(identity, frames);
	}
	for (const frame of snapshot.frames) {
		const identity = JSON.stringify([frame.assetVersionId, frame.frameKey]);
		const matchingFrames = currentFrames.get(identity);
		if (
			!matchingFrames ||
			frame.sourcePivots.some(
				(sourcePivot) =>
					!matchingFrames.some((currentFrame) =>
						currentFrame.sourcePivots.some(
							(currentPivot) =>
								canonicalGameplayMetadataJson(currentPivot) ===
								canonicalGameplayMetadataJson(sourcePivot)
						)
					)
			)
		) {
			errors.push(
				"Paketin kare metadata'sı artık aynı Asset Version'a bağlı değil."
			);
			break;
		}
	}

	const currentRecords = new Map(
		current.records.map((record) => [record.id, record])
	);
	for (const record of snapshot.records) {
		const currentRecord = currentRecords.get(record.id);
		if (
			!currentRecord ||
			canonicalGameplayMetadataJson(currentRecord) !==
				canonicalGameplayMetadataJson(record)
		) {
			errors.push(
				"Paketin Gameplay Metadata kaydı artık değişmez kaynağıyla eşleşmiyor."
			);
			break;
		}
	}
	return errors;
}

async function digest(payload: z.infer<typeof payloadSchema>) {
	const bytes = new TextEncoder().encode(
		canonicalGameplayMetadataJson(payload)
	);
	const hash = await crypto.subtle.digest("SHA-256", bytes);
	return Array.from(new Uint8Array(hash), (value) =>
		value.toString(16).padStart(2, "0")
	).join("");
}

export async function createAnimationMetadataPackage(
	target: AnimationMetadataPackageTarget
): Promise<AnimationMetadataPackage> {
	const parsedTarget = animationMetadataPackageTargetSchema.parse(target);
	const errors = getAnimationMetadataIntegrityErrors(parsedTarget);
	if (errors.length) {
		throw new Error(`Bütünlük hatası: ${[...new Set(errors)].join(" ")}`);
	}
	const payload = payloadSchema.parse({
		...parsedTarget,
		format: "sprite-anvil.animation-metadata",
		schemaVersion: "1.0.0",
	});
	return animationMetadataPackageSchema.parse({
		...payload,
		contentDigest: await digest(payload),
	});
}

export async function readAnimationMetadataPackage(
	value: unknown,
	target: AnimationMetadataPackageTarget
): Promise<AnimationMetadataPackage> {
	const parsed = animationMetadataPackageSchema.safeParse(value);
	if (!parsed.success) {
		throw new Error(
			"Bütünlük hatası: Animasyon Metadata Paketi biçimi, sürüm kimliği veya boyutu geçersiz."
		);
	}
	const { contentDigest, ...payload } = parsed.data;
	if ((await digest(payload)) !== contentDigest) {
		throw new Error(
			"Bütünlük hatası: Animasyon Metadata Paketi özeti içerikle eşleşmiyor."
		);
	}
	const snapshot = animationMetadataPackageTargetSchema.parse({
		compositeVersion: payload.compositeVersion,
		unitVersions: payload.unitVersions,
		assetVersionPins: payload.assetVersionPins,
		frames: payload.frames,
		records: payload.records,
	});
	const integrityErrors = getAnimationMetadataIntegrityErrors(snapshot);
	if (integrityErrors.length) {
		throw new Error(
			`Bütünlük hatası: ${[...new Set(integrityErrors)].join(" ")}`
		);
	}
	const snapshotErrors = getAnimationMetadataPackageSnapshotErrors(
		snapshot,
		target
	);
	if (snapshotErrors.length) {
		throw new Error(`Bütünlük hatası: ${snapshotErrors.join(" ")}`);
	}
	return parsed.data;
}

export function createAnimationMetadataPackageTarget(input: {
	compositeVersion: CompositeVersion;
	unitVersions: UnitVersion[];
	assetVersionPins: AnimationMetadataAssetVersionPin[];
	frames: GameplayMetadataFrame[];
	records: GameplayMetadataRecord[];
}): AnimationMetadataPackageTarget {
	const compositeVersion: AnimationMetadataCompositeVersion = {
		id: input.compositeVersion.id,
		projectId: input.compositeVersion.projectId,
		assetRecordId: input.compositeVersion.assetRecordId,
		versionNumber: input.compositeVersion.versionNumber,
		createdAt: input.compositeVersion.createdAt,
		compositionMemberships: input.compositeVersion.compositionMemberships,
	};
	const unitVersions = [...input.unitVersions].sort(
		(left, right) =>
			left.unitType.localeCompare(right.unitType) ||
			left.unitKey.localeCompare(right.unitKey) ||
			left.versionNumber - right.versionNumber ||
			left.id.localeCompare(right.id)
	);
	const assetVersionPins = [...input.assetVersionPins].sort((left, right) =>
		left.id.localeCompare(right.id)
	);
	const frames = [...input.frames].sort(
		(left, right) =>
			left.assetVersionId.localeCompare(right.assetVersionId) ||
			left.frameKey.localeCompare(right.frameKey)
	);
	const records = [...input.records].sort(
		(left, right) =>
			left.assetVersionId.localeCompare(right.assetVersionId) ||
			left.frameKey.localeCompare(right.frameKey) ||
			left.createdAt.localeCompare(right.createdAt) ||
			left.id.localeCompare(right.id)
	);
	const compositionMemberships: CompositionMembership[] = [
		...compositeVersion.compositionMemberships,
	];
	return animationMetadataPackageTargetSchema.parse({
		compositeVersion: { ...compositeVersion, compositionMemberships },
		unitVersions,
		assetVersionPins,
		frames,
		records,
	});
}

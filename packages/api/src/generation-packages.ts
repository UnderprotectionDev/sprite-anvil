import { z } from "zod";
import {
	type AssetRecordTracking,
	referenceFeatureSchema,
	referenceRoleSchema,
} from "./asset-record-tracking";
import type { AssetRecord } from "./asset-records";
import { assetRecordSchema } from "./asset-records";
import type { AssetVersionCatalog } from "./asset-versions";
import { unitVersionSchema } from "./asset-versions";
import type { ProjectContextScopeCatalog } from "./context-scopes";
import { themeRecordSchema, visualWorldRecordSchema } from "./context-scopes";
import { pixelRectSchema } from "./pixel-editor";
import type { ProjectContext } from "./project-context";
import { projectContextSchema } from "./project-context";
import { idempotencyKeySchema } from "./record-publication";
import type { ReferenceBoardImage } from "./reference-production";

const idSchema = z.uuid();
const dimensionSchema = z
	.object({
		height: z.number().int().positive().max(100_000),
		width: z.number().int().positive().max(100_000),
	})
	.strict();

const constraintListSchema = z
	.array(z.string().trim().min(1).max(500))
	.max(30)
	.refine(
		(values) =>
			new Set(values.map((value) => value.toLocaleLowerCase("tr-TR"))).size ===
			values.length,
		"A constraint may only be listed once."
	);

const referenceRoleSnapshotSchema = z
	.object({
		assetRecordId: idSchema.nullable(),
		assetRecordName: z.string().min(1).max(120).nullable(),
		assetVersionId: idSchema.nullable(),
		contentDigest: z
			.string()
			.regex(/^[a-f0-9]{64}$/)
			.nullable(),
		contentType: z.enum(["image/png", "image/webp"]).nullable(),
		contextOverrideRationale: z.string().nullable(),
		customPurpose: z.string().nullable(),
		fileName: z.string().min(1).max(255).nullable(),
		forbiddenFeatures: z.array(referenceFeatureSchema).max(7),
		id: idSchema,
		kind: z.enum(["asset_version", "reference_image"]),
		notes: z.string().nullable(),
		role: referenceRoleSchema,
		transferredFeatures: z.array(referenceFeatureSchema).max(7),
		versionNumber: z.number().int().positive().nullable(),
	})
	.strict();

const canonicalDesignSnapshotSchema = z
	.object({
		assetFamilyId: idSchema,
		assetRecordId: idSchema,
		assetVersionId: idSchema,
		canonicalDesignId: idSchema,
		contentDigest: z
			.string()
			.regex(/^[a-f0-9]{64}$/)
			.nullable(),
		contentType: z.enum(["image/png", "image/webp"]),
		versionNumber: z.number().int().positive(),
	})
	.strict();

const lockedUnitSnapshotSchema = unitVersionSchema
	.pick({
		assetVersionId: true,
		id: true,
		sourceAssetVersionId: true,
		unitKey: true,
		unitType: true,
		versionNumber: true,
	})
	.strict();

const correctionPointSchema = z
	.object({
		x: z.number().int().min(0).max(100_000),
		y: z.number().int().min(0).max(100_000),
	})
	.strict();

const correctionRectSchema = pixelRectSchema.extend({
	x: z.number().int().min(0).max(100_000),
	y: z.number().int().min(0).max(100_000),
});

/** Non-image-altering marks; they travel with the package and never touch pixels. */
export const correctionAnnotationSchema = z.discriminatedUnion("kind", [
	z
		.object({
			kind: z.literal("arrow"),
			from: correctionPointSchema,
			to: correctionPointSchema,
		})
		.strict(),
	z
		.object({
			kind: z.literal("line"),
			from: correctionPointSchema,
			to: correctionPointSchema,
		})
		.strict(),
	z.object({ kind: z.literal("region"), rect: correctionRectSchema }).strict(),
	z
		.object({
			kind: z.literal("note"),
			at: correctionPointSchema,
			text: z.string().trim().min(1).max(500),
		})
		.strict(),
	z.object({ kind: z.literal("pivot"), at: correctionPointSchema }).strict(),
	z
		.object({
			kind: z.literal("ground-line"),
			y: z.number().int().min(0).max(100_000),
		})
		.strict(),
]);

/** The Working Draft a correction was marked on; its size and revision fix what the coordinates mean. */
export const correctionDraftReferenceSchema = z
	.object({ id: idSchema, revision: z.number().int().min(0) })
	.strict();

export const correctionCoordinateSpaceSchema = z
	.object({
		draftId: idSchema,
		draftRevision: z.number().int().min(0),
		height: dimensionSchema.shape.height,
		width: dimensionSchema.shape.width,
	})
	.strict();

export const generationPackageCorrectionInputSchema = z
	.object({
		annotations: z.array(correctionAnnotationSchema).max(50),
		draft: correctionDraftReferenceSchema,
		issueNote: z.string().trim().min(1).max(2000),
		redrawRegion: correctionRectSchema,
		sourceAssetVersionId: idSchema,
		targetUnitVersionId: idSchema.nullable(),
	})
	.strict();

const generationPackageCorrectionSchema = generationPackageCorrectionInputSchema
	.omit({ draft: true })
	.extend({
		coordinateSpace: correctionCoordinateSpaceSchema,
		targetUnit: lockedUnitSnapshotSchema.nullable(),
	})
	.strict();

const contextRulesSchema =
	projectContextSchema.shape.currentContextRevision.shape.rules;

export const generationPackageSnapshotSchema = z
	.object({
		assetRecord: assetRecordSchema,
		avoidConstraints: constraintListSchema,
		canonicalDesign: canonicalDesignSnapshotSchema.nullable(),
		changeConstraints: constraintListSchema,
		correction: generationPackageCorrectionSchema.optional(),
		expectedOutputStructure: z.string().trim().min(1).max(2000),
		lockedUnits: z.array(lockedUnitSnapshotSchema).max(100),
		preserveConstraints: constraintListSchema,
		productionContextSnapshot: z
			.object({
				contextRevisionId: idSchema,
				generalArtDirection: z.string().max(1000),
				ruleContractVersion: z.literal("context-rule/1.0.0"),
				rules: contextRulesSchema,
				revisionNumber: z.number().int().positive(),
				theme: themeRecordSchema.nullable(),
				visualWorld: visualWorldRecordSchema.nullable(),
			})
			.strict(),
		referenceRoles: z.array(referenceRoleSnapshotSchema).max(200),
		targetDimensions: dimensionSchema,
		targetTask: z.string().trim().min(1).max(2000),
	})
	.strict();

export const generationPackageSchema = z
	.object({
		...generationPackageSnapshotSchema.shape,
		assetRecordId: idSchema,
		createdAt: z.iso.datetime(),
		id: idSchema,
		projectId: idSchema,
	})
	.strict();

export const generationPackageCreateInputSchema = z
	.object({
		assetRecordId: idSchema,
		avoidConstraints: constraintListSchema,
		changeConstraints: constraintListSchema,
		correction: generationPackageCorrectionInputSchema.optional(),
		expectedOutputStructure: z.string().trim().min(1).max(2000),
		idempotencyKey: idempotencyKeySchema.optional(),
		lockedUnitVersionIds: z
			.array(idSchema)
			.max(100)
			.refine((ids) => new Set(ids).size === ids.length),
		preserveConstraints: constraintListSchema,
		projectId: idSchema,
		targetDimensions: dimensionSchema,
		targetTask: z.string().trim().min(1).max(2000),
	})
	.strict();

export const generationPackageListInputSchema = z
	.object({ assetRecordId: idSchema, projectId: idSchema })
	.strict();

export type GenerationPackageCorrectionInput = z.infer<
	typeof generationPackageCorrectionInputSchema
>;
export type GenerationPackage = z.infer<typeof generationPackageSchema>;
export type GenerationPackageSnapshot = z.infer<
	typeof generationPackageSnapshotSchema
>;
export type GenerationPackageCreateInput = z.infer<
	typeof generationPackageCreateInputSchema
>;

export interface GenerationPackageStore {
	create: (
		userId: string,
		input: {
			assetRecordId: string;
			idempotencyKey?: string;
			projectId: string;
			snapshot: GenerationPackageSnapshot;
		}
	) => Promise<GenerationPackage | null>;
	list: (
		userId: string,
		projectId: string,
		assetRecordId: string
	) => Promise<GenerationPackage[] | null>;
}

/** Size and revision of a Working Draft as the server derived them; supplied by the pixel editor. */
export interface PixelDraftCoordinateSpace {
	assetRecordId: string;
	draftId: string;
	draftRevision: number;
	height: number;
	sourceAssetVersionId: string;
	width: number;
}

export const correctionErrors = {
	draftMismatch:
		"The correction Working Draft does not belong to this record and source version.",
	draftStale: "The Working Draft changed after the correction was marked.",
	draftUnavailable: "The correction Working Draft could not be found.",
	outsideBounds: "A correction mark is outside the target bounds.",
	sourceNotInRecord:
		"The correction source version does not belong to this record.",
	targetUnitInvalid:
		"The correction target Unit Version is not in this record or is also preserved.",
} as const;

type Dimensions = z.infer<typeof dimensionSchema>;
type Point = z.infer<typeof correctionPointSchema>;
type Rect = z.infer<typeof correctionRectSchema>;

function pointInside(point: Point, size: Dimensions) {
	return point.x < size.width && point.y < size.height;
}

function rectInside(rect: Rect, size: Dimensions) {
	return (
		rect.x + rect.width <= size.width && rect.y + rect.height <= size.height
	);
}

/**
 * Checks a correction's Working Draft reference against the draft the server
 * read. Returns the coordinate space the marks are validated in; throws a
 * correctionErrors message otherwise.
 */
export function resolveCorrectionCoordinateSpace(
	correction: Pick<
		GenerationPackageCorrectionInput,
		"draft" | "sourceAssetVersionId"
	>,
	draftSpace: PixelDraftCoordinateSpace | null,
	assetRecordId: string
): z.infer<typeof correctionCoordinateSpaceSchema> {
	if (!draftSpace || draftSpace.draftId !== correction.draft.id) {
		throw new Error(correctionErrors.draftUnavailable);
	}
	if (
		draftSpace.assetRecordId !== assetRecordId ||
		draftSpace.sourceAssetVersionId !== correction.sourceAssetVersionId
	) {
		throw new Error(correctionErrors.draftMismatch);
	}
	if (draftSpace.draftRevision !== correction.draft.revision) {
		throw new Error(correctionErrors.draftStale);
	}
	return {
		draftId: draftSpace.draftId,
		draftRevision: draftSpace.draftRevision,
		height: draftSpace.height,
		width: draftSpace.width,
	};
}

function buildCorrection(
	correction: z.infer<typeof generationPackageCorrectionInputSchema>,
	coordinateSpace: z.infer<typeof correctionCoordinateSpaceSchema>,
	assetRecordId: string,
	catalog: AssetVersionCatalog,
	lockedUnitVersionIds: string[]
) {
	if (
		!catalog.assetVersions.some(
			(version) =>
				version.id === correction.sourceAssetVersionId &&
				version.assetRecordId === assetRecordId
		)
	) {
		throw new Error(correctionErrors.sourceNotInRecord);
	}
	let targetUnit: z.infer<typeof lockedUnitSnapshotSchema> | null = null;
	if (correction.targetUnitVersionId) {
		const unit = catalog.unitVersions.find(
			(entry) =>
				entry.id === correction.targetUnitVersionId &&
				entry.assetRecordId === assetRecordId
		);
		if (!unit || lockedUnitVersionIds.includes(unit.id)) {
			throw new Error(correctionErrors.targetUnitInvalid);
		}
		targetUnit = {
			assetVersionId: unit.assetVersionId,
			id: unit.id,
			sourceAssetVersionId: unit.sourceAssetVersionId,
			unitKey: unit.unitKey,
			unitType: unit.unitType,
			versionNumber: unit.versionNumber,
		};
	}
	const inside =
		rectInside(correction.redrawRegion, coordinateSpace) &&
		correction.annotations.every((mark) => {
			if (mark.kind === "region") {
				return rectInside(mark.rect, coordinateSpace);
			}
			if (mark.kind === "note" || mark.kind === "pivot") {
				return pointInside(mark.at, coordinateSpace);
			}
			if (mark.kind === "ground-line") {
				return mark.y < coordinateSpace.height;
			}
			return (
				pointInside(mark.from, coordinateSpace) &&
				pointInside(mark.to, coordinateSpace)
			);
		});
	if (!inside) {
		throw new Error(correctionErrors.outsideBounds);
	}
	const { draft: _draft, ...recorded } = correction;
	return { ...recorded, coordinateSpace, targetUnit };
}

export function createGenerationPackageSnapshot(data: {
	assetRecord: AssetRecord;
	assetVersionCatalog: AssetVersionCatalog;
	/** Required with a correction: the Working Draft space the server derived. */
	correctionSpace?: z.infer<typeof correctionCoordinateSpaceSchema>;
	input: GenerationPackageCreateInput;
	projectContext: ProjectContext;
	projectContextScopeCatalog: ProjectContextScopeCatalog;
	referenceBoardImages: ReferenceBoardImage[];
	tracking: AssetRecordTracking;
}) {
	const { assetRecord, assetVersionCatalog, projectContext } = data;
	const request = data.input;
	const activeRevision = projectContext.currentContextRevision;
	const scopes = new Set(
		[
			["project", request.projectId],
			...(assetRecord.visualWorldId
				? [["visual_world", assetRecord.visualWorldId]]
				: []),
			...(assetRecord.themeId ? [["theme", assetRecord.themeId]] : []),
			...(data.tracking.family
				? [["asset_family", data.tracking.family.id]]
				: []),
			["asset", assetRecord.id],
		].map(([kind, id]) => `${kind}:${id}`)
	);
	const rules = activeRevision.rules.filter((rule) =>
		scopes.has(`${rule.scope.kind}:${rule.scope.id}`)
	);

	const canonicalVersionId = data.tracking.family?.canonicalVersionId;
	let canonicalDesign: GenerationPackage["canonicalDesign"] = null;
	if (canonicalVersionId) {
		const selectedDesign = assetVersionCatalog.canonicalDesigns.find(
			(design) =>
				design.assetFamilyId === data.tracking.family?.id &&
				design.assetVersionId === canonicalVersionId
		);
		const selectedVersion = assetVersionCatalog.assetVersions.find(
			(version) =>
				version.id === canonicalVersionId &&
				version.assetRecordId === selectedDesign?.assetRecordId
		);
		if (!(selectedDesign && selectedVersion)) {
			throw new Error("The current Canonical Design is missing its version.");
		}
		canonicalDesign = {
			assetFamilyId: selectedDesign.assetFamilyId,
			assetRecordId: selectedDesign.assetRecordId,
			assetVersionId: selectedVersion.id,
			canonicalDesignId: selectedDesign.id,
			contentDigest: selectedVersion.contentDigest,
			contentType: selectedVersion.contentType,
			versionNumber: selectedVersion.versionNumber,
		};
	}

	const lockedUnits = request.lockedUnitVersionIds.map((id) => {
		const unit = assetVersionCatalog.unitVersions.find(
			(entry) => entry.id === id && entry.assetRecordId === assetRecord.id
		);
		if (!unit) {
			throw new Error("A locked Unit Version does not belong to this record.");
		}
		return {
			assetVersionId: unit.assetVersionId,
			id: unit.id,
			sourceAssetVersionId: unit.sourceAssetVersionId,
			unitKey: unit.unitKey,
			unitType: unit.unitType,
			versionNumber: unit.versionNumber,
		};
	});

	if (request.correction && !data.correctionSpace) {
		throw new Error(correctionErrors.draftUnavailable);
	}
	const correction =
		request.correction && data.correctionSpace
			? buildCorrection(
					request.correction,
					data.correctionSpace,
					assetRecord.id,
					assetVersionCatalog,
					request.lockedUnitVersionIds
				)
			: undefined;

	const referenceRoles: GenerationPackage["referenceRoles"] = [
		...data.tracking.references.map((reference) => ({
			assetRecordId: reference.assetRecordId,
			assetRecordName: reference.assetRecordName,
			assetVersionId: reference.versionId,
			contentDigest: null,
			contentType: null,
			contextOverrideRationale: reference.contextOverrideRationale ?? null,
			customPurpose: reference.customPurpose ?? null,
			fileName: null,
			forbiddenFeatures: reference.forbiddenFeatures,
			id: reference.id,
			kind: "asset_version" as const,
			notes: reference.notes,
			role: reference.role,
			transferredFeatures: reference.transferredFeatures,
			versionNumber: reference.versionNumber,
		})),
		...data.referenceBoardImages.map((reference) => ({
			assetRecordId: reference.assetRecordId,
			assetRecordName: null,
			assetVersionId: null,
			contentDigest: reference.sha256,
			contentType: reference.contentType,
			contextOverrideRationale: reference.contextOverrideRationale,
			customPurpose: reference.customPurpose,
			fileName: reference.fileName,
			forbiddenFeatures: reference.forbiddenFeatures,
			id: reference.id,
			kind: "reference_image" as const,
			notes: reference.notes,
			role: reference.role,
			transferredFeatures: reference.transferredFeatures,
			versionNumber: null,
		})),
	];

	const visualWorld = assetRecord.visualWorldId
		? data.projectContextScopeCatalog.visualWorlds.find(
				(world) => world.id === assetRecord.visualWorldId
			)
		: null;
	const theme = assetRecord.themeId
		? data.projectContextScopeCatalog.themes.find(
				(entry) => entry.id === assetRecord.themeId
			)
		: null;
	if (
		(assetRecord.visualWorldId && !visualWorld) ||
		(assetRecord.themeId && !theme)
	) {
		throw new Error("The Asset Record context scope could not be resolved.");
	}

	return generationPackageSnapshotSchema.parse({
		assetRecord,
		avoidConstraints: request.avoidConstraints,
		canonicalDesign,
		changeConstraints: request.changeConstraints,
		correction,
		expectedOutputStructure: request.expectedOutputStructure,
		lockedUnits,
		preserveConstraints: request.preserveConstraints,
		productionContextSnapshot: {
			contextRevisionId: activeRevision.id,
			generalArtDirection: projectContext.generalArtDirection,
			ruleContractVersion: activeRevision.ruleContractVersion,
			rules,
			revisionNumber: activeRevision.revisionNumber,
			theme: theme ?? null,
			visualWorld: visualWorld ?? null,
		},
		referenceRoles,
		targetDimensions: data.correctionSpace
			? {
					height: data.correctionSpace.height,
					width: data.correctionSpace.width,
				}
			: request.targetDimensions,
		targetTask: request.targetTask,
	});
}

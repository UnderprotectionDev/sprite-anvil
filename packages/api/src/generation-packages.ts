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
import type { ProjectContext } from "./project-context";
import { projectContextSchema } from "./project-context";
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

const contextRulesSchema =
	projectContextSchema.shape.currentContextRevision.shape.rules;

export const generationPackageSnapshotSchema = z
	.object({
		assetRecord: assetRecordSchema,
		avoidConstraints: constraintListSchema,
		canonicalDesign: canonicalDesignSnapshotSchema.nullable(),
		changeConstraints: constraintListSchema,
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
		expectedOutputStructure: z.string().trim().min(1).max(2000),
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

export function createGenerationPackageSnapshot(data: {
	assetRecord: AssetRecord;
	assetVersionCatalog: AssetVersionCatalog;
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

	const sourceAssetRecordIdsByVersionId = new Map(
		assetVersionCatalog.assetVersions.map((version) => [
			version.id,
			version.assetRecordId,
		])
	);
	const referenceRoles: GenerationPackage["referenceRoles"] = [
		...data.tracking.references.map((reference) => ({
			assetRecordId:
				sourceAssetRecordIdsByVersionId.get(reference.versionId) ?? null,
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
		targetDimensions: request.targetDimensions,
		targetTask: request.targetTask,
	});
}

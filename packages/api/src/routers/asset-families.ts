import { ORPCError } from "@orpc/server";
import type { AssetFamilyCatalogScope } from "../asset-families";
import {
	assetFamilyCatalogSchema,
	assetFamilyCreateInputSchema,
	assetFamilyListInputSchema,
	assetFamilyRecordSchema,
	assetFamilyRelationshipCreateInputSchema,
	assetFamilyRelationshipSchema,
	assetRecordCreateInputSchema,
	assetRecordSchema,
	subjectIdentityCreateInputSchema,
	subjectIdentityRecordSchema,
} from "../asset-families";
import type { Context } from "../context";
import { protectedProcedure } from "../index";

async function readCatalog(
	context: Context,
	projectId: string,
	scope?: AssetFamilyCatalogScope
) {
	const catalog = await context.assetFamilyStore.list(
		context.session?.user.id ?? "",
		projectId,
		scope
	);
	if (!catalog) {
		throw new ORPCError("NOT_FOUND", { message: "Project not found" });
	}
	return assetFamilyCatalogSchema.parse(catalog);
}

export const assetFamiliesRouter = {
	list: protectedProcedure
		.input(assetFamilyListInputSchema)
		.output(assetFamilyCatalogSchema)
		.handler(async ({ context, input }) =>
			readCatalog(context, input.projectId, input.scope)
		),
	createSubjectIdentity: protectedProcedure
		.input(subjectIdentityCreateInputSchema)
		.output(subjectIdentityRecordSchema)
		.handler(async ({ context, input }) => {
			await readCatalog(context, input.projectId);
			const identity = await context.assetFamilyStore.createSubjectIdentity(
				context.session.user.id,
				input
			);
			if (!identity) {
				throw new ORPCError("CONFLICT", {
					message: "This Asset Identity already exists in the Project.",
				});
			}
			return subjectIdentityRecordSchema.parse(identity);
		}),
	createAssetFamily: protectedProcedure
		.input(assetFamilyCreateInputSchema)
		.output(assetFamilyRecordSchema)
		.handler(async ({ context, input }) => {
			const [catalog, scopes] = await Promise.all([
				readCatalog(context, input.projectId),
				context.projectContextScopeStore.list(
					context.session.user.id,
					input.projectId
				),
			]);
			if (
				!catalog.subjectIdentities.some(
					(item) => item.id === input.subjectIdentityId
				)
			) {
				throw new ORPCError("NOT_FOUND", {
					message: "Asset Identity not found in this Project.",
				});
			}
			if (!scopes) {
				throw new ORPCError("NOT_FOUND", { message: "Project not found" });
			}
			if (
				!scopes.visualWorlds.some((item) => item.id === input.visualWorldId)
			) {
				throw new ORPCError("NOT_FOUND", {
					message: "Visual World not found in this Project.",
				});
			}
			const family = await context.assetFamilyStore.createAssetFamily(
				context.session.user.id,
				input
			);
			if (!family) {
				throw new ORPCError("CONFLICT", {
					message:
						"An Asset Family with this name already exists under this Asset Identity.",
				});
			}
			return assetFamilyRecordSchema.parse(family);
		}),
	createAssetRecord: protectedProcedure
		.input(assetRecordCreateInputSchema)
		.output(assetRecordSchema)
		.handler(async ({ context, input }) => {
			const catalog = await readCatalog(context, input.projectId);
			if (
				!catalog.assetFamilies.some((item) => item.id === input.assetFamilyId)
			) {
				throw new ORPCError("NOT_FOUND", {
					message: "Asset Family not found in this Project.",
				});
			}
			const assetRecord = await context.assetFamilyStore.createAssetRecord(
				context.session.user.id,
				input
			);
			if (!assetRecord) {
				throw new ORPCError("CONFLICT", {
					message:
						"An Asset Record with this name already exists in this Asset Family.",
				});
			}
			return assetRecordSchema.parse(assetRecord);
		}),
	createRelationship: protectedProcedure
		.input(assetFamilyRelationshipCreateInputSchema)
		.output(assetFamilyRelationshipSchema)
		.handler(async ({ context, input }) => {
			const catalog = await readCatalog(context, input.projectId);
			if (
				!catalog.assetFamilies.some((item) => item.id === input.assetFamilyId)
			) {
				throw new ORPCError("NOT_FOUND", {
					message: "Asset Family not found in this Project.",
				});
			}
			const source = catalog.assetRecords.find(
				(item) => item.id === input.sourceAssetRecordId
			);
			const target = catalog.assetRecords.find(
				(item) => item.id === input.targetAssetRecordId
			);
			if (!(source && target)) {
				throw new ORPCError("NOT_FOUND", {
					message: "Asset Record selected for the relationship was not found.",
				});
			}
			if (
				source.assetFamilyId !== input.assetFamilyId ||
				target.assetFamilyId !== input.assetFamilyId ||
				source.id === target.id
			) {
				throw new ORPCError("BAD_REQUEST", {
					message:
						"Choose two different Asset Records in the same Asset Family for the relationship.",
				});
			}
			if (input.type === "derivative") {
				const versionCatalog = await context.assetVersionStore.list(
					context.session.user.id,
					input.projectId
				);
				if (!versionCatalog) {
					throw new ORPCError("NOT_FOUND", { message: "Project not found" });
				}
				const sourceVersion = versionCatalog.assetVersions.find(
					(item) => item.id === input.sourceAssetVersionId
				);
				const currentCanonicalDesign = versionCatalog.canonicalDesigns
					.filter((item) => item.assetFamilyId === input.assetFamilyId)
					.at(-1);
				if (
					!sourceVersion ||
					sourceVersion.assetFamilyId !== input.assetFamilyId ||
					sourceVersion.assetRecordId !== input.sourceAssetRecordId ||
					!sourceVersion.integrityVerified ||
					!sourceVersion.contentDigest ||
					sourceVersion.reviewDisposition !== "approved" ||
					currentCanonicalDesign?.assetVersionId !== sourceVersion.id
				) {
					throw new ORPCError("BAD_REQUEST", {
						message:
							"The source for a Derived Asset must be the approved Canonical Design Version in the same family.",
					});
				}
				if (
					!(await context.verifyAssetVersionContent?.(
						context.session.user.id,
						input.projectId,
						sourceVersion.id
					))
				) {
					throw new ORPCError("BAD_REQUEST", {
						message:
							"The Canonical Design Version must pass integrity verification for a Derived Asset.",
					});
				}
			}
			const relationship = await context.assetFamilyStore.createRelationship(
				context.session.user.id,
				input
			);
			if (!relationship) {
				throw new ORPCError("CONFLICT", {
					message: "This relationship already exists in the Asset Family.",
				});
			}
			return assetFamilyRelationshipSchema.parse(relationship);
		}),
};

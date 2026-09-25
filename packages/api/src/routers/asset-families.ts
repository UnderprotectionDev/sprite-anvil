import { ORPCError } from "@orpc/server";
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

async function readCatalog(context: Context, projectId: string) {
	const catalog = await context.assetFamilyStore.list(
		context.session?.user.id ?? "",
		projectId
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
			readCatalog(context, input.projectId)
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
					message: "Bu Projede aynı Varlık Kimliği zaten var.",
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
					message: "Bu Projede Varlık Kimliği bulunamadı.",
				});
			}
			if (!scopes) {
				throw new ORPCError("NOT_FOUND", { message: "Project not found" });
			}
			if (
				!scopes.visualWorlds.some((item) => item.id === input.visualWorldId)
			) {
				throw new ORPCError("NOT_FOUND", {
					message: "Bu Projede Görsel Dünya bulunamadı.",
				});
			}
			const family = await context.assetFamilyStore.createAssetFamily(
				context.session.user.id,
				input
			);
			if (!family) {
				throw new ORPCError("CONFLICT", {
					message:
						"Bu Varlık Kimliğinde aynı adda bir Varlık Ailesi zaten var.",
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
					message: "Bu Projede Varlık Ailesi bulunamadı.",
				});
			}
			const assetRecord = await context.assetFamilyStore.createAssetRecord(
				context.session.user.id,
				input
			);
			if (!assetRecord) {
				throw new ORPCError("CONFLICT", {
					message: "Bu Varlık Ailesinde aynı adda bir Varlık Kaydı zaten var.",
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
					message: "Bu Projede Varlık Ailesi bulunamadı.",
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
					message: "İlişki için seçilen Varlık Kaydı bulunamadı.",
				});
			}
			if (
				source.assetFamilyId !== input.assetFamilyId ||
				target.assetFamilyId !== input.assetFamilyId ||
				source.id === target.id
			) {
				throw new ORPCError("BAD_REQUEST", {
					message:
						"İlişkinin iki Varlık Kaydı da aynı Varlık Ailesinde olmalı ve farklı kayıtlar seçilmelidir.",
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
							"Türetilmiş Varlık için seçilen kaynak, aynı ailedeki onaylı Ana Tasarım Sürümü olmalıdır.",
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
							"Türetilmiş Varlık için Ana Tasarım Sürümünün bütünlüğü doğrulanmalıdır.",
					});
				}
			}
			const relationship = await context.assetFamilyStore.createRelationship(
				context.session.user.id,
				input
			);
			if (!relationship) {
				throw new ORPCError("CONFLICT", {
					message: "Bu ilişki Varlık Ailesinde zaten kayıtlı.",
				});
			}
			return assetFamilyRelationshipSchema.parse(relationship);
		}),
};

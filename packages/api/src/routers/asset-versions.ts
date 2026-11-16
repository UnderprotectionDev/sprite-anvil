import { ORPCError } from "@orpc/server";
import {
	assetFamilyCanonicalDesignInputSchema,
	assetFamilyCanonicalDesignSchema,
	assetVersionBatchReviewInputSchema,
	assetVersionBatchReviewPreviewInputSchema,
	assetVersionBatchReviewPreviewSchema,
	assetVersionBatchReviewResultSchema,
	assetVersionCatalogSchema,
	assetVersionListInputSchema,
	assetVersionReviewEventSchema,
	assetVersionReviewInputSchema,
	compositeVersionCreateInputSchema,
	compositeVersionReviewEventSchema,
	compositeVersionReviewInputSchema,
	compositeVersionSchema,
} from "../asset-versions";
import { previewBatchReview } from "../batch-version-review";
import type { Context } from "../context";
import { protectedProcedure } from "../index";
import { recordRepairedReview } from "../measurement-review-lineage";
import { recordProductBoundary } from "../measurement-workflows";
import {
	manualImportEvidenceInputSchema,
	manualImportEvidenceSummarySchema,
} from "../production-provenance";
import {
	providerGenerationRecordCreateInputSchema,
	providerGenerationRecordSchema,
} from "../provider-generation-records";
import { withPublicationErrors } from "../record-publication";

async function readVersionCatalog(context: Context, projectId: string) {
	const userId = context.session?.user.id ?? "";
	const [catalog, providerGenerationRecords] = await Promise.all([
		context.assetVersionStore.list(userId, projectId),
		context.providerGenerationRecordStore?.list(userId, projectId) ?? [],
	]);
	if (!(catalog && providerGenerationRecords)) {
		throw new ORPCError("NOT_FOUND", { message: "Project not found" });
	}
	const recordsByAssetVersionId = new Map(
		providerGenerationRecords.map((record) => [record.assetVersionId, record])
	);
	return assetVersionCatalogSchema.parse({
		...catalog,
		assetVersions: catalog.assetVersions.map((version) => ({
			...version,
			providerGenerationRecord: recordsByAssetVersionId.get(version.id) ?? null,
		})),
	});
}

function assertApprovalEvidenceComplete(
	decision: "approved" | "candidate" | "rejected",
	version: Awaited<
		ReturnType<typeof readVersionCatalog>
	>["assetVersions"][number]
) {
	if (
		decision === "approved" &&
		version.productionEvidence.evidenceLevel === "incomplete"
	) {
		throw new ORPCError("BAD_REQUEST", {
			message:
				version.productionEvidence.sourceKind === "external_working_file_edit"
					? "Save a Managed Snapshot of the editable working file before approval."
					: "Record the Generation Package, actual instruction, and source surface for Manual Import Evidence before approval.",
		});
	}
	if (
		decision === "approved" &&
		version.productionSource === "connected_provider" &&
		!version.providerGenerationRecord
	) {
		throw new ORPCError("BAD_REQUEST", {
			message:
				"A connected-provider result needs its Provider Generation Record before approval.",
		});
	}
}

export const assetVersionsRouter = {
	previewBatchReview: protectedProcedure
		.input(assetVersionBatchReviewPreviewInputSchema)
		.output(assetVersionBatchReviewPreviewSchema)
		.handler(async ({ context, input }) =>
			previewBatchReview(
				context,
				input,
				await readVersionCatalog(context, input.projectId)
			)
		),
	reviewBatch: protectedProcedure
		.input(assetVersionBatchReviewInputSchema)
		.output(assetVersionBatchReviewResultSchema)
		.handler(async ({ context, input }) => {
			const existing = await context.assetVersionStore.readBatchReviewEvents(
				context.session.user.id,
				input
			);
			if (existing === "conflict") {
				throw new ORPCError("CONFLICT", {
					message:
						"This batch review request was already used for different decisions.",
				});
			}
			if (existing) {
				return { reviewEvents: existing };
			}
			const catalog = await readVersionCatalog(context, input.projectId);
			const preview = await previewBatchReview(
				context,
				{
					...input,
					assetVersionIds: input.targets.map((target) => target.assetVersionId),
				},
				catalog
			);
			if (
				preview.items.some(
					(item, index) =>
						item.expectedReviewEventId !==
						input.targets[index]?.expectedReviewEventId
				)
			) {
				throw new ORPCError("CONFLICT", {
					message: "Review decisions changed. Reload the preview.",
				});
			}
			const blocked = preview.items.filter((item) => item.blockers.length > 0);
			if (blocked.length > 0) {
				throw new ORPCError("BAD_REQUEST", {
					message: `No Review Event was written: ${blocked.map((item) => `${item.assetVersionId}: ${item.blockers.join(", ")}`).join("; ")}`,
				});
			}
			const events = await context.assetVersionStore.recordBatchReviewEvents(
				context.session.user.id,
				input
			);
			if (!events) {
				throw new ORPCError("CONFLICT", {
					message: "Batch review could not be completed. Reload the preview.",
				});
			}
			await Promise.all(
				events.map((event) =>
					recordRepairedReview(context, input.projectId, catalog, {
						kind: "asset",
						id: event.assetVersionId,
					})
				)
			);
			return { reviewEvents: events };
		}),
	list: protectedProcedure
		.input(assetVersionListInputSchema)
		.output(assetVersionCatalogSchema)
		.handler(async ({ context, input }) =>
			readVersionCatalog(context, input.projectId)
		),
	recordProviderGeneration: protectedProcedure
		.input(providerGenerationRecordCreateInputSchema)
		.output(providerGenerationRecordSchema)
		.handler(async ({ context, input }) => {
			const store = context.providerGenerationRecordStore;
			if (!store) {
				throw new ORPCError("INTERNAL_SERVER_ERROR", {
					message: "Provider Generation Record storage is unavailable.",
				});
			}
			const result = await store.create(context.session.user.id, input);
			if (!result) {
				throw new ORPCError("NOT_FOUND", {
					message: "Provider result not found",
				});
			}
			if (result.kind === "not-provider-result") {
				throw new ORPCError("BAD_REQUEST", {
					message:
						"Provider Generation Record only applies to provider-sourced results.",
				});
			}
			if (result.kind === "conflict") {
				throw new ORPCError("CONFLICT", {
					message:
						"This provider result already has a different Provider Generation Record.",
				});
			}
			return providerGenerationRecordSchema.parse(result.record);
		}),
	createCompositeVersion: protectedProcedure
		.input(compositeVersionCreateInputSchema)
		.output(compositeVersionSchema)
		.handler(async ({ context, input }) => {
			const result = await context.assetVersionStore.createCompositeVersion(
				context.session.user.id,
				input
			);
			if (!result) {
				throw new ORPCError("NOT_FOUND", {
					message: "Project or Asset Record not found.",
				});
			}
			if (result.kind === "invalid-unit-versions") {
				throw new ORPCError("BAD_REQUEST", {
					message:
						"Selected Unit Versions do not belong to this Asset Record or select the same composition slot more than once.",
				});
			}
			if (result.kind === "idempotency-conflict") {
				throw new ORPCError("CONFLICT", {
					message:
						"This Composite Version creation key was already used with different members.",
				});
			}
			return compositeVersionSchema.parse(result.compositeVersion);
		}),
	reviewCompositeVersion: protectedProcedure
		.input(compositeVersionReviewInputSchema)
		.output(compositeVersionReviewEventSchema)
		.handler(async ({ context, input }) => {
			// A keyed repeat returns the first result before any state-based check
			// can turn it into a failure.
			const replayed = input.idempotencyKey
				? await withPublicationErrors(() =>
						context.assetVersionStore.replayCompositeVersionReviewEvent(
							context.session.user.id,
							input
						)
					)
				: null;
			if (replayed) {
				return compositeVersionReviewEventSchema.parse(replayed);
			}
			const catalog = await readVersionCatalog(context, input.projectId);
			const compositeVersion = catalog.compositeVersions.find(
				(item) => item.id === input.compositeVersionId
			);
			if (!compositeVersion) {
				throw new ORPCError("NOT_FOUND", {
					message: "Composite Version not found.",
				});
			}
			if (compositeVersion.reviewDisposition === input.decision) {
				throw new ORPCError("BAD_REQUEST", {
					message:
						"This is already the current Composite Version review decision.",
				});
			}
			const event = await withPublicationErrors(() =>
				context.assetVersionStore.recordCompositeVersionReviewEvent(
					context.session.user.id,
					input
				)
			);
			if (!event) {
				throw new ORPCError("CONFLICT", {
					message:
						"The Composite Version was reviewed in the meantime. Reload the current state.",
				});
			}
			await recordRepairedReview(context, input.projectId, catalog, {
				kind: "composite",
				id: input.compositeVersionId,
			});
			return compositeVersionReviewEventSchema.parse(event);
		}),
	review: protectedProcedure
		.input(assetVersionReviewInputSchema)
		.output(assetVersionReviewEventSchema)
		.handler(async ({ context, input }) => {
			const replayed = input.idempotencyKey
				? await withPublicationErrors(() =>
						context.assetVersionStore.replayReviewEvent(
							context.session.user.id,
							input
						)
					)
				: null;
			if (replayed) {
				return assetVersionReviewEventSchema.parse(replayed);
			}
			const catalog = await readVersionCatalog(context, input.projectId);
			const version = catalog.assetVersions.find(
				(item) => item.id === input.assetVersionId
			);
			if (!version) {
				throw new ORPCError("NOT_FOUND", {
					message: "Asset Version not found.",
				});
			}
			if (version.reviewDisposition === input.decision) {
				throw new ORPCError("BAD_REQUEST", {
					message: "This is already the current Asset Version review decision.",
				});
			}
			assertApprovalEvidenceComplete(input.decision, version);
			if (
				input.decision === "approved" &&
				!(version.integrityVerified && version.contentDigest)
			) {
				throw new ORPCError("BAD_REQUEST", {
					message:
						"An Asset Version cannot be approved before integrity verification completes.",
				});
			}
			if (
				input.decision === "approved" &&
				(version.sourceKind === "manual_import" ||
					version.sourceKind === "legacy_asset")
			) {
				const tracking = await context.assetRecordTrackingStore.getTracking(
					context.session.user.id,
					input.projectId,
					version.assetRecordId
				);
				const evidenceRequired =
					version.sourceKind === "manual_import" ||
					!tracking ||
					tracking.tracking.manualImportEvidenceRequiredVersionIds.includes(
						version.id
					);
				const hasEvidence = tracking?.tracking.manualImportEvidence?.some(
					(evidence) => evidence.assetVersionId === version.id
				);
				if (evidenceRequired && !hasEvidence) {
					throw new ORPCError("BAD_REQUEST", {
						message:
							"A Candidate Version cannot be approved until Manual Import Evidence is complete.",
					});
				}
			}
			if (
				input.decision === "approved" &&
				!(await context.verifyAssetVersionContent?.(
					context.session.user.id,
					input.projectId,
					input.assetVersionId
				))
			) {
				throw new ORPCError("BAD_REQUEST", {
					message:
						"The stored Asset Version cannot be approved because integrity verification failed.",
				});
			}
			const event = await withPublicationErrors(() =>
				context.assetVersionStore.recordReviewEvent(
					context.session.user.id,
					input
				)
			);
			if (!event) {
				throw new ORPCError("CONFLICT", {
					message:
						"The Asset Version was reviewed in the meantime. Reload the current state.",
				});
			}
			if ("kind" in event && event.kind === "approval-blocked") {
				throw new ORPCError("BAD_REQUEST", {
					message: `Complete the required quality evidence for approval: ${event.blockers.join(", ")}`,
				});
			}
			await recordRepairedReview(context, input.projectId, catalog, {
				kind: "asset",
				id: input.assetVersionId,
			});
			return assetVersionReviewEventSchema.parse(event);
		}),
	saveManualImportEvidence: protectedProcedure
		.input(manualImportEvidenceInputSchema)
		.output(manualImportEvidenceSummarySchema)
		.handler(async ({ context, input }) => {
			const result = await context.assetVersionStore.saveManualImportEvidence(
				context.session.user.id,
				input
			);
			if (result.kind === "not-found") {
				throw new ORPCError("NOT_FOUND", {
					message: "Candidate Asset Version or Project not found.",
				});
			}
			if (result.kind === "not-manual-import") {
				throw new ORPCError("BAD_REQUEST", {
					message:
						"Manual Import Evidence can only be added to a manually imported version.",
				});
			}
			if (result.kind === "not-candidate") {
				throw new ORPCError("PRECONDITION_FAILED", {
					message:
						"Manual Import Evidence can only be updated for a Candidate Version.",
				});
			}
			if (result.kind === "package-not-found") {
				throw new ORPCError("BAD_REQUEST", {
					message:
						"The selected Generation Package does not belong to this Asset Record.",
				});
			}
			if (result.kind === "conflict") {
				throw new ORPCError("CONFLICT", {
					message:
						"The evidence changed concurrently. Reload the version state and try again.",
				});
			}
			const evidence = manualImportEvidenceSummarySchema.parse(result.evidence);
			await recordProductBoundary(context, {
				userId: context.session.user.id,
				projectId: input.projectId,
				workflowId: input.generationPackageId,
				eventFamily: "production_workflow",
				eventName: "candidate_preview_reached",
				phase: "finish",
				recordKind: "asset_version",
				outcomeClass: "preview_reached",
				counters: {},
			});
			return evidence;
		}),
	selectCanonicalDesign: protectedProcedure
		.input(assetFamilyCanonicalDesignInputSchema)
		.output(assetFamilyCanonicalDesignSchema)
		.handler(async ({ context, input }) => {
			const [familyCatalog, versionCatalog] = await Promise.all([
				context.assetFamilyStore.list(context.session.user.id, input.projectId),
				readVersionCatalog(context, input.projectId),
			]);
			if (
				!familyCatalog?.assetFamilies.some(
					(item) => item.id === input.assetFamilyId
				)
			) {
				throw new ORPCError("NOT_FOUND", {
					message: "Asset Family not found in this Project.",
				});
			}
			const version = versionCatalog.assetVersions.find(
				(item) => item.id === input.assetVersionId
			);
			if (!version || version.assetFamilyId !== input.assetFamilyId) {
				throw new ORPCError("BAD_REQUEST", {
					message:
						"Only an Asset Version in the same Asset Family can be selected as the Canonical Design.",
				});
			}
			if (version.reviewDisposition !== "approved") {
				throw new ORPCError("BAD_REQUEST", {
					message:
						"Only an approved Asset Version can be selected as the Canonical Design.",
				});
			}
			if (
				!(
					version.integrityVerified &&
					version.contentDigest &&
					(await context.verifyAssetVersionContent?.(
						context.session.user.id,
						input.projectId,
						input.assetVersionId
					))
				)
			) {
				throw new ORPCError("BAD_REQUEST", {
					message:
						"An Asset Version without verified integrity cannot be the Canonical Design.",
				});
			}
			const selection = await context.assetVersionStore.selectCanonicalDesign(
				context.session.user.id,
				input
			);
			if (!selection) {
				throw new ORPCError("CONFLICT", {
					message:
						"The Canonical Design selection changed. Reload the current state.",
				});
			}
			return assetFamilyCanonicalDesignSchema.parse(selection);
		}),
};

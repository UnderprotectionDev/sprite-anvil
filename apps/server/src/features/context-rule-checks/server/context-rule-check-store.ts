import { createHash } from "node:crypto";
import type { AssetVersionStore } from "@sprite-anvil/api/asset-versions";
import type {
	ColourMergeOutcome,
	ColourMergePreview,
	ContextRuleCheckItem,
	ContextRuleCheckStore,
	ContextRuleLimits,
} from "@sprite-anvil/api/context-rule-checks";
import {
	contextRuleCheckOverviewSchema,
	measuredColourSchema,
} from "@sprite-anvil/api/context-rule-checks";
import type { ProjectContextScopeStore } from "@sprite-anvil/api/context-scopes";
import type { FamilyReadinessStore } from "@sprite-anvil/api/family-readiness";
import type { ProjectContextStore } from "@sprite-anvil/api/project-context";
import type { Database } from "@sprite-anvil/db";
import { assetRecords } from "@sprite-anvil/db/schema/asset-records";
import {
	assetVersionReviewEvents,
	assetVersions,
} from "@sprite-anvil/db/schema/asset-versions";
import {
	colourMerges,
	contextRuleMeasurements,
} from "@sprite-anvil/db/schema/context-rule-checks";
import { and, asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import type { TwoDVisualAssetStorage } from "../../../cloudflare";
import { createProjectAssetVersionObjectKey } from "../../../cloudflare";
import type { VersionReview } from "./checked-versions";
import { resolveRuleLimits, selectCheckedVersion } from "./checked-versions";
import { applyColourMerge, proposeColourMerge } from "./colour-merge";
import type { PixelMeasurement } from "./pixel-measurement";
import { measureRaster, pixelMeasurementVersion } from "./pixel-measurement";
import { decodeRaster, encodePng } from "./raster-codec";
import { evaluateContextRules } from "./rule-evaluation";

export interface ContextRuleCheckDependencies {
	assetVersionStore: Pick<AssetVersionStore, "createCandidateVersion">;
	createStorage: () => TwoDVisualAssetStorage;
	familyReadinessStore: Pick<FamilyReadinessStore, "list">;
	projectContextScopeStore: Pick<ProjectContextScopeStore, "list">;
	projectContextStore: Pick<ProjectContextStore, "listProjects">;
}

/** Stored images read at once while measuring. */
const readConcurrency = 8;
const fileExtensionPattern = /\.[^.]+$/u;

type VersionRow = typeof assetVersions.$inferSelect;
type RecordRow = typeof assetRecords.$inferSelect;

function sha256(bytes: Uint8Array | string) {
	return createHash("sha256").update(bytes).digest("hex");
}

export function createContextRuleCheckStore(
	db: Database,
	dependencies: ContextRuleCheckDependencies
): ContextRuleCheckStore {
	/** Ownership, the Active Context Revision and the scope catalog. */
	async function readProject(userId: string, projectId: string) {
		const project = (
			await dependencies.projectContextStore.listProjects(userId)
		).find((item) => item.id === projectId);
		if (!project) {
			return null;
		}
		const catalog = await dependencies.projectContextScopeStore.list(
			userId,
			projectId
		);
		return catalog
			? { catalog, revision: project.currentContextRevision }
			: null;
	}

	/** Verified stored pixels, or null when the content cannot be trusted. */
	async function readRaster(version: VersionRow) {
		try {
			const object = await dependencies.createStorage().get(version.objectKey);
			if (!object?.body) {
				return null;
			}
			const bytes = new Uint8Array(
				await new Response(object.body).arrayBuffer()
			);
			return sha256(bytes) === version.contentDigest
				? await decodeRaster(bytes)
				: null;
		} catch {
			return null;
		}
	}

	async function measureVersions(projectId: string, versions: VersionRow[]) {
		const measurements = new Map<string, PixelMeasurement>();
		if (versions.length === 0) {
			return measurements;
		}
		const cached = await db
			.select()
			.from(contextRuleMeasurements)
			.where(
				and(
					eq(contextRuleMeasurements.projectId, projectId),
					eq(
						contextRuleMeasurements.measurementVersion,
						pixelMeasurementVersion
					),
					inArray(
						contextRuleMeasurements.assetVersionId,
						versions.map((version) => version.id)
					)
				)
			);
		for (const row of cached) {
			const version = versions.find((item) => item.id === row.assetVersionId);
			if (version?.contentDigest === row.contentDigest) {
				measurements.set(row.assetVersionId, {
					colours: z.array(measuredColourSchema).parse(row.colours),
					outlineWidth: row.outlineWidth,
				});
			}
		}
		const missing = versions.filter((version) => !measurements.has(version.id));
		for (let start = 0; start < missing.length; start += readConcurrency) {
			// biome-ignore lint/performance/noAwaitInLoops: batches bound concurrent storage reads.
			await Promise.all(
				missing.slice(start, start + readConcurrency).map(async (version) => {
					const raster = await readRaster(version);
					if (!(raster && version.contentDigest)) {
						return;
					}
					const measurement = measureRaster(raster);
					measurements.set(version.id, measurement);
					await db
						.insert(contextRuleMeasurements)
						.values({
							projectId,
							assetVersionId: version.id,
							measurementVersion: pixelMeasurementVersion,
							contentDigest: version.contentDigest,
							colours: measurement.colours,
							outlineWidth: measurement.outlineWidth,
						})
						.onConflictDoNothing();
				})
			);
		}
		return measurements;
	}

	async function readQaBlockedVersions(
		userId: string,
		projectId: string,
		records: RecordRow[]
	) {
		const familyIds = new Set(
			records.flatMap((record) => record.assetFamilyId ?? [])
		);
		const families = await Promise.all(
			[...familyIds].map((familyId) =>
				dependencies.familyReadinessStore.list(userId, projectId, familyId)
			)
		);
		return new Set(
			families.flatMap((family) =>
				(family?.items ?? [])
					.filter((item) => item.qualityReadiness === "blocked")
					.flatMap((item) => item.currentAssetVersionIds)
			)
		);
	}

	function readActiveRecords(projectId: string) {
		return db
			.select()
			.from(assetRecords)
			.where(
				and(
					eq(assetRecords.projectId, projectId),
					eq(assetRecords.availability, "active")
				)
			)
			.orderBy(asc(assetRecords.name), asc(assetRecords.id));
	}

	async function readCheckedVersions(projectId: string) {
		const [records, versions, reviews] = await Promise.all([
			readActiveRecords(projectId),
			db
				.select()
				.from(assetVersions)
				.where(eq(assetVersions.projectId, projectId)),
			db
				.select()
				.from(assetVersionReviewEvents)
				.where(eq(assetVersionReviewEvents.projectId, projectId)),
		]);
		const versionReviews: VersionReview[] = reviews.map((review) => ({
			id: review.id,
			versionId: review.versionId,
			decision: review.decision,
			createdAt: new Date(review.createdAt),
		}));
		return records.flatMap((record) => {
			const checked = selectCheckedVersion(
				versions.filter((version) => version.assetRecordId === record.id),
				versionReviews
			);
			return checked ? [{ record, ...checked }] : [];
		});
	}

	async function overview(userId: string, projectId: string) {
		const project = await readProject(userId, projectId);
		if (!project) {
			return null;
		}
		const checked = await readCheckedVersions(projectId);
		const [measurements, blocked] = await Promise.all([
			measureVersions(
				projectId,
				checked.map((item) => item.version)
			),
			readQaBlockedVersions(
				userId,
				projectId,
				checked.map((item) => item.record)
			),
		]);
		const items = checked.map(
			({ record, version, reviewDisposition }): ContextRuleCheckItem => {
				const measurement = measurements.get(version.id);
				const qaBlocked = blocked.has(version.id);
				const evaluation = measurement
					? evaluateContextRules(measurement, {
							limits: resolveRuleLimits(
								projectId,
								record,
								project.revision.rules,
								project.catalog
							),
							qaBlocked,
						})
					: null;
				return {
					assetRecordId: record.id,
					name: record.name,
					assetCategory: record.assetCategory,
					assetVersionId: version.id,
					versionNumber: version.versionNumber,
					reviewDisposition,
					status: measurement ? "checked" : "unreadable",
					qaBlocked,
					colours: measurement?.colours ?? [],
					results: evaluation?.results ?? [],
					merge: evaluation?.merge
						? {
								steps: evaluation.merge.steps,
								changesBoundary: evaluation.merge.changesBoundary,
								colourCount: evaluation.merge.colourCount,
							}
						: null,
				};
			}
		);
		return contextRuleCheckOverviewSchema.parse({
			projectId,
			contextRevisionId: project.revision.id,
			revisionNumber: project.revision.revisionNumber,
			items,
		});
	}

	/** The merge of one exact version under the Active Context Revision. */
	async function renderMerge(
		userId: string,
		input: {
			projectId: string;
			assetVersionId: string;
			targets: Record<string, string>;
		}
	): Promise<
		ColourMergeOutcome<{
			preview: ColourMergePreview;
			png: Uint8Array<ArrayBuffer>;
			record: RecordRow;
			version: VersionRow;
		}>
	> {
		const project = await readProject(userId, input.projectId);
		if (!project) {
			return { ok: false, reason: "not_found" };
		}
		const [row] = await db
			.select({ record: assetRecords, version: assetVersions })
			.from(assetVersions)
			.innerJoin(assetRecords, eq(assetRecords.id, assetVersions.assetRecordId))
			.where(
				and(
					eq(assetVersions.projectId, input.projectId),
					eq(assetVersions.id, input.assetVersionId),
					eq(assetRecords.availability, "active")
				)
			)
			.limit(1);
		if (!row) {
			return { ok: false, reason: "not_found" };
		}
		const raster = await readRaster(row.version);
		if (!raster) {
			return { ok: false, reason: "unreadable" };
		}
		const limits: ContextRuleLimits = resolveRuleLimits(
			input.projectId,
			row.record,
			project.revision.rules,
			project.catalog
		);
		const measurement = measureRaster(raster);
		if (
			limits.maxColours === undefined ||
			measurement.colours.length <= limits.maxColours
		) {
			return { ok: false, reason: "nothing_to_merge" };
		}
		const proposal = proposeColourMerge(
			measurement.colours,
			limits.maxColours,
			input.targets
		);
		if (
			!(
				proposal.ok &&
				Object.keys(input.targets).every((source) =>
					proposal.steps.some((step) => step.source === source)
				)
			)
		) {
			return { ok: false, reason: "invalid_target" };
		}
		const merged = applyColourMerge(raster, proposal.steps);
		const png = await encodePng(merged);
		return {
			ok: true,
			value: {
				png,
				record: row.record,
				version: row.version,
				preview: {
					assetVersionId: row.version.id,
					contextRevisionId: project.revision.id,
					steps: proposal.steps,
					changesBoundary: proposal.changesBoundary,
					colourCount: proposal.colourCount,
					outlineWidth: measureRaster(merged).outlineWidth,
					imageDataUrl: `data:image/png;base64,${Buffer.from(png).toString("base64")}`,
				},
			},
		};
	}

	return {
		overview,

		async recheck(userId, projectId, assetRecordIds) {
			if (!(await readProject(userId, projectId))) {
				return null;
			}
			const selected = (await readCheckedVersions(projectId)).filter((item) =>
				assetRecordIds.includes(item.record.id)
			);
			if (selected.length > 0) {
				await db.delete(contextRuleMeasurements).where(
					and(
						eq(contextRuleMeasurements.projectId, projectId),
						inArray(
							contextRuleMeasurements.assetVersionId,
							selected.map((item) => item.version.id)
						)
					)
				);
			}
			return overview(userId, projectId);
		},

		async previewMerge(userId, input) {
			const rendered = await renderMerge(userId, input);
			return rendered.ok
				? { ok: true, value: rendered.value.preview }
				: rendered;
		},

		async applyMerge(userId, input) {
			const rendered = await renderMerge(userId, input);
			if (!rendered.ok) {
				return rendered;
			}
			const { png, preview, record, version } = rendered.value;
			if (preview.contextRevisionId !== input.expectedContextRevisionId) {
				return { ok: false, reason: "stale_context_revision" };
			}
			if (!record.assetFamilyId) {
				return { ok: false, reason: "family_required" };
			}
			const versionId = crypto.randomUUID();
			const objectKey = createProjectAssetVersionObjectKey(
				input.projectId,
				record.id,
				versionId
			);
			const storage = dependencies.createStorage();
			await storage.put(
				objectKey,
				new Blob([png]).stream(),
				"image/png",
				png.byteLength
			);
			const created = await dependencies.assetVersionStore
				.createCandidateVersion(userId, {
					id: versionId,
					projectId: input.projectId,
					assetFamilyId: record.assetFamilyId,
					assetRecordId: record.id,
					objectKey,
					contentType: "image/png",
					contentLength: png.byteLength,
					contentDigest: sha256(png),
					fileName: `${(version.fileName ?? record.name).replace(fileExtensionPattern, "")}-merged.png`,
					// The same source and mapping always name the same Candidate Version.
					idempotencyKey:
						input.idempotencyKey ??
						`colour-merge:${sha256(`${version.id}:${JSON.stringify(preview.steps)}`)}`,
					integrityVerified: true,
					sourceKind: "derived",
				})
				.catch(() => null);
			if (!(created?.kind === "created" || created?.kind === "existing")) {
				// A row write that threw may still have committed; keep a referenced object.
				const [stored] = await db
					.select({ id: assetVersions.id })
					.from(assetVersions)
					.where(eq(assetVersions.id, versionId))
					.limit(1);
				if (!stored) {
					await storage.delete(objectKey);
				}
				return {
					ok: false,
					reason:
						created?.kind === "idempotency-conflict"
							? "idempotency_conflict"
							: "storage_unavailable",
				};
			}
			if (created.kind === "existing") {
				await storage.delete(objectKey);
			}
			await db
				.insert(colourMerges)
				.values({
					assetVersionId: created.version.id,
					projectId: input.projectId,
					sourceAssetVersionId: version.id,
					contextRevisionId: preview.contextRevisionId,
					steps: preview.steps,
					createdByUserId: userId,
				})
				.onConflictDoNothing();
			return {
				ok: true,
				value: {
					assetRecordId: record.id,
					assetVersionId: created.version.id,
					created: created.kind === "created",
				},
			};
		},
	};
}

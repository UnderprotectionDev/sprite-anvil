import { z } from "zod";
import type { HistoryRecords } from "./project-archive-history";
import type {
	FoundationRecords,
	ProjectArchiveFileEntry,
} from "./project-archives";
import { recordContentDigest } from "./record-content-digest";

/**
 * The delivery and validation record group of a Project Archive: export
 * profiles and their revisions, Export Bundle manifests, Delivery Refresh
 * Locks, Delivery Targets with their drafts and revisions, Delivery
 * Fulfilments, Historical Risk Notices, Delivery Diffs and Runtime Validation
 * Records. Every record keeps its source id. No record carries the user who
 * made it, a storage location or a destination path.
 */

const idSchema = z.string().trim().min(1).max(128);
const timestampSchema = z.iso.datetime();
const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const jsonObjectSchema = z.record(z.string(), z.unknown());

export const deliveryGroup = "delivery";

export const runtimeEvidenceFileKind = "runtime_evidence_file";

const requirementIdentityShape = {
	assetFamilyId: idSchema,
	assetFamilyName: z.string(),
	itemId: z.string().min(1),
	itemKind: z.string(),
	itemName: z.string(),
};

const resolutionSchema = z.enum([
	"only_bundle",
	"identical_pins",
	"user_selected",
]);

const bundleMappingSchema = z
	.object({
		bundleId: idSchema,
		manifestDigest: sha256Schema,
		resolution: resolutionSchema,
	})
	.strict();

const versionedEntrySchema = z
	.object({
		...requirementIdentityShape,
		assetVersionIds: z.array(idSchema),
	})
	.strict();

export const deliverySectionSchemas = {
	/**
	 * A Delivery Diff is derived, never stored at the source: it compares two
	 * consecutive Delivery Fulfilments of one Delivery Target. Verification
	 * recomputes it from the archived Fulfilments.
	 */
	deliveryDiffs: z
		.object({
			assetVersions: z
				.object({
					added: z.array(versionedEntrySchema),
					changed: z.array(
						z
							.object({
								...requirementIdentityShape,
								fromAssetVersionIds: z.array(idSchema),
								toAssetVersionIds: z.array(idSchema),
							})
							.strict()
					),
					removed: z.array(versionedEntrySchema),
					unchangedCount: z.number().int().nonnegative(),
				})
				.strict(),
			bundleMappings: z
				.object({
					changes: z.array(
						z
							.object({
								...requirementIdentityShape,
								from: bundleMappingSchema.nullable(),
								to: bundleMappingSchema.nullable(),
							})
							.strict()
					),
				})
				.strict(),
			context: z
				.object({
					changed: z.boolean(),
					fromContextRevisionId: idSchema,
					toContextRevisionId: idSchema,
				})
				.strict(),
			deliveryTargetId: idSchema,
			fromFulfilmentId: idSchema,
			/** `<from fulfilment id>..<to fulfilment id>`. */
			id: z.string().min(1).max(260),
			toFulfilmentId: idSchema,
		})
		.strict(),
	deliveryFulfilments: z
		.object({
			createdAt: timestampSchema,
			deliveryTargetId: idSchema,
			/** The mapping draft the Fulfilment was finalized from; drafts are not archived, so this is provenance only. */
			draftId: z.string().min(1),
			id: idSchema,
			requirements: z.array(
				z
					.object({
						...requirementIdentityShape,
						assetVersionIds: z.array(idSchema).min(1),
						bundleId: idSchema,
						manifestDigest: sha256Schema,
						position: z.number().int().nonnegative(),
						/** The Required Items List revision; required item lists are not part of the archive, so this is provenance only. */
						requiredSetRevisionId: z.string().min(1),
						resolution: resolutionSchema,
					})
					.strict()
			),
			revisionId: idSchema,
			revisionNumber: z.number().int().positive(),
		})
		.strict(),
	deliveryRefreshLocks: z
		.object({
			bundleId: idSchema,
			bundleManifestDigest: sha256Schema,
			contractVersion: z.string(),
			createdAt: timestampSchema,
			/** A human label; never an absolute path. */
			destinationLabel: z.string(),
			files: z.array(
				z
					.object({
						byteSize: z.number().int().positive(),
						path: z.string().min(1),
						sha256: sha256Schema,
					})
					.strict()
			),
			id: idSchema,
			lockDigest: sha256Schema,
			profileId: idSchema,
			profileRevisionId: idSchema,
		})
		.strict(),
	deliveryTargetDrafts: z
		.object({
			contextRevisionId: idSchema,
			createdAt: timestampSchema,
			deliveryTargetId: idSchema,
			families: z.array(
				z
					.object({
						assetFamilyId: idSchema,
						position: z.number().int().nonnegative(),
						/** Required item lists are not part of the archive, so this is provenance only. */
						requiredSetRevisionId: z.string().min(1),
					})
					.strict()
			),
			id: idSchema,
			productionEvidencePolicy: z
				.object({
					defaultRequirement: z.string(),
					familyRequirements: z.array(
						z
							.object({ assetFamilyId: idSchema, requirement: z.string() })
							.strict()
					),
				})
				.strict(),
			rightsEvidencePolicy: z
				.object({
					acceptableStates: z.array(z.string()),
					requireRecordFor: z.array(z.string()),
				})
				.strict(),
			runtimeValidationCriterion: z
				.object({
					environments: z.array(
						z
							.object({
								adapterVersion: z.string().nullable(),
								engineVersion: z.string(),
								gameBuild: z.string(),
							})
							.strict()
					),
					freshness: z.string(),
				})
				.strict()
				.nullable(),
		})
		.strict(),
	deliveryTargetRevisions: z
		.object({
			activatedAt: timestampSchema,
			deliveryTargetId: idSchema,
			draftId: idSchema,
			id: idSchema,
			revisionNumber: z.number().int().positive(),
		})
		.strict(),
	deliveryTargets: z
		.object({
			createdAt: timestampSchema,
			id: idSchema,
			name: z.string(),
			purpose: z.enum(["demo", "chapter", "update", "other"]),
		})
		.strict(),
	/** The package manifest of one Export Bundle: its pinned revisions, its file list and the text of `manifest.json`. */
	exportBundles: z
		.object({
			adapterVersion: z.string().nullable(),
			contextRevisionId: idSchema,
			contractVersion: z.string(),
			createdAt: timestampSchema,
			deliveryTargetRevisionId: idSchema.nullable(),
			files: z.array(
				z
					.object({
						assetVersionId: idSchema.nullable(),
						byteSize: z.number().int().positive(),
						/** Kept only for the manifest file; asset files are reached through their Asset Version. */
						content: z.string().nullable(),
						path: z.string().min(1),
						sha256: sha256Schema,
					})
					.strict()
			),
			id: idSchema,
			manifestDigest: sha256Schema,
			profileId: idSchema,
			profileRevisionId: idSchema,
		})
		.strict(),
	exportProfileRevisions: z
		.object({
			contentDigest: sha256Schema,
			contractVersion: z.string(),
			createdAt: timestampSchema,
			definition: jsonObjectSchema,
			id: idSchema,
			profileId: idSchema,
			revisionNumber: z.number().int().positive(),
		})
		.strict(),
	exportProfiles: z
		.object({ createdAt: timestampSchema, id: idSchema, name: z.string() })
		.strict(),
	historicalRiskNotices: z
		.object({
			affectedUsage: z.array(
				z
					.object({
						assetFamilyId: idSchema,
						assetFamilyName: z.string(),
						bundleId: idSchema,
						itemId: z.string().min(1),
						itemName: z.string(),
					})
					.strict()
			),
			assetRecordId: idSchema,
			deliveryTargetId: idSchema,
			detectedAt: timestampSchema,
			fulfilmentId: idSchema,
			id: idSchema,
			pinnedPolicy: z
				.object({
					acceptableStates: z.array(z.string()),
					requireRecordFor: z.array(z.string()),
				})
				.strict(),
			pinnedRights: z
				.object({
					rightsRecordId: idSchema,
					state: z.string(),
					versionNumber: z.number().int().positive(),
				})
				.strict()
				.nullable(),
			revisionId: idSchema,
			revisionNumber: z.number().int().positive(),
			rightsRecordId: idSchema,
			rightsRecordState: z.string(),
			rightsRecordVersionNumber: z.number().int().positive(),
		})
		.strict(),
	/**
	 * One Runtime Validation Record with its evidence and the user decisions on
	 * it. An uploaded evidence file keeps its identity, name, digest and size;
	 * the file itself is listed in the manifest and is never carried.
	 */
	runtimeValidations: z
		.object({
			adapterVersion: z.string().nullable(),
			bundleId: idSchema,
			createdAt: timestampSchema,
			decisions: z.array(
				z
					.object({
						createdAt: timestampSchema,
						failureSource: z
							.enum([
								"asset_content",
								"engine_adapter",
								"game_configuration",
								"multiple_sources",
							])
							.nullable(),
						id: idSchema,
						kind: z.enum(["outcome", "failure_source"]),
						outcome: z.enum(["pass", "fail", "inconclusive"]).nullable(),
						sequence: z.number().int().nonnegative(),
					})
					.strict()
			),
			engineVersion: z.string(),
			evidence: z.array(
				z
					.object({
						createdAt: timestampSchema,
						file: z
							.object({
								byteSize: z.number().int().positive(),
								fileName: z.string(),
								sha256: sha256Schema,
							})
							.strict()
							.nullable(),
						id: idSchema,
						kind: z.enum([
							"screenshot",
							"recording",
							"test_result",
							"observation",
						]),
						source: z.enum(["manual", "adapter_draft"]),
						text: z.string().nullable(),
					})
					.strict()
			),
			gameBuild: z.string(),
			id: idSchema,
			manifestDigest: sha256Schema,
			supersedesRecordId: idSchema.nullable(),
		})
		.strict(),
} as const;

export type DeliverySectionName = keyof typeof deliverySectionSchemas;
export type DeliveryRecords = {
	[Name in DeliverySectionName]: z.infer<
		(typeof deliverySectionSchemas)[Name]
	>[];
};

export function emptyDeliveryRecords(): DeliveryRecords {
	return Object.fromEntries(
		Object.keys(deliverySectionSchemas).map((name) => [name, []])
	) as unknown as DeliveryRecords;
}

type Fulfilment = DeliveryRecords["deliveryFulfilments"][number];
type Diff = DeliveryRecords["deliveryDiffs"][number];

const uniqueSorted = (ids: string[]) => [...new Set(ids)].sort();
const sameVersions = (left: string[], right: string[]) =>
	uniqueSorted(left).join("\n") === uniqueSorted(right).join("\n");
const requirementKey = (r: { assetFamilyId: string; itemId: string }) =>
	`${r.assetFamilyId}\u0000${r.itemId}`;
const compare = (left: string, right: string) =>
	Number(left > right) - Number(left < right);

type Requirement = Fulfilment["requirements"][number];
const identityOf = (r: Requirement) => ({
	assetFamilyId: r.assetFamilyId,
	assetFamilyName: r.assetFamilyName,
	itemId: r.itemId,
	itemKind: r.itemKind,
	itemName: r.itemName,
});
const mappingOf = (r: Requirement) => ({
	bundleId: r.bundleId,
	manifestDigest: r.manifestDigest,
	resolution: r.resolution,
});

function diffOne(
	from: Fulfilment,
	to: Fulfilment,
	contextOf: (revisionId: string) => string
): Diff {
	const before = new Map(from.requirements.map((r) => [requirementKey(r), r]));
	const after = new Map(to.requirements.map((r) => [requirementKey(r), r]));
	const assetVersions: Diff["assetVersions"] = {
		added: [],
		changed: [],
		removed: [],
		unchangedCount: 0,
	};
	const changes: Diff["bundleMappings"]["changes"] = [];
	for (const [key, was] of before) {
		const now = after.get(key);
		if (!now) {
			assetVersions.removed.push({
				...identityOf(was),
				assetVersionIds: was.assetVersionIds,
			});
			changes.push({ ...identityOf(was), from: mappingOf(was), to: null });
			continue;
		}
		if (sameVersions(was.assetVersionIds, now.assetVersionIds)) {
			assetVersions.unchangedCount += 1;
		} else {
			assetVersions.changed.push({
				...identityOf(now),
				fromAssetVersionIds: was.assetVersionIds,
				toAssetVersionIds: now.assetVersionIds,
			});
		}
		if (
			was.bundleId !== now.bundleId ||
			was.manifestDigest !== now.manifestDigest ||
			was.resolution !== now.resolution
		) {
			changes.push({
				...identityOf(now),
				from: mappingOf(was),
				to: mappingOf(now),
			});
		}
	}
	for (const [key, now] of after) {
		if (!before.has(key)) {
			assetVersions.added.push({
				...identityOf(now),
				assetVersionIds: now.assetVersionIds,
			});
			changes.push({ ...identityOf(now), from: null, to: mappingOf(now) });
		}
	}
	const fromContext = contextOf(from.revisionId);
	const toContext = contextOf(to.revisionId);
	return {
		assetVersions,
		bundleMappings: { changes },
		context: {
			changed: fromContext !== toContext,
			fromContextRevisionId: fromContext,
			toContextRevisionId: toContext,
		},
		deliveryTargetId: from.deliveryTargetId,
		fromFulfilmentId: from.id,
		id: `${from.id}..${to.id}`,
		toFulfilmentId: to.id,
	};
}

/**
 * The Delivery Diffs of an archive: for each Delivery Target, every
 * Fulfilment compared with the one before it, ordered by creation time and
 * then id. Pure; it reads only archived Fulfilments, revisions and drafts.
 */
export function deriveDeliveryDiffs(
	delivery: Pick<
		DeliveryRecords,
		"deliveryFulfilments" | "deliveryTargetDrafts" | "deliveryTargetRevisions"
	>
): Diff[] {
	const draftContext = new Map(
		delivery.deliveryTargetDrafts.map((d) => [d.id, d.contextRevisionId])
	);
	const revisionContext = new Map(
		delivery.deliveryTargetRevisions.map((r) => [
			r.id,
			draftContext.get(r.draftId) ?? "",
		])
	);
	const byTarget = new Map<string, Fulfilment[]>();
	for (const fulfilment of delivery.deliveryFulfilments) {
		const list = byTarget.get(fulfilment.deliveryTargetId) ?? [];
		list.push(fulfilment);
		byTarget.set(fulfilment.deliveryTargetId, list);
	}
	const diffs: Diff[] = [];
	for (const list of byTarget.values()) {
		list.sort(
			(left, right) =>
				compare(left.createdAt, right.createdAt) || compare(left.id, right.id)
		);
		for (let index = 1; index < list.length; index += 1) {
			diffs.push(
				diffOne(
					list[index - 1] as Fulfilment,
					list[index] as Fulfilment,
					(revisionId) => revisionContext.get(revisionId) ?? ""
				)
			);
		}
	}
	return diffs;
}

/** The foundation and history ids the delivery group points into. */
export type DeliveryFoundation = Pick<
	FoundationRecords,
	"assetFamilies" | "assetRecords" | "assetVersions" | "contextRevisions"
>;

const idSet = (list: { id: string }[]) => new Set(list.map((r) => r.id));

function profileAndBundleFailures(
	delivery: DeliveryRecords,
	foundation: DeliveryFoundation
) {
	const failures: string[] = [];
	const profiles = idSet(delivery.exportProfiles);
	const revisions = new Map(
		delivery.exportProfileRevisions.map((r) => [r.id, r])
	);
	const targetRevisions = idSet(delivery.deliveryTargetRevisions);
	const contexts = idSet(foundation.contextRevisions);
	const versions = idSet(foundation.assetVersions);
	for (const revision of delivery.exportProfileRevisions) {
		if (!profiles.has(revision.profileId)) {
			failures.push(
				`Export Profile revision ${revision.id} points at a missing Export Profile.`
			);
		}
	}
	const bundles = new Map(delivery.exportBundles.map((b) => [b.id, b]));
	for (const bundle of delivery.exportBundles) {
		const revision = revisions.get(bundle.profileRevisionId);
		const ok =
			revision?.profileId === bundle.profileId &&
			contexts.has(bundle.contextRevisionId) &&
			(bundle.deliveryTargetRevisionId === null ||
				targetRevisions.has(bundle.deliveryTargetRevisionId)) &&
			bundle.files.every(
				(file) =>
					file.assetVersionId === null || versions.has(file.assetVersionId)
			);
		if (!ok) {
			failures.push(`Export Bundle ${bundle.id} points at a missing record.`);
		}
	}
	for (const lock of delivery.deliveryRefreshLocks) {
		const bundle = bundles.get(lock.bundleId);
		const revision = revisions.get(lock.profileRevisionId);
		if (
			!(
				bundle &&
				revision &&
				revision.profileId === lock.profileId &&
				bundle.manifestDigest === lock.bundleManifestDigest
			)
		) {
			failures.push(
				`Delivery Refresh Lock ${lock.id} does not match its Export Bundle and profile revision.`
			);
		}
	}
	return failures;
}

function fulfilmentFailures(
	delivery: DeliveryRecords,
	foundation: DeliveryFoundation,
	history: Pick<HistoryRecords, "rightsRecords">
) {
	const failures: string[] = [];
	const targets = idSet(delivery.deliveryTargets);
	const drafts = new Map(delivery.deliveryTargetDrafts.map((d) => [d.id, d]));
	const revisions = new Map(
		delivery.deliveryTargetRevisions.map((r) => [r.id, r])
	);
	const bundles = new Map(delivery.exportBundles.map((b) => [b.id, b]));
	const versions = idSet(foundation.assetVersions);
	const families = idSet(foundation.assetFamilies);
	const records = idSet(foundation.assetRecords);
	const contexts = idSet(foundation.contextRevisions);
	for (const draft of delivery.deliveryTargetDrafts) {
		const ok =
			targets.has(draft.deliveryTargetId) &&
			contexts.has(draft.contextRevisionId) &&
			draft.families.every((family) => families.has(family.assetFamilyId));
		if (!ok) {
			failures.push(
				`Delivery Target draft ${draft.id} points at a missing record.`
			);
		}
	}
	for (const revision of delivery.deliveryTargetRevisions) {
		if (
			drafts.get(revision.draftId)?.deliveryTargetId !==
			revision.deliveryTargetId
		) {
			failures.push(
				`Delivery Target revision ${revision.id} points at a missing draft or one of another target.`
			);
		}
	}
	const fulfilments = new Map(
		delivery.deliveryFulfilments.map((f) => [f.id, f])
	);
	for (const fulfilment of delivery.deliveryFulfilments) {
		const revision = revisions.get(fulfilment.revisionId);
		const ok =
			revision?.deliveryTargetId === fulfilment.deliveryTargetId &&
			revision.revisionNumber === fulfilment.revisionNumber &&
			fulfilment.requirements.every((requirement) => {
				const bundle = bundles.get(requirement.bundleId);
				return (
					bundle?.manifestDigest === requirement.manifestDigest &&
					families.has(requirement.assetFamilyId) &&
					requirement.assetVersionIds.every((id) => versions.has(id))
				);
			});
		if (!ok) {
			failures.push(
				`Delivery Fulfilment ${fulfilment.id} points at a missing record or one that does not match.`
			);
		}
	}
	const rights = idSet(history.rightsRecords);
	for (const notice of delivery.historicalRiskNotices) {
		const fulfilment = fulfilments.get(notice.fulfilmentId);
		const ok =
			fulfilment?.deliveryTargetId === notice.deliveryTargetId &&
			fulfilment.revisionId === notice.revisionId &&
			records.has(notice.assetRecordId) &&
			rights.has(notice.rightsRecordId) &&
			notice.affectedUsage.every(
				(usage) =>
					bundles.has(usage.bundleId) && families.has(usage.assetFamilyId)
			);
		if (!ok) {
			failures.push(
				`Historical Risk Notice ${notice.id} points at a missing record.`
			);
		}
	}
	return failures;
}

async function diffFailures(delivery: DeliveryRecords) {
	const failures: string[] = [];
	const fulfilments = idSet(delivery.deliveryFulfilments);
	for (const diff of delivery.deliveryDiffs) {
		if (
			!(
				fulfilments.has(diff.fromFulfilmentId) &&
				fulfilments.has(diff.toFulfilmentId)
			)
		) {
			failures.push(
				`Delivery Diff ${diff.id} points at a missing Delivery Fulfilment.`
			);
		}
	}
	const expected = deriveDeliveryDiffs(delivery);
	const sorted = (list: Diff[]) =>
		[...list].sort((left, right) => compare(left.id, right.id));
	if (
		(await recordContentDigest(sorted(expected))) !==
		(await recordContentDigest(sorted(delivery.deliveryDiffs)))
	) {
		failures.push(
			"The Delivery Diffs do not match the archived Delivery Fulfilments."
		);
	}
	return failures;
}

function validationFailures(
	delivery: DeliveryRecords,
	files: Pick<
		ProjectArchiveFileEntry,
		"byteSize" | "kind" | "sha256" | "sourceId"
	>[]
) {
	const failures: string[] = [];
	const bundles = new Map(delivery.exportBundles.map((b) => [b.id, b]));
	const validations = idSet(delivery.runtimeValidations);
	const evidenceFiles = new Map(
		files
			.filter((file) => file.kind === runtimeEvidenceFileKind)
			.map((file) => [file.sourceId, file])
	);
	const evidenceIds = new Set<string>();
	for (const validation of delivery.runtimeValidations) {
		const bundle = bundles.get(validation.bundleId);
		const ok =
			bundle?.manifestDigest === validation.manifestDigest &&
			(validation.supersedesRecordId === null ||
				validations.has(validation.supersedesRecordId));
		if (!ok) {
			failures.push(
				`Runtime validation ${validation.id} does not match its Export Bundle or the record it supersedes.`
			);
		}
		for (const evidence of validation.evidence) {
			evidenceIds.add(evidence.id);
			const listed = evidenceFiles.get(evidence.id);
			const matches = evidence.file
				? listed?.sha256 === evidence.file.sha256 &&
					listed.byteSize === evidence.file.byteSize
				: listed === undefined;
			if (!matches) {
				failures.push(
					`Runtime validation evidence ${evidence.id} does not match its file entry.`
				);
			}
		}
	}
	for (const sourceId of evidenceFiles.keys()) {
		if (!evidenceIds.has(sourceId)) {
			failures.push(
				`Evidence file ${sourceId} points at a missing runtime validation evidence.`
			);
		}
	}
	return failures;
}

/**
 * The relations that must hold for the delivery group: every link points at a
 * record the archive holds, digests copied between records agree, derived
 * Delivery Diffs match their Fulfilments, and a runtime evidence file matches
 * its manifest entry.
 */
export async function deliveryRelationFailures(
	delivery: DeliveryRecords,
	foundation: DeliveryFoundation,
	history: Pick<HistoryRecords, "rightsRecords">,
	files: Pick<
		ProjectArchiveFileEntry,
		"byteSize" | "kind" | "sha256" | "sourceId"
	>[]
): Promise<string[]> {
	return [
		...profileAndBundleFailures(delivery, foundation),
		...fulfilmentFailures(delivery, foundation, history),
		...(await diffFailures(delivery)),
		...validationFailures(delivery, files),
	];
}

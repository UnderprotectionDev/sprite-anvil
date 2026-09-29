import type {
	ProfileContractsCatalog,
	SpecializedProfileContractStore,
} from "@sprite-anvil/api/specialized-profile-contracts";
import {
	profileContractRevisionRecordSchema,
	profileContractsCatalogSchema,
	specializedProfileContractTemplates,
} from "@sprite-anvil/api/specialized-profile-contracts";
import { type Database, getProjectForUser } from "@sprite-anvil/db";
import {
	specializedProfileContractActivations,
	specializedProfileContractHeads,
	specializedProfileContractRevisions,
} from "@sprite-anvil/db/schema/specialized-profile-contracts";
import { and, asc, desc, eq, sql } from "drizzle-orm";

function toISOString(value: Date | string) {
	return value instanceof Date
		? value.toISOString()
		: new Date(value).toISOString();
}

function toRevision(
	row: typeof specializedProfileContractRevisions.$inferSelect,
	activeRevisionId: string | null,
	activatedRevisionIds: Set<string>
) {
	return profileContractRevisionRecordSchema.parse({
		id: row.id,
		projectId: row.projectId,
		profileId: row.profileId,
		revisionNumber: row.revisionNumber,
		contract: row.contract,
		createdByUserId: row.createdByUserId,
		createdAt: toISOString(row.createdAt),
		isActive: row.id === activeRevisionId,
		wasActivated: activatedRevisionIds.has(row.id),
	});
}

export function createSpecializedProfileContractStore(
	db: Database
): SpecializedProfileContractStore {
	async function list(
		userId: string,
		projectId: string
	): Promise<ProfileContractsCatalog | null> {
		if (!(await getProjectForUser(db, userId, projectId))) {
			return null;
		}
		const [revisionRows, headRows, activationRows] = await Promise.all([
			db
				.select()
				.from(specializedProfileContractRevisions)
				.where(eq(specializedProfileContractRevisions.projectId, projectId))
				.orderBy(
					asc(specializedProfileContractRevisions.profileId),
					asc(specializedProfileContractRevisions.revisionNumber)
				),
			db
				.select()
				.from(specializedProfileContractHeads)
				.where(eq(specializedProfileContractHeads.projectId, projectId)),
			db
				.select({
					profileId: specializedProfileContractActivations.profileId,
					revisionId: specializedProfileContractActivations.revisionId,
				})
				.from(specializedProfileContractActivations)
				.where(eq(specializedProfileContractActivations.projectId, projectId)),
		]);
		const activatedByProfile = new Map<string, Set<string>>();
		for (const activation of activationRows) {
			const revisions =
				activatedByProfile.get(activation.profileId) ?? new Set();
			revisions.add(activation.revisionId);
			activatedByProfile.set(activation.profileId, revisions);
		}
		const headsByProfile = new Map(
			headRows.map((head) => [head.profileId, head.activeRevisionId])
		);
		const revisionsByProfile = new Map<string, typeof revisionRows>();
		for (const row of revisionRows) {
			const revisions = revisionsByProfile.get(row.profileId) ?? [];
			revisions.push(row);
			revisionsByProfile.set(row.profileId, revisions);
		}
		return profileContractsCatalogSchema.parse({
			projectId,
			profiles: specializedProfileContractTemplates.map((template) => {
				const profileRevisions =
					revisionsByProfile.get(template.profileId) ?? [];
				const activeRevisionId = headsByProfile.get(template.profileId) ?? null;
				const activatedRevisionIds =
					activatedByProfile.get(template.profileId) ?? new Set<string>();
				const revisions = profileRevisions.map((row) =>
					toRevision(row, activeRevisionId, activatedRevisionIds)
				);
				return {
					profileId: template.profileId,
					template,
					activeRevision:
						revisions.find((revision) => revision.isActive) ?? null,
					revisions,
				};
			}),
		});
	}

	async function activate(
		userId: string,
		input: Parameters<SpecializedProfileContractStore["activate"]>[1]
	) {
		if (!(await getProjectForUser(db, userId, input.projectId))) {
			return null;
		}
		const template = specializedProfileContractTemplates.find(
			(contract) =>
				contract.profileId === input.profileId &&
				contract.revisionNumber === input.templateRevisionNumber
		);
		if (!template) {
			return null;
		}

		const [existing] = await db
			.select({ id: specializedProfileContractRevisions.id })
			.from(specializedProfileContractRevisions)
			.where(
				and(
					eq(specializedProfileContractRevisions.projectId, input.projectId),
					eq(specializedProfileContractRevisions.profileId, input.profileId),
					eq(
						specializedProfileContractRevisions.templateRevisionNumber,
						input.templateRevisionNumber
					)
				)
			)
			.limit(1);
		let revisionId = existing?.id;
		if (!revisionId) {
			const [latestRevision] = await db
				.select({
					revisionNumber: specializedProfileContractRevisions.revisionNumber,
				})
				.from(specializedProfileContractRevisions)
				.where(
					and(
						eq(specializedProfileContractRevisions.projectId, input.projectId),
						eq(specializedProfileContractRevisions.profileId, input.profileId)
					)
				)
				.orderBy(desc(specializedProfileContractRevisions.revisionNumber))
				.limit(1);
			const [inserted] = await db
				.insert(specializedProfileContractRevisions)
				.values({
					id: crypto.randomUUID(),
					projectId: input.projectId,
					profileId: input.profileId,
					revisionNumber: (latestRevision?.revisionNumber ?? 0) + 1,
					templateRevisionNumber: template.revisionNumber,
					contract: template,
					createdByUserId: userId,
				})
				.onConflictDoNothing()
				.returning({ id: specializedProfileContractRevisions.id });
			revisionId = inserted?.id;
			if (!revisionId) {
				const [raced] = await db
					.select({ id: specializedProfileContractRevisions.id })
					.from(specializedProfileContractRevisions)
					.where(
						and(
							eq(
								specializedProfileContractRevisions.projectId,
								input.projectId
							),
							eq(
								specializedProfileContractRevisions.profileId,
								input.profileId
							),
							eq(
								specializedProfileContractRevisions.templateRevisionNumber,
								input.templateRevisionNumber
							)
						)
					)
					.limit(1);
				revisionId = raced?.id;
			}
		}
		if (!revisionId) {
			return null;
		}

		const activatedAt = new Date();
		await db.execute(sql`
			WITH updated_head AS (
				INSERT INTO specialized_profile_contract_heads (
					project_id, profile_id, active_revision_id, updated_at
				)
				VALUES (
					${input.projectId}, ${input.profileId}, ${revisionId}, ${activatedAt}
				)
				ON CONFLICT (project_id, profile_id)
				DO UPDATE SET
					active_revision_id = EXCLUDED.active_revision_id,
					updated_at = EXCLUDED.updated_at
				RETURNING project_id, profile_id, active_revision_id
			)
			INSERT INTO specialized_profile_contract_activations (
				id, project_id, profile_id, revision_id, activated_by_user_id, activated_at
			)
			SELECT
				${crypto.randomUUID()}, project_id, profile_id, active_revision_id,
				${userId}, ${activatedAt}
			FROM updated_head
		`);
		return list(userId, input.projectId);
	}

	return { list, activate };
}

import type {
	ProductionExperiment,
	ProductionExperimentStore,
} from "@sprite-anvil/api/production-experiments";
import { productionExperimentSchema } from "@sprite-anvil/api/production-experiments";
import type { Database } from "@sprite-anvil/db";
import { assetRecords } from "@sprite-anvil/db/schema/asset-records";
import {
	productionExperiments,
	productionExperimentTrials,
} from "@sprite-anvil/db/schema/production-experiments";
import { project } from "@sprite-anvil/db/schema/project";
import { and, asc, desc, eq, exists, inArray, isNull } from "drizzle-orm";

function toISOString(value: Date | string) {
	return value instanceof Date
		? value.toISOString()
		: new Date(value).toISOString();
}

function mapExperiment(
	row: typeof productionExperiments.$inferSelect,
	trials: (typeof productionExperimentTrials.$inferSelect)[]
): ProductionExperiment {
	return productionExperimentSchema.parse({
		assetRecordId: row.assetRecordId,
		conclusion:
			row.outcome && row.concludedAt
				? {
						concludedAt: toISOString(row.concludedAt),
						note: row.outcomeNote,
						outcome: row.outcome,
						selectedTrialId: row.selectedTrialId,
					}
				: null,
		createdAt: toISOString(row.createdAt),
		id: row.id,
		projectId: row.projectId,
		title: row.title,
		trials: trials
			.filter((trial) => trial.experimentId === row.id)
			.sort((left, right) => left.position - right.position)
			.map((trial) => ({
				assetVersionId: trial.assetVersionId,
				createdAt: toISOString(trial.createdAt),
				generationPackageId: trial.generationPackageId,
				id: trial.id,
				label: trial.label,
				position: trial.position,
			})),
	});
}

async function isOwnedAssetRecord(
	db: Database,
	userId: string,
	projectId: string,
	assetRecordId: string
) {
	const [record] = await db
		.select({ availability: assetRecords.availability })
		.from(assetRecords)
		.innerJoin(project, eq(project.id, assetRecords.projectId))
		.where(
			and(
				eq(assetRecords.projectId, projectId),
				eq(assetRecords.id, assetRecordId),
				eq(project.ownerUserId, userId)
			)
		)
		.limit(1);
	return Boolean(record && record.availability !== "erased");
}

async function readOwnedExperiments(
	db: Database,
	userId: string,
	projectId: string,
	filter: { assetRecordId?: string; experimentId?: string }
) {
	const conditions = [
		eq(productionExperiments.projectId, projectId),
		eq(project.ownerUserId, userId),
	];
	if (filter.assetRecordId) {
		conditions.push(
			eq(productionExperiments.assetRecordId, filter.assetRecordId)
		);
	}
	if (filter.experimentId) {
		conditions.push(eq(productionExperiments.id, filter.experimentId));
	}
	const rows = await db
		.select({ experiment: productionExperiments })
		.from(productionExperiments)
		.innerJoin(project, eq(project.id, productionExperiments.projectId))
		.where(and(...conditions))
		.orderBy(
			desc(productionExperiments.createdAt),
			desc(productionExperiments.id)
		);
	if (rows.length === 0) {
		return [];
	}
	const trials = await db
		.select()
		.from(productionExperimentTrials)
		.where(
			inArray(
				productionExperimentTrials.experimentId,
				rows.map((row) => row.experiment.id)
			)
		)
		.orderBy(asc(productionExperimentTrials.position));
	return rows.map((row) => mapExperiment(row.experiment, trials));
}

export function createProductionExperimentStore(
	db: Database
): ProductionExperimentStore {
	return {
		async conclude(userId, input) {
			const [experiment] = await readOwnedExperiments(
				db,
				userId,
				input.projectId,
				{ experimentId: input.experimentId }
			);
			if (!experiment) {
				return null;
			}
			if (experiment.conclusion) {
				return { kind: "already-concluded" };
			}
			if (
				input.selectedTrialId &&
				!experiment.trials.some((trial) => trial.id === input.selectedTrialId)
			) {
				return { kind: "trial-not-found" };
			}

			// The outcome IS NULL guard keeps the first conclusion final; the EXISTS
			// guard re-verifies the selected trial inside the write itself.
			const selectedTrialGuard = input.selectedTrialId
				? [
						exists(
							db
								.select({ id: productionExperimentTrials.id })
								.from(productionExperimentTrials)
								.where(
									and(
										eq(
											productionExperimentTrials.experimentId,
											input.experimentId
										),
										eq(productionExperimentTrials.id, input.selectedTrialId)
									)
								)
						),
					]
				: [];
			const updated = await db
				.update(productionExperiments)
				.set({
					concludedAt: new Date(),
					concludedByUserId: userId,
					outcome: input.outcome,
					outcomeNote: input.note,
					selectedTrialId: input.selectedTrialId,
				})
				.where(
					and(
						eq(productionExperiments.projectId, input.projectId),
						eq(productionExperiments.id, input.experimentId),
						isNull(productionExperiments.outcome),
						...selectedTrialGuard
					)
				)
				.returning({ id: productionExperiments.id });
			if (updated.length === 0) {
				const [current] = await readOwnedExperiments(
					db,
					userId,
					input.projectId,
					{ experimentId: input.experimentId }
				);
				if (!current) {
					return null;
				}
				return current.conclusion
					? { kind: "already-concluded" }
					: { kind: "trial-changed" };
			}
			const [reread] = await readOwnedExperiments(db, userId, input.projectId, {
				experimentId: input.experimentId,
			});
			return reread ? { experiment: reread, kind: "concluded" } : null;
		},
		async create(userId, input) {
			if (
				!(await isOwnedAssetRecord(
					db,
					userId,
					input.projectId,
					input.assetRecordId
				))
			) {
				return null;
			}
			const experimentId = crypto.randomUUID();
			await db.batch([
				db.insert(productionExperiments).values({
					assetRecordId: input.assetRecordId,
					createdByUserId: userId,
					id: experimentId,
					projectId: input.projectId,
					title: input.title,
				}),
				db.insert(productionExperimentTrials).values(
					input.trials.map((trial, position) => ({
						assetRecordId: input.assetRecordId,
						assetVersionId: trial.assetVersionId,
						experimentId,
						generationPackageId: trial.generationPackageId,
						label: trial.label,
						position,
						projectId: input.projectId,
					}))
				),
			]);
			const [created] = await readOwnedExperiments(
				db,
				userId,
				input.projectId,
				{
					experimentId,
				}
			);
			return created ?? null;
		},
		async get(userId, projectId, experimentId) {
			const [experiment] = await readOwnedExperiments(db, userId, projectId, {
				experimentId,
			});
			return experiment ?? null;
		},
		async list(userId, projectId, assetRecordId) {
			if (!(await isOwnedAssetRecord(db, userId, projectId, assetRecordId))) {
				return null;
			}
			return await readOwnedExperiments(db, userId, projectId, {
				assetRecordId,
			});
		},
	};
}

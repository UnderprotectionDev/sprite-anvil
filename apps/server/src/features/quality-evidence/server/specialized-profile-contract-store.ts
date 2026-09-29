import { isDeepStrictEqual } from "node:util";
import type {
	ProjectProfileContractActivation,
	SpecializedProfileContract,
	SpecializedProfileContractStore,
} from "@sprite-anvil/api/specialized-profile-contracts";
import {
	getSpecializedProfileContract,
	projectProfileContractActivationSchema,
	specializedProfileContractSchema,
} from "@sprite-anvil/api/specialized-profile-contracts";
import { type Database, getProjectForUser } from "@sprite-anvil/db";
import {
	projectSpecializedProfileContracts,
	specializedProfileContractRevisions,
} from "@sprite-anvil/db/schema/specialized-profile-contracts";
import { and, asc, eq } from "drizzle-orm";

function toISOString(value: Date | string) {
	return value instanceof Date
		? value.toISOString()
		: new Date(value).toISOString();
}

function toActivation(record: {
	activatedAt: Date | string;
	activatedByUserId: string;
	contractRevisionId: string;
	contractSchemaVersion: string;
	contractVersion: string;
	definition: unknown;
	profileId: string;
	projectId: string;
}): ProjectProfileContractActivation {
	const contract = specializedProfileContractSchema.parse(record.definition);
	if (
		contract.profileId !== record.profileId ||
		contract.contractSchemaVersion !== record.contractSchemaVersion ||
		contract.version !== record.contractVersion ||
		`${contract.profileId}@${contract.version}` !== record.contractRevisionId
	) {
		throw new Error(
			"Stored Specialized Profile Contract revision id is invalid"
		);
	}
	return projectProfileContractActivationSchema.parse({
		activatedAt: toISOString(record.activatedAt),
		activatedByUserId: record.activatedByUserId,
		contract,
		contractRevisionId: record.contractRevisionId,
		projectId: record.projectId,
	});
}

function sameContract(
	storedDefinition: unknown,
	canonicalContract: SpecializedProfileContract
) {
	const storedContract =
		specializedProfileContractSchema.parse(storedDefinition);
	return isDeepStrictEqual(storedContract, canonicalContract);
}

function projectContractActivationQuery(db: Database) {
	return db
		.select({
			activatedAt: projectSpecializedProfileContracts.activatedAt,
			activatedByUserId: projectSpecializedProfileContracts.activatedByUserId,
			contractRevisionId: projectSpecializedProfileContracts.contractRevisionId,
			contractSchemaVersion:
				specializedProfileContractRevisions.contractSchemaVersion,
			contractVersion: specializedProfileContractRevisions.contractVersion,
			definition: specializedProfileContractRevisions.definition,
			profileId: projectSpecializedProfileContracts.profileId,
			projectId: projectSpecializedProfileContracts.projectId,
		})
		.from(projectSpecializedProfileContracts)
		.innerJoin(
			specializedProfileContractRevisions,
			and(
				eq(
					projectSpecializedProfileContracts.profileId,
					specializedProfileContractRevisions.profileId
				),
				eq(
					projectSpecializedProfileContracts.contractRevisionId,
					specializedProfileContractRevisions.id
				)
			)
		);
}

export function createSpecializedProfileContractStore(
	db: Database
): SpecializedProfileContractStore {
	return {
		async list(userId, projectId) {
			const ownedProject = await getProjectForUser(db, userId, projectId);
			if (!ownedProject) {
				return null;
			}
			const rows = await projectContractActivationQuery(db)
				.where(eq(projectSpecializedProfileContracts.projectId, projectId))
				.orderBy(asc(projectSpecializedProfileContracts.profileId));

			return rows.map(toActivation);
		},

		async getActive(userId, projectId, profileId) {
			const ownedProject = await getProjectForUser(db, userId, projectId);
			if (!ownedProject) {
				return null;
			}
			const [row] = await projectContractActivationQuery(db)
				.where(
					and(
						eq(projectSpecializedProfileContracts.projectId, projectId),
						eq(projectSpecializedProfileContracts.profileId, profileId)
					)
				)
				.limit(1);

			return row ? toActivation(row) : null;
		},

		async activate(userId, projectId, profileId, requestedContract) {
			const ownedProject = await getProjectForUser(db, userId, projectId);
			if (!ownedProject) {
				return false;
			}
			const canonicalDefinition = getSpecializedProfileContract(profileId);
			if (!canonicalDefinition) {
				throw new Error("Unknown Specialized Profile Contract");
			}
			const canonicalContract =
				specializedProfileContractSchema.parse(canonicalDefinition);
			const contract =
				specializedProfileContractSchema.parse(requestedContract);
			if (
				contract.profileId !== profileId ||
				!isDeepStrictEqual(contract, canonicalContract)
			) {
				throw new Error(
					"Only the canonical Specialized Profile Contract can be activated"
				);
			}

			const contractRevisionId = `${profileId}@${canonicalContract.version}`;
			await db
				.insert(specializedProfileContractRevisions)
				.values({
					id: contractRevisionId,
					profileId,
					contractSchemaVersion: canonicalContract.contractSchemaVersion,
					contractVersion: canonicalContract.version,
					definition: canonicalContract as unknown as Record<string, unknown>,
				})
				.onConflictDoNothing();
			const [persistedRevision] = await db
				.select()
				.from(specializedProfileContractRevisions)
				.where(
					and(
						eq(specializedProfileContractRevisions.profileId, profileId),
						eq(
							specializedProfileContractRevisions.contractVersion,
							canonicalContract.version
						)
					)
				)
				.limit(1);
			if (
				!persistedRevision ||
				persistedRevision.id !== contractRevisionId ||
				persistedRevision.contractSchemaVersion !==
					canonicalContract.contractSchemaVersion ||
				!sameContract(persistedRevision.definition, canonicalContract)
			) {
				throw new Error(
					"The immutable Specialized Profile Contract revision does not match the canonical definition"
				);
			}

			await db
				.insert(projectSpecializedProfileContracts)
				.values({
					projectId,
					profileId,
					contractRevisionId,
					activatedByUserId: userId,
				})
				.onConflictDoUpdate({
					target: [
						projectSpecializedProfileContracts.projectId,
						projectSpecializedProfileContracts.profileId,
					],
					set: {
						contractRevisionId,
						activatedByUserId: userId,
						activatedAt: new Date(),
					},
				});
			return true;
		},
	};
}

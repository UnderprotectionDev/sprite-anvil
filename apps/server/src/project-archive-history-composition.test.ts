import { expect, test } from "bun:test";
import { getSpecializedProfileContract } from "@sprite-anvil/api/specialized-profile-contracts";
import type { Database } from "@sprite-anvil/db";
import type { InteractiveTransaction } from "@sprite-anvil/db/interactive-database";
import { getTableName } from "drizzle-orm";
import { insertArchiveHistory } from "./features/project-archives/server/project-archive-history-materialization";
import type { StoredProjectArchiveRestoreRecord } from "./features/project-archives/server/project-archive-restore-storage";
import { createSpecializedProfileContractStore } from "./features/quality-evidence/server/specialized-profile-contract-store";

type Tx = InteractiveTransaction;

test("restored canonical profile activation is readable through the normal profile store", async () => {
	const definition = getSpecializedProfileContract("icon");
	if (!definition) {
		throw new Error("Icon contract missing");
	}
	const id = `${definition.profileId}@${definition.version}`;
	const at = "2026-01-01T00:00:00.000Z";
	const section = (name: string, rows: unknown[]) => ({
		group: "history",
		name,
		digest: "d",
		sourceDigest: "d",
		recordCount: rows.length,
		records: rows,
	});
	const record: StoredProjectArchiveRestoreRecord = {
		files: [],
		ids: [],
		projectName: "Restored",
		restore: {
			archiveId: "archive",
			createdAt: new Date(at),
			createdByUserId: "owner",
			id: "restore",
			manifestDigest: "digest",
			requestDigest: "request",
			restoredProjectId: "restored",
			sourceProjectId: "source",
		},
		sections: [
			section("contractRevisions", [
				{
					id,
					profileId: definition.profileId,
					contractSchemaVersion: definition.contractSchemaVersion,
					contractVersion: definition.version,
					definition,
					createdAt: at,
				},
			]),
			section("contractActivations", [
				{ id, profileId: "icon", contractRevisionId: id, activatedAt: at },
			]),
		],
	};
	let activation: Record<string, unknown> | undefined;
	const existing = {
		id,
		profileId: "icon",
		contractSchemaVersion: definition.contractSchemaVersion,
		contractVersion: definition.version,
		definition,
		createdAt: new Date(at),
	};
	const tx = {
		insert: (table: Parameters<typeof getTableName>[0]) => ({
			values: (rows: unknown) => {
				if (getTableName(table) === "project_specialized_profile_contracts") {
					[activation] = rows as Record<string, unknown>[];
				}
				const promise = Promise.resolve();
				return Object.assign(promise, { onConflictDoNothing: () => promise });
			},
		}),
		select: () => ({
			from: () => ({
				where: () => ({ limit: () => Promise.resolve([existing]) }),
			}),
		}),
	} as unknown as Tx;
	await insertArchiveHistory(tx, record);
	expect(activation).toMatchObject({
		projectId: "restored",
		profileId: "icon",
		contractRevisionId: id,
	});
	let queries = 0;
	const db = {
		select: () => ({
			from: () => ({
				innerJoin: () => ({
					where: () => ({
						limit: () =>
							Promise.resolve([
								{
									...existing,
									...activation,
									activatedAt: new Date(at),
									activatedByUserId: "owner",
									contractRevisionId: id,
								},
							]),
					}),
				}),
				where: () => ({
					limit: () => {
						queries += 1;
						return Promise.resolve([{ id: "restored", ownerUserId: "owner" }]);
					},
				}),
			}),
		}),
	} as unknown as Database;
	expect(
		await createSpecializedProfileContractStore(db).getActive(
			"owner",
			"restored",
			"icon"
		)
	).toMatchObject({
		projectId: "restored",
		contractRevisionId: id,
		contract: definition,
	});
	expect(queries).toBe(1);
});

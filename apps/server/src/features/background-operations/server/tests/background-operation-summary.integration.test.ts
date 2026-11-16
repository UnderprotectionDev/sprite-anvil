import { expect, test } from "bun:test";
import { call } from "@orpc/server";
import type { Context } from "@sprite-anvil/api/context";
import { appRouter } from "@sprite-anvil/api/routers/index";
import type { Database } from "@sprite-anvil/db";
import { user } from "@sprite-anvil/db/schema/auth";
import { backgroundOperations } from "@sprite-anvil/db/schema/background-operations";
import { project } from "@sprite-anvil/db/schema/project";
import { createLocalTestDb } from "@sprite-anvil/db/testing";
import { createBackgroundOperationStore } from "../background-operation-store";
import type { OperationStorage } from "../operation-storage";

function operationStatus(index: number) {
	if (index < 101) {
		return "pending" as const;
	}
	if (index === 101) {
		return "running" as const;
	}
	if (index === 102) {
		return "cancel_requested" as const;
	}
	if (index < 107) {
		return "failed" as const;
	}
	return "completed" as const;
}

const databaseUrl = process.env.CONTEXT_TEST_DATABASE_URL;
test.skipIf(!databaseUrl)(
	"summary counts every authorized project operation regardless of age",
	async () => {
		if (!databaseUrl) {
			throw new Error("CONTEXT_TEST_DATABASE_URL required");
		}
		const db = createLocalTestDb({ DATABASE_URL: databaseUrl });
		const ownerId = crypto.randomUUID();
		const otherId = crypto.randomUUID();
		const projectId = crypto.randomUUID();
		const rollback = new Error("deliberate rollback");
		try {
			await expect(
				db.transaction(async (tx) => {
					await tx.insert(user).values([
						{ id: ownerId, name: "Owner", email: `${ownerId}@example.test` },
						{ id: otherId, name: "Other", email: `${otherId}@example.test` },
					]);
					await tx
						.insert(project)
						.values({ id: projectId, ownerUserId: ownerId, name: "Summary" });
					await tx.insert(backgroundOperations).values(
						Array.from({ length: 110 }, (_, index) => ({
							id: crypto.randomUUID(),
							projectId,
							kind: "export" as const,
							scopeSummary: "Export",
							triggerSummary: "Requested",
							triggeredByUserId: ownerId,
							status: operationStatus(index),
						}))
					);
					const store = createBackgroundOperationStore(
						tx as unknown as Database,
						{} as OperationStorage
					);
					const context = {
						session: { user: { id: ownerId } },
						backgroundOperationStore: store,
					} as unknown as Context;
					expect(
						await call(
							appRouter.backgroundOperations.summary,
							{ projectId },
							{ context }
						)
					).toEqual({ active: 103, failed: 4 });
					await expect(
						call(
							appRouter.backgroundOperations.summary,
							{ projectId },
							{
								context: {
									...context,
									session: { user: { id: otherId } } as Context["session"],
								},
							}
						)
					).rejects.toMatchObject({ code: "NOT_FOUND" });
					throw rollback;
				})
			).rejects.toBe(rollback);
		} finally {
			await db.close();
		}
	}
);

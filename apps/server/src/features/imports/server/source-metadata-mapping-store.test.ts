import { expect, test } from "bun:test";
import { createDb } from "@sprite-anvil/db";
import { assetRecords } from "@sprite-anvil/db/schema/asset-records";
import { user } from "@sprite-anvil/db/schema/auth";
import { importInboxEntries } from "@sprite-anvil/db/schema/import-inbox";
import { project } from "@sprite-anvil/db/schema/project";
import {
	sourceMetadataMappingFinalizations,
	sourceMetadataMappingProposals,
} from "@sprite-anvil/db/schema/source-metadata-mapping";
import { eq } from "drizzle-orm";
import { createSourceMetadataMappingProposalStore } from "./source-metadata-mapping-store";

const databaseUrl = process.env.CONTEXT_TEST_DATABASE_URL;

test.skipIf(!databaseUrl)(
	"reserves the same finalization after rereading JSONB decisions",
	async () => {
		if (!databaseUrl) {
			throw new Error("CONTEXT_TEST_DATABASE_URL is required for this test.");
		}
		const db = createDb({ DATABASE_URL: databaseUrl });
		const userId = crypto.randomUUID();
		const projectId = crypto.randomUUID();
		const assetRecordId = crypto.randomUUID();
		const sourceEntryId = crypto.randomUUID();
		const proposalId = crypto.randomUUID();
		const store = createSourceMetadataMappingProposalStore(db);
		const decisions = [
			{
				field: "frame" as const,
				key: "walk-0",
				sourceEntryId,
				sourcePath: "frames[0]",
			},
		];

		try {
			await db.insert(user).values({
				id: userId,
				name: "Mapping Finalization Test",
				email: `mapping-finalization-${userId}@example.test`,
			});
			await db.insert(project).values({
				id: projectId,
				ownerUserId: userId,
				name: "Mapping Finalization Test",
			});
			await db.insert(assetRecords).values({
				id: assetRecordId,
				projectId,
				createdByUserId: userId,
				name: "Walk cycle",
				supportLevel: "general",
				availability: "active",
			});
			await db.insert(importInboxEntries).values({
				id: sourceEntryId,
				projectId,
				fileName: "walk.png",
				sourceContentType: "image/png",
				contentLength: 91,
				sha256: "a".repeat(64),
				objectKey: `import-inbox/${projectId}/${sourceEntryId}`,
				createdByUserId: userId,
			});
			await db.insert(sourceMetadataMappingProposals).values({
				id: proposalId,
				projectId,
				sourceEntryId,
				proposal: {},
				createdByUserId: userId,
			});

			const input = { assetRecordId, decisions };
			expect(
				await store.reserveFinalization(userId, projectId, proposalId, input)
			).toBe("reserved");
			expect(
				await store.reserveFinalization(userId, projectId, proposalId, input)
			).toBe("reserved");
			expect(
				await store.reserveFinalization(userId, projectId, proposalId, {
					assetRecordId,
					decisions: decisions.map((decision) => ({
						...decision,
						sourcePath: "frames[1]",
					})),
				})
			).toBe("conflict");
		} finally {
			await db
				.delete(sourceMetadataMappingFinalizations)
				.where(eq(sourceMetadataMappingFinalizations.proposalId, proposalId));
			await db
				.delete(sourceMetadataMappingProposals)
				.where(eq(sourceMetadataMappingProposals.id, proposalId));
			await db
				.delete(importInboxEntries)
				.where(eq(importInboxEntries.id, sourceEntryId));
			await db.delete(assetRecords).where(eq(assetRecords.id, assetRecordId));
			await db.delete(project).where(eq(project.id, projectId));
			await db.delete(user).where(eq(user.id, userId));
		}
	}
);

import { expect, test } from "bun:test";
import { call } from "@orpc/server";
import type { Context } from "@sprite-anvil/api/context";
import { appRouter } from "@sprite-anvil/api/routers/index";
import { createDb } from "@sprite-anvil/db";
import { assetRecords } from "@sprite-anvil/db/schema/asset-records";
import { user } from "@sprite-anvil/db/schema/auth";
import { project } from "@sprite-anvil/db/schema/project";
import { rightsRecords } from "@sprite-anvil/db/schema/rights-records";
import { eq } from "drizzle-orm";
import { createRightsRecordStore } from "./rights-record-store";

const databaseUrl = process.env.CONTEXT_TEST_DATABASE_URL;

test.skipIf(!databaseUrl)(
	"persists and rereads immutable text and file Rights Record revisions through the protected API",
	async () => {
		if (!databaseUrl) {
			throw new Error("CONTEXT_TEST_DATABASE_URL is required for this test.");
		}

		const db = createDb({ DATABASE_URL: databaseUrl });
		const userId = crypto.randomUUID();
		const projectId = crypto.randomUUID();
		const assetRecordId = crypto.randomUUID();
		let insertedUser = false;
		let insertedProject = false;
		let insertedAssetRecord = false;

		try {
			await db.insert(user).values({
				id: userId,
				name: "Rights Record Integration Test",
				email: `rights-record-${userId}@example.test`,
			});
			insertedUser = true;
			await db.insert(project).values({
				id: projectId,
				name: "Rights Record Integration Project",
				ownerUserId: userId,
			});
			insertedProject = true;
			await db.insert(assetRecords).values({
				id: assetRecordId,
				projectId,
				createdByUserId: userId,
				name: "Integration Asset Record",
				identityCriteria: ["independent_product_meaning"],
				supportLevel: "general",
				availability: "active",
			});
			insertedAssetRecord = true;

			const rightsRecordStore = createRightsRecordStore(db);
			const context = {
				rightsRecordStore,
				session: { user: { id: userId } },
			} as unknown as Context;
			const firstInput = {
				assetRecordId,
				assertedScope: "Paid game releases",
				evidence: "License reference: https://example.test/license",
				id: crypto.randomUUID(),
				projectId,
				restrictions: null,
				rightsHolderOrProvider: "Example Studio",
				source: "https://example.test/source",
				state: "documented" as const,
				uncertainty: "Merchandising is not covered.",
			};
			const first = await call(appRouter.rightsRecords.create, firstInput, {
				context,
			});
			const retriedFirst = await call(
				appRouter.rightsRecords.create,
				firstInput,
				{ context }
			);
			const second = await call(
				appRouter.rightsRecords.create,
				{
					...firstInput,
					evidence: "Updated license reference",
					id: crypto.randomUUID(),
					state: "assertion_only",
					uncertainty: "The merchandising limit is still unclear.",
				},
				{ context }
			);
			const fileBackedResult =
				await rightsRecordStore.createRevisionWithEvidenceFile(userId, {
					...firstInput,
					evidence: null,
					id: crypto.randomUUID(),
					evidenceFile: {
						contentLength: 12,
						fileName: "license.pdf",
						objectKey: `projects/${projectId}/rights-record-evidence/${assetRecordId}/test-object`,
						sha256: "a".repeat(64),
						sourceContentType: "application/pdf",
					},
				});
			if (!fileBackedResult.ok) {
				throw new Error("File-backed Rights Record revision was not created.");
			}
			const fileBacked = fileBackedResult.record;

			const rereadRightsRecordStore = createRightsRecordStore(
				createDb({ DATABASE_URL: databaseUrl })
			);
			const rereadContext = {
				rightsRecordStore: rereadRightsRecordStore,
				session: { user: { id: userId } },
			} as unknown as Context;
			const history = await call(
				appRouter.rightsRecords.list,
				{ assetRecordId, projectId },
				{ context: rereadContext }
			);

			expect(first.versionNumber).toBe(1);
			expect(retriedFirst).toEqual(first);
			expect(second.versionNumber).toBe(2);
			expect(history).toEqual([fileBacked, second, first]);
			expect(fileBacked).toMatchObject({
				evidence: null,
				evidenceFile: {
					contentLength: 12,
					fileName: "license.pdf",
					sourceContentType: "application/pdf",
				},
				versionNumber: 3,
			});
			expect(JSON.stringify(fileBacked)).not.toContain("objectKey");

			await db
				.update(assetRecords)
				.set({ availability: "archived" })
				.where(eq(assetRecords.id, assetRecordId));
			expect(
				await rereadRightsRecordStore.getEvidenceFile(
					userId,
					projectId,
					assetRecordId,
					fileBacked.id
				)
			).toMatchObject({ fileName: "license.pdf" });
		} finally {
			if (insertedAssetRecord) {
				await db
					.delete(rightsRecords)
					.where(eq(rightsRecords.projectId, projectId));
				await db.delete(assetRecords).where(eq(assetRecords.id, assetRecordId));
			}
			if (insertedProject) {
				await db.delete(project).where(eq(project.id, projectId));
			}
			if (insertedUser) {
				await db.delete(user).where(eq(user.id, userId));
			}
		}
	}
);

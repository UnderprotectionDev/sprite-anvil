import { expect, test } from "bun:test";
import { createManagedObjectLegacyGuard } from "../managed-object-legacy-guard";

test("registers exact owner-scoped historical import keys without deleting them", async () => {
	const reservations: unknown[] = [];
	const guard = createManagedObjectLegacyGuard({
		listOwnerProjectIds: () => Promise.resolve(["owner-project"]),
		listObjects: (prefix) =>
			Promise.resolve([
				`${prefix}11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222/archive.zip`,
			]),
		listOwner: () => Promise.resolve([]),
		reserve: (entry) => {
			reservations.push(entry);
			return Promise.resolve();
		},
	});
	await guard("owner");
	expect(reservations).toEqual([
		{
			ownerUserId: "owner",
			projectId: "owner-project",
			operationId: "11111111-1111-4111-8111-111111111111",
			objectKey:
				"projects/owner-project/project-archive-imports/11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222/archive.zip",
			purpose: "archive_import_zip",
		},
	]);
});

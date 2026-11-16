import { expect, test } from "bun:test";
import { assetRecordSearchInputSchema } from "./asset-records";

const projectId = "41000000-0000-4000-8000-000000000001";

test("Asset Record search accepts bounded page requests and rejects invalid page sizes", () => {
	expect(
		assetRecordSearchInputSchema.safeParse({
			projectId,
			pagination: { limit: 20, offset: 0 },
		}).success
	).toBe(true);
	expect(
		assetRecordSearchInputSchema.safeParse({
			projectId,
			pagination: { limit: 101, offset: 0 },
		}).success
	).toBe(false);
	expect(
		assetRecordSearchInputSchema.safeParse({
			projectId,
			pagination: { limit: 1, offset: -1 },
		}).success
	).toBe(false);
	expect(assetRecordSearchInputSchema.safeParse({ projectId }).success).toBe(
		true
	);
});

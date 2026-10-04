import { expect, test } from "bun:test";
import { call } from "@orpc/server";
import { appRouter } from "@sprite-anvil/api/routers/index";
import { specializedProfileContractCatalog } from "@sprite-anvil/api/specialized-profile-contracts";

const input = {
	id: "64869356-a595-4a3a-995f-87dad6c77d04",
	projectId: "project",
	assetFamilyId: "family",
	canonicalDesignId: "design",
	contractRevisionId: "character@1",
	directions: ["south", "west", "north", "east"].map((direction) => ({
		direction,
		frames: [{ assetVersionId: "version", durationMs: 100, region: null }],
	})),
	observations: {
		silhouette: "Same outline",
		proportions: "Same proportions",
		equipmentSide: "Sword on right",
		palette: "Same palette",
		perspective: "Consistent angle",
		scale: "32 pixels",
		groundContact: "Needs follow-up",
	},
	outcome: "needs_follow_up",
	rationale: "Ground contact differs in the east view.",
};
function setup() {
	const records: unknown[] = [];
	const context = {
		session: { user: { id: "owner" } },
		directionalReviewStore: {
			list: (userId: string, projectId: string) =>
				userId === "owner" && projectId === "project" ? records : null,
			append: (_userId: string, record: unknown) => {
				records.push(structuredClone(record));
				return record;
			},
			listAccessibleVersionIds: (userId: string, projectId: string) =>
				userId === "owner" && projectId === "project"
					? new Set(["version"])
					: null,
		},
		assetVersionStore: {
			list: () => ({
				assetVersions: [
					{
						id: "version",
						assetFamilyId: "family",
						integrityVerified: true,
						contentDigest: "a".repeat(64),
					},
					{
						id: "erased-record-version",
						assetFamilyId: "family",
						integrityVerified: true,
						contentDigest: "b".repeat(64),
					},
				],
				canonicalDesigns: [
					{ id: "design", assetFamilyId: "family", assetVersionId: "version" },
				],
			}),
		},
		verifyAssetVersionContent: () => true,
		specializedProfileContractStore: {
			getActive: () => ({
				contract: specializedProfileContractCatalog[0],
				contractRevisionId: "character@1",
			}),
		},
	};
	return { context, records };
}
async function invoke(operation: string, request: unknown, context: unknown) {
	const routers = appRouter as unknown as Record<
		string,
		Record<string, unknown>
	>;
	if (!routers.directionalReviews) {
		throw new Error("Directional review API is unavailable");
	}
	return await call(
		routers.directionalReviews[operation] as never,
		request as never,
		{ context: context as never }
	);
}
test("persists a human directional review, rereads it and replays without a second record", async () => {
	const { context, records } = setup();
	const saved = await invoke("save", input, context);
	expect(saved).toMatchObject({
		...input,
		reviewedByUserId: "owner",
		versionPins: [{ assetVersionId: "version", contentDigest: "a".repeat(64) }],
	});
	expect(
		await invoke(
			"list",
			{ projectId: "project", assetFamilyId: "family" },
			context
		)
	).toEqual([saved]);
	expect(await invoke("save", input, context)).toEqual(saved);
	expect(records).toHaveLength(1);
});

test("rejects unauthorized, missing profile, stale canonical, broken versions and altered replay", async () => {
	const { context, records } = setup();
	await expect(
		invoke("save", input, { ...context, session: null })
	).rejects.toMatchObject({ code: "UNAUTHORIZED" });
	await expect(
		invoke("list", { projectId: "other", assetFamilyId: "family" }, context)
	).rejects.toMatchObject({ code: "NOT_FOUND" });
	await expect(
		invoke("save", input, {
			...context,
			specializedProfileContractStore: { getActive: () => null },
		})
	).rejects.toMatchObject({ code: "BAD_REQUEST" });
	await expect(
		invoke("save", { ...input, canonicalDesignId: "old" }, context)
	).rejects.toMatchObject({ code: "CONFLICT" });
	await expect(
		invoke("save", { ...input, contractRevisionId: "old" }, context)
	).rejects.toMatchObject({ code: "CONFLICT" });
	await expect(
		invoke("save", input, {
			...context,
			verifyAssetVersionContent: () => false,
		})
	).rejects.toMatchObject({ code: "BAD_REQUEST" });
	expect(records).toHaveLength(0);
	await invoke("save", input, context);
	await expect(
		invoke("save", { ...input, rationale: "Different judgment" }, context)
	).rejects.toMatchObject({ code: "CONFLICT" });
	expect(records).toHaveLength(1);
});
test("rejects versions of erased records with the intact-version error", async () => {
	const { context, records } = setup();
	const erased = {
		...input,
		directions: input.directions.map((direction) => ({
			...direction,
			frames: [
				{ ...direction.frames[0], assetVersionId: "erased-record-version" },
			],
		})),
	};
	await expect(invoke("save", erased, context)).rejects.toMatchObject({
		code: "BAD_REQUEST",
	});
	expect(records).toHaveLength(0);
});
test("rejects missing observations and duplicate or incomplete direction sets", async () => {
	const { context } = setup();
	await Promise.all(
		[
			{ ...input, directions: input.directions.slice(0, 3) },
			{
				...input,
				directions: input.directions.map((item) => ({
					...item,
					direction: "south",
				})),
			},
			{ ...input, observations: { ...input.observations, groundContact: "" } },
			{
				...input,
				directions: input.directions.map((item) => ({
					...item,
					frames: [{ ...item.frames[0], durationMs: 0 }],
				})),
			},
		].map((invalid) =>
			expect(invoke("save", invalid, context)).rejects.toMatchObject({
				code: "BAD_REQUEST",
			})
		)
	);
});

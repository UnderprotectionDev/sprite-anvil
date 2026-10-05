import { expect, test } from "bun:test";
import { call } from "@orpc/server";
import { appRouter } from "@sprite-anvil/api/routers/index";
import { specializedProfileContractCatalog } from "@sprite-anvil/api/specialized-profile-contracts";

const input = {
	id: "8a3bf45a-0039-4761-b996-b0d45f732877",
	projectId: "project",
	assetFamilyId: "family",
	contractRevisionId: "character@1",
	animationName: "Walk cycle",
	playbackSpeed: 1,
	looping: true,
	directions: ["south", "west", "north", "east"].map((direction, index) => ({
		direction,
		frames: [
			{
				assetVersionId: "version-one",
				frameKey: "walk-0",
				durationMs: 80 + index,
				region: null,
				motionPhase: "Contact",
			},
			{
				assetVersionId: "version-two",
				frameKey: "walk-1",
				durationMs: 220 + index,
				region: { x: 0, y: 0, width: 16, height: 16 },
				motionPhase: null,
			},
		],
	})),
	outcome: "needs_follow_up",
	rationale: "The west contact frame is held longer than the south frame.",
};

function setup() {
	const records: unknown[] = [];
	const versions = [
		{
			id: "version-one",
			assetFamilyId: "family",
			integrityVerified: true,
			contentDigest: "a".repeat(64),
		},
		{
			id: "version-two",
			assetFamilyId: "family",
			integrityVerified: true,
			contentDigest: "b".repeat(64),
		},
	];
	const context = {
		session: { user: { id: "owner" } },
		animationTimingReviewStore: {
			list: (userId: string, projectId: string, assetFamilyId: string) =>
				userId === "owner" &&
				projectId === "project" &&
				assetFamilyId === "family"
					? records
					: null,
			append: (_userId: string, record: unknown) => {
				records.push(structuredClone(record));
				return record;
			},
			listAccessibleVersionIds: (
				userId: string,
				projectId: string,
				assetFamilyId: string
			) =>
				userId === "owner" &&
				projectId === "project" &&
				assetFamilyId === "family"
					? new Set(versions.map((version) => version.id))
					: null,
		},
		assetVersionStore: {
			list: () => ({ assetVersions: versions }),
		},
		verifyAssetVersionContent: () => true,
		specializedProfileContractStore: {
			getActive: () => ({
				contract: specializedProfileContractCatalog[0],
				contractRevisionId: "character@1",
			}),
		},
	};
	return { context, records, versions };
}

async function invoke(operation: string, request: unknown, context: unknown) {
	const routers = appRouter as unknown as Record<
		string,
		Record<string, unknown>
	>;
	if (!routers.animationTimingReviews) {
		throw new Error("Animation timing review API is unavailable");
	}
	return await call(
		routers.animationTimingReviews[operation] as never,
		request as never,
		{ context: context as never }
	);
}

test("persists independent frame timing and optional phases, then rereads and replays", async () => {
	const { context, records } = setup();
	const saved = await invoke("save", input, context);
	expect(saved).toMatchObject({
		...input,
		reviewedByUserId: "owner",
		versionPins: [
			{ assetVersionId: "version-one", contentDigest: "a".repeat(64) },
			{ assetVersionId: "version-two", contentDigest: "b".repeat(64) },
		],
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

test("preserves exact gameplay metadata frame keys up to 512 characters", async () => {
	const { context } = setup();
	const frameKey = ` ${"f".repeat(510)} `;
	const request = {
		...input,
		directions: input.directions.map((direction) => ({
			...direction,
			frames: direction.frames.map((frame, index) =>
				index === 0 ? { ...frame, frameKey } : frame
			),
		})),
	};

	expect(await invoke("save", request, context)).toMatchObject({
		directions: request.directions,
	});
	expect(
		await invoke(
			"list",
			{ projectId: "project", assetFamilyId: "family" },
			context
		)
	).toMatchObject([{ directions: request.directions }]);
});

test("rejects unauthorized, inaccessible, erased, stale-contract and altered-replay paths", async () => {
	const { context, records, versions } = setup();
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
		invoke("save", { ...input, rationale: "Changed review" }, context)
	).rejects.toMatchObject({ code: "CONFLICT" });
	const [, versionToInvalidate] = versions;
	if (!versionToInvalidate) {
		throw new Error("Expected the second fixture version.");
	}
	versionToInvalidate.integrityVerified = false;
	await expect(
		invoke("save", { ...input, id: crypto.randomUUID() }, context)
	).rejects.toMatchObject({ code: "BAD_REQUEST" });
	expect(records).toHaveLength(1);
});

test("rejects invalid timing, duplicate directions and missing human rationale", async () => {
	const { context } = setup();
	const invalidInputs = [
		{
			...input,
			directions: input.directions.map((direction) => ({
				...direction,
				frames: [{ ...direction.frames[0], durationMs: 0 }],
			})),
		},
		{
			...input,
			directions: input.directions.map((direction) => ({
				...direction,
				direction: "south",
			})),
		},
		{ ...input, rationale: " " },
	];
	await Promise.all(
		invalidInputs.map((invalid) =>
			expect(invoke("save", invalid, context)).rejects.toMatchObject({
				code: "BAD_REQUEST",
			})
		)
	);
});

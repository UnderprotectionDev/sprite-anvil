import { expect, test } from "bun:test";
import { call } from "@orpc/server";
import type { Context } from "@sprite-anvil/api/context";
import { appRouter } from "@sprite-anvil/api/routers/index";
import type { Database } from "@sprite-anvil/db";
import { createExportProfileStore } from "../export-profile-store";
import { createMemoryExportProfileStorage } from "./memory-export-profile-storage";

const userId = "user-1";
const projectId = "7a1f0f0e-8f4e-4c36-9a53-0b0b6a2f2a01";
const otherProjectId = "7a1f0f0e-8f4e-4c36-9a53-0b0b6a2f2a02";
const profileId = "8b2a3d62-3d2e-4b86-8a7c-0e6c2f0d1001";
const otherProfileId = "8b2a3d62-3d2e-4b86-8a7c-0e6c2f0d1002";
const revisionId = "8b2a3d62-3d2e-4b86-8a7c-0e6c2f0d3001";
const secondRevisionId = "8b2a3d62-3d2e-4b86-8a7c-0e6c2f0d3002";
const otherRevisionId = "8b2a3d62-3d2e-4b86-8a7c-0e6c2f0d3003";

const definition = {
	fileFormat: "png" as const,
	layout: "grid" as const,
	metadataMapping: [{ sourceField: "frameCount", targetKey: "frames" }],
	namingTemplate: "{family}_{item}",
	padding: 2,
	scale: 1,
	trim: "transparent" as const,
};

const digestPattern = /^[0-9a-f]{64}$/;

function setup(options: { hasAccess?: boolean } = {}) {
	const context = {
		exportProfileStore: createExportProfileStore(
			{} as Database,
			createMemoryExportProfileStorage(),
			{
				getProjectForUser: (_userId, requestedProjectId) =>
					Promise.resolve(
						(options.hasAccess ?? true) &&
							[projectId, otherProjectId].includes(requestedProjectId)
							? { id: requestedProjectId }
							: null
					),
				now: () => new Date("2026-11-10T10:00:00.000Z"),
			}
		),
		session: { user: { id: userId } },
	} as unknown as Context;
	return {
		create: (input: Record<string, unknown>) =>
			call(
				appRouter.exportProfiles.createRevision,
				{
					contractVersion: "1.0.0",
					definition,
					name: "Sheets",
					profileId,
					projectId,
					revisionId,
					...input,
				} as never,
				{ context }
			),
		list: (id = projectId) =>
			call(appRouter.exportProfiles.list, { projectId: id }, { context }),
	};
}

test("a saved Export Profile revision is re-read from storage with its digest", async () => {
	const { create, list } = setup();
	const saved = await create({});
	expect(saved.revisionNumber).toBe(1);

	const catalog = await list();
	expect(catalog.profiles).toHaveLength(1);
	expect(catalog.profiles[0]?.name).toBe("Sheets");
	expect(catalog.profiles[0]?.revisions).toEqual([saved]);
	expect(saved.definition).toEqual(definition);
	expect(saved.contentDigest).toMatch(digestPattern);
});

test("the same definition gives the same content digest in another profile", async () => {
	const { create } = setup();
	const first = await create({});
	const second = await create({
		profileId: otherProfileId,
		revisionId: otherRevisionId,
	});
	expect(second.contentDigest).toBe(first.contentDigest);
});

test("changing a profile adds a revision and leaves the earlier one untouched", async () => {
	const { create, list } = setup();
	const first = await create({});
	const second = await create({
		definition: { ...definition, padding: 4 },
		revisionId: secondRevisionId,
	});
	expect(second.revisionNumber).toBe(2);
	expect(second.contentDigest).not.toBe(first.contentDigest);

	const [profile] = (await list()).profiles;
	expect(profile?.revisions[0]).toEqual(first);
	expect(profile?.revisions[1]).toEqual(second);
});

test("repeating a revision id replays it, and different content under it conflicts", async () => {
	const { create, list } = setup();
	const first = await create({});
	expect(await create({})).toEqual(first);
	expect((await list()).profiles[0]?.revisions).toHaveLength(1);

	await expect(
		create({ definition: { ...definition, padding: 8 } })
	).rejects.toMatchObject({ code: "CONFLICT" });
	expect((await list()).profiles[0]?.revisions).toEqual([first]);
});

test("an unknown major contract version stops the revision", async () => {
	const { create, list } = setup();
	await expect(create({ contractVersion: "2.0.0" })).rejects.toMatchObject({
		code: "BAD_REQUEST",
	});
	expect((await list()).profiles).toEqual([]);
});

test("an unknown required field is refused and an optional extension is kept", async () => {
	const { create } = setup();
	await expect(
		create({ definition: { ...definition, installer: "run.sh" } })
	).rejects.toBeDefined();

	const saved = await create({
		definition: { ...definition, extensions: { vendor: { hint: "x" } } },
	});
	expect(saved.definition.extensions).toEqual({ vendor: { hint: "x" } });
});

test("a profile id owned by another project is unavailable", async () => {
	const { create } = setup();
	await create({});
	await expect(
		create({ projectId: otherProjectId, revisionId: otherRevisionId })
	).rejects.toMatchObject({ code: "BAD_REQUEST" });
});

test("a project the user cannot access is not found", async () => {
	const { create, list } = setup({ hasAccess: false });
	await expect(create({})).rejects.toMatchObject({ code: "NOT_FOUND" });
	await expect(list()).rejects.toMatchObject({ code: "NOT_FOUND" });
});

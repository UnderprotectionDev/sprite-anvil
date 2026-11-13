import { expect, test } from "bun:test";
import { call } from "@orpc/server";
import type { Context } from "@sprite-anvil/api/context";
import type { ExportBundle } from "@sprite-anvil/api/export-bundles";
import { appRouter } from "@sprite-anvil/api/routers/index";
import {
	fixtureExportBundle,
	fixtureSource,
} from "@sprite-anvil/api/test-support/platform-equivalence-fixture";
import type { Database } from "@sprite-anvil/db";
import { createPlatformEquivalenceStore } from "../platform-equivalence-store";
import { createMemoryPlatformEquivalenceStorage } from "./memory-platform-equivalence-storage";

const userId = "user-1";
const projectId = "7a1f0f0e-8f4e-4c36-9a53-0b0b6a2f2a01";
const otherProjectId = "7a1f0f0e-8f4e-4c36-9a53-0b0b6a2f2a02";

async function setup(options: { hasAccess?: boolean } = {}) {
	const source = await fixtureSource();
	const webBundle = await fixtureExportBundle(source);
	const desktopBundle = await fixtureExportBundle(source, {
		createdAt: "2026-11-11T08:30:00.000Z",
	});
	const changedBundle = await fixtureExportBundle({
		...source,
		context: { revisionId: "ctx-2", revisionNumber: 5 },
	});
	const bundles = new Map<string, ExportBundle>(
		[webBundle, desktopBundle, changedBundle].map((bundle) => [
			bundle.id,
			bundle,
		])
	);
	let tick = 0;
	const context = {
		platformEquivalenceStore: createPlatformEquivalenceStore({} as Database, {
			bundles: {
				get: (_userId, requestedProjectId, bundleId) =>
					Promise.resolve(
						requestedProjectId === projectId
							? (bundles.get(bundleId) ?? null)
							: null
					),
			},
			getProjectForUser: (_userId, requestedProjectId) =>
				Promise.resolve(
					(options.hasAccess ?? true) &&
						[projectId, otherProjectId].includes(requestedProjectId)
						? { id: requestedProjectId }
						: null
				),
			now: () => {
				tick += 1;
				return new Date(Date.UTC(2026, 10, 12, 10, 0, tick));
			},
			storage: createMemoryPlatformEquivalenceStorage(),
		}),
		session: { user: { id: userId } },
	} as unknown as Context;
	return {
		bundles: { changedBundle, desktopBundle, webBundle },
		createReport: (input: Record<string, unknown>) =>
			call(
				appRouter.platformEquivalence.createReport,
				{ idempotencyKey: "report-1", projectId, ...input } as never,
				{ context }
			),
		getReport: (reportId: string) =>
			call(
				appRouter.platformEquivalence.getReport,
				{ projectId, reportId },
				{ context }
			),
		overview: (id = projectId) =>
			call(
				appRouter.platformEquivalence.overview,
				{ projectId: id },
				{ context }
			),
		recordRun: (input: Record<string, unknown>) =>
			call(
				appRouter.platformEquivalence.recordRun,
				{ idempotencyKey: "run-1", projectId, ...input } as never,
				{ context }
			),
	};
}

test("each surface records its run and a re-read report compares them as interim evidence", async () => {
	const { bundles, createReport, getReport, overview, recordRun } =
		await setup();
	const web = await recordRun({
		bundleId: bundles.webBundle.id,
		idempotencyKey: "web-run",
		surface: "web",
	});
	const desktop = await recordRun({
		bundleId: bundles.desktopBundle.id,
		idempotencyKey: "desktop-run",
		surface: "desktop",
	});
	expect(web.status).toBe("created");
	expect(web.run.surfaceIdentity).toBe("client_declared");

	const created = await createReport({
		desktopRunId: desktop.run.id,
		webRunId: web.run.id,
	});
	const reread = await getReport(created.report.id);

	expect(reread.comparison.outcome).toBe("equivalent");
	expect(reread.phase).toBe("phase_3_interim");
	expect(reread.claimsFullAcceptance).toBe(false);
	expect(reread.surfaceIdentity).toBe("client_declared");
	expect(reread.notEvaluated).toEqual([
		"delivery_refresh_lock",
		"divergence",
		"reference_acceptance_scenarios",
		"extended_acceptance_scenarios",
	]);
	const listed = await overview();
	expect(listed.runs.map((run) => run.surface).sort()).toEqual([
		"desktop",
		"web",
	]);
	expect(listed.reports.map((report) => report.id)).toEqual([
		created.report.id,
	]);
});

test("a repeated key replays the first run and a changed request under that key conflicts", async () => {
	const { bundles, overview, recordRun } = await setup();
	const first = await recordRun({
		bundleId: bundles.webBundle.id,
		surface: "web",
	});
	const replayed = await recordRun({
		bundleId: bundles.webBundle.id,
		surface: "web",
	});

	expect(replayed.status).toBe("replayed");
	expect(replayed.run.id).toBe(first.run.id);
	expect((await overview()).runs).toHaveLength(1);
	await expect(
		recordRun({ bundleId: bundles.webBundle.id, surface: "desktop" })
	).rejects.toMatchObject({ code: "CONFLICT" });
});

test("runs from different inputs and a missing surface are reported, not equated", async () => {
	const { bundles, createReport, recordRun } = await setup();
	const web = await recordRun({
		bundleId: bundles.webBundle.id,
		idempotencyKey: "web-run",
		surface: "web",
	});
	const desktop = await recordRun({
		bundleId: bundles.changedBundle.id,
		idempotencyKey: "desktop-run",
		surface: "desktop",
	});

	const differentInputs = await createReport({
		desktopRunId: desktop.run.id,
		webRunId: web.run.id,
	});
	const missing = await createReport({
		desktopRunId: null,
		idempotencyKey: "report-2",
		webRunId: web.run.id,
	});

	expect(differentInputs.report.comparison.outcome).toBe("inputs_differ");
	expect(missing.report.comparison.outcome).toBe("missing_surface");
	expect(missing.report.comparison.missingSurfaces).toEqual(["desktop"]);
});

test("an unknown bundle, a wrong-surface run, no run and a foreign project are rejected", async () => {
	const { bundles, createReport, overview, recordRun } = await setup();
	const web = await recordRun({
		bundleId: bundles.webBundle.id,
		surface: "web",
	});

	await expect(
		recordRun({
			bundleId: crypto.randomUUID(),
			idempotencyKey: "unknown",
			surface: "web",
		})
	).rejects.toMatchObject({ code: "NOT_FOUND" });
	await expect(
		createReport({ desktopRunId: web.run.id, webRunId: null })
	).rejects.toMatchObject({ code: "BAD_REQUEST" });
	await expect(
		createReport({ desktopRunId: null, webRunId: null })
	).rejects.toMatchObject({ code: "BAD_REQUEST" });
	await expect(
		createReport({
			desktopRunId: null,
			webRunId: crypto.randomUUID(),
		})
	).rejects.toMatchObject({ code: "BAD_REQUEST" });
	await expect(overview(otherProjectId)).resolves.toEqual({
		reports: [],
		runs: [],
	});
});

test("a user without access to the project reads and writes nothing", async () => {
	const { bundles, createReport, overview, recordRun } = await setup({
		hasAccess: false,
	});

	await expect(overview()).rejects.toMatchObject({ code: "NOT_FOUND" });
	await expect(
		recordRun({ bundleId: bundles.webBundle.id, surface: "web" })
	).rejects.toMatchObject({ code: "NOT_FOUND" });
	await expect(
		createReport({ desktopRunId: null, webRunId: crypto.randomUUID() })
	).rejects.toMatchObject({ code: "NOT_FOUND" });
});

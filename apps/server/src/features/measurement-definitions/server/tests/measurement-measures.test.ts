import { expect, test } from "bun:test";
import {
	type MeasurementDefinitionActivateInput,
	measurementDefinitionActivateInputSchema,
} from "@sprite-anvil/api/measurement-definitions";
import { measurementEventRecordInputSchema } from "@sprite-anvil/api/measurement-events";
import { measurementMeasureReportSchema } from "@sprite-anvil/api/measurement-measures";
import { createMeasurementDefinitionStore } from "../measurement-definition-store";
import { createMeasurementEventStore } from "../measurement-event-store";
import { createMeasurementMeasureStore } from "../measurement-measure-store";
import { createMeasurementPseudonymizer } from "../measurement-pseudonym";
import { createMemoryMeasurementDefinitionStorage } from "./memory-measurement-definition-storage";
import { createMemoryMeasurementEventStorage } from "./memory-measurement-event-storage";

const ownerId = "user-owner";
const otherUserId = "user-other";
const projectId = crypto.randomUUID();
const pseudonymize = createMeasurementPseudonymizer("test-key");
const start = "generation_package_preparation_started";
const end = "candidate_preview_available";
const t0 = new Date("2026-11-01T10:00:00.000Z");
const asOf = new Date("2026-11-13T10:00:00.000Z");

const ratioKey = /percent|^ratio$|^rate$|share|fraction/i;

function allKeys(value: unknown): string[] {
	if (Array.isArray(value)) {
		return value.flatMap(allKeys);
	}
	if (typeof value === "object" && value !== null) {
		return Object.entries(value).flatMap(([key, entry]) => [
			key,
			...allKeys(entry),
		]);
	}
	return [];
}

const baseDefinition = {
	contractVersion: "1.0",
	decisionUse: "Decide whether the production preview flow needs rework.",
	denominator: { outcomeClass: "workflow_started" },
	endEvent: end,
	eventFamily: "production_workflow",
	exclusions: [],
	metricId: "time_to_first_preview",
	numerator: { outcomeClass: "preview_reached" },
	retentionDays: 365,
	scope: {
		projects: { kind: "all_projects" },
		surfaces: ["web", "desktop"],
		users: "all_users",
	},
	startEvent: start,
	timeWindowDays: 30,
};

function setup() {
	const definitions = createMemoryMeasurementDefinitionStorage();
	const events = createMemoryMeasurementEventStorage();
	const definitionStore = createMeasurementDefinitionStore({
		storage: definitions.storage,
	});
	let clock = t0;
	const eventStore = createMeasurementEventStore({
		definitionStorage: definitions.storage,
		now: () => clock,
		ownsProject: () => Promise.resolve(true),
		pseudonymize,
		storage: events.storage,
	});
	const measureStore = createMeasurementMeasureStore({
		definitionStorage: definitions.storage,
		eventStorage: events.storage,
		now: () => asOf,
		pseudonymize,
	});

	async function activate(
		overrides: Partial<MeasurementDefinitionActivateInput> = {},
		userId = ownerId
	) {
		const result = await definitionStore.activate(
			userId,
			measurementDefinitionActivateInputSchema.parse({
				...baseDefinition,
				id: crypto.randomUUID(),
				...overrides,
			})
		);
		if (result.status !== "activated") {
			throw new Error("setup definition was not activated");
		}
		return result.definition;
	}

	async function record(
		definitionId: string,
		at: Date,
		overrides: Record<string, unknown>,
		userId = ownerId
	) {
		clock = at;
		const result = await eventStore.record(
			userId,
			measurementEventRecordInputSchema.parse({
				counters: {},
				definitionId,
				id: crypto.randomUUID(),
				outcomeClass: "workflow_started",
				projectId,
				recordKind: "generation_package",
				surface: "web",
				workflowId: crypto.randomUUID(),
				...overrides,
			})
		);
		if (result.status !== "recorded") {
			throw new Error(`setup event rejected: ${result.reason}`);
		}
	}

	/** Records a flow's start (and end) `minutes` apart; returns its workflow id. */
	async function flow(
		definitionId: string,
		options: {
			endAfterMinutes?: number;
			endOutcome?: string;
			startAt?: Date;
			startOverrides?: Record<string, unknown>;
		}
	) {
		const workflowId = crypto.randomUUID();
		const startAt = options.startAt ?? t0;
		await record(definitionId, startAt, {
			eventName: start,
			outcomeClass: "workflow_started",
			workflowId,
			...options.startOverrides,
		});
		if (options.endAfterMinutes !== undefined) {
			await record(
				definitionId,
				new Date(startAt.getTime() + options.endAfterMinutes * 60_000),
				{
					eventName: end,
					outcomeClass: options.endOutcome ?? "preview_reached",
					projectId: options.startOverrides?.projectId ?? projectId,
					workflowId,
				}
			);
		}
		return workflowId;
	}

	return {
		activate,
		events,
		flow,
		measure: () => measureStore.compute(ownerId),
		measureFor: (userId: string) => measureStore.compute(userId),
		record,
	};
}

test("full flows give raw server-time durations and raw numerator and denominator counts, with no percentage", async () => {
	const { activate, flow, measure } = setup();
	const definition = await activate();
	await flow(definition.id, { endAfterMinutes: 10 });
	await flow(definition.id, { endAfterMinutes: 30 });
	await flow(definition.id, {
		endAfterMinutes: 20,
		endOutcome: "preview_failed",
	});

	const report = await measure();

	expect(measurementMeasureReportSchema.parse(report)).toEqual(report);
	const [measure1] = report.measures;
	expect(report.measures).toHaveLength(1);
	expect(measure1?.definitionId).toBe(definition.id);
	expect(measure1?.version).toBe(1);
	expect(measure1?.duration.completedFlows).toBe(3);
	expect(measure1?.duration.durationsMs).toEqual([
		10 * 60_000,
		20 * 60_000,
		30 * 60_000,
	]);
	expect(measure1?.duration.minMs).toBe(10 * 60_000);
	expect(measure1?.duration.medianMs).toBe(20 * 60_000);
	expect(measure1?.duration.maxMs).toBe(30 * 60_000);
	expect(measure1?.success.numerator).toEqual({
		count: 2,
		outcomeClass: "preview_reached",
	});
	expect(measure1?.success.denominator).toEqual({
		count: 3,
		outcomeClass: "workflow_started",
	});
	expect(measure1?.abandonment).toEqual({
		missingEnd: 0,
		missingStart: 0,
		total: 0,
	});
	expect(report.claim).toEqual({
		reason: "no_baseline_and_target",
		status: "not_claimed",
	});
	expect(allKeys(report).filter((key) => ratioKey.test(key))).toEqual([]);
});

test("an incomplete flow is reported as abandonment and joins neither the duration nor the success counts", async () => {
	const { activate, flow, measure, record } = setup();
	const definition = await activate();
	await flow(definition.id, { endAfterMinutes: 10 });
	await flow(definition.id, {});
	await flow(definition.id, {});
	await record(definition.id, t0, {
		eventName: end,
		outcomeClass: "preview_reached",
	});

	const [only] = (await measure()).measures;

	expect(only?.duration.completedFlows).toBe(1);
	expect(only?.duration.durationsMs).toEqual([10 * 60_000]);
	expect(only?.success.numerator.count).toBe(1);
	expect(only?.success.denominator.count).toBe(1);
	expect(only?.abandonment).toEqual({
		missingEnd: 2,
		missingStart: 1,
		total: 3,
	});
});

test("an end event stamped before the start never makes a duration", async () => {
	const { activate, measure, record } = setup();
	const definition = await activate();
	const workflowId = crypto.randomUUID();
	await record(definition.id, new Date(t0.getTime() - 60_000), {
		eventName: end,
		outcomeClass: "preview_reached",
		workflowId,
	});
	await record(definition.id, t0, { eventName: start, workflowId });

	const [only] = (await measure()).measures;

	expect(only?.duration.completedFlows).toBe(0);
	expect(only?.duration.durationsMs).toEqual([]);
	expect(only?.duration.medianMs).toBeNull();
	expect(only?.abandonment.missingEnd).toBe(1);
});

test("different definition versions of one metric are computed separately and never merged", async () => {
	const { activate, flow, measure } = setup();
	const first = await activate();
	const second = await activate({ retentionDays: 400 });
	await flow(first.id, { endAfterMinutes: 10 });
	await flow(first.id, { endAfterMinutes: 14 });
	await flow(second.id, { endAfterMinutes: 50 });

	const report = await measure();

	expect(
		report.measures.map((m) => [m.version, m.duration.completedFlows])
	).toEqual([
		[1, 2],
		[2, 1],
	]);
	expect(report.measures[1]?.duration.durationsMs).toEqual([50 * 60_000]);
});

test("exclusions, the time window and the project scope of the pinned definition are applied", async () => {
	const { activate, flow, measure } = setup();
	const listedProject = crypto.randomUUID();
	const definition = await activate({
		exclusions: ["internal_test"],
		scope: {
			projects: { kind: "listed_projects", projectIds: [listedProject] },
			surfaces: ["web", "desktop"],
			users: "all_users",
		},
		timeWindowDays: 7,
	});
	const inScope = { projectId: listedProject };
	await flow(definition.id, {
		endAfterMinutes: 5,
		startAt: new Date("2026-11-12T09:00:00.000Z"),
		startOverrides: inScope,
	});
	// Another project: out of the listed scope.
	await flow(definition.id, {
		endAfterMinutes: 5,
		startAt: new Date("2026-11-12T09:00:00.000Z"),
	});
	// Older than the 7-day window.
	await flow(definition.id, {
		endAfterMinutes: 5,
		startAt: new Date("2026-11-01T09:00:00.000Z"),
		startOverrides: inScope,
	});
	// Excluded by an exclusion rule on the record kind.
	await flow(definition.id, {
		endAfterMinutes: 5,
		startAt: new Date("2026-11-12T09:00:00.000Z"),
		startOverrides: { ...inScope, recordKind: "internal_test" },
	});

	const [only] = (await measure()).measures;

	expect(only?.duration.completedFlows).toBe(1);
	expect(only?.excludedFlows).toBe(1);
	expect(only?.windowStart).toBe("2026-11-06T10:00:00.000Z");
});

test("guardrail tallies are raw counter totals and end outcome counts, kept apart from the success counts", async () => {
	const { activate, flow, measure } = setup();
	const definition = await activate();
	await flow(definition.id, {
		endAfterMinutes: 5,
		endOutcome: "reference_mismatch_caught",
		startOverrides: { counters: { regeneration_count: 2 } },
	});
	await flow(definition.id, {
		startOverrides: { counters: { regeneration_count: 3 } },
	});

	const [only] = (await measure()).measures;

	expect(only?.guardrail.counterTotals).toEqual({ regeneration_count: 5 });
	expect(only?.guardrail.endOutcomeCounts).toEqual({
		reference_mismatch_caught: 1,
	});
	expect(only?.success.numerator.count).toBe(0);
});

test("a user only gets measures of their own definitions, and the report holds no identity, workflow id or content", async () => {
	const { activate, flow, measure, measureFor } = setup();
	const definition = await activate();
	await flow(definition.id, { endAfterMinutes: 10 });

	expect((await measureFor("user-other")).measures).toEqual([]);
	const serialized = JSON.stringify(await measure());
	expect(serialized).not.toContain(ownerId);
	expect(serialized).not.toContain(otherUserId);
	expect(serialized).not.toContain(projectId);
	expect(serialized).not.toContain(pseudonymize("user", ownerId));
	expect(serialized).not.toContain(pseudonymize("project", projectId));
});

test("no measure is derived from image content: the report contract rejects any classification field", () => {
	const parsed = measurementMeasureReportSchema.safeParse({
		asOf: asOf.toISOString(),
		claim: { reason: "no_baseline_and_target", status: "not_claimed" },
		measures: [],
		imageQuality: "consistent",
	});
	expect(parsed.success).toBe(false);
});

test("the same workflow id from another project or user never merges into one flow", async () => {
	const { activate, events, measure, record } = setup();
	const definition = await activate();
	const workflowId = crypto.randomUUID();
	await record(definition.id, t0, { eventName: start, workflowId });
	// Same workflow id, different project: its end must not complete the first flow.
	await record(definition.id, new Date(t0.getTime() + 60_000), {
		eventName: end,
		outcomeClass: "preview_reached",
		projectId: crypto.randomUUID(),
		workflowId,
	});
	// Same workflow id, different user pseudonym, same project pseudonym.
	await events.storage.insert({
		counters: {},
		definitionId: definition.id,
		definitionVersion: definition.version,
		eventFamily: definition.eventFamily,
		eventName: end,
		id: crypto.randomUUID(),
		metricId: definition.metricId,
		occurredAt: new Date(t0.getTime() + 120_000),
		outcomeClass: "preview_reached",
		projectPseudonym: pseudonymize("project", projectId),
		recordKind: "generation_package",
		surface: "web",
		userPseudonym: pseudonymize("user", otherUserId),
		workflowId,
	});

	const [measure1] = (await measure()).measures;

	expect(measure1?.duration.completedFlows).toBe(0);
	expect(measure1?.abandonment).toEqual({
		missingEnd: 1,
		missingStart: 2,
		total: 3,
	});
});

import { expect, test } from "bun:test";
import {
	type MeasurementDefinitionActivateInput,
	measurementDefinitionActivateInputSchema,
} from "@sprite-anvil/api/measurement-definitions";
import { createMeasurementDefinitionStore } from "../measurement-definition-store";
import { createMemoryMeasurementDefinitionStorage } from "./memory-measurement-definition-storage";

const ownerId = "user-owner";
const otherUserId = "user-other";
const activatedAt = new Date("2026-11-13T09:30:00.000Z");

function validInput(
	overrides: Partial<MeasurementDefinitionActivateInput> = {}
): MeasurementDefinitionActivateInput {
	return measurementDefinitionActivateInputSchema.parse({
		contractVersion: "1.0",
		decisionUse: "Decide whether the production preview flow needs rework.",
		denominator: { outcomeClass: "workflow_started" },
		endEvent: "candidate_preview_available",
		eventFamily: "production_workflow",
		exclusions: ["internal_test_project"],
		id: crypto.randomUUID(),
		metricId: "time_to_first_preview",
		numerator: { outcomeClass: "preview_reached" },
		retentionDays: 365,
		scope: {
			projects: { kind: "all_projects" },
			surfaces: ["web", "desktop"],
			users: "all_users",
		},
		startEvent: "generation_package_preparation_started",
		timeWindowDays: 30,
		...overrides,
	});
}

function setup() {
	const memory = createMemoryMeasurementDefinitionStorage();
	let clock = activatedAt;
	const store = createMeasurementDefinitionStore({
		now: () => clock,
		storage: memory.storage,
	});
	return {
		setClock: (next: Date) => {
			clock = next;
		},
		storage: memory,
		store,
	};
}

test("activating stores a versioned definition stamped with server time and re-reads it from the persisted record", async () => {
	const { store } = setup();
	const input = validInput();

	const result = await store.activate(ownerId, input);

	expect(result.status).toBe("activated");
	if (result.status !== "activated") {
		return;
	}
	expect(result.definition).toMatchObject({
		activatedAt: activatedAt.toISOString(),
		contractVersion: "1.0",
		decisionUse: input.decisionUse,
		denominator: input.denominator,
		endEvent: input.endEvent,
		eventFamily: "production_workflow",
		exclusions: input.exclusions,
		id: input.id,
		metricId: "time_to_first_preview",
		numerator: input.numerator,
		retentionDays: 365,
		scope: input.scope,
		startEvent: input.startEvent,
		timeSource: "server_time",
		timeWindowDays: 30,
		version: 1,
	});

	const catalog = await store.list(ownerId);
	expect(catalog.definitions).toEqual([result.definition]);
});

test("the definition's time source is fixed by the server, so a client clock is rejected at the boundary", () => {
	for (const extra of [
		{ activatedAt: "2020-01-01T00:00:00.000Z" },
		{ timeSource: "client_time" },
	]) {
		expect(
			measurementDefinitionActivateInputSchema.safeParse({
				...validInput(),
				...extra,
			}).success
		).toBe(false);
	}
});

test("a new definition for the same metric becomes the next version and leaves the older one untouched", async () => {
	const { setClock, store } = setup();
	const first = await store.activate(ownerId, validInput());
	const before = await store.list(ownerId);

	setClock(new Date("2026-12-01T00:00:00.000Z"));
	const second = await store.activate(
		ownerId,
		validInput({ timeWindowDays: 90 })
	);

	expect(first.status).toBe("activated");
	expect(second.status).toBe("activated");
	if (second.status !== "activated") {
		return;
	}
	expect(second.definition.version).toBe(2);
	expect(second.definition.timeWindowDays).toBe(90);

	const after = await store.list(ownerId);
	expect(after.definitions).toHaveLength(2);
	expect(after.definitions[0]).toEqual(before.definitions[0]);
	expect(after.definitions[0]?.timeWindowDays).toBe(30);
	expect(after.definitions[0]?.activatedAt).toBe(activatedAt.toISOString());
});

test("different metrics keep their own version numbers", async () => {
	const { store } = setup();
	await store.activate(ownerId, validInput());
	const other = await store.activate(
		ownerId,
		validInput({ metricId: "offline_verification_time" })
	);

	expect(other.status === "activated" && other.definition.version).toBe(1);
});

test("an unknown major contract version blocks activation and stores nothing", async () => {
	const { store } = setup();

	const results = await Promise.all(
		["2.0", "0.9", "10.1"].map((contractVersion) =>
			store.activate(ownerId, validInput({ contractVersion }))
		)
	);
	for (const result of results) {
		expect(result).toEqual({
			reason: "unsupported_contract_version",
			status: "rejected",
		});
	}
	expect((await store.list(ownerId)).definitions).toEqual([]);
});

test("a known major with a newer minor version is accepted", async () => {
	const { store } = setup();
	const result = await store.activate(
		ownerId,
		validInput({ contractVersion: "1.4" })
	);
	expect(result.status).toBe("activated");
});

test("a missing required field blocks activation at the boundary", () => {
	const required = [
		"contractVersion",
		"decisionUse",
		"denominator",
		"endEvent",
		"eventFamily",
		"exclusions",
		"id",
		"metricId",
		"numerator",
		"retentionDays",
		"scope",
		"startEvent",
		"timeWindowDays",
	];
	for (const field of required) {
		const { [field]: _removed, ...rest } = validInput() as Record<
			string,
			unknown
		>;
		expect(
			measurementDefinitionActivateInputSchema.safeParse(rest).success,
			field
		).toBe(false);
	}
});

test("malformed definitions are rejected: same start and end, empty scope, listed projects without ids, no decision use", () => {
	const invalid: Record<string, unknown>[] = [
		{ endEvent: "generation_package_preparation_started" },
		{ scope: { ...validInput().scope, surfaces: [] } },
		{
			scope: {
				...validInput().scope,
				projects: { kind: "listed_projects", projectIds: [] },
			},
		},
		{ decisionUse: "   " },
		{ contractVersion: "one" },
		{ retentionDays: 0 },
		{ timeWindowDays: 0 },
	];
	for (const override of invalid) {
		expect(
			measurementDefinitionActivateInputSchema.safeParse({
				...validInput(),
				...override,
			}).success,
			JSON.stringify(override)
		).toBe(false);
	}
});

test("a definition cannot carry a baseline or a percentage target", () => {
	for (const extra of [
		{ baseline: 12 },
		{ targetPercent: 30 },
		{ successClaim: "verified" },
	]) {
		expect(
			measurementDefinitionActivateInputSchema.safeParse({
				...validInput(),
				...extra,
			}).success
		).toBe(false);
	}
});

test("a user only reads their own definitions", async () => {
	const { store } = setup();
	await store.activate(ownerId, validInput());

	expect((await store.list(otherUserId)).definitions).toEqual([]);
});

test("another user's definition id is not reused for their own", async () => {
	const { store } = setup();
	const input = validInput();
	await store.activate(ownerId, input);

	expect(await store.activate(otherUserId, input)).toEqual({
		reason: "id_conflict",
		status: "rejected",
	});
	expect((await store.list(otherUserId)).definitions).toEqual([]);
});

test("repeating an activation with the same id and content returns the stored version", async () => {
	const { setClock, store } = setup();
	const input = validInput();
	const first = await store.activate(ownerId, input);

	setClock(new Date("2027-01-01T00:00:00.000Z"));
	const replay = await store.activate(ownerId, input);

	expect(replay).toEqual(first);
	expect((await store.list(ownerId)).definitions).toHaveLength(1);
});

test("reusing an id for different content is a conflict and changes nothing", async () => {
	const { store } = setup();
	const input = validInput();
	await store.activate(ownerId, input);

	const result = await store.activate(ownerId, {
		...input,
		retentionDays: 30,
	});

	expect(result).toEqual({ reason: "id_conflict", status: "rejected" });
	const [stored] = (await store.list(ownerId)).definitions;
	expect(stored?.retentionDays).toBe(365);
});

test("losing the version-number race retries, and a persistent loss reports a conflict", async () => {
	const { storage, store } = setup();

	storage.failNextInserts(2);
	const retried = await store.activate(ownerId, validInput());
	expect(retried.status).toBe("activated");

	storage.failNextInserts(10);
	expect(await store.activate(ownerId, validInput())).toEqual({
		status: "version_conflict",
	});
	expect((await store.list(ownerId)).definitions).toHaveLength(1);
});

test("the returned record is a copy, so mutating it does not rewrite the stored definition", async () => {
	const { store } = setup();
	const result = await store.activate(ownerId, validInput());
	if (result.status !== "activated") {
		throw new Error("Expected the definition to activate.");
	}
	result.definition.exclusions.push("tampered");

	const [stored] = (await store.list(ownerId)).definitions;
	expect(stored?.exclusions).toEqual(["internal_test_project"]);
});

import type { MeasurementMeasureStore } from "@sprite-anvil/api/measurement-measure-store";
import type { MeasurementMeasure } from "@sprite-anvil/api/measurement-measures";
import { measurementMeasureReportSchema } from "@sprite-anvil/api/measurement-measures";
import type {
	MeasurementDefinitionStorage,
	StoredMeasurementDefinition,
} from "./measurement-definition-storage";
import type {
	MeasurementEventStorage,
	StoredMeasurementEvent,
} from "./measurement-event-storage";
import type { Pseudonymize } from "./measurement-pseudonym-kind";

const dayMs = 86_400_000;

export interface MeasurementMeasureStoreOptions {
	definitionStorage: MeasurementDefinitionStorage;
	eventStorage: MeasurementEventStorage;
	/** The server clock; the window is read against it, never a client time. */
	now?: () => Date;
	/** The same pseudonymizer that stamped the events, so scope can be matched without real ids. */
	pseudonymize: Pseudonymize;
}

function increment(counts: Record<string, number>, label: string, by = 1) {
	counts[label] = (counts[label] ?? 0) + by;
}

function median(sorted: number[]): number | null {
	if (sorted.length === 0) {
		return null;
	}
	const middle = Math.floor(sorted.length / 2);
	const upper = sorted[middle] ?? 0;
	return sorted.length % 2 === 1
		? upper
		: Math.round(((sorted[middle - 1] ?? 0) + upper) / 2);
}

function byTime(left: StoredMeasurementEvent, right: StoredMeasurementEvent) {
	return left.occurredAt.getTime() - right.occurredAt.getTime();
}

/** Keeps the events the definition's scope covers, grouped per workflow and in server-time order. */
function groupFlowsInScope(
	definition: StoredMeasurementDefinition,
	events: StoredMeasurementEvent[],
	pseudonymize: Pseudonymize
): StoredMeasurementEvent[][] {
	const listedProjects =
		definition.scope.projects.kind === "listed_projects"
			? new Set(
					definition.scope.projects.projectIds.map((id) =>
						pseudonymize("project", id)
					)
				)
			: null;
	const ownerPseudonym =
		definition.scope.users === "owner_only"
			? pseudonymize("user", definition.ownerUserId)
			: null;
	const inScope = (event: StoredMeasurementEvent) =>
		definition.scope.surfaces.includes(event.surface) &&
		(!listedProjects || listedProjects.has(event.projectPseudonym)) &&
		(!ownerPseudonym || event.userPseudonym === ownerPseudonym);

	// A workflow id is only unique within one user and project, so the flow key includes both pseudonyms.
	const flows = new Map<string, StoredMeasurementEvent[]>();
	for (const event of events.filter(inScope).sort(byTime)) {
		const key = JSON.stringify([
			event.userPseudonym,
			event.projectPseudonym,
			event.workflowId,
		]);
		flows.set(key, [...(flows.get(key) ?? []), event]);
	}
	return [...flows.values()];
}

interface Tally {
	counterTotals: Record<string, number>;
	denominator: number;
	durationsMs: number[];
	endOutcomeCounts: Record<string, number>;
	excludedFlows: number;
	missingEnd: number;
	missingStart: number;
	numerator: number;
}

function tallyGuardrail(
	definition: StoredMeasurementDefinition,
	flowEvents: StoredMeasurementEvent[],
	tally: Tally
) {
	for (const event of flowEvents) {
		for (const [label, value] of Object.entries(event.counters)) {
			increment(tally.counterTotals, label, value);
		}
		if (event.eventName === definition.endEvent) {
			increment(tally.endOutcomeCounts, event.outcomeClass);
		}
	}
}

/** A duration and a success count need this flow's explicit start and a later explicit end; anything else is abandonment. */
function tallyOutcome(
	definition: StoredMeasurementDefinition,
	flowEvents: StoredMeasurementEvent[],
	startEvent: StoredMeasurementEvent | undefined,
	tally: Tally
) {
	const endEvent = startEvent
		? flowEvents.find(
				(event) =>
					event.eventName === definition.endEvent &&
					event.occurredAt >= startEvent.occurredAt
			)
		: undefined;
	if (!(startEvent && endEvent)) {
		if (startEvent) {
			tally.missingEnd += 1;
		} else {
			tally.missingStart += 1;
		}
		return;
	}
	tally.durationsMs.push(
		endEvent.occurredAt.getTime() - startEvent.occurredAt.getTime()
	);
	if (startEvent.outcomeClass === definition.denominator.outcomeClass) {
		tally.denominator += 1;
		if (endEvent.outcomeClass === definition.numerator.outcomeClass) {
			tally.numerator += 1;
		}
	}
}

/**
 * Computes one definition version's measures from the events collected under
 * exactly that version. Only labels, counters and server times are read, so no
 * image or subjective rating can turn into a success label.
 */
function computeMeasure(
	definition: StoredMeasurementDefinition,
	events: StoredMeasurementEvent[],
	asOf: Date,
	pseudonymize: Pseudonymize
): MeasurementMeasure {
	const windowDays = Math.min(
		definition.timeWindowDays,
		definition.retentionDays
	);
	const windowStart = new Date(asOf.getTime() - windowDays * dayMs);
	const exclusions = new Set(definition.exclusions);
	const tally: Tally = {
		counterTotals: {},
		denominator: 0,
		durationsMs: [],
		endOutcomeCounts: {},
		excludedFlows: 0,
		missingEnd: 0,
		missingStart: 0,
		numerator: 0,
	};

	for (const flowEvents of groupFlowsInScope(
		definition,
		events,
		pseudonymize
	)) {
		const startEvent = flowEvents.find(
			(event) => event.eventName === definition.startEvent
		);
		// A flow belongs to the window by when it began, or by its first event if it never did.
		const anchor = startEvent ?? flowEvents[0];
		if (!anchor || anchor.occurredAt < windowStart) {
			continue;
		}
		if (
			flowEvents.some(
				(event) =>
					exclusions.has(event.outcomeClass) || exclusions.has(event.recordKind)
			)
		) {
			tally.excludedFlows += 1;
			continue;
		}
		tallyGuardrail(definition, flowEvents, tally);
		tallyOutcome(definition, flowEvents, startEvent, tally);
	}

	const durationsMs = tally.durationsMs.sort((left, right) => left - right);
	return {
		abandonment: {
			missingEnd: tally.missingEnd,
			missingStart: tally.missingStart,
			total: tally.missingEnd + tally.missingStart,
		},
		definitionId: definition.id,
		duration: {
			completedFlows: durationsMs.length,
			durationsMs,
			maxMs: durationsMs.at(-1) ?? null,
			medianMs: median(durationsMs),
			minMs: durationsMs[0] ?? null,
		},
		eventFamily: definition.eventFamily,
		excludedFlows: tally.excludedFlows,
		guardrail: {
			counterTotals: tally.counterTotals,
			endOutcomeCounts: tally.endOutcomeCounts,
		},
		metricId: definition.metricId,
		success: {
			denominator: {
				count: tally.denominator,
				outcomeClass: definition.denominator.outcomeClass,
			},
			numerator: {
				count: tally.numerator,
				outcomeClass: definition.numerator.outcomeClass,
			},
		},
		version: definition.version,
		windowStart: windowStart.toISOString(),
	};
}

export function createMeasurementMeasureStore({
	definitionStorage,
	eventStorage,
	now = () => new Date(),
	pseudonymize,
}: MeasurementMeasureStoreOptions): MeasurementMeasureStore {
	return {
		async compute(userId) {
			const asOf = now();
			const definitions = (await definitionStorage.listForOwner(userId)).sort(
				(left, right) =>
					left.metricId.localeCompare(right.metricId) ||
					left.version - right.version
			);
			const measures = await Promise.all(
				definitions.map(async (definition) =>
					computeMeasure(
						definition,
						await eventStorage.listByDefinitionId(definition.id),
						asOf,
						pseudonymize
					)
				)
			);
			return measurementMeasureReportSchema.parse({
				asOf: asOf.toISOString(),
				claim: { reason: "no_baseline_and_target", status: "not_claimed" },
				measures,
			});
		},
	};
}

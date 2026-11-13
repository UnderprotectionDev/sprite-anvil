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
import type { Pseudonymize } from "./measurement-pseudonymize";
import { createScopeCheck } from "./measurement-scope";

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
	const violatesScope = createScopeCheck(definition, pseudonymize);
	// A workflow id is only unique within one user and project, so the flow key includes both pseudonyms.
	const flows = new Map<string, StoredMeasurementEvent[]>();
	for (const event of events.sort(byTime)) {
		if (violatesScope(event)) {
			continue;
		}
		const key = JSON.stringify([
			event.userPseudonym,
			event.projectPseudonym,
			event.workflowId,
		]);
		const flow = flows.get(key);
		if (flow) {
			flow.push(event);
		} else {
			flows.set(key, [event]);
		}
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
	unusedEndEvents: number;
}

function newTally(): Tally {
	return {
		counterTotals: {},
		denominator: 0,
		durationsMs: [],
		endOutcomeCounts: {},
		excludedFlows: 0,
		missingEnd: 0,
		missingStart: 0,
		numerator: 0,
		unusedEndEvents: 0,
	};
}

/** The window is the shorter of the time window and the retention period, ending at the server's now. */
function windowStartOf(definition: StoredMeasurementDefinition, asOf: Date) {
	const windowDays = Math.min(
		definition.timeWindowDays,
		definition.retentionDays
	);
	return new Date(asOf.getTime() - windowDays * dayMs);
}

/** A flow belongs to the window by when it began, or by its first event if it never did. */
function isInWindow(
	definition: StoredMeasurementDefinition,
	flowEvents: StoredMeasurementEvent[],
	windowStart: Date
) {
	const anchor =
		flowEvents.find((event) => event.eventName === definition.startEvent) ??
		flowEvents[0];
	return anchor !== undefined && anchor.occurredAt >= windowStart;
}

/** A flow with any event of an excluded outcome class or record kind leaves every count. */
function isExcluded(
	definition: StoredMeasurementDefinition,
	flowEvents: StoredMeasurementEvent[]
) {
	const exclusions = new Set(definition.exclusions);
	return flowEvents.some(
		(event) =>
			exclusions.has(event.outcomeClass) || exclusions.has(event.recordKind)
	);
}

/** Guardrails are raw tallies over every in-scope event of the flow, duplicates included. */
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

/**
 * A duration and a success count need the flow's first start and the first end
 * stamped at or after it (an end at the very same time counts, as a zero-length
 * flow); anything else is abandonment. An end before the start never completes
 * a flow. Every other end event of a completed flow, a later duplicate or an
 * early one, is neither a duration nor a success: it is counted once in
 * `unusedEndEvents` so it stays visible without changing the result.
 */
function tallyOutcome(
	definition: StoredMeasurementDefinition,
	flowEvents: StoredMeasurementEvent[],
	tally: Tally
) {
	const startEvent = flowEvents.find(
		(event) => event.eventName === definition.startEvent
	);
	const endEvents = flowEvents.filter(
		(event) => event.eventName === definition.endEvent
	);
	const endEvent = startEvent
		? endEvents.find((event) => event.occurredAt >= startEvent.occurredAt)
		: undefined;
	if (!(startEvent && endEvent)) {
		if (startEvent) {
			tally.missingEnd += 1;
		} else {
			tally.missingStart += 1;
		}
		return;
	}
	tally.unusedEndEvents += endEvents.length - 1;
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

function toMeasure(
	definition: StoredMeasurementDefinition,
	tally: Tally,
	windowStart: Date
): MeasurementMeasure {
	const durationsMs = tally.durationsMs.sort((left, right) => left - right);
	return {
		abandonment: {
			missingEnd: tally.missingEnd,
			missingStart: tally.missingStart,
			total: tally.missingEnd + tally.missingStart,
		},
		contractVersion: definition.contractVersion,
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
		unusedEndEvents: tally.unusedEndEvents,
		version: definition.version,
		windowStart: windowStart.toISOString(),
	};
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
	const windowStart = windowStartOf(definition, asOf);
	const tally = newTally();
	for (const flowEvents of groupFlowsInScope(
		definition,
		events,
		pseudonymize
	)) {
		if (!isInWindow(definition, flowEvents, windowStart)) {
			continue;
		}
		if (isExcluded(definition, flowEvents)) {
			tally.excludedFlows += 1;
			continue;
		}
		tallyGuardrail(definition, flowEvents, tally);
		tallyOutcome(definition, flowEvents, tally);
	}
	return toMeasure(definition, tally, windowStart);
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

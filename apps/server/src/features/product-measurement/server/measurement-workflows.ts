import type { MeasurementDefinitionStore } from "@sprite-anvil/api/measurement-definition-store";
import type { MeasurementEventStore } from "@sprite-anvil/api/measurement-event-store";
import {
	type ProductMeasurementRecorder,
	productMeasurementBoundarySchema,
} from "@sprite-anvil/api/measurement-workflows";
import { idempotentRecordId } from "@sprite-anvil/api/record-publication";
import type { MeasurementEventStorage } from "./measurement-event-storage";

export function createProductMeasurementRecorder({
	definitionStore,
	eventStore,
	storage,
}: {
	definitionStore: MeasurementDefinitionStore;
	eventStore: MeasurementEventStore;
	storage: MeasurementEventStorage;
}): ProductMeasurementRecorder {
	return {
		async record(rawInput) {
			const input = productMeasurementBoundarySchema.parse(rawInput);
			if (!input.eventName) {
				return;
			}
			const { definitions } = await definitionStore.list(input.userId);
			const family = definitions.filter(
				(definition) => definition.eventFamily === input.eventFamily
			);
			const latest = new Map<string, (typeof family)[number]>();
			for (const definition of family) {
				const previous = latest.get(definition.metricId);
				if (!previous || previous.version < definition.version) {
					latest.set(definition.metricId, definition);
				}
			}
			const id = (definitionId: string, phase: "start" | "finish") =>
				idempotentRecordId(
					{
						kind: "measurement-boundary",
						userId: input.userId,
						projectId: input.projectId,
						targetId: input.workflowId,
					},
					`${definitionId}:${phase}`
				);
			await Promise.all(
				Array.from(
					input.phase === "start" ? latest.values() : family,
					async (definition) => {
						if (
							(input.phase === "start"
								? definition.startEvent
								: definition.endEvent) !== input.eventName
						) {
							return;
						}
						if (input.phase === "finish") {
							const start = await storage.findById(
								await id(definition.id, "start")
							);
							if (
								!start ||
								start.definitionId !== definition.id ||
								start.workflowId !== input.workflowId ||
								start.surface !== input.surface ||
								start.eventName !== definition.startEvent
							) {
								return;
							}
						}
						await eventStore.record(input.userId, {
							id: await id(definition.id, input.phase),
							projectId: input.projectId,
							workflowId: input.workflowId,
							definitionId: definition.id,
							eventName:
								input.phase === "start"
									? definition.startEvent
									: definition.endEvent,
							surface: input.surface,
							recordKind: input.recordKind,
							outcomeClass: input.outcomeClass,
							counters: input.counters,
						});
					}
				)
			);
		},
	};
}

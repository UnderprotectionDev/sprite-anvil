import type { MeasurementDefinitionStore } from "@sprite-anvil/api/measurement-definition-store";
import type { MeasurementEventStore } from "@sprite-anvil/api/measurement-event-store";
import type { ProductMeasurementRecorder } from "@sprite-anvil/api/measurement-workflows";
import { productMeasurementBoundarySchema } from "@sprite-anvil/api/measurement-workflows";
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
			const metricStartId = (metricId: string) =>
				idempotentRecordId(
					{
						kind: "measurement-boundary",
						userId: input.userId,
						projectId: input.projectId,
						targetId: input.workflowId,
					},
					`metric:${metricId}:start`
				);
			const hasLegacyStart = async (metricId: string) => {
				const starts = await Promise.all(
					family
						.filter((item) => item.metricId === metricId)
						.map(async (item) => storage.findById(await id(item.id, "start")))
				);
				return starts.some(Boolean);
			};
			const hasMatchingStart = async (
				definition: (typeof family)[number],
				stableStartId: string
			) => {
				const start =
					(await storage.findById(await id(definition.id, "start"))) ??
					(await storage.findById(stableStartId));
				return Boolean(
					start &&
						start.definitionId === definition.id &&
						start.workflowId === input.workflowId &&
						start.surface === input.surface &&
						start.eventName === definition.startEvent
				);
			};
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
						const stableStartId = await metricStartId(definition.metricId);
						if (
							input.phase === "start" &&
							(await hasLegacyStart(definition.metricId))
						) {
							return;
						}
						if (
							input.phase === "finish" &&
							!(await hasMatchingStart(definition, stableStartId))
						) {
							return;
						}
						await eventStore.record(input.userId, {
							id:
								input.phase === "start"
									? stableStartId
									: await id(definition.id, input.phase),
							projectId: input.projectId,
							workflowId: input.workflowId,
							definitionId: definition.id,
							eventName: input.eventName,
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

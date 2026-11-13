import { z } from "zod";
import {
	measurementEventFamilySchema,
	measurementRatioTermSchema,
} from "./measurement-definitions";

const countSchema = z.number().int().min(0);
const countsByLabelSchema = z.record(z.string(), countSchema);

/**
 * Durations come only from a workflow's explicit start and end event, both
 * stamped by the server clock. Raw durations and an order summary, never a mean
 * that hides how few flows there are.
 */
export const measurementDurationSchema = z
	.object({
		completedFlows: countSchema,
		durationsMs: z.array(countSchema),
		maxMs: countSchema.nullable(),
		medianMs: countSchema.nullable(),
		minMs: countSchema.nullable(),
	})
	.strict();

/** Raw counts of the definition's numerator and denominator; deliberately no ratio or percentage. */
export const measurementSuccessCountsSchema = z
	.object({
		denominator: measurementRatioTermSchema
			.extend({ count: countSchema })
			.strict(),
		numerator: measurementRatioTermSchema
			.extend({ count: countSchema })
			.strict(),
	})
	.strict();

/** Flows without both an explicit start and end event; a separate outcome, never part of duration or success. */
export const measurementAbandonmentSchema = z
	.object({
		missingEnd: countSchema,
		missingStart: countSchema,
		total: countSchema,
	})
	.strict();

/** Raw guardrail tallies over the in-scope events; they are not a success series. */
export const measurementGuardrailSchema = z
	.object({
		counterTotals: countsByLabelSchema,
		endOutcomeCounts: countsByLabelSchema,
	})
	.strict();

/** One Measurement Definition version's measures; another version of the same metric is another entry. */
export const measurementMeasureSchema = z
	.object({
		abandonment: measurementAbandonmentSchema,
		definitionId: z.uuid(),
		duration: measurementDurationSchema,
		eventFamily: measurementEventFamilySchema,
		excludedFlows: countSchema,
		guardrail: measurementGuardrailSchema,
		metricId: z.string().min(1).max(64),
		success: measurementSuccessCountsSchema,
		version: z.number().int().positive(),
		windowStart: z.iso.datetime(),
	})
	.strict();
export type MeasurementMeasure = z.infer<typeof measurementMeasureSchema>;

export const measurementMeasureReportSchema = z
	.object({
		asOf: z.iso.datetime(),
		/** No baseline and agreed target exist in this contract, so no success percentage is ever claimed. */
		claim: z
			.object({
				reason: z.literal("no_baseline_and_target"),
				status: z.literal("not_claimed"),
			})
			.strict(),
		measures: z.array(measurementMeasureSchema),
	})
	.strict();
export type MeasurementMeasureReport = z.infer<
	typeof measurementMeasureReportSchema
>;

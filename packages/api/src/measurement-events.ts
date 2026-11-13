import { z } from "zod";
import {
	measurementEventFamilySchema,
	measurementSurfaceSchema,
} from "./measurement-definitions";

const idSchema = z.uuid();

/** Contains a long hex or digit run, or a well-known credential prefix: shapes a secret or content digest takes. */
const secretShape =
	/[a-f0-9]{20,}|\d{10,}|^(?:sk|pk|ghp|gho|ghs|xox[a-z]|akia|eyj)[_a-z0-9-]*$/i;

/**
 * A closed-vocabulary label: lowercase words joined by underscores. It cannot
 * hold a sentence, a path, a file name with an extension or mixed-case text,
 * and shapes that look like a credential or digest are refused too.
 */
const labelSchema = z
	.string()
	.regex(
		/^[a-z][a-z0-9_]{0,63}$/,
		"Use a short lowercase label of letters, digits and underscores."
	)
	.refine(
		(label) => !secretShape.test(label),
		"A label cannot carry a credential or digest."
	);

const maxCounters = 20;
const maxCounterValue = 1_000_000_000;

/** Required numeric counters: label to non-negative integer, never text. */
export const measurementEventCountersSchema = z
	.record(
		labelSchema,
		z.number().int().min(0).max(maxCounterValue),
		"Counters are labels with whole-number values."
	)
	.refine(
		(counters) => Object.keys(counters).length <= maxCounters,
		`At most ${maxCounters} counters are allowed.`
	);

const envelopeFields = {
	counters: measurementEventCountersSchema,
	/** The activated Measurement Definition version this event belongs to. */
	definitionId: idSchema,
	/** The definition's start or end event this record marks. */
	eventName: labelSchema,
	outcomeClass: labelSchema,
	/** The kind of record the workflow handled, as a label; never a record name. */
	recordKind: labelSchema,
	surface: measurementSurfaceSchema,
	/** Correlates the start and end events of one workflow run. */
	workflowId: idSchema,
};

/**
 * What a client may send. Strict: any other key (file content, pixels, raw
 * instructions, notes, paths, asset names, secrets, a client clock) fails
 * validation instead of being dropped, so it is never persisted. The user and
 * the time come from the server session and clock, not from the payload.
 */
export const measurementEventRecordInputSchema = z
	.object({
		...envelopeFields,
		/** Idempotency key: the same id with the same content returns the stored event; different content is a conflict. */
		id: idSchema,
		projectId: idSchema,
	})
	.strict();
export type MeasurementEventRecordInput = z.infer<
	typeof measurementEventRecordInputSchema
>;

/** The stored envelope: pseudonymous identities, server time and the definition version it relates to. */
export const measurementEventSchema = z
	.object({
		...envelopeFields,
		definitionVersion: z.number().int().positive(),
		eventFamily: measurementEventFamilySchema,
		id: idSchema,
		metricId: z.string().min(1).max(64),
		/** Always the server clock; a device clock never moves a measurement. */
		occurredAt: z.iso.datetime(),
		projectPseudonym: z.string().min(1).max(128),
		timeSource: z.literal("server_time"),
		userPseudonym: z.string().min(1).max(128),
	})
	.strict();
export type MeasurementEvent = z.infer<typeof measurementEventSchema>;

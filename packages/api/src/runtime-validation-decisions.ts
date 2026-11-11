import { z } from "zod";
import { idempotencyKeySchema } from "./record-publication";

const idSchema = z.uuid();

/** Geçti, Başarısız or Sonuçsuz; chosen only by the user. */
export const runtimeValidationOutcomes = [
	"pass",
	"fail",
	"inconclusive",
] as const;
export const runtimeValidationOutcomeSchema = z.enum(runtimeValidationOutcomes);
export type RuntimeValidationOutcome = z.infer<
	typeof runtimeValidationOutcomeSchema
>;

/** What the user can confirm as the failure source; Source Unknown is only ever the initial state of a Fail. */
export const runtimeValidationConfirmedFailureSources = [
	"asset_content",
	"engine_adapter",
	"game_configuration",
	"multiple_sources",
] as const;
export const runtimeValidationConfirmedFailureSourceSchema = z.enum(
	runtimeValidationConfirmedFailureSources
);
export type RuntimeValidationConfirmedFailureSource = z.infer<
	typeof runtimeValidationConfirmedFailureSourceSchema
>;

export const runtimeValidationFailureSourceSchema = z.enum([
	"source_unknown",
	...runtimeValidationConfirmedFailureSources,
]);
export type RuntimeValidationFailureSource = z.infer<
	typeof runtimeValidationFailureSourceSchema
>;

export const runtimeValidationDecisionKindSchema = z.enum([
	"outcome",
	"failure_source",
]);

/** The outcome is chosen from this input only; there is no adapter or automation field. */
export const runtimeValidationFinalizeOutcomeInputSchema = z
	.object({
		idempotencyKey: idempotencyKeySchema,
		outcome: runtimeValidationOutcomeSchema,
		projectId: idSchema,
		recordId: idSchema,
	})
	.strict();
export type RuntimeValidationFinalizeOutcomeInput = z.infer<
	typeof runtimeValidationFinalizeOutcomeInputSchema
>;

export const runtimeValidationConfirmFailureSourceInputSchema = z
	.object({
		failureSource: runtimeValidationConfirmedFailureSourceSchema,
		idempotencyKey: idempotencyKeySchema,
		projectId: idSchema,
		recordId: idSchema,
	})
	.strict();
export type RuntimeValidationConfirmFailureSourceInput = z.infer<
	typeof runtimeValidationConfirmFailureSourceInputSchema
>;

/** One append-only decision as re-read, in the order it was made. */
export const runtimeValidationDecisionSchema = z.object({
	createdAt: z.iso.datetime(),
	failureSource: runtimeValidationConfirmedFailureSourceSchema.nullable(),
	id: idSchema,
	kind: runtimeValidationDecisionKindSchema,
	outcome: runtimeValidationOutcomeSchema.nullable(),
});
export type RuntimeValidationDecision = z.infer<
	typeof runtimeValidationDecisionSchema
>;

export const runtimeValidationDecisionResultSchema = z.object({
	decision: runtimeValidationDecisionSchema,
	status: z.enum(["created", "replayed"]),
});

/** The outcome and failure source a record currently has, derived from its decisions. */
export function deriveRuntimeValidationState(
	decisions: Pick<RuntimeValidationDecision, "failureSource" | "outcome">[]
): {
	failureSource: RuntimeValidationFailureSource | null;
	outcome: RuntimeValidationOutcome | null;
} {
	const outcome = decisions.find((item) => item.outcome !== null)?.outcome;
	if (!outcome) {
		return { failureSource: null, outcome: null };
	}
	if (outcome !== "fail") {
		return { failureSource: null, outcome };
	}
	const confirmed = decisions
		.filter((item) => item.failureSource !== null)
		.at(-1)?.failureSource;
	return { failureSource: confirmed ?? "source_unknown", outcome };
}

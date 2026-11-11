import { z } from "zod";
import type { RuntimeValidationRecord } from "./runtime-validation";

const idSchema = z.uuid();
const labelSchema = z.string().trim().min(1).max(200);

/** One game environment a Delivery Target needs validated: game build, engine version and optional adapter version label. */
export const runtimeValidationEnvironmentSchema = z
	.object({
		adapterVersion: labelSchema.nullable(),
		engineVersion: labelSchema,
		gameBuild: labelSchema,
	})
	.strict();
export type RuntimeValidationEnvironment = z.infer<
	typeof runtimeValidationEnvironmentSchema
>;

/**
 * The only freshness rule so far: a record is current only while no other
 * record of the same bundle and environment names it as superseded. Further
 * rules are added as options here.
 */
export const runtimeValidationFreshnessSchema = z.enum(["not_superseded"]);

/** A Delivery Target's runtime validation acceptance criterion, pinned with its revision. */
export const runtimeValidationCriterionSchema = z
	.object({
		environments: z
			.array(runtimeValidationEnvironmentSchema)
			.min(1, "A runtime validation criterion needs at least one environment.")
			.max(20)
			.refine(
				(environments) =>
					new Set(environments.map((entry) => environmentKey(entry))).size ===
					environments.length,
				"An environment can be required only once."
			),
		freshness: runtimeValidationFreshnessSchema,
	})
	.strict();
export type RuntimeValidationCriterion = z.infer<
	typeof runtimeValidationCriterionSchema
>;

function environmentKey(environment: RuntimeValidationEnvironment) {
	return JSON.stringify([
		environment.gameBuild,
		environment.engineVersion,
		environment.adapterVersion,
	]);
}

export const runtimeValidationBlockers = [
	"no_record",
	"decision_pending",
	"inconclusive",
	"failed_source_unknown",
	"failed_revalidation_required",
	/** Kept for the contract; the current record is by definition never superseded. */
	"superseded",
] as const;
export const runtimeValidationBlockerSchema = z.enum(runtimeValidationBlockers);
export type RuntimeValidationBlocker = z.infer<
	typeof runtimeValidationBlockerSchema
>;

export const runtimeValidationEnvironmentReadinessSchema = z.object({
	blocker: runtimeValidationBlockerSchema.nullable(),
	environment: runtimeValidationEnvironmentSchema,
	/** The record the status rests on; null when no record matches the environment. */
	recordId: idSchema.nullable(),
	satisfied: z.boolean(),
});

export const runtimeValidationReadinessSchema = z.object({
	environments: z.array(runtimeValidationEnvironmentReadinessSchema),
	/** True when the target has no criterion, or every required environment has a current Pass. */
	ready: z.boolean(),
	/** Whether the target's revision carries a runtime validation criterion at all. */
	required: z.boolean(),
});
export type RuntimeValidationReadiness = z.infer<
	typeof runtimeValidationReadinessSchema
>;

export const runtimeValidationReadinessInputSchema = z
	.object({
		/** The exact Export Bundle offered to satisfy the target. */
		bundleId: idSchema,
		projectId: idSchema,
		revisionId: idSchema,
	})
	.strict();

function sameEnvironment(
	record: Pick<
		RuntimeValidationRecord,
		"adapterVersion" | "engineVersion" | "gameBuild"
	>,
	environment: RuntimeValidationEnvironment
) {
	return (
		record.gameBuild === environment.gameBuild &&
		record.engineVersion === environment.engineVersion &&
		record.adapterVersion === environment.adapterVersion
	);
}

/**
 * Whether the exact bundle meets a Delivery Target's criterion. A record counts
 * only for its exact bundle, game build, engine and adapter version; the latest
 * such record decides, and only a Pass the user finalized satisfies the
 * environment. The current record is the latest one in that bundle and
 * environment that no other record there supersedes. `records` are oldest
 * first, as listed.
 */
export function evaluateRuntimeValidationCriterion(
	criterion: RuntimeValidationCriterion | null,
	bundleId: string,
	records: RuntimeValidationRecord[]
): RuntimeValidationReadiness {
	if (!criterion) {
		return { environments: [], ready: true, required: false };
	}
	const environments = criterion.environments.map((environment) => {
		const matching = records.filter(
			(record) =>
				record.bundleId === bundleId && sameEnvironment(record, environment)
		);
		// A retest supersedes only its own bundle and environment, so only these records can.
		const supersededIds = new Set(
			matching.flatMap((record) =>
				record.supersedesRecordId ? [record.supersedesRecordId] : []
			)
		);
		const current = matching
			.filter((record) => !supersededIds.has(record.id))
			.at(-1);
		const blocked = (blocker: RuntimeValidationBlocker) => ({
			blocker,
			environment,
			recordId: current?.id ?? null,
			satisfied: false,
		});
		if (!current) {
			return blocked("no_record");
		}
		switch (current.outcome) {
			case null:
				return blocked("decision_pending");
			case "inconclusive":
				return blocked("inconclusive");
			case "fail":
				return blocked(
					current.failureSource === "source_unknown"
						? "failed_source_unknown"
						: "failed_revalidation_required"
				);
			default:
				return {
					blocker: null,
					environment,
					recordId: current.id,
					satisfied: true,
				};
		}
	});
	return {
		environments,
		ready: environments.every((entry) => entry.satisfied),
		required: true,
	};
}

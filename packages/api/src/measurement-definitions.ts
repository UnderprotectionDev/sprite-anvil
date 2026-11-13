import { z } from "zod";

/** The only contract major version this build can activate; a definition with another major is stopped, never coerced. */
export const supportedMeasurementContractMajor = 1;

const idSchema = z.uuid();
const slugSchema = z
	.string()
	.trim()
	.regex(
		/^[a-z][a-z0-9_]{0,63}$/,
		"Use lowercase letters, digits and underscores, starting with a letter."
	);

/** The event families of PRD 09 section 7; each owns one start and end boundary pair. */
export const measurementEventFamilySchema = z.enum([
	"production_workflow",
	"review_and_repair",
	"import_mapping",
	"export_delivery",
	"runtime_validation",
	"offline_verification",
]);
export type MeasurementEventFamily = z.infer<
	typeof measurementEventFamilySchema
>;

export const measurementSurfaceSchema = z.enum(["web", "desktop"]);

/** The population a metric counts: which users, projects and surfaces. */
export const measurementScopeSchema = z
	.object({
		projects: z.discriminatedUnion("kind", [
			z.object({ kind: z.literal("all_projects") }).strict(),
			z
				.object({
					kind: z.literal("listed_projects"),
					projectIds: z.array(idSchema).min(1).max(200),
				})
				.strict(),
		]),
		surfaces: z
			.array(measurementSurfaceSchema)
			.min(1)
			.refine(
				(surfaces) => new Set(surfaces).size === surfaces.length,
				"A surface can be chosen only once."
			),
		users: z.enum(["owner_only", "all_users"]),
	})
	.strict();
export type MeasurementScope = z.infer<typeof measurementScopeSchema>;

/** One side of a ratio: the outcome class of the events it counts. */
export const measurementRatioTermSchema = z
	.object({ outcomeClass: slugSchema })
	.strict();

const contractVersionSchema = z
	.string()
	.trim()
	.regex(/^\d{1,4}\.\d{1,4}$/, "Use a major.minor contract version.");

/** The fields a user fixes; the server adds the version number, the time source and the activation time. */
const definitionFields = {
	contractVersion: contractVersionSchema,
	/** The product decision the result can change; it describes the metric, it is not telemetry. */
	decisionUse: z.string().trim().min(1).max(500),
	denominator: measurementRatioTermSchema,
	endEvent: slugSchema,
	eventFamily: measurementEventFamilySchema,
	exclusions: z
		.array(slugSchema)
		.max(50)
		.refine(
			(exclusions) => new Set(exclusions).size === exclusions.length,
			"An exclusion rule can be listed only once."
		),
	metricId: slugSchema,
	numerator: measurementRatioTermSchema,
	retentionDays: z.number().int().min(1).max(3650),
	scope: measurementScopeSchema,
	startEvent: slugSchema,
	timeWindowDays: z.number().int().min(1).max(3650),
};

export const measurementDefinitionActivateInputSchema = z
	.object({
		...definitionFields,
		/** Idempotency key: the same id with the same content returns the stored version; different content is a conflict. */
		id: idSchema,
	})
	.strict()
	.refine((input) => input.startEvent !== input.endEvent, {
		message: "The start and end events must differ.",
		path: ["endEvent"],
	});
export type MeasurementDefinitionActivateInput = z.infer<
	typeof measurementDefinitionActivateInputSchema
>;

export const measurementDefinitionSchema = z
	.object({
		...definitionFields,
		activatedAt: z.iso.datetime(),
		id: idSchema,
		/** Always the server clock; a device clock never moves a measurement. */
		timeSource: z.literal("server_time"),
		/** Per metric, starting at 1; a later version never rewrites an earlier one. */
		version: z.number().int().positive(),
	})
	.strict();
export type MeasurementDefinition = z.infer<typeof measurementDefinitionSchema>;

export const measurementDefinitionCatalogSchema = z
	.object({ definitions: z.array(measurementDefinitionSchema) })
	.strict();
export type MeasurementDefinitionCatalog = z.infer<
	typeof measurementDefinitionCatalogSchema
>;

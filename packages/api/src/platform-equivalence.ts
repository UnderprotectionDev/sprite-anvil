import { z } from "zod";
import {
	platformEquivalenceComparisonSchema,
	platformEquivalenceEvidenceSchema,
	platformEquivalenceNotEvaluatedSchema,
	platformSurfaceSchema,
} from "./platform-equivalence-comparison";
import { idempotencyKeySchema } from "./record-publication";

const idSchema = z.uuid();

export const platformEquivalenceOverviewInputSchema = z
	.object({ projectId: idSchema })
	.strict();

export const platformEquivalenceReportGetInputSchema = z
	.object({ projectId: idSchema, reportId: idSchema })
	.strict();

/**
 * Records what one surface derived from one stored Export Bundle. The surface is
 * the client's own declaration; the server cannot verify it. The same
 * `idempotencyKey` replays the first run.
 */
export const platformEquivalenceRunRecordInputSchema = z
	.object({
		bundleId: idSchema,
		idempotencyKey: idempotencyKeySchema,
		projectId: idSchema,
		surface: platformSurfaceSchema,
	})
	.strict();
export type PlatformEquivalenceRunRecordInput = z.infer<
	typeof platformEquivalenceRunRecordInputSchema
>;

/** Compares one chosen web run with one chosen desktop run; either may be absent. */
export const platformEquivalenceReportCreateInputSchema = z
	.object({
		desktopRunId: idSchema.nullable(),
		idempotencyKey: idempotencyKeySchema,
		projectId: idSchema,
		webRunId: idSchema.nullable(),
	})
	.strict();
export type PlatformEquivalenceReportCreateInput = z.infer<
	typeof platformEquivalenceReportCreateInputSchema
>;

export const platformEquivalenceRunSchema = z.object({
	bundleId: z.string(),
	createdAt: z.iso.datetime(),
	evidence: platformEquivalenceEvidenceSchema,
	id: idSchema,
	projectId: idSchema,
	surface: platformSurfaceSchema,
	/** The surface is declared by the client; the server does not verify it. */
	surfaceIdentity: z.literal("client_declared"),
});
export type PlatformEquivalenceRun = z.infer<
	typeof platformEquivalenceRunSchema
>;

export const platformEquivalenceReportSchema = z.object({
	/** This report never claims full PLT-01 acceptance. */
	claimsFullAcceptance: z.literal(false),
	comparison: platformEquivalenceComparisonSchema,
	createdAt: z.iso.datetime(),
	desktopRunId: z.string().nullable(),
	id: idSchema,
	/** What the interim evidence does not evaluate. */
	notEvaluated: z.array(platformEquivalenceNotEvaluatedSchema),
	phase: z.literal("phase_3_interim"),
	projectId: idSchema,
	surfaceIdentity: z.literal("client_declared"),
	webRunId: z.string().nullable(),
});
export type PlatformEquivalenceReport = z.infer<
	typeof platformEquivalenceReportSchema
>;

export const platformEquivalenceOverviewSchema = z.object({
	/** Newest first. */
	reports: z.array(platformEquivalenceReportSchema),
	/** Newest first. */
	runs: z.array(platformEquivalenceRunSchema),
});
export type PlatformEquivalenceOverview = z.infer<
	typeof platformEquivalenceOverviewSchema
>;

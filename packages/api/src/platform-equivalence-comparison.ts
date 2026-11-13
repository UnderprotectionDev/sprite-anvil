/**
 * Pure comparison of the evidence two surfaces produced for one Core Production
 * Lifecycle input. Evidence is derived from a stored Export Bundle, so it holds
 * meaning only: ids that differ per run and generation times are left out.
 */
import { z } from "zod";
import { sha256Schema } from "./export-bundle-manifest";
import type { ExportBundle } from "./export-bundles";
import { recordContentDigest } from "./record-content-digest";

export const platformSurfaceSchema = z.enum(["web", "desktop"]);
export type PlatformSurface = z.infer<typeof platformSurfaceSchema>;
export const platformSurfaces = platformSurfaceSchema.options;

export const platformEquivalenceSections = [
	"authoritative_record",
	"quality_evidence",
	"engine_neutral_package",
] as const;
export const platformEquivalenceSectionSchema = z.enum(
	platformEquivalenceSections
);
export type PlatformEquivalenceSection = z.infer<
	typeof platformEquivalenceSectionSchema
>;

/** What this Phase 3 interim evidence does not evaluate; it is never reported as passed. */
export const platformEquivalenceNotEvaluated = [
	"delivery_refresh_lock",
	"divergence",
	"reference_acceptance_scenarios",
	"extended_acceptance_scenarios",
] as const;
export const platformEquivalenceNotEvaluatedSchema = z.enum(
	platformEquivalenceNotEvaluated
);

export const platformEquivalenceSectionEvidenceSchema = z.object({
	content: z.record(z.string(), z.unknown()),
	digest: sha256Schema,
	fieldDigests: z.record(z.string(), sha256Schema),
});
export type PlatformEquivalenceSectionEvidence = z.infer<
	typeof platformEquivalenceSectionEvidenceSchema
>;

export const platformEquivalenceInputSchema = z.object({
	adapterVersion: z.string().nullable(),
	assetFamilyIds: z.array(z.string()),
	contextRevisionId: z.string(),
	deliveryTargetRevisionId: z.string().nullable(),
	profileRevisionId: z.string(),
});
export type PlatformEquivalenceInput = z.infer<
	typeof platformEquivalenceInputSchema
>;

export const platformEquivalenceEvidenceSchema = z.object({
	input: platformEquivalenceInputSchema,
	inputDigest: sha256Schema,
	sections: z.object({
		authoritative_record: platformEquivalenceSectionEvidenceSchema,
		engine_neutral_package: platformEquivalenceSectionEvidenceSchema,
		quality_evidence: platformEquivalenceSectionEvidenceSchema,
	}),
});
export type PlatformEquivalenceEvidence = z.infer<
	typeof platformEquivalenceEvidenceSchema
>;

export const platformEquivalenceOutcomeSchema = z.enum([
	"equivalent",
	"different",
	"inputs_differ",
	"missing_surface",
]);

export const platformEquivalenceSectionResultSchema = z.object({
	/** Names of the fields whose meaning differs between the surfaces. */
	differences: z.array(z.string()),
	result: z.enum(["same", "different", "not_compared"]),
	section: platformEquivalenceSectionSchema,
});

export const platformEquivalenceComparisonSchema = z.object({
	missingSurfaces: z.array(platformSurfaceSchema),
	outcome: platformEquivalenceOutcomeSchema,
	sections: z.array(platformEquivalenceSectionResultSchema),
});
export type PlatformEquivalenceComparison = z.infer<
	typeof platformEquivalenceComparisonSchema
>;

async function sectionOf(
	content: Record<string, unknown>
): Promise<PlatformEquivalenceSectionEvidence> {
	const entries = await Promise.all(
		Object.entries(content).map(
			async ([field, value]) =>
				[field, await recordContentDigest(value)] as const
		)
	);
	return {
		content,
		digest: await recordContentDigest(content),
		fieldDigests: Object.fromEntries(entries),
	};
}

/** The meaning of one stored Export Bundle, without ids or times that differ per run. */
export async function deriveEquivalenceEvidence(
	bundle: ExportBundle
): Promise<PlatformEquivalenceEvidence> {
	const { manifest } = bundle;
	const input: PlatformEquivalenceInput = {
		adapterVersion: manifest.adapterVersion,
		assetFamilyIds: manifest.families
			.map((family) => family.assetFamilyId)
			.sort((a, b) => a.localeCompare(b)),
		contextRevisionId: manifest.context.revisionId,
		deliveryTargetRevisionId: manifest.deliveryTargetRevisionId,
		profileRevisionId: manifest.profile.revisionId,
	};
	const [authoritative, quality, pkg] = await Promise.all([
		sectionOf({
			compositeVersions: manifest.compositeVersions,
			context: manifest.context,
			engineData: manifest.engineData ?? null,
			families: manifest.families,
			productionEvidence: manifest.productionEvidence,
			profile: {
				contentDigest: manifest.profile.contentDigest,
				revisionId: manifest.profile.revisionId,
			},
			requiredSets: manifest.requiredSets,
			rightsEvidence: manifest.rightsEvidence,
			unitVersions: manifest.unitVersions,
		}),
		sectionOf({
			qualityEvidence: manifest.qualityEvidence,
			waivers: manifest.waivers,
		}),
		sectionOf({
			contractVersion: manifest.contractVersion,
			files: bundle.files.map((file) => ({
				byteSize: file.byteSize,
				path: file.path,
				sha256: file.sha256,
			})),
			manifestDigest: bundle.manifestDigest,
		}),
	]);
	return {
		input,
		inputDigest: await recordContentDigest(input),
		sections: {
			authoritative_record: authoritative,
			engine_neutral_package: pkg,
			quality_evidence: quality,
		},
	};
}

function notCompared() {
	return platformEquivalenceSections.map((section) => ({
		differences: [],
		result: "not_compared" as const,
		section,
	}));
}

/** Compares the evidence of the web and desktop runs; a missing or different-input run compares nothing. */
export function compareEquivalenceEvidence(
	web: PlatformEquivalenceEvidence | null,
	desktop: PlatformEquivalenceEvidence | null
): PlatformEquivalenceComparison {
	const missingSurfaces = platformSurfaces.filter(
		(surface) => !(surface === "web" ? web : desktop)
	);
	if (!(web && desktop)) {
		return {
			missingSurfaces,
			outcome: "missing_surface",
			sections: notCompared(),
		};
	}
	if (web.inputDigest !== desktop.inputDigest) {
		return {
			missingSurfaces: [],
			outcome: "inputs_differ",
			sections: notCompared(),
		};
	}
	const sections = platformEquivalenceSections.map((section) => {
		const left = web.sections[section];
		const right = desktop.sections[section];
		const fields = new Set([
			...Object.keys(left.fieldDigests),
			...Object.keys(right.fieldDigests),
		]);
		const differences = [...fields]
			.filter((field) => left.fieldDigests[field] !== right.fieldDigests[field])
			.sort((a, b) => a.localeCompare(b));
		return {
			differences,
			result:
				differences.length === 0 ? ("same" as const) : ("different" as const),
			section,
		};
	});
	return {
		missingSurfaces: [],
		outcome: sections.every((section) => section.result === "same")
			? "equivalent"
			: "different",
		sections,
	};
}

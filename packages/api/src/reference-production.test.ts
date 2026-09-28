import { expect, test } from "bun:test";
import {
	analyzeReferenceTransferConstraints,
	indexReferenceConflictFeaturesById,
	referenceBoardMetadataSchema,
} from "./reference-production";

test("requires a purpose for custom reference rules and valid override evidence", () => {
	const common = {
		contextOverrideRationale: null,
		customPurpose: null,
		forbiddenFeatures: [],
		notes: null,
		role: "custom" as const,
		transferredFeatures: ["pose" as const],
	};
	const missingPurpose = referenceBoardMetadataSchema.safeParse(common);
	expect(missingPurpose.success).toBe(false);

	const missingOverrideEvidence = referenceBoardMetadataSchema.safeParse({
		...common,
		contextOverrideRationale: "Overrides identity boundary",
		customPurpose: "Use this as a character identity",
		transferredFeatures: ["identity"],
	});
	expect(missingOverrideEvidence.success).toBe(false);

	const validRules = referenceBoardMetadataSchema.safeParse({
		...common,
		contextOverrideRationale: "Matches the specific family direction.",
		customPurpose: "Use the silhouette",
		transferredFeatures: ["identity"],
	});
	expect(validRules.success).toBe(true);
});

test("reports a conflict when one Reference Role both allows and forbids a feature", () => {
	const result = analyzeReferenceTransferConstraints([
		{
			forbiddenFeatures: ["palette"],
			id: "reference-one",
			transferredFeatures: ["palette"],
		},
	]);

	expect(result).toEqual({
		conflicts: [
			{
				allowingReferenceIds: ["reference-one"],
				feature: "palette",
				forbiddingReferenceIds: ["reference-one"],
			},
		],
		effectiveForbiddenFeatures: [],
		effectiveTransferredFeatures: [],
	});
});

test("reports a conflict when different Reference Roles have opposing rules", () => {
	const result = analyzeReferenceTransferConstraints([
		{
			forbiddenFeatures: [],
			id: "pose-reference",
			transferredFeatures: ["palette"],
		},
		{
			forbiddenFeatures: ["palette"],
			id: "avoid-palette-reference",
			transferredFeatures: [],
		},
	]);

	expect(result.conflicts).toEqual([
		{
			allowingReferenceIds: ["pose-reference"],
			feature: "palette",
			forbiddingReferenceIds: ["avoid-palette-reference"],
		},
	]);
	expect(result.effectiveForbiddenFeatures).toEqual([]);
	expect(result.effectiveTransferredFeatures).toEqual([]);
});

test("indexes each conflict feature under its allowing and forbidding references", () => {
	const featuresByReference = indexReferenceConflictFeaturesById([
		{
			allowingReferenceIds: ["reference-one"],
			feature: "palette",
			forbiddingReferenceIds: ["reference-two"],
		},
		{
			allowingReferenceIds: ["reference-three"],
			feature: "identity",
			forbiddingReferenceIds: ["reference-one"],
		},
	]);

	expect([...(featuresByReference.get("reference-one") ?? [])]).toEqual([
		"palette",
		"identity",
	]);
	expect([...(featuresByReference.get("reference-two") ?? [])]).toEqual([
		"palette",
	]);
	expect([...(featuresByReference.get("reference-three") ?? [])]).toEqual([
		"identity",
	]);
});

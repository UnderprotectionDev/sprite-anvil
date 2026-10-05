import { describe, expect, test } from "bun:test";
import { assetFamilyComparisonInputSchema } from "./asset-family-comparisons";

const projectId = "5e641210-5f0d-4e2d-8b4a-8b4e138f5f1d";
const assetFamilyId = "5b741210-5f0d-4e2d-8b4a-8b4e138f5f1d";

function input() {
	return {
		id: "5a741210-5f0d-4e2d-8b4a-8b4e138f5f1d",
		projectId,
		assetFamilyId,
		contractRevisionId: "object_weapon_equipment_states@1.0.0",
		assetVersions: [
			{
				assetRecordId: "5c741210-5f0d-4e2d-8b4a-8b4e138f5f1d",
				assetVersionId: "5d741210-5f0d-4e2d-8b4a-8b4e138f5f1d",
				unitVersionIds: ["5f741210-5f0d-4e2d-8b4a-8b4e138f5f1d"],
			},
			{
				assetRecordId: "60741210-5f0d-4e2d-8b4a-8b4e138f5f1d",
				assetVersionId: "61741210-5f0d-4e2d-8b4a-8b4e138f5f1d",
				unitVersionIds: ["62741210-5f0d-4e2d-8b4a-8b4e138f5f1d"],
			},
		],
		observations: {
			scale: "The opened state is larger than the closed state.",
			perspective: "Both views use the same low angle.",
			materialLanguage: "Both states use the same brushed steel texture.",
			stateDirectionDistinction:
				"The open and closed states remain easy to tell apart.",
		},
	};
}

describe("Asset Family Comparison input", () => {
	test("accepts user observations without asking for an automatic verdict", () => {
		const parsed = assetFamilyComparisonInputSchema.safeParse(input());

		expect(parsed.success).toBe(true);
	});

	test("requires current Asset Versions from at least two Asset Records", () => {
		const comparison = input();
		const firstAssetVersion = comparison.assetVersions.at(0);
		if (!firstAssetVersion) {
			throw new Error("The comparison fixture needs its first Asset Version.");
		}
		const oneVersionWithSeveralUnits = {
			...comparison,
			assetVersions: [
				{
					...firstAssetVersion,
					unitVersionIds: [
						"5f741210-5f0d-4e2d-8b4a-8b4e138f5f1d",
						"63741210-5f0d-4e2d-8b4a-8b4e138f5f1d",
					],
				},
			],
		};

		expect(
			assetFamilyComparisonInputSchema.safeParse(oneVersionWithSeveralUnits)
				.success
		).toBe(false);
	});

	test("rejects a repeated Asset Record even when the Asset Version ids differ", () => {
		const comparison = input();
		const [firstAssetVersion, secondAssetVersion] = comparison.assetVersions;
		if (!(firstAssetVersion && secondAssetVersion)) {
			throw new Error("The comparison fixture needs two Asset Versions.");
		}
		comparison.assetVersions[1] = {
			...secondAssetVersion,
			assetRecordId: firstAssetVersion.assetRecordId,
		};

		expect(assetFamilyComparisonInputSchema.safeParse(comparison).success).toBe(
			false
		);
	});

	test("does not accept outcome or rationale fields", () => {
		expect(
			assetFamilyComparisonInputSchema.safeParse({
				...input(),
				outcome: "consistent",
				rationale: "An automated verdict is outside this comparison.",
			}).success
		).toBe(false);
	});
});

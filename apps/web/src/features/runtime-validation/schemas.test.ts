import { expect, test } from "vitest";
import { deliveryTargetFormSchema } from "../delivery-planning/schemas";
import { runtimeValidationRecordFormSchema } from "./schemas";

const tooLong = "x".repeat(201);
const limitMessage = "Use at most 200 characters.";

function recordIssues(gameBuild: string, adapterVersion = "") {
	const result = runtimeValidationRecordFormSchema.safeParse({
		adapterVersion,
		bundleId: "b",
		engineVersion: "Godot",
		gameBuild,
		supersedesRecordId: "",
	});
	return result.success ? [] : result.error.issues.map((item) => item.message);
}

function criterionIssues(gameBuild: string, adapterVersion = "") {
	const result = deliveryTargetFormSchema.safeParse({
		acceptableStates: ["documented"],
		defaultProductionRequirement: "advisory",
		families: ["a", "b"].map((id) => ({
			assetFamilyId: id,
			assetFamilyName: id,
			productionRequirement: "default",
			requiredSetRevisionId: id,
			selected: true,
		})),
		name: "Target",
		purpose: "demo",
		requireRecordFor: [],
		requireRuntimeValidation: true,
		runtimeEnvironments: [
			{ adapterVersion, engineVersion: "Godot", gameBuild },
		],
	});
	return result.success
		? []
		: result.error.issues
				.filter((item) => item.path[0] === "runtimeEnvironments")
				.map((item) => item.message);
}

test("the environment fields follow one rule in the record and the criterion forms", () => {
	for (const issues of [recordIssues, criterionIssues]) {
		expect(issues("   ")).toContain("Enter the game build.");
		expect(issues(tooLong)).toContain(limitMessage);
		expect(issues("build-1", tooLong)).toContain(limitMessage);
		expect(issues("build-1")).toEqual([]);
	}
});

test("surrounding whitespace is not counted toward the 200 character limit in either form", () => {
	const padded = `  ${"x".repeat(200)}  `;
	expect(recordIssues(padded)).toEqual([]);
	expect(criterionIssues(padded)).toEqual([]);
});

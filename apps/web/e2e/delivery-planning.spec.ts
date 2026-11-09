import { expect, test } from "@playwright/test";
import {
	deliveryPlanningFixture as fixture,
	prepareDeliveryPlanningWorkspace,
} from "./delivery-planning-fixture";

const readinessPlanUrl = /\/readiness-plan\?deliveryTargetId=/;
const moveDownName = /^Move .* down$/;
const familyListRevisionOne = /^Etkin Sürüm 1$/;
const familyListRevisionTwo = /Sürüm 2/;
const rationaleTerms = [
	"Target requirement",
	"Work opened",
	"User priority",
	"Revalidation impact",
];

test("activates a Delivery Target, re-versions it with evidence policies and opens its Readiness Plan", async ({
	page,
}) => {
	test.skip(
		!process.env.CONTEXT_TEST_DATABASE_URL,
		"CONTEXT_TEST_DATABASE_URL is required for the persistent flow."
	);
	test.setTimeout(240_000);

	await prepareDeliveryPlanningWorkspace(page);

	// A draft spanning two Asset Families is reviewed before anything is official.
	await expect(
		page.getByText("This project has no Delivery Targets yet.")
	).toBeVisible();
	await page.getByRole("button", { name: "New Delivery Target" }).click();
	await page.getByLabel("Name", { exact: true }).fill(fixture.targetName);
	// Purpose, the default requirement and the accepted Rights Record states start unchosen.
	await expect(page.getByLabel("Purpose")).toHaveValue("");
	await expect(
		page.getByLabel("Default Production Evidence requirement")
	).toHaveValue("");
	await expect(
		page.getByRole("checkbox", { name: "Documented" })
	).not.toBeChecked();
	await page.getByLabel("Purpose").selectOption({ label: "Demo" });
	await page
		.getByLabel("Default Production Evidence requirement")
		.selectOption({ label: "Missing history is advisory" });
	await page.getByRole("checkbox", { name: "Documented" }).check();
	for (const family of fixture.families) {
		// biome-ignore lint/performance/noAwaitInLoops: Checkbox interactions are order-independent but kept sequential for stable rendering.
		await page.getByRole("checkbox", { name: family.familyName }).check();
	}
	await page.getByRole("button", { name: "Save draft" }).click();

	const review = page.getByRole("region", { name: "Draft review" });
	await expect(review).toBeVisible();
	for (const family of fixture.families) {
		// biome-ignore lint/performance/noAwaitInLoops: Assertions read the same review section in order.
		await expect(review.getByText(family.familyName)).toBeVisible();
		await expect(review.getByText(family.itemName)).toBeVisible();
	}
	await expect(
		review.getByText("Context Revision", { exact: false })
	).toBeVisible();
	await expect(page.getByText("Not activated")).toBeVisible();
	await expect(
		page.getByRole("link", { name: "Open Readiness Plan" })
	).toHaveCount(0);

	// Activation turns the draft into revision 1, and a reload re-reads it.
	await review.getByRole("button", { name: "Activate revision" }).click();
	await expect(
		page.getByRole("heading", { name: "Active revision 1" })
	).toBeVisible();
	await page.reload();
	await expect(
		page.getByRole("heading", { name: "Active revision 1" })
	).toBeVisible();
	await expect(page.getByRole("region", { name: "Draft review" })).toHaveCount(
		0
	);
	for (const family of fixture.families) {
		// biome-ignore lint/performance/noAwaitInLoops: Assertions read the re-loaded page in order.
		await expect(page.getByText(family.familyName).first()).toBeVisible();
	}

	// Re-versioning pins both evidence policies and leaves revision 1 as it was.
	await page.getByRole("button", { name: "New revision" }).click();
	await expect(page.getByLabel("Name", { exact: true })).toBeDisabled();
	await page
		.getByLabel("Default Production Evidence requirement")
		.selectOption({ label: "Full Generation Package history" });
	await page.getByRole("checkbox", { name: "Assertion only" }).check();
	await page.getByRole("checkbox", { name: "Results" }).check();
	await page.getByRole("button", { name: "Save draft" }).click();
	await page
		.getByRole("region", { name: "Draft review" })
		.getByRole("button", { name: "Activate revision" })
		.click();

	await expect(
		page.getByRole("heading", { name: "Active revision 2" })
	).toBeVisible();
	const diff = page.getByRole("region", {
		name: "Scope diff against revision 1",
	});
	await expect(
		diff.getByText("Production Evidence Policy changed")
	).toBeVisible();
	await expect(diff.getByText("Rights Evidence Policy changed")).toBeVisible();
	await expect(diff.getByText("Context Revision unchanged")).toBeVisible();

	// The reloaded catalog still carries revision 1 with the policy values it was activated with.
	const catalogResponse = page.waitForResponse((response) =>
		response.url().includes("/rpc/deliveryPlanning/list")
	);
	await page.reload();
	const catalogBody = (await (await catalogResponse).json()) as {
		json: {
			deliveryTargets: {
				revisions: {
					productionEvidencePolicy: { defaultRequirement: string };
					revisionNumber: number;
					rightsEvidencePolicy: {
						acceptableStates: string[];
						requireRecordFor: string[];
					};
				}[];
			}[];
		};
	};
	const firstRevision = catalogBody.json.deliveryTargets[0]?.revisions.find(
		(revision) => revision.revisionNumber === 1
	);
	expect(firstRevision?.productionEvidencePolicy.defaultRequirement).toBe(
		"advisory"
	);
	expect(firstRevision?.rightsEvidencePolicy).toEqual({
		acceptableStates: ["documented"],
		requireRecordFor: [],
	});
	await expect(
		page.getByRole("heading", { name: "Active revision 2" })
	).toBeVisible();
	await expect(
		page
			.getByRole("region", { name: "Scope diff against revision 1" })
			.getByText("Production Evidence Policy changed")
	).toBeVisible();
	const history = page.getByRole("list", { name: "Revisions" });
	await expect(
		history.getByText("Revision 1,", { exact: false })
	).toBeVisible();
	await expect(
		history.getByText("Revision 2,", { exact: false })
	).toBeVisible();

	// Activating a Delivery Target revision did not replace either family's Required Items List.
	await page.getByRole("link", { name: "Varlık Aileleri" }).click();
	for (const family of fixture.families) {
		// biome-ignore lint/performance/noAwaitInLoops: Each family is selected and read in turn.
		await page
			.getByRole("button", { name: "Tamamlanma ve kanıtlar", exact: true })
			.click();
		await page
			.getByLabel("İnceleme ve tamamlanma için aile")
			.selectOption({ label: family.familyName });
		await expect(
			page.getByRole("heading", { name: familyListRevisionOne })
		).toBeVisible();
		await expect(page.getByText(familyListRevisionTwo)).toHaveCount(0);
	}
	await page.getByRole("link", { name: "Delivery Targets" }).click();

	// The Readiness Plan explains what blocks the target; activation did not make it Ready.
	await page.getByRole("link", { name: "Open Readiness Plan" }).click();
	await expect(page).toHaveURL(readinessPlanUrl);
	await expect(
		page.getByRole("heading", { name: "Readiness Plan", level: 1 })
	).toBeVisible();
	await expect(page.getByText("Target Readiness: Blocked")).toBeVisible();
	await expect(page.getByText("Delivery Status: Not delivered")).toBeVisible();
	// Records without an Asset Version leave each required item incomplete.
	const blockers = page.getByRole("list", { name: "Blockers" });
	await expect(blockers.getByText("Required item incomplete")).toHaveCount(
		fixture.families.length
	);
	for (const family of fixture.families) {
		// biome-ignore lint/performance/noAwaitInLoops: Assertions read the same list in order.
		await expect(
			blockers.getByText(family.itemName, { exact: true })
		).toBeVisible();
	}
	const firstStep = page
		.getByRole("list", { name: "Dependent work" })
		.getByRole("listitem")
		.first();
	for (const term of rationaleTerms) {
		// biome-ignore lint/performance/noAwaitInLoops: Assertions read the same step in order.
		await expect(firstStep.getByText(term, { exact: true })).toBeVisible();
	}

	// A user reorder persists across a reload.
	const steps = page
		.getByRole("list", { name: "Dependent work" })
		.getByRole("heading", { level: 3 });
	await expect(steps.nth(1)).toBeVisible();
	const before = await steps.allTextContents();
	expect(before.length).toBeGreaterThanOrEqual(2);
	await page.getByRole("button", { name: moveDownName }).first().click();
	await expect
		.poll(async () => (await steps.allTextContents()).slice(0, 2))
		.toEqual([before[1], before[0]]);
	await page.reload();
	await expect
		.poll(async () => (await steps.allTextContents()).slice(0, 2))
		.toEqual([before[1], before[0]]);
});

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { $, browser, expect } from "@wdio/globals";
import {
	assetRecordFixture,
	assetRecordMeasurementScenarios,
	assetVersionE2eEnabled,
	createAssetRecordFixture,
} from "../e2e/asset-record-fixture";
import { openWorkspaceTask } from "./workspace-navigation";

describe("Asset Records", () => {
	it("persists an Asset Record created through the desktop flow", async function () {
		if (!process.env.CONTEXT_TEST_DATABASE_URL) {
			this.skip();
		}

		const signInLink = await $("a=Sign In");
		await signInLink.waitForClickable();
		await signInLink.click();
		await (await $("input[name='name']")).setValue(assetRecordFixture.userName);
		await (await $("input[name='email']")).setValue(assetRecordFixture.email);
		await (await $("input[name='password']")).setValue(
			assetRecordFixture.password
		);
		await (await $("button=Sign Up")).click();
		await (await $("h1=Projects")).waitForDisplayed();

		await (await $("a=Projects")).click();
		await openWorkspaceTask("New project");
		await (await $("input#project-name")).setValue(
			assetRecordFixture.projectName
		);
		await (await $("textarea#project-art-direction")).setValue(
			assetRecordFixture.generalArtDirection
		);
		await (await $("button=Create project")).click();

		const projectLink = await $(
			`a[aria-label="${assetRecordFixture.projectName} open project"]`
		);
		await projectLink.waitForClickable();
		await projectLink.click();
		await (await $("button=New Asset Record")).waitForDisplayed();
		const assetRecordsUrl = await browser.getUrl();
		for (const scenario of assetRecordMeasurementScenarios) {
			// biome-ignore lint/performance/noAwaitInLoops: Each scenario reuses one desktop window and must finish before navigating to the next record.
			await browser.url(assetRecordsUrl);
			await openWorkspaceTask("New Asset Record");
			await (await $("input#asset-record-name")).setValue(scenario.name);
			await (await $("input[type='checkbox']")).click();
			await (await $("button=Create Asset Record")).click();
			await (await $(`h1=${scenario.name}`)).waitForDisplayed();
			await openWorkspaceTask("Record details");
			await Promise.all(
				scenario.inputs.map(async ({ id, kind, value }) => {
					if (kind === "select") {
						await (await $(`select#${id}`)).selectByAttribute("value", value);
						return;
					}
					await (await $(`input#${id}`)).setValue(value);
				})
			);
			await (await $("button=Save dimensions")).click();
			await expect(await $("p=Dimensions saved.")).toBeDisplayed();
			await expect(await $("p*=Record created")).toBeDisplayed();
			await browser.refresh();
			await (await $(`h1=${scenario.name}`)).waitForDisplayed();
			await openWorkspaceTask("Record details");
			await expect(await $("p*=Record created")).toBeDisplayed();
			await Promise.all(
				scenario.inputs.map(async ({ id, kind, value }) => {
					const selector = kind === "select" ? `select#${id}` : `input#${id}`;
					await expect(await $(selector)).toHaveValue(value);
				})
			);
		}
	});

	it("persists an Asset Version, review, quality result, and legacy history", async function () {
		const versionFixture = createAssetRecordFixture();
		if (!assetVersionE2eEnabled) {
			this.skip();
		}

		const signInLink = await $("a=Sign In");
		await signInLink.waitForClickable();
		await signInLink.click();
		await (await $("input[name='name']")).setValue(versionFixture.userName);
		await (await $("input[name='email']")).setValue(versionFixture.email);
		await (await $("input[name='password']")).setValue(versionFixture.password);
		await (await $("button=Sign Up")).click();
		await (await $("h1=Projects")).waitForDisplayed();
		await (await $("a=Projects")).click();
		await openWorkspaceTask("New project");
		await (await $("input#project-name")).setValue(versionFixture.projectName);
		await (await $("textarea#project-art-direction")).setValue(
			versionFixture.generalArtDirection
		);
		await (await $("button=Create project")).click();

		const projectLink = await $(
			`a[aria-label="${versionFixture.projectName} open project"]`
		);
		await projectLink.waitForClickable();
		await projectLink.click();
		await openWorkspaceTask("New Asset Record");
		await (await $("input#asset-record-name")).setValue(versionFixture.name);
		await (await $("input[type='checkbox']")).click();
		await (await $("button=Create Asset Record")).click();
		await (await $(`h1=${versionFixture.name}`)).waitForDisplayed();

		const tempDirectory = mkdtempSync(
			join(tmpdir(), "asset-record-version-e2e-")
		);
		try {
			const imagePath = join(tempDirectory, "ash-knight.png");
			writeFileSync(
				imagePath,
				Buffer.from(versionFixture.assetVersionPngBase64, "base64")
			);
			const uploadedPath = await browser.uploadFile(imagePath);
			await (await $("input#asset-version-file")).setValue(uploadedPath);
			await (await $("textarea#asset-version-missing-history")).setValue(
				"The original generation instruction is unavailable."
			);
			await (await $("input#asset-version-source")).setValue(
				"Created for version tracking"
			);
			await (await $("select#asset-version-relationship")).selectByAttribute(
				"value",
				"created_by_user"
			);
			await (await $("textarea#asset-version-evidence")).setValue(
				"Owner attested to the source and relationship."
			);
			await (await $("button=Save Candidate Version")).click();
			await (await $("p*=Candidate Version saved.")).waitForDisplayed();
			await (
				await $("p*=File format signature matched (1 version).")
			).waitForDisplayed();

			await (await $("textarea#review-rationale")).setValue(
				"Reviewed through the desktop flow."
			);
			await (await $("button=Approve")).click();
			await (await $("p*=Approved Version saved.")).waitForDisplayed();
			await (await $("p*=ash-knight.png · Version 1")).waitForDisplayed();
			await (await $("p*=Created for version tracking")).waitForDisplayed();
			await (
				await $(
					"p*=Unknown production history: The original generation instruction is unavailable."
				)
			).waitForDisplayed();
			await (
				await $("p*=Owner attested to the source and relationship.")
			).waitForDisplayed();
			await (await $("p*=Created by user")).waitForDisplayed();
			await (
				await $("p*=Reviewed through the desktop flow.")
			).waitForDisplayed();

			const alternativeImagePath = join(tempDirectory, "ash-knight-alt.png");
			writeFileSync(
				alternativeImagePath,
				Buffer.from(versionFixture.assetVersionPngBase64, "base64")
			);
			const uploadedAlternativePath =
				await browser.uploadFile(alternativeImagePath);
			await (await $("input#asset-version-file")).setValue(
				uploadedAlternativePath
			);
			await (await $("textarea#asset-version-missing-history")).setValue(
				"The alternative sketch instructions are unavailable."
			);
			await (await $("input#asset-version-source")).setValue(
				"Alternative sketch"
			);
			await (await $("select#asset-version-relationship")).selectByAttribute(
				"value",
				"received_from_team"
			);
			await (await $("textarea#asset-version-evidence")).setValue(
				"Team handoff note."
			);
			await (await $("button=Save Candidate Version")).click();
			await (await $("p*=Candidate Version saved.")).waitForDisplayed();
			await (
				await $("p*=ash-knight-alt.png · Version 2 · Candidate")
			).waitForDisplayed();
			await (
				await $(
					"p*=Unknown production history: The alternative sketch instructions are unavailable."
				)
			).waitForDisplayed();
			await (
				await $("p*=File format signature matched (2 version).")
			).waitForDisplayed();

			await browser.refresh();
			await (await $("p*=ash-knight.png · Version 1")).waitForDisplayed();
			await (
				await $("p*=ash-knight-alt.png · Version 2 · Candidate")
			).waitForDisplayed();
			await (
				await $(
					"p*=Unknown production history: The original generation instruction is unavailable."
				)
			).waitForDisplayed();
			await (
				await $(
					"p*=Unknown production history: The alternative sketch instructions are unavailable."
				)
			).waitForDisplayed();
			await (
				await $("p*=File format signature matched (2 version).")
			).waitForDisplayed();
			await (await $("p*=Created for version tracking")).waitForDisplayed();
			await (await $("p*=Alternative sketch")).waitForDisplayed();
			await (await $("p*=Team handoff note.")).waitForDisplayed();
			await (await $("p*=Received from team")).waitForDisplayed();
			await (
				await $("p*=Owner attested to the source and relationship.")
			).waitForDisplayed();
			await (await $("p*=Created by user")).waitForDisplayed();
			await (
				await $("p*=Reviewed through the desktop flow.")
			).waitForDisplayed();
		} finally {
			rmSync(tempDirectory, { force: true, recursive: true });
		}
	});

	it("archives and restores an Asset Record through the desktop flow", async function () {
		const fixture = createAssetRecordFixture();
		if (!process.env.CONTEXT_TEST_DATABASE_URL) {
			this.skip();
		}

		const signInLink = await $("a=Sign In");
		await signInLink.waitForClickable();
		await signInLink.click();
		await (await $("input[name='name']")).setValue(fixture.userName);
		await (await $("input[name='email']")).setValue(fixture.email);
		await (await $("input[name='password']")).setValue(fixture.password);
		await (await $("button=Sign Up")).click();
		await (await $("h1=Projects")).waitForDisplayed();
		await (await $("a=Projects")).click();
		await openWorkspaceTask("New project");
		await (await $("input#project-name")).setValue(fixture.projectName);
		await (await $("textarea#project-art-direction")).setValue(
			fixture.generalArtDirection
		);
		await (await $("button=Create project")).click();

		const projectLink = await $(
			`a[aria-label="${fixture.projectName} open project"]`
		);
		await projectLink.waitForClickable();
		await projectLink.click();
		await openWorkspaceTask("New Asset Record");
		await (await $("input#asset-record-name")).setValue(fixture.name);
		await (await $("input[type='checkbox']")).click();
		await (await $("button=Create Asset Record")).click();
		await (await $(`h1=${fixture.name}`)).waitForDisplayed();

		await openWorkspaceTask("Record details");
		await (await $("button=Archive record")).click();
		await (await $("p=Archived")).waitForDisplayed();
		await browser.refresh();
		await openWorkspaceTask("Record details");
		await (await $("p=Archived")).waitForDisplayed();

		await (await $("button=Reactivate record")).click();
		await (await $("p=Etkin")).waitForDisplayed();
		await browser.refresh();
		await openWorkspaceTask("Record details");
		await (await $("p=Etkin")).waitForDisplayed();
	});
});

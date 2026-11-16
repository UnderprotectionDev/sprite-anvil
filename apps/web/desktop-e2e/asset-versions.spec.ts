import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { $, browser } from "@wdio/globals";
import { assetVersionFixture as fixture } from "../e2e/asset-version-fixture";
import { openWorkspaceTask } from "./workspace-navigation";

describe("Asset and Composite Version lineage", () => {
	it("persists the same exact composition in the desktop flow", async function () {
		if (!process.env.CONTEXT_TEST_DATABASE_URL) {
			this.skip();
		}

		const directory = await mkdtemp(
			join(tmpdir(), "sprite-anvil-asset-version-")
		);
		const pngPath = join(directory, "ash-knight.png");
		const frameV1Path = join(directory, "attack-frame-v1.png");
		const directionPath = join(directory, "north-direction-v1.png");
		const frameV2Path = join(directory, "attack-frame-v2.png");
		await Promise.all(
			[pngPath, frameV1Path, directionPath, frameV2Path].map((path) =>
				writeFile(path, fixture.png)
			)
		);

		try {
			function getSourceRecord() {
				return $(`h4=${fixture.sourceName}`).$("xpath=ancestor::li[1]");
			}

			async function uploadUnitCorrection({
				filePath,
				key,
				sourceVersion,
				type,
			}: {
				filePath: string;
				key: string;
				sourceVersion: string;
				type: "direction" | "frame";
			}) {
				const sourceRecord = await getSourceRecord();
				await (
					await sourceRecord.$(
						'xpath=.//label[span[text()="Unit type"]]/select'
					)
				).selectByAttribute("value", type);
				await (
					await sourceRecord.$('xpath=.//label[span[text()="Unit name"]]/input')
				).setValue(key);
				await (
					await sourceRecord.$(
						'xpath=.//label[span[text()="Kaynak Asset Version"]]/select'
					)
				).selectByVisibleText(sourceVersion);
				await (
					await sourceRecord.$(
						'xpath=.//label[span[text()="Corrected PNG or WebP"]]/input'
					)
				).setValue(filePath);
				await (await $("button=Save unit correction")).click();
			}

			await (await $("a=Sign In")).waitForClickable();
			await (await $("a=Sign In")).click();
			await (await $("input[name='name']")).setValue(fixture.userName);
			await (await $("input[name='email']")).setValue(fixture.email);
			await (await $("input[name='password']")).setValue(fixture.password);
			await (await $("button=Sign Up")).click();
			await (await $("h1=Game projects")).waitForDisplayed();

			await (await $("a=Context Proposals")).click();
			await (await $('//label[span[text()="Project name"]]/input')).setValue(
				fixture.projectName
			);
			await (
				await $('//label[span[text()="General art direction"]]/textarea')
			).setValue(fixture.generalArtDirection);
			await (await $("button=Create project")).click();
			await openWorkspaceTask("Visual Worlds and Themes");
			await (await $("input[placeholder='e.g. High plateaus']")).setValue(
				fixture.visualWorldName
			);
			await (await $("button=Add Visual World")).click();
			await (await $(`strong=${fixture.visualWorldName}`)).waitForDisplayed();

			await (await $("a=Projeler")).click();
			await (await $("a=Asset Families")).click();
			await openWorkspaceTask("Family and representation relationships");
			await (await $("input[id='subject-identity-name']")).setValue(
				fixture.identityName
			);
			await (await $("button=Create Subject Identity")).click();
			await openWorkspaceTask("Family catalog");
			await (await $(`h2=${fixture.identityName}`)).waitForDisplayed();
			await openWorkspaceTask("Family and representation relationships");
			await (await $("input[id='asset-family-name']")).setValue(
				fixture.familyName
			);
			await (await $("#asset-family-visual-world")).selectByVisibleText(
				fixture.visualWorldName
			);
			await (await $("input[id='asset-family-use-context']")).setValue(
				fixture.useContext
			);
			await (await $("button=Create Asset Family")).click();
			await openWorkspaceTask("Family catalog");
			await (await $(`h3=${fixture.familyName}`)).waitForDisplayed();

			await openWorkspaceTask("Family and representation relationships");
			await (await $("input[id='asset-record-name']")).setValue(
				fixture.sourceName
			);
			await (await $("button=Add Asset Record")).click();
			await openWorkspaceTask("Version and dependency operations");
			await openWorkspaceTask("Family and representation relationships");
			await (await $("input[id='asset-record-name']")).setValue(
				fixture.derivativeName
			);
			await (await $("button=Add Asset Record")).click();
			await openWorkspaceTask("Version and dependency operations");
			await (
				await $("section[aria-label='Version and dependency operations']").$(
					`h4=${fixture.derivativeName}`
				)
			).waitForDisplayed();

			await (
				await $(
					`input[aria-label='${fixture.sourceName} için Varlık Sürümü dosyası']`
				)
			).setValue(pngPath);
			await (await $("p=Version 1 · Candidate")).waitForDisplayed();
			const reviewRationale = "The silhouette matches the family design.";
			await (await $("textarea[id^='review-rationale-']")).setValue(
				reviewRationale
			);
			await (await $("button=Onayla")).click();
			await (await $("p=Sürüm 1 · Approved")).waitForDisplayed();
			await $(`li*=— Gerekçe: ${reviewRationale}`).waitForDisplayed();
			await (await $("time[datetime]")).waitForDisplayed();
			await (await $("button=Select as Canonical Design")).click();
			await $(
				"p=Canonical Design: Ash Knight base · Sürüm 1"
			).waitForDisplayed();

			await openWorkspaceTask("Family and representation relationships");
			await (await $("#relationship-type")).selectByAttribute(
				"value",
				"derivative"
			);
			await $(
				"p=Ash Knight base · Canonical Design Version 1"
			).waitForDisplayed();
			await (await $("#relationship-target")).selectByVisibleText(
				fixture.derivativeName
			);
			await (await $("button=İlişki ekle")).click();
			await openWorkspaceTask("Family catalog");
			const lineage = await $(`li*=${fixture.visibleLineage}`);
			await lineage.waitForDisplayed();
			await openWorkspaceTask("Version and dependency operations");

			await uploadUnitCorrection({
				filePath: frameV1Path,
				key: "attack/frame-3",
				sourceVersion: "Sürüm 1 · Onaylandı",
				type: "frame",
			});
			await (
				await $("li*=Kare · attack/frame-3 · Birim Sürümü 1")
			).waitForDisplayed();

			await uploadUnitCorrection({
				filePath: directionPath,
				key: "north",
				sourceVersion: "Sürüm 1 · Onaylandı",
				type: "direction",
			});
			await (await $("li*=Yön · north · Birim Sürümü 1")).waitForDisplayed();

			const sourceRecord = await getSourceRecord();
			await (
				await sourceRecord.$(
					'xpath=.//label[span[text()="Kare · attack/frame-3"]]/select'
				)
			).selectByVisibleText("Birim Sürümü 1 · Varlık Sürümü 2 · Aday");
			await (
				await sourceRecord.$(
					'xpath=.//label[span[text()="Yön · north"]]/select'
				)
			).selectByVisibleText("Birim Sürümü 1 · Varlık Sürümü 3 · Aday");
			await (await $("button=Save new Composite Version")).click();
			await (await $("h6=Composite Version 1 · Aday")).waitForDisplayed();

			const firstComposite = await $("h6=Composite Version 1 · Aday").$(
				"xpath=ancestor::article[1]"
			);
			await (
				await firstComposite.$(
					'xpath=.//label[span[text()="Composite Version 1 review rationale"]]/textarea'
				)
			).setValue("The initial frame and direction were reviewed together.");
			await (await firstComposite.$("button=Onayla")).click();
			await (await $("h6=Composite Version 1 · Approved")).waitForDisplayed();

			await uploadUnitCorrection({
				filePath: frameV2Path,
				key: "attack/frame-3",
				sourceVersion: "Sürüm 2 · Aday",
				type: "frame",
			});
			await (
				await $("li*=Kare · attack/frame-3 · Birim Sürümü 2")
			).waitForDisplayed();

			const correctedAssetVersion = await sourceRecord.$(
				"xpath=.//p[normalize-space(.)='Sürüm 4 · Aday']/ancestor::li[1]"
			);
			await (
				await correctedAssetVersion.$(
					'xpath=.//label[span[text()="Review rationale"]]/textarea'
				)
			).setValue("The corrected frame is ready for composition.");
			await (await correctedAssetVersion.$("button=Onayla")).click();
			await (await $("p=Sürüm 4 · Approved")).waitForDisplayed();

			const latestSourceRecord = await getSourceRecord();
			await (
				await latestSourceRecord.$(
					'xpath=.//label[span[text()="Starting Composite Version"]]/select'
				)
			).selectByVisibleText("Composite Version 1 · Approved");
			await (
				await latestSourceRecord.$(
					'xpath=.//label[span[text()="Kare · attack/frame-3"]]/select'
				)
			).selectByVisibleText("Birim Sürümü 2 · Varlık Sürümü 4 · Onaylandı");
			await (await $("button=Save new Composite Version")).click();
			await (await $("h6=Composite Version 2 · Aday")).waitForDisplayed();
			const secondComposite = await $("h6=Composite Version 2 · Aday").$(
				"xpath=ancestor::article[1]"
			);
			await (
				await secondComposite.$("p=Kare · attack/frame-3 · Unit Version 2")
			).waitForDisplayed();
			await (
				await secondComposite.$("p=Yön · north · Unit Version 1")
			).waitForDisplayed();
			await (
				await secondComposite.$("p=Asset Version 4 · Approved")
			).waitForDisplayed();
			const firstCompositeAfterEdit = await $(
				"h6=Composite Version 1 · Approved"
			).$("xpath=ancestor::article[1]");
			await (
				await firstCompositeAfterEdit.$(
					"p=Kare · attack/frame-3 · Unit Version 1"
				)
			).waitForDisplayed();

			await browser.refresh();
			await openWorkspaceTask("Version and dependency operations");
			await (await $("p=Sürüm 1 · Approved")).waitForDisplayed();
			await $(`li*=— Gerekçe: ${reviewRationale}`).waitForDisplayed();
			await (await $("time[datetime]")).waitForDisplayed();
			await (await $(`li*=${fixture.visibleLineage}`)).waitForDisplayed();
			await (await $("h6=Composite Version 1 · Approved")).waitForDisplayed();
			await (await $("h6=Composite Version 2 · Aday")).waitForDisplayed();
			const persistedFirstComposite = await $(
				"h6=Composite Version 1 · Approved"
			).$("xpath=ancestor::article[1]");
			await (
				await persistedFirstComposite.$(
					"p=Kare · attack/frame-3 · Unit Version 1"
				)
			).waitForDisplayed();
			await (
				await persistedFirstComposite.$("p=Yön · north · Unit Version 1")
			).waitForDisplayed();
			const persistedComposite = await $("h6=Composite Version 2 · Aday").$(
				"xpath=ancestor::article[1]"
			);
			await (
				await persistedComposite.$("p=Kare · attack/frame-3 · Unit Version 2")
			).waitForDisplayed();
			await (
				await persistedComposite.$("p=Yön · north · Unit Version 1")
			).waitForDisplayed();
			await (
				await persistedComposite.$("p=Asset Version 4 · Approved")
			).waitForDisplayed();
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});
});

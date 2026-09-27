import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { $, browser } from "@wdio/globals";
import { assetVersionFixture as fixture } from "../e2e/asset-version-fixture";

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
						'xpath=.//label[span[text()="Birim türü"]]/select'
					)
				).selectByAttribute("value", type);
				await (
					await sourceRecord.$('xpath=.//label[span[text()="Birim adı"]]/input')
				).setValue(key);
				await (
					await sourceRecord.$(
						'xpath=.//label[span[text()="Kaynak Varlık Sürümü"]]/select'
					)
				).selectByVisibleText(sourceVersion);
				await (
					await sourceRecord.$(
						'xpath=.//label[span[text()="Düzeltilmiş PNG veya WebP"]]/input'
					)
				).setValue(filePath);
				await (await $("button=Birim düzeltmesini kaydet")).click();
			}

			await (await $("a=Sign In")).waitForClickable();
			await (await $("a=Sign In")).click();
			await (await $("input[name='name']")).setValue(fixture.userName);
			await (await $("input[name='email']")).setValue(fixture.email);
			await (await $("input[name='password']")).setValue(fixture.password);
			await (await $("button=Sign Up")).click();
			await (await $("h1=Dashboard")).waitForDisplayed();

			await (await $("a=Proje Bağlamı")).click();
			await (await $('//label[span[text()="Proje adı"]]/input')).setValue(
				fixture.projectName
			);
			await (
				await $('//label[span[text()="Genel sanat yaklaşımı"]]/textarea')
			).setValue(fixture.generalArtDirection);
			await (await $("button=Projeyi oluştur")).click();
			await (await $("h2=Bağlam Önerisi hazırlayın")).waitForDisplayed();
			await (await $("input[placeholder='Örn. Yüksek yaylalar']")).setValue(
				fixture.visualWorldName
			);
			await (await $("button=Görsel Dünya ekle")).click();
			await (await $(`strong=${fixture.visualWorldName}`)).waitForDisplayed();

			await (await $("a=Projects")).click();
			await (await $("a=Varlık Aileleri")).click();
			await (await $("input[id='subject-identity-name']")).setValue(
				fixture.identityName
			);
			await (await $("button=Varlık Kimliği oluştur")).click();
			await (await $(`h2=${fixture.identityName}`)).waitForDisplayed();
			await (await $("input[id='asset-family-name']")).setValue(
				fixture.familyName
			);
			await (await $("#asset-family-visual-world")).selectByVisibleText(
				fixture.visualWorldName
			);
			await (await $("input[id='asset-family-use-context']")).setValue(
				fixture.useContext
			);
			await (await $("button=Varlık Ailesi oluştur")).click();
			await (await $(`h3=${fixture.familyName}`)).waitForDisplayed();

			await (await $("input[id='asset-record-name']")).setValue(
				fixture.sourceName
			);
			await (await $("button=Varlık Kaydı ekle")).click();
			await (await $("input[id='asset-record-name']")).setValue(
				fixture.derivativeName
			);
			await (await $("button=Varlık Kaydı ekle")).click();
			await (await $(`h4=${fixture.derivativeName}`)).waitForDisplayed();

			await (
				await $(
					`input[aria-label='${fixture.sourceName} için Varlık Sürümü dosyası']`
				)
			).setValue(pngPath);
			await (await $("p=Sürüm 1 · Aday")).waitForDisplayed();
			const reviewRationale = "The silhouette matches the family design.";
			await (await $("textarea[id^='review-rationale-']")).setValue(
				reviewRationale
			);
			await (await $("button=Onayla")).click();
			await (await $("p=Sürüm 1 · Onaylandı")).waitForDisplayed();
			await $(`li*=— Gerekçe: ${reviewRationale}`).waitForDisplayed();
			await (await $("time[datetime]")).waitForDisplayed();
			await (await $("button=Ana Tasarım olarak seç")).click();
			await $("p=Ana Tasarım: Ash Knight base · Sürüm 1").waitForDisplayed();

			await (await $("#relationship-type")).selectByAttribute(
				"value",
				"derivative"
			);
			await $("p=Ash Knight base · Ana Tasarım Sürüm 1").waitForDisplayed();
			await (await $("#relationship-target")).selectByVisibleText(
				fixture.derivativeName
			);
			await (await $("button=İlişki ekle")).click();
			const lineage = await $(`li*=${fixture.visibleLineage}`);
			await lineage.waitForDisplayed();

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
			await (await $("button=Yeni Birleşik Sürüm kaydet")).click();
			await (await $("h6=Birleşik Sürüm 1 · Aday")).waitForDisplayed();

			const firstComposite = await $("h6=Birleşik Sürüm 1 · Aday").$(
				"xpath=ancestor::article[1]"
			);
			await (
				await firstComposite.$(
					'xpath=.//label[span[text()="Birleşik Sürüm 1 inceleme gerekçesi"]]/textarea'
				)
			).setValue("The initial frame and direction were reviewed together.");
			await (await firstComposite.$("button=Onayla")).click();
			await (await $("h6=Birleşik Sürüm 1 · Onaylandı")).waitForDisplayed();

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
					'xpath=.//label[span[text()="İnceleme gerekçesi"]]/textarea'
				)
			).setValue("The corrected frame is ready for composition.");
			await (await correctedAssetVersion.$("button=Onayla")).click();
			await (await $("p=Sürüm 4 · Onaylandı")).waitForDisplayed();

			const latestSourceRecord = await getSourceRecord();
			await (
				await latestSourceRecord.$(
					'xpath=.//label[span[text()="Başlangıç Birleşik Sürümü"]]/select'
				)
			).selectByVisibleText("Birleşik Sürüm 1 · Onaylandı");
			await (
				await latestSourceRecord.$(
					'xpath=.//label[span[text()="Kare · attack/frame-3"]]/select'
				)
			).selectByVisibleText("Birim Sürümü 2 · Varlık Sürümü 4 · Onaylandı");
			await (await $("button=Yeni Birleşik Sürüm kaydet")).click();
			await (await $("h6=Birleşik Sürüm 2 · Aday")).waitForDisplayed();
			const secondComposite = await $("h6=Birleşik Sürüm 2 · Aday").$(
				"xpath=ancestor::article[1]"
			);
			await (
				await secondComposite.$("p=Kare · attack/frame-3 · Birim Sürümü 2")
			).waitForDisplayed();
			await (
				await secondComposite.$("p=Yön · north · Birim Sürümü 1")
			).waitForDisplayed();
			await (
				await secondComposite.$("p=Varlık Sürümü 4 · Onaylandı")
			).waitForDisplayed();
			const firstCompositeAfterEdit = await $(
				"h6=Birleşik Sürüm 1 · Onaylandı"
			).$("xpath=ancestor::article[1]");
			await (
				await firstCompositeAfterEdit.$(
					"p=Kare · attack/frame-3 · Birim Sürümü 1"
				)
			).waitForDisplayed();

			await browser.refresh();
			await (await $("p=Sürüm 1 · Onaylandı")).waitForDisplayed();
			await $(`li*=— Gerekçe: ${reviewRationale}`).waitForDisplayed();
			await (await $("time[datetime]")).waitForDisplayed();
			await (await $(`li*=${fixture.visibleLineage}`)).waitForDisplayed();
			await (await $("h6=Birleşik Sürüm 1 · Onaylandı")).waitForDisplayed();
			await (await $("h6=Birleşik Sürüm 2 · Aday")).waitForDisplayed();
			const persistedFirstComposite = await $(
				"h6=Birleşik Sürüm 1 · Onaylandı"
			).$("xpath=ancestor::article[1]");
			await (
				await persistedFirstComposite.$(
					"p=Kare · attack/frame-3 · Birim Sürümü 1"
				)
			).waitForDisplayed();
			await (
				await persistedFirstComposite.$("p=Yön · north · Birim Sürümü 1")
			).waitForDisplayed();
			const persistedComposite = await $("h6=Birleşik Sürüm 2 · Aday").$(
				"xpath=ancestor::article[1]"
			);
			await (
				await persistedComposite.$("p=Kare · attack/frame-3 · Birim Sürümü 2")
			).waitForDisplayed();
			await (
				await persistedComposite.$("p=Yön · north · Birim Sürümü 1")
			).waitForDisplayed();
			await (
				await persistedComposite.$("p=Varlık Sürümü 4 · Onaylandı")
			).waitForDisplayed();
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});
});

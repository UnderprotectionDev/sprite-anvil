import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { uiComponentStates } from "@sprite-anvil/api/ui-state-comparisons";
import { $, browser, expect } from "@wdio/globals";
import { uiStateComparisonFixture as fixture } from "../e2e/ui-state-comparison-fixture";
import {
	activateFamilyProfile,
	openWorkspaceTask,
} from "./workspace-navigation";

describe("UI State Comparison", () => {
	it("persists and reopens a UI screen and state comparison on the desktop surface", async function () {
		this.timeout(240_000);
		if (!process.env.CONTEXT_TEST_DATABASE_URL) {
			this.skip();
		}

		const directory = await mkdtemp(
			join(tmpdir(), "sprite-anvil-asset-family-comparison-")
		);
		const pngPath = join(directory, "asset-family-comparison.png");
		await writeFile(pngPath, fixture.png);

		try {
			await (await $("a=Sign In")).waitForClickable();
			await (await $("a=Sign In")).click();
			await (await $("button=Need an account? Sign Up")).click();
			await $("h2=Create Account").waitForDisplayed();
			await $("input[name='name']").setValue(fixture.userName);
			await $("input[name='email']").setValue(fixture.email);
			await $("input[name='password']").setValue(fixture.password);
			await (await $("button=Sign Up")).click();
			// The first webview navigation after signup can be slow on a cold start.
			await $("h1=Oyun projeleri").waitForDisplayed({ timeout: 30_000 });

			await (await $("a=Proje Bağlamı")).click();
			await $("//label[span[text()='Proje adı']]/input").setValue(
				fixture.projectName
			);
			await $(
				"//label[span[text()='Genel sanat yaklaşımı']]/textarea"
			).setValue(fixture.generalArtDirection);
			await (await $("button=Projeyi oluştur")).click();
			await openWorkspaceTask("Görsel Dünyalar ve Temalar");
			await $("input[placeholder='Örn. Yüksek yaylalar']").setValue(
				fixture.visualWorldName
			);
			await (await $("button=Görsel Dünya ekle")).click();
			await $(`strong=${fixture.visualWorldName}`).waitForDisplayed();

			await (await $("a=Projeler")).click();
			await (await $("a=Varlık Aileleri")).click();
			await openWorkspaceTask("Aile ve temsil ilişkileri");
			await $("input[id='subject-identity-name']").setValue(
				fixture.identityName
			);
			await (await $("button=Varlık Kimliği oluştur")).click();
			await openWorkspaceTask("Aile kataloğu");
			await $(`h2=${fixture.identityName}`).waitForDisplayed();
			await openWorkspaceTask("Aile ve temsil ilişkileri");
			await $("input[id='asset-family-name']").setValue(fixture.familyName);
			await $("#asset-family-visual-world").selectByVisibleText(
				fixture.visualWorldName
			);
			await $("input[id='asset-family-use-context']").setValue(
				fixture.useContext
			);
			await (await $("button=Varlık Ailesi oluştur")).click();
			await openWorkspaceTask("Aile kataloğu");
			await $(`h3=${fixture.familyName}`).waitForDisplayed();

			for (const record of fixture.records) {
				// biome-ignore lint/performance/noAwaitInLoops: Desktop interactions within each record setup must occur in order.
				await openWorkspaceTask("Aile ve temsil ilişkileri");
				const criterion = await $(
					"//label[contains(normalize-space(.), 'Bağımsız ürün anlamı')]/input"
				);
				if (!(await criterion.isSelected())) {
					await criterion.click();
				}
				await $("input[id='asset-record-name']").setValue(record.name);
				await (await $("button=Varlık Kaydı ekle")).click();
				await openWorkspaceTask("Sürüm ve bağımlılık işlemleri");
				const recordItem = await $(
					`//section[@aria-label='Sürüm ve bağımlılık işlemleri']//li[h4[normalize-space(.)='${record.name}']]`
				);
				await recordItem
					.$("p=Henüz sürüm kaydedilmedi.")
					.waitForDisplayed({ timeout: 20_000 });

				await (await recordItem.$("a=Varlık Sürümü yükle")).click();
				await openWorkspaceTask("Kayıt bilgileri");
				await $("#asset-record-metadata-category").selectByVisibleText(
					fixture.categoryLabel
				);
				await (await $("button=Metadata’yı kaydet")).click();
				await $("p=Varlık kaydı metadata’sı kaydedildi.").waitForDisplayed();

				await openWorkspaceTask("Sürümler ve dosyalar");
				await $("#asset-version-file").setValue(pngPath);
				await $("#asset-version-missing-history").setValue(record.uploadNote);
				await $("#asset-version-source").setValue(
					"Asset family comparison desktop fixture"
				);
				await $("#asset-version-relationship").selectByAttribute(
					"value",
					"created_by_user"
				);
				await (await $("button=Aday sürümü kaydet")).click();
				await $("p=Aday Sürüm kaydedildi.").waitForDisplayed();

				await (await $("a=Varlık Aileleri")).click();
				await openWorkspaceTask("Sürüm ve bağımlılık işlemleri");
				await (
					await $(
						`//section[@aria-label='Sürüm ve bağımlılık işlemleri']//li[h4[normalize-space(.)='${record.name}']]`
					)
				)
					.$("p=Sürüm 1 · Aday")
					.waitForDisplayed({ timeout: 20_000 });
			}

			await activateFamilyProfile("Arayüz ekranı ve bileşeni", "1.0.0");
			const comparison = await $(
				`//section[h3[normalize-space(.)='${fixture.familyName} · Ekran ve Bileşen Durumlarını Karşılaştırma']]`
			);
			await comparison.waitForDisplayed();
			await comparison.$("input[id$='-name']").setValue("Inventory controls");
			await comparison
				.$("select[id$='-screen']")
				.selectByVisibleText("Inventory screen · Version 1");
			for (let index = 2; index < 9; index += 1) {
				// biome-ignore lint/performance/noAwaitInLoops: Add native form rows sequentially.
				await comparison.$("button=Add component state").click();
			}
			const components = [
				...uiComponentStates.map((state) => ({
					identity: "inventory-button",
					kind: "button",
					state,
					version: "Inventory button states",
				})),
				{
					identity: "inventory-panel",
					kind: "panel",
					state: "normal",
					version: "Inventory panel",
				},
				{
					identity: "inventory-slot",
					kind: "item_slot",
					state: "normal",
					version: "Inventory item slot",
				},
			];
			const rows = await comparison.$$("fieldset fieldset.min-w-0");
			for (const [index, component] of components.entries()) {
				const row = rows[index];
				if (!row) {
					throw new Error("Missing component state row.");
				}
				// biome-ignore lint/performance/noAwaitInLoops: Native state fields are filled sequentially.
				await row.$("input[id$='-identity']").setValue(component.identity);
				await row
					.$("select[id$='-kind']")
					.selectByAttribute("value", component.kind);
				await row
					.$("select[id$='-version']")
					.selectByVisibleText(`${component.version} · Version 1`);
				await row
					.$("select[id$='-state']")
					.selectByAttribute("value", component.state);
			}
			await comparison
				.$("textarea[id$='-family-notes']")
				.setValue("Consistent inventory borders.");
			await comparison
				.$("textarea[id$='-state-notes']")
				.setValue("All seven button states remain explicitly mapped.");
			await comparison.$("button=Save comparison").click();
			await comparison
				.$("p=Comparison verified from persistent storage.")
				.waitForDisplayed();
			await browser.refresh();
			await openWorkspaceTask("Profil incelemeleri");
			await $("h5=Inventory controls").waitForDisplayed();
			await $("p=Consistent inventory borders.").waitForDisplayed();
			await $("summary=Show comparison details").click();
			await expect(
				await $("img[alt='inventory-button · Button · Disabled']")
			).toBeDisplayed();
			await expect(
				await $("img[alt='inventory-panel · Panel · Normal']")
			).toBeDisplayed();
			await expect(
				await $("img[alt='inventory-slot · Item slot · Normal']")
			).toBeDisplayed();
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});
});

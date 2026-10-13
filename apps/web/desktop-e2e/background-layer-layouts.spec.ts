import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { $, browser, expect } from "@wdio/globals";
import { assetFamilyWorkspaceFixture as baseFixture } from "../e2e/asset-family-workspace-fixture";
import {
	activateFamilyProfile,
	openWorkspaceTask,
} from "./workspace-navigation";

const fixture = {
	...baseFixture,
	userName: "Background Layout Desktop",
	email: `background-desktop-${crypto.randomUUID()}@example.test`,
	projectName: "Forest Background Desktop",
	identityName: "Forest",
	familyName: "Forest Background",
	visualWorldName: "Forest",
	categoryLabel: "Arka planlar ve katmanlı kaydırma",
	records: [{ name: "Sky", uploadNote: "Desktop background fixture." }],
};

describe("Background Layer Layout", () => {
	it("saves a safe area and rereads the exact layout on the desktop surface", async function () {
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
				await $(
					"//label[contains(normalize-space(.), 'Bağımsız ürün anlamı')]/input"
				).click();
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
					"Background layer layout desktop fixture"
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

			await activateFamilyProfile("Arka plan ve katmanlı kaydırma", "1.0.1");

			const section =
				"//section[h3[normalize-space(.)='Background layer layout · Forest Background']]";
			let layout = await $(section);
			await layout.waitForDisplayed({ timeout: 20_000 });
			await layout
				.$("xpath=.//label[normalize-space(.)='Layer identity']/input")
				.setValue("sky");
			await layout
				.$(
					"xpath=.//label[contains(normalize-space(.), 'Exact version')]/select"
				)
				.selectByVisibleText("Sky · v1");
			await layout
				.$("xpath=.//label[normalize-space(.)='Safe area X']/input")
				.setValue("24");
			await layout
				.$("xpath=.//label[normalize-space(.)='Safe area width']/input")
				.setValue("16");
			await layout
				.$("xpath=.//label[normalize-space(.)='Safe area Y']/input")
				.setValue("8");
			await layout
				.$("xpath=.//label[normalize-space(.)='Safe area height']/input")
				.setValue("16");
			await (await layout.$("button=Save layer layout")).click();
			const alert = await layout.$("p[role='alert']");
			await alert.waitForDisplayed();
			await expect(await alert.getText()).toBe(
				"Player safe area must remain inside the crop."
			);
			await layout
				.$("xpath=.//label[normalize-space(.)='Safe area X']/input")
				.setValue("8");
			await (await layout.$("button=Save layer layout")).click();
			await layout
				.$("p=Layer layout saved.")
				.waitForDisplayed({ timeout: 20_000 });
			await browser.refresh();
			await openWorkspaceTask("Profil incelemeleri");
			layout = await $(section);
			await layout.$("p=sky · Sky · v1").waitForDisplayed({ timeout: 20_000 });
			await expect(
				await layout
					.$("p=Crop: 0, 0, 32 × 32 · Safe area: 8, 8, 16 × 16")
					.isDisplayed()
			).toBe(true);
			await expect(
				await layout
					.$("p=Actual scrolling test is still required.")
					.isDisplayed()
			).toBe(true);
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});
});

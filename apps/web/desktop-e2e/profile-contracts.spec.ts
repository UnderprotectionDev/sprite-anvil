import { $, browser, expect } from "@wdio/globals";
import { createAssetRecordFixture } from "../e2e/asset-record-fixture";

describe("Specialized Profile Contracts", () => {
	it("persists the same project-scoped profile activation through the desktop flow", async function () {
		if (!process.env.CONTEXT_TEST_DATABASE_URL) {
			this.skip();
		}
		const fixture = createAssetRecordFixture();
		const signInLink = await $("a=Sign In");
		await signInLink.waitForClickable();
		await signInLink.click();
		await (await $("input[name='name']")).setValue(fixture.userName);
		await (await $("input[name='email']")).setValue(fixture.email);
		await (await $("input[name='password']")).setValue(fixture.password);
		await (await $("button=Sign Up")).click();
		await (await $("h1=Dashboard")).waitForDisplayed();

		await (await $("a=Projects")).click();
		await (await $("input#project-name")).setValue(fixture.projectName);
		await (await $("textarea#project-art-direction")).setValue(
			fixture.generalArtDirection
		);
		await (await $("button=Proje oluştur")).click();
		const projectContractsLink = await $(
			`a[aria-label="${fixture.projectName} özel profil sözleşmelerini yönet"]`
		);
		await projectContractsLink.waitForClickable();
		await projectContractsLink.click();

		await (
			await $(`h1=${fixture.projectName} · Özel Profil Sözleşmeleri`)
		).waitForDisplayed();
		const iconProfile = await $('article[aria-labelledby="icon-heading"]');
		await (await iconProfile.$("summary")).click();
		await (
			await iconProfile.$("h5=icon.metadata_roundtrip")
		).waitForDisplayed();
		await (await iconProfile.$("button=Sözleşmeyi etkinleştir")).click();
		await (
			await $("p=İkon 1.0.0 sürümü etkinleştirildi ve yeniden okundu.")
		).waitForDisplayed();

		await browser.refresh();
		await (
			await iconProfile.$("p=Bu projede etkin · 1.0.0")
		).waitForDisplayed();
		await expect(await iconProfile.$("button=Etkin")).toBeDisabled();
	});
});

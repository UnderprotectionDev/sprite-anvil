import { $, browser } from "@wdio/globals";
import { createAssetRecordFixture } from "../e2e/asset-record-fixture";
import { openWorkspaceTask } from "./workspace-navigation";

describe("Collections", () => {
	it("persists Collection membership changes through the desktop flow", async function () {
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
		await (await $("h1=Game projects")).waitForDisplayed();

		await (await $("a=Projeler")).click();
		await openWorkspaceTask("New game project");
		await (await $("input#project-name")).setValue(fixture.projectName);
		await (await $("textarea#project-art-direction")).setValue(
			fixture.generalArtDirection
		);
		await (await $("button=Create project")).click();
		await (
			await $(`a[aria-label="${fixture.projectName} varlık kayıtlarını aç"]`)
		).waitForClickable();
		await (
			await $(`a[aria-label="${fixture.projectName} varlık kayıtlarını aç"]`)
		).click();

		await openWorkspaceTask("New Asset Record");
		await (await $("input#asset-record-name")).setValue(fixture.name);
		await (await $("input[type='checkbox']")).click();
		await (await $("button=Create Asset Record")).click();
		await (await $(`h1=${fixture.name}`)).waitForDisplayed();

		await (await $("a=Projeler")).click();
		await (
			await $(`a[aria-label="${fixture.projectName} koleksiyonlarını düzenle"]`)
		).waitForClickable();
		await (
			await $(`a[aria-label="${fixture.projectName} koleksiyonlarını düzenle"]`)
		).click();

		const collectionName = `Planning ${fixture.name}`;
		await (await $("input#collection-name")).setValue(collectionName);
		await (await $("button=Create Collection")).click();
		await (await $(`h2=${collectionName}`)).waitForDisplayed();
		await (await $("select#collection-asset-record")).selectByVisibleText(
			`${fixture.name} · Varlık Ailesi atanmamış`
		);
		await (await $("button=Add to Collection")).click();
		await (await $(`h3=${fixture.name}`)).waitForDisplayed();
		await browser.refresh();
		await (await $(`h3=${fixture.name}`)).waitForDisplayed();

		await (
			await $(
				`button[aria-label="${fixture.name} Varlık Kaydını Koleksiyondan kaldır"]`
			)
		).click();
		await $("p=This Collection has no Asset Records yet.").waitForDisplayed();
		await browser.refresh();
		await (await $(`h2=${collectionName}`)).waitForDisplayed();
		await $("p=This Collection has no Asset Records yet.").waitForDisplayed();
	});
});

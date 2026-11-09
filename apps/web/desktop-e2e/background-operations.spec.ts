import { $, expect } from "@wdio/globals";
import { createAssetRecordFixture } from "../e2e/asset-record-fixture";
import { openWorkspaceTask } from "./workspace-navigation";

// No screen or public API creates a Background Operation (the cloud records
// them for archive, restore, export, verification and deletion runs), so the
// desktop flow checks what a real project shows through the real cloud: the
// Background Operations screen reads the authoritative, empty record.
// Progress, failure, retry and cancel results are covered by the web e2e with
// a mocked record, and by the server tests of the same record.
describe("Background Operations", () => {
	it("opens the Background Operations screen of a new project and reads an empty record", async function () {
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
		await (await $("h1=Oyun projeleri")).waitForDisplayed();

		await (await $("a=Projeler")).click();
		await openWorkspaceTask("Yeni oyun projesi");
		await (await $("input#project-name")).setValue(fixture.projectName);
		await (await $("textarea#project-art-direction")).setValue(
			fixture.generalArtDirection
		);
		await (await $("button=Proje oluştur")).click();
		const projectLink = await $(
			`a[aria-label="${fixture.projectName} varlık kayıtlarını aç"]`
		);
		await projectLink.waitForClickable();
		await projectLink.click();

		const operationsLink = await $("a=Background operations");
		await operationsLink.waitForClickable();
		await operationsLink.click();
		await (await $("h1=Background operations")).waitForDisplayed();
		await (
			await $("p=No background operations have run in this project.")
		).waitForDisplayed();
		await expect(
			await $("ul[aria-label='Background operations']")
		).toBeExisting();
		await expect(await $("button=Retry")).not.toBeExisting();
	});
});

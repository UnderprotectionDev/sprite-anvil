import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { $, browser, expect } from "@wdio/globals";
import { createAssetRecordFixture } from "../e2e/asset-record-fixture";
import { openWorkspaceTask } from "./workspace-navigation";

// The desktop webview cannot cut its network the way the web e2e does, so the
// page is told it is offline (`navigator.onLine` and the `offline` event) and
// its fetches fail, then it is told it is online again.
async function setPageConnectivity(online: boolean) {
	await browser.execute((isOnline: boolean) => {
		const scope = window as unknown as {
			__realFetch?: typeof fetch;
		};
		scope.__realFetch ??= window.fetch.bind(window);
		Object.defineProperty(navigator, "onLine", {
			configurable: true,
			get: () => isOnline,
		});
		window.fetch = isOnline
			? scope.__realFetch
			: () => Promise.reject(new TypeError("Failed to fetch"));
		window.dispatchEvent(new Event(isOnline ? "online" : "offline"));
	}, online);
}

describe("Offline staging", () => {
	it("keeps a staged PNG while offline and sends it to the Import Inbox once on reconnect", async function () {
		const fixture = createAssetRecordFixture();
		if (!process.env.CONTEXT_TEST_DATABASE_URL) {
			this.skip();
		}

		const directory = mkdtempSync(join(tmpdir(), "offline-staging-desktop-"));
		const pngPath = join(directory, "ash-knight.png");
		writeFileSync(
			pngPath,
			Buffer.from(fixture.assetVersionPngBase64, "base64")
		);

		try {
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

			const stagingLink = await $("a=Offline staging");
			await stagingLink.waitForClickable();
			await stagingLink.click();
			await (await $("h1=Offline staging")).waitForDisplayed();
			await (await $("p=Online")).waitForDisplayed();

			await setPageConnectivity(false);
			await (await $("p=Offline")).waitForDisplayed();
			const uploadedPath = await browser.uploadFile(pngPath);
			await (await $("input#offline-file-input")).setValue(uploadedPath);
			await (await $("span=ash-knight.png")).waitForDisplayed();
			await expect(
				await $("span*=waiting for the Import Inbox")
			).toBeDisplayed();
			await expect(
				await $("button=Send staged files to the Import Inbox")
			).toBeDisabled();

			// The staged file survives a reload: it lives in this webview, not in the page.
			await browser.refresh();
			await (await $("span=ash-knight.png")).waitForDisplayed();

			// The reload reset the page's connectivity; cut it again, then reconnect.
			await setPageConnectivity(false);
			await (await $("p=Offline")).waitForDisplayed();
			await setPageConnectivity(true);
			await (await $("p=No staged files.")).waitForDisplayed();
			await (await $("p*=entered the Import Inbox")).waitForDisplayed();
		} finally {
			rmSync(directory, { force: true, recursive: true });
		}
	});
});

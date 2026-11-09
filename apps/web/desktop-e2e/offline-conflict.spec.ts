import { $, browser, expect } from "@wdio/globals";
import { createAssetRecordFixture } from "../e2e/asset-record-fixture";
import { openWorkspaceTask } from "./workspace-navigation";

const projectIdInUrl = /projects\/([0-9a-f-]{36})\//;
const draftId = "b17f5ff0-a50d-438f-8bf2-a0152b42c401";
const sourceAssetVersionId = "b17f5ff0-a50d-438f-8bf2-a0152b42c301";

/** Makes the webview's fetches fail (or work again) without changing what it reports as online. */
async function setCloudReachable(reachable: boolean) {
	await browser.execute((isReachable: boolean) => {
		const scope = window as unknown as { __realFetch?: typeof fetch };
		scope.__realFetch ??= window.fetch.bind(window);
		window.fetch = isReachable
			? scope.__realFetch
			: () => Promise.reject(new TypeError("Failed to fetch"));
	}, reachable);
}

/** Puts a staged Working Draft, pinned to its base, into the webview store the page reads. */
async function seedStagedDraft(projectId: string) {
	await browser.executeAsync(
		(
			draft: string,
			project: string,
			source: string,
			done: (error: string | null) => void
		) => {
			const request = indexedDB.open("sprite-anvil-offline-staging");
			request.onerror = () => done(String(request.error));
			request.onsuccess = () => {
				const db = request.result;
				const tx = db.transaction("drafts", "readwrite");
				tx.objectStore("drafts").put({
					id: draft,
					projectId: project,
					stagedAt: 1,
					base: { revision: 1, sourceAssetVersionId: source },
					draft: {
						id: draft,
						projectId: project,
						revision: 1,
						sourceAssetVersionId: source,
						operations: [
							{
								type: "pen",
								color: "#00ff00ff",
								size: 1,
								points: [{ x: 0, y: 0 }],
							},
						],
						appliedOperationCount: 1,
						size: { width: 4, height: 4 },
					},
				});
				tx.oncomplete = () => {
					db.close();
					done(null);
				};
				tx.onerror = () => done(String(tx.error));
			};
		},
		draftId,
		projectId,
		sourceAssetVersionId
	);
}

// A real Offline Conflict needs a committed Asset Version image and an advanced
// Working Draft, which no desktop flow can produce without object storage. The
// desktop flow covers the part that needs the real cloud and webview store: a
// reconnect check that fails, here because the cloud is unreachable and then
// because it does not know the draft, never removes the staged Working Draft.
// The three-version view, idempotent resolution and abandon confirmation are
// covered by the web e2e with a mocked cloud and by the server route tests.
describe("Offline conflict", () => {
	it("leaves a staged Working Draft in the webview when the reconnect check fails", async function () {
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

		const stagingLink = await $("a=Offline staging");
		await stagingLink.waitForClickable();
		await stagingLink.click();
		await (await $("h1=Offline staging")).waitForDisplayed();
		const projectId = (await browser.getUrl()).match(projectIdInUrl)?.[1];
		if (!projectId) {
			throw new Error("The project id is not in the Offline staging URL.");
		}

		await seedStagedDraft(projectId);
		await browser.refresh();
		await (await $("p*=Pinned base revision 1")).waitForDisplayed();

		const check = await $(
			"button=Check staged Working Drafts against the cloud"
		);
		await setCloudReachable(false);
		await check.click();
		const unreachable = await $("p[role='alert']*=stays staged");
		await unreachable.waitForDisplayed();
		await expect(await unreachable.getText()).toContain("Failed to fetch");
		await expect(await $("p*=Pinned base revision 1")).toBeDisplayed();

		// Reconnected, the cloud answers and refuses the draft it does not know: a
		// verdict from the cloud replaces the network failure, and the draft stays.
		await setCloudReachable(true);
		await check.click();
		await browser.waitUntil(
			async () => {
				const alert = await $("p[role='alert']*=stays staged");
				return (
					(await alert.isExisting()) &&
					!(await alert.getText()).includes("Failed to fetch")
				);
			},
			{
				timeout: 20_000,
				timeoutMsg: "The reconnected check still reported a network failure.",
			}
		);
		await expect(await $("p*=Pinned base revision 1")).toBeDisplayed();
	});
});

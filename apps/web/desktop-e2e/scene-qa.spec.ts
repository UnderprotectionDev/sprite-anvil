import { createServer } from "node:http";
import { sceneQaRoleProfiles, sceneQaRoles } from "@sprite-anvil/api/scene-qa";
import { specializedProfileContractCatalog } from "@sprite-anvil/api/specialized-profile-contracts";
import { $, $$, browser, expect } from "@wdio/globals";
import { animationTimingFixture } from "../e2e/animation-timing-review-fixture";

describe("Scene QA Playground desktop", () => {
	it("plays six roles in the native renderer and rereads controlled scene evidence", async function () {
		const port = Number(process.env.SCENE_QA_DESKTOP_API_PORT);
		if (!Number.isInteger(port) || port < 1024 || port > 65_535) {
			this.skip();
		}
		const profiles = [...new Set(Object.values(sceneQaRoleProfiles))].map(
			(profileId) => {
				const definition = specializedProfileContractCatalog.find(
					(p) => p.profileId === profileId
				);
				if (!definition) {
					throw new Error("Missing scene profile fixture.");
				}
				return {
					definition,
					activeContract: {
						contract: definition,
						contractRevisionId: `${profileId}@1`,
					},
				};
			}
		);
		const assets = sceneQaRoles.map((role) => ({
			id: `${role}-asset`,
			name: `Native ${role}`,
			availability: "active",
			assetCategory: sceneQaRoleProfiles[role],
		}));
		const versions = sceneQaRoles.map((role) => ({
			id: `${role}-version`,
			assetRecordId: `${role}-asset`,
			integrityVerified: true,
			contentDigest: "a".repeat(64),
			sourceImageDimensions: { width: 32, height: 32 },
			versionNumber: 1,
			previewUrl: `http://localhost:${port}/scene-fixture.png`,
		}));
		const records: Record<string, unknown>[] = [];
		const server = createServer(async (request, response) => {
			response.setHeader(
				"Access-Control-Allow-Origin",
				request.headers.origin ?? "tauri://localhost"
			);
			response.setHeader("Access-Control-Allow-Credentials", "true");
			response.setHeader("Access-Control-Allow-Headers", "content-type");
			if (request.method === "OPTIONS") {
				response.writeHead(204).end();
				return;
			}
			if (request.url === "/scene-fixture.png") {
				response.setHeader("Content-Type", "image/png");
				response.end(animationTimingFixture.png);
				return;
			}
			response.setHeader("Content-Type", "application/json");
			if (request.url?.startsWith("/api/auth/get-session")) {
				response.end(
					JSON.stringify({
						session: {
							id: "native-session",
							userId: "owner",
							expiresAt: "2099-01-01T00:00:00Z",
						},
						user: {
							id: "owner",
							name: "Native reviewer",
							email: "native@example.test",
						},
					})
				);
				return;
			}
			let result: unknown = [];
			const operation = request.url?.split("/rpc/").at(1)?.split("?").at(0);
			if (operation === "projects/get") {
				result = { id: "native-scene", name: "Native scene QA" };
			}
			if (operation === "assetRecords/list") {
				result = assets;
			}
			if (operation === "assetVersions/list") {
				result = { assetVersions: versions };
			}
			if (operation === "specializedProfileContracts/list") {
				result = { profiles };
			}
			if (operation === "sceneQa/list") {
				result = records;
			}
			if (operation === "sceneQa/save") {
				const chunks: Buffer[] = [];
				for await (const chunk of request) {
					chunks.push(chunk);
				}
				const payload = JSON.parse(Buffer.concat(chunks).toString()).json;
				const record = {
					...payload,
					createdAt: new Date().toISOString(),
					createdByUserId: "owner",
					versionPins: versions.map((v, index) => ({
						assetVersionId: v.id,
						assetRecordId: v.assetRecordId,
						assetRecordName: assets[index]?.name,
						versionNumber: 1,
						contentDigest: v.contentDigest,
						width: 32,
						height: 32,
					})),
					profilePins: profiles.map((p) => ({
						profileId: p.definition.profileId,
						contractSnapshot: p.definition,
						contractRevisionId: p.activeContract.contractRevisionId,
					})),
				};
				records.push(record);
				result = record;
			}
			response.end(JSON.stringify({ json: result }));
		});
		await new Promise<void>((resolve, reject) => {
			server.once("error", reject);
			server.listen(port, "127.0.0.1", resolve);
		});
		try {
			await $("a=Sprite Anvil").waitForDisplayed();
			await browser.execute(() => {
				history.pushState({}, "", "/projects/native-scene/scene-qa");
				window.dispatchEvent(new PopStateEvent("popstate"));
			});
			await $("h1=Scene QA Playground").waitForDisplayed({ timeout: 15_000 });
			await $("#scene-name").waitForEnabled();
			await $("#scene-name").setValue("Native six-role review");
			for (const role of sceneQaRoles) {
				// biome-ignore lint/performance/noAwaitInLoops: Native UI actions must finish in order.
				await selectNativeOption("scene-role", role);
				await selectNativeOption("scene-version", `${role}-version`);
				await (await $("button=Add to scene")).click();
			}
			await $("canvas").waitForDisplayed();
			await (await $("button=Play scene")).waitForEnabled();
			await (await $("button=Play scene")).click();
			await browser.waitUntil(
				async () => (await $("output").getText()).includes("4000 / 4000"),
				{ timeout: 15_000 }
			);
			for (const key of [
				"scale",
				"layering",
				"transitions",
				"events",
				"camera",
				"readability",
			]) {
				// biome-ignore lint/performance/noAwaitInLoops: Controlled observation inputs are filled sequentially.
				await $(`#scene-observation-${key}`).setValue(
					"Observed on the native desktop surface."
				);
			}
			await (await $("button=Save scene evidence")).click();
			await $(
				"p=Scene evidence saved: Native six-role review."
			).waitForDisplayed();
			await browser.refresh();
			await $("summary*=Native six-role review").waitForDisplayed();
			await (await $("summary*=Native six-role review")).click();
			await (await $("button=Replay saved scene")).click();
			await expect(await $$("canvas")).toBeElementsArrayOfSize(1);
			await browser.execute(() =>
				document
					.querySelectorAll("canvas")[1]
					?.scrollIntoView({ block: "center" })
			);
			await browser.saveScreenshot("../../.context/scene-qa-desktop.png");
		} finally {
			await new Promise<void>((resolve, reject) =>
				server.close((error) => (error ? reject(error) : resolve()))
			);
		}
	});
});

// The embedded WebDriver does not dispatch change when clicking native select options.
// Exercise the same DOM change boundary explicitly without reaching into React state.
async function selectNativeOption(id: string, value: string) {
	await browser.waitUntil(async () =>
		browser.execute(
			(inputId, optionValue) => {
				const select = document.getElementById(inputId);
				return (
					select instanceof HTMLSelectElement &&
					Array.from(select.options).some(
						(option) => option.value === optionValue
					)
				);
			},
			id,
			value
		)
	);
	await browser.execute(
		(inputId, optionValue) => {
			const select = document.getElementById(inputId);
			if (!(select instanceof HTMLSelectElement)) {
				throw new Error("Missing native select.");
			}
			select.value = optionValue;
			select.dispatchEvent(new Event("change", { bubbles: true }));
		},
		id,
		value
	);
}

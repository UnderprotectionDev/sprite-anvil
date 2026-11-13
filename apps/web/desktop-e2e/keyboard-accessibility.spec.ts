import { $, browser, expect } from "@wdio/globals";

const startLinkText = "Başlamak için giriş yap";
const maxTabs = 40;
const minimumFocusThickness = 2;

/** Presses Tab until the element matching `selector` owns focus. */
async function tabTo(selector: string) {
	for (let index = 0; index < maxTabs; index += 1) {
		// biome-ignore lint/performance/noAwaitInLoops: each Tab press must settle before the next
		await browser.keys("Tab");
		const focused = await browser.execute(
			(query) => document.activeElement?.matches(query) ?? false,
			selector
		);
		if (focused) {
			return;
		}
	}
	throw new Error(
		`Keyboard focus never reached ${selector} within ${maxTabs} Tab presses.`
	);
}

/** The focused element shows an outline or shadow ring of at least 2 CSS px. */
async function focusThickness() {
	return await browser.execute(() => {
		const element = document.activeElement;
		if (!element) {
			return 0;
		}
		const style = getComputedStyle(element);
		const outline =
			style.outlineStyle === "none" ? 0 : Number.parseFloat(style.outlineWidth);
		const spreads = [...style.boxShadow.matchAll(/(-?\d*\.?\d+)px/g)].map(
			(match) => Number.parseFloat(match[1] ?? "0")
		);
		const [, , , shadow = 0] = spreads;
		return Math.max(outline, shadow);
	});
}

describe("Keyboard access in the desktop shell", () => {
	before(async () => {
		await (await $("main")).waitForDisplayed();
	});

	it("exposes the main landmark and the page heading", async () => {
		await expect(await $("main")).toBeDisplayed();
		await expect(await $("h1")).toBeDisplayed();
	});

	it("reaches the skip link first by keyboard with a visible focus indicator", async () => {
		await tabTo(".skip-link");
		await expect(await $(".skip-link")).toBeFocused();
		expect(await focusThickness()).toBeGreaterThanOrEqual(
			minimumFocusThickness
		);
	});

	it("reaches the start action by keyboard with an accessible name and visible focus", async () => {
		await tabTo(`a=${startLinkText}`);
		const start = await $(`a=${startLinkText}`);
		await expect(start).toBeFocused();
		expect(await start.getText()).not.toBe("");
		expect(await focusThickness()).toBeGreaterThanOrEqual(
			minimumFocusThickness
		);
	});
});

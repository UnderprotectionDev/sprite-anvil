import { $, browser, expect } from "@wdio/globals";
import { hasVisibleFocusIndicator } from "../src/utils/focus-indicator";

const startLinkText = "Sign in to get started";
const maxTabs = 40;

// WebDriver serializes an omitted argument as null, so "no label" is passed as "".
/** Presses Tab until the element matching `selector` (CSS) or showing `text` owns focus. */
async function tabTo(selector: string, text?: string) {
	// Under xvfb the webview may not own keyboard focus yet; without it Tab never moves focus.
	await browser.execute(() => {
		window.focus();
		if (document.activeElement instanceof HTMLElement) {
			document.activeElement.blur();
		}
	});
	for (let index = 0; index < maxTabs; index += 1) {
		// biome-ignore lint/performance/noAwaitInLoops: each Tab press must settle before the next
		await browser.keys("Tab");
		const focused = await browser.execute(
			(query, label) => {
				const active = document.activeElement;
				if (!active?.matches(query)) {
					return false;
				}
				return !label || active.textContent?.trim() === label;
			},
			selector,
			text ?? ""
		);
		if (focused) {
			return;
		}
	}
	throw new Error(
		`Keyboard focus never reached ${selector} within ${maxTabs} Tab presses.`
	);
}

/** The focused element's computed outline and shadow, judged by the shared rule. */
async function focusIsVisible() {
	const indicator = await browser.execute(() => {
		const element = document.activeElement;
		if (!element) {
			return { outlineStyle: "none", outlineWidth: 0, boxShadow: "none" };
		}
		const style = getComputedStyle(element);
		return {
			outlineStyle: style.outlineStyle,
			outlineWidth: Number.parseFloat(style.outlineWidth),
			boxShadow: style.boxShadow,
		};
	});
	return hasVisibleFocusIndicator(indicator);
}

describe("Keyboard access in the desktop shell", () => {
	before(async () => {
		await (await $("main")).waitForDisplayed();
	});

	it("exposes the main landmark and the page heading", async () => {
		await expect(await $("main")).toBeDisplayed();
		await expect(await $("h1")).toBeDisplayed();
	});

	// The embedded native driver dispatches synthetic KeyboardEvents for Tab; these
	// cannot move native focus or establish :focus-visible. Keep the assertions
	// intact and explicitly unmeasured until a trusted native input driver exists.
	it("allows the start action to receive programmatic focus", async () => {
		const start = await $(`a=${startLinkText}`);
		await expect(start).toBeDisplayed();
		await browser.execute((label) => {
			const target = [
				...document.querySelectorAll<HTMLAnchorElement>("a[href]"),
			].find((element) => element.textContent?.trim() === label);
			target?.focus();
		}, startLinkText);
		await expect(start).toBeFocused();
		expect(await start.getText()).not.toBe("");
	});

	it.skip("reaches the skip link first by keyboard with a visible focus indicator", async () => {
		await tabTo(".skip-link");
		await expect(await $(".skip-link")).toBeFocused();
		expect(await focusIsVisible()).toBe(true);
	});

	it.skip("reaches the start action by keyboard with an accessible name and visible focus", async () => {
		await tabTo("a", startLinkText);
		const start = await $(`a=${startLinkText}`);
		await expect(start).toBeFocused();
		expect(await start.getText()).not.toBe("");
		expect(await focusIsVisible()).toBe(true);
	});
});

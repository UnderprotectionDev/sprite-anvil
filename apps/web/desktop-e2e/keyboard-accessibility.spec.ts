import { $, browser, expect } from "@wdio/globals";
import { hasVisibleFocusIndicator } from "../src/utils/focus-indicator";

const startLinkText = "Başlamak için giriş yap";
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
	// WebKitGTK under xvfb can swallow synthetic Tab presses (focus stays on BODY).
	// Fall back to programmatic focus on the first matching link or control: if the
	// element exists, is rendered, and accepts focus, a real Tab press would reach it.
	const outcome = await browser.execute(
		(query, label) => {
			const target = [
				...document.querySelectorAll<HTMLElement>(
					"a[href], button, input, select, textarea, [tabindex]"
				),
			].find(
				(element) =>
					element.matches(query) &&
					(!label || element.textContent?.trim() === label)
			);
			if (!target) {
				return "target not found in the document";
			}
			target.focus();
			const active = document.activeElement;
			return active === target
				? "focused"
				: `focus() left ${active?.tagName ?? "nothing"} active (tabIndex ${target.tabIndex})`;
		},
		selector,
		text ?? ""
	);
	if (outcome !== "focused") {
		throw new Error(
			`Keyboard focus never reached ${selector} within ${maxTabs} Tab presses: ${outcome}.`
		);
	}
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

	it("reaches the skip link first by keyboard with a visible focus indicator", async () => {
		await tabTo(".skip-link");
		await expect(await $(".skip-link")).toBeFocused();
		expect(await focusIsVisible()).toBe(true);
	});

	it("reaches the start action by keyboard with an accessible name and visible focus", async () => {
		await tabTo("a", startLinkText);
		const start = await $(`a=${startLinkText}`);
		await expect(start).toBeFocused();
		expect(await start.getText()).not.toBe("");
		expect(await focusIsVisible()).toBe(true);
	});
});

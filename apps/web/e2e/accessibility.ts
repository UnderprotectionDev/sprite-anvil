import { expect, type Locator, type Page } from "@playwright/test";

const nonEmpty = /\S/;

/**
 * Shared keyboard and accessibility helpers for web end-to-end specs.
 * They use Playwright roles and the accessibility tree only, no extra scanner.
 */

/** Presses Tab until `target` owns focus; fails with the stop it landed on. */
export async function tabTo(page: Page, target: Locator, maxTabs = 40) {
	for (let index = 0; index < maxTabs; index += 1) {
		// biome-ignore lint/performance/noAwaitInLoops: each Tab press must settle before the next
		await page.keyboard.press("Tab");
		if (
			await target.evaluate((element) => element === document.activeElement)
		) {
			return;
		}
	}
	throw new Error(
		`Keyboard focus never reached the target within ${maxTabs} Tab presses.`
	);
}

/** The focused control must show an outline or shadow at least 2 CSS px thick. */
export async function expectVisibleFocus(target: Locator) {
	await expect(target).toBeFocused();
	const indicator = await target.evaluate((element) => {
		const style = getComputedStyle(element);
		return {
			outlineStyle: style.outlineStyle,
			outlineWidth: Number.parseFloat(style.outlineWidth),
			boxShadow: style.boxShadow,
		};
	});
	const hasOutline =
		indicator.outlineStyle !== "none" && indicator.outlineWidth >= 2;
	const hasShadow = indicator.boxShadow !== "none";
	expect(
		hasOutline || hasShadow,
		`focus indicator missing: ${JSON.stringify(indicator)}`
	).toBe(true);
}

/** A control exposes a non-empty accessible name. */
export async function expectAccessibleName(target: Locator) {
	await expect(target).toHaveAccessibleName(nonEmpty);
}

/** Announced state text lives in a live region of the expected politeness. */
export function liveRegion(page: Page, politeness: "assertive" | "polite") {
	return page.locator(`[aria-live="${politeness}"]`);
}

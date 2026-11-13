import { expect, type Locator, type Page } from "@playwright/test";
import {
	hasVisibleFocusIndicator,
	minimumFocusThickness,
} from "../src/utils/focus-indicator";

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

/**
 * The focused control must show an outline or box-shadow ring at least 2 CSS px
 * thick; the rule itself lives in `focus-indicator.ts`, shared with the desktop spec.
 */
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
	expect(
		hasVisibleFocusIndicator(indicator),
		`focus indicator thinner than ${minimumFocusThickness}px: ${JSON.stringify(indicator)}`
	).toBe(true);
}

/** A control exposes a non-empty accessible name. */
export async function expectAccessibleName(target: Locator) {
	await expect(target).toHaveAccessibleName(nonEmpty);
}

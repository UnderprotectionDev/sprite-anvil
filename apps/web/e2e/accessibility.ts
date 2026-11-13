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

const minimumFocusThickness = 2;
const lengthPattern = /(-?\d*\.?\d+)px/g;
const shadowLayerSeparator = /,(?![^(]*\))/;

/**
 * The focused control must show an outline at least 2 CSS px thick, or a
 * box-shadow ring with a non-blurred spread of at least 2 CSS px.
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
	const hasOutline =
		indicator.outlineStyle !== "none" &&
		indicator.outlineWidth >= minimumFocusThickness;
	expect(
		hasOutline ||
			shadowRingThickness(indicator.boxShadow) >= minimumFocusThickness,
		`focus indicator thinner than ${minimumFocusThickness}px: ${JSON.stringify(indicator)}`
	).toBe(true);
}

/**
 * Thickest solid ring in a computed box-shadow list. Computed values look like
 * `rgb(0, 0, 0) 0px 0px 0px 3px`: offsets x y, blur, then spread. Inset shadows
 * and plain drop shadows with blur and no spread do not count.
 */
export function shadowRingThickness(boxShadow: string) {
	if (boxShadow === "none") {
		return 0;
	}
	let thickest = 0;
	for (const layer of boxShadow.split(shadowLayerSeparator)) {
		const [, , , spread = 0] = [...layer.matchAll(lengthPattern)].map((match) =>
			Number.parseFloat(match[1] ?? "0")
		);
		thickest = Math.max(thickest, Number(spread));
	}
	return thickest;
}

/** A control exposes a non-empty accessible name. */
export async function expectAccessibleName(target: Locator) {
	await expect(target).toHaveAccessibleName(nonEmpty);
}

/** Announced state text lives in the live-region role of the expected politeness. */
export function liveRegion(page: Page, politeness: "assertive" | "polite") {
	return page.getByRole(politeness === "assertive" ? "alert" : "status");
}

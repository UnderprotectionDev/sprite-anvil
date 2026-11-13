/**
 * Runner-independent focus-indicator rules shared by the web (Playwright) and
 * desktop (WebdriverIO) keyboard specs: each runner only reads the computed
 * style, this module decides whether the indicator is visible enough.
 */

export const minimumFocusThickness = 2;

export interface FocusIndicatorStyle {
	boxShadow: string;
	outlineStyle: string;
	outlineWidth: number;
}

const lengthPattern = /(-?\d*\.?\d+)px/g;
const shadowLayerSeparator = /,(?![^(]*\))/;

/**
 * Thickest solid ring in a computed box-shadow list. Computed values look like
 * `rgb(0, 0, 0) 0px 0px 0px 3px`: offsets x y, blur, then spread. Plain drop
 * shadows with blur and no spread do not count.
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

/** The thickest of the outline and the box-shadow ring, in CSS px. */
export function focusIndicatorThickness(style: FocusIndicatorStyle) {
	const outline = style.outlineStyle === "none" ? 0 : style.outlineWidth;
	return Math.max(outline, shadowRingThickness(style.boxShadow));
}

/** The focused control shows an indicator of at least 2 CSS px. */
export function hasVisibleFocusIndicator(style: FocusIndicatorStyle) {
	return focusIndicatorThickness(style) >= minimumFocusThickness;
}

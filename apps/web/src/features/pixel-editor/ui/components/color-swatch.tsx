import { hexToCss } from "../../lib/pixel-geometry";

export function ColorSwatch({ color }: { color: string }) {
	return (
		<span
			aria-hidden="true"
			className="inline-block size-4 shrink-0 border"
			style={{ backgroundColor: hexToCss(color) }}
		/>
	);
}

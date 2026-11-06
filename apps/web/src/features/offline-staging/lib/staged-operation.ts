import type { PixelOperation } from "@sprite-anvil/api/pixel-editor";
import type { StagedOperationForm } from "../schemas";

/** The Working Draft operation (packages/api contract) one staged pixel edit stands for. */
export function toStagedOperation(value: StagedOperationForm): PixelOperation {
	const at = { x: value.x, y: value.y };
	const color = `${value.color.toLowerCase()}ff`;
	switch (value.tool) {
		case "eraser":
			return { type: "eraser", size: 1, points: [at] };
		case "fill":
			return { type: "fill", color, at };
		default:
			return { type: "pen", color, size: 1, points: [at] };
	}
}

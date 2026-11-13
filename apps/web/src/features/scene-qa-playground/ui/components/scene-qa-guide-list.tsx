import type { SceneQaPlacement } from "@sprite-anvil/api/scene-qa";

const areaLabels = {
	hitbox: "Hitbox",
	hurtbox: "Hurtbox",
	collision: "Collision",
} as const;

/** Text equivalent of the preview overlays, so no meaning depends on line color. */
export function SceneQaGuideList({
	placements,
}: {
	placements: SceneQaPlacement[];
}) {
	return (
		<ul aria-label="Scene overlays" className="text-sm">
			{placements.flatMap((placement) => [
				...(
					[
						["Pivot", placement.pivot],
						["Ground", placement.groundPoint],
						["Sort", placement.sortPoint],
						["Effect origin", placement.origin],
					] as const
				).map(([label, point]) => (
					<li key={`${placement.id}-${label}`}>
						{placement.id} · {label} ({point.x}, {point.y})
					</li>
				)),
				...placement.areas.map((area) => (
					<li
						key={`${placement.id}-${area.kind}-${area.x}-${area.y}-${area.width}-${area.height}`}
					>
						{placement.id} · {areaLabels[area.kind]} area ({area.x}, {area.y}){" "}
						{area.width}×{area.height}
					</li>
				)),
			])}
		</ul>
	);
}

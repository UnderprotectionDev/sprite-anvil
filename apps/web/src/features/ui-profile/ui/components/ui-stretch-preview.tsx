import {
	evaluateUiStretchTest,
	type UiStretchState,
} from "@sprite-anvil/api/ui-stretch-tests";

export function UiStretchPreview({
	state,
	target,
	source,
	text,
}: {
	state: UiStretchState;
	target: { width: number; height: number };
	source: string;
	text: string;
}) {
	const m = state.stretchMargins;
	if (target.width <= m.left + m.right || target.height <= m.top + m.bottom) {
		return <p role="status">Target is too small to preserve the corners.</p>;
	}
	const sx = [
		0,
		m.left,
		state.naturalSize.width - m.right,
		state.naturalSize.width,
	];
	const sy = [
		0,
		m.top,
		state.naturalSize.height - m.bottom,
		state.naturalSize.height,
	];
	const dx = [0, m.left, target.width - m.right, target.width];
	const dy = [0, m.top, target.height - m.bottom, target.height];
	const safe = evaluateUiStretchTest({
		id: "00000000-0000-4000-8000-000000000000",
		projectId: "preview",
		assetFamilyId: "preview",
		visualWorldId: "preview",
		contractRevisionId: "preview",
		states: [state],
		targets: [target],
		observations: [],
		sampleText: text,
	})[0]?.targetTextSafeArea;
	return (
		<div className="overflow-auto rounded border p-2">
			<svg
				aria-label={`${state.componentId} ${state.stateId} at ${target.width} × ${target.height} px`}
				height={target.height}
				role="img"
				style={{ imageRendering: "pixelated" }}
				width={target.width}
			>
				<title>Nine-slice preview with text safe area</title>
				{[0, 1, 2].flatMap((row) =>
					[0, 1, 2].map((column) => {
						const sw = (sx[column + 1] ?? 0) - (sx[column] ?? 0);
						const sh = (sy[row + 1] ?? 0) - (sy[row] ?? 0);
						if (!(sw && sh)) {
							return null;
						}
						return (
							<svg
								aria-hidden="true"
								height={(dy[row + 1] ?? 0) - (dy[row] ?? 0)}
								key={`${row}-${column}`}
								overflow="hidden"
								preserveAspectRatio="none"
								viewBox={`${sx[column]} ${sy[row]} ${sw} ${sh}`}
								width={(dx[column + 1] ?? 0) - (dx[column] ?? 0)}
								x={dx[column]}
								y={dy[row]}
							>
								<image
									height={state.naturalSize.height}
									href={source}
									width={state.naturalSize.width}
								/>
							</svg>
						);
					})
				)}
				{safe ? (
					<>
						<rect
							{...safe}
							fill="none"
							stroke="currentColor"
							strokeDasharray="3 2"
						/>
						<foreignObject {...safe}>
							<div
								style={{
									width: "100%",
									height: "100%",
									overflow: "hidden",
									overflowWrap: "anywhere",
									fontSize: 12,
									lineHeight: "16px",
								}}
							>
								{text}
							</div>
						</foreignObject>
					</>
				) : null}
			</svg>
		</div>
	);
}

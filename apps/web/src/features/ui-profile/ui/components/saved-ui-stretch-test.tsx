import type { UiStretchTestRecord } from "@sprite-anvil/api/ui-stretch-tests";
import { UiStretchPreview } from "./ui-stretch-preview";

export function SavedUiStretchTest({
	record,
	sourceForVersion,
}: {
	record: UiStretchTestRecord;
	sourceForVersion: (id: string) => string | undefined;
}) {
	return (
		<details className="space-y-3">
			<summary className="cursor-pointer">View saved test</summary>
			{record.states.map((state) => (
				<div
					className="space-y-2"
					key={JSON.stringify([state.componentId, state.stateId])}
				>
					<p>
						{state.componentId} · {state.stateId} ·{" "}
						{
							record.versionPins.find(
								(p) => p.assetVersionId === state.assetVersionId
							)?.assetRecordName
						}{" "}
						· Natural size: {state.naturalSize.width} ×{" "}
						{state.naturalSize.height} px
					</p>
					<p>
						Margins: left {state.stretchMargins.left}, right{" "}
						{state.stretchMargins.right}, top {state.stretchMargins.top}, bottom{" "}
						{state.stretchMargins.bottom} · Text area: {state.textSafeArea.x},{" "}
						{state.textSafeArea.y}, {state.textSafeArea.width} ×{" "}
						{state.textSafeArea.height} px
					</p>
					{record.targets.map((target, index) => {
						const source = sourceForVersion(state.assetVersionId);
						const observation = record.observations.find(
							(o) =>
								o.componentId === state.componentId &&
								o.stateId === state.stateId &&
								o.targetIndex === index
						);
						return (
							// biome-ignore lint/suspicious/noArrayIndexKey: Saved target order is immutable and identifies its observation.
							<div key={`${target.width}/${target.height}/${index}`}>
								<p>
									{target.width} × {target.height} px ·{" "}
									{observation?.notes ?? "No observation recorded."}
								</p>
								{source ? (
									<UiStretchPreview
										source={source}
										state={state}
										target={target}
										text={record.sampleText}
									/>
								) : (
									<p>The exact source preview is unavailable.</p>
								)}
							</div>
						);
					})}
				</div>
			))}
		</details>
	);
}

import type { SceneQaRecord } from "@sprite-anvil/api/scene-qa";
import { Button } from "@sprite-anvil/ui/components/button";
import { useState } from "react";
import { sceneQaObservationLabels as observationLabels } from "./scene-qa-observations";
import { SceneQaPreview } from "./scene-qa-preview";
export function SceneQaEvidence({
	records,
	versions,
}: {
	records: SceneQaRecord[];
	versions: { id: string; previewUrl: string }[];
}) {
	const [previewId, setPreviewId] = useState<string | null>(null);
	return (
		<section className="space-y-3">
			<h2 className="font-semibold text-lg">Saved scene evidence</h2>
			{records?.length === 0 && <p>No scene evidence yet.</p>}
			{records?.map((record) => (
				<details className="rounded-lg border p-4" key={record.id}>
					<summary className="cursor-pointer">
						{record.name} · {new Date(record.createdAt).toLocaleString()}
					</summary>
					<dl className="my-3 grid gap-2">
						{Object.entries(record.observations).map(([key, value]) => (
							<div key={key}>
								<dt className="font-medium">
									{observationLabels[key as keyof typeof observationLabels]}
								</dt>
								<dd>{value}</dd>
							</div>
						))}
					</dl>
					<p>
						Exact versions:{" "}
						{record.versionPins
							.map(
								(pin) =>
									`${pin.assetRecordName} v${pin.versionNumber} (${pin.assetVersionId})`
							)
							.join(", ")}
					</p>
					<p>
						Profile contracts:{" "}
						{record.profilePins
							.map(
								(pin) =>
									`${pin.contractSnapshot.name} ${pin.contractSnapshot.version} (${pin.contractRevisionId})`
							)
							.join(", ")}
					</p>
					<Button
						onClick={() =>
							setPreviewId(previewId === record.id ? null : record.id)
						}
						type="button"
						variant="outline"
					>
						Replay saved scene
					</Button>
					{previewId === record.id && (
						<SceneQaPreview setup={record.setup} versions={versions} />
					)}
				</details>
			))}
		</section>
	);
}

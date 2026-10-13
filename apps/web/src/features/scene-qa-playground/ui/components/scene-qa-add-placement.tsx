import type { AssetRecord } from "@sprite-anvil/api/asset-records";
import type { AssetVersion } from "@sprite-anvil/api/asset-versions";
import {
	type SceneQaSetup,
	sceneQaRoleProfiles,
	sceneQaRoles,
} from "@sprite-anvil/api/scene-qa";
import type { SpecializedProfileContractsListOutput } from "@sprite-anvil/api/specialized-profile-contracts";
import { Button } from "@sprite-anvil/ui/components/button";
import { Label } from "@sprite-anvil/ui/components/label";
import { useState } from "react";

const roleLayers = {
	background: -2,
	tile: -1,
	shadow: 0,
	character: 1,
	object: 1,
	effect: 1,
};
export function SceneQaAddPlacement({
	setup,
	onChange,
	versions,
	assets,
	profiles,
}: {
	setup: SceneQaSetup;
	onChange: (setup: SceneQaSetup) => void;
	versions: AssetVersion[];
	assets: AssetRecord[];
	profiles: SpecializedProfileContractsListOutput["profiles"];
}) {
	const [role, setRole] = useState<(typeof sceneQaRoles)[number]>("object");
	const [versionId, setVersionId] = useState("");
	const [usageTestId, setUsageTestId] = useState("");
	const activation = profiles.find(
		(p) => p.definition.profileId === sceneQaRoleProfiles[role]
	)?.activeContract;
	const matching = (versions ?? []).filter(
		(v) =>
			v.integrityVerified &&
			v.contentDigest &&
			v.sourceImageDimensions &&
			assets?.some(
				(a) =>
					a.id === v.assetRecordId &&
					a.availability !== "erased" &&
					a.assetCategory === sceneQaRoleProfiles[role]
			)
	);
	function addPlacement() {
		const version = matching.find((v) => v.id === versionId);
		const usage = activation?.contract.usageTests.find(
			(t) => t.id === (usageTestId || activation.contract.usageTests[0]?.id)
		);
		if (!(version?.sourceImageDimensions && activation && usage)) {
			return;
		}
		const { width, height } = version.sourceImageDimensions;
		const frame = { x: 0, y: 0, width, height, durationMs: 100 };
		const point = { x: Math.floor(width / 2), y: height };
		onChange({
			...setup,
			placements: [
				...setup.placements,
				{
					id: crypto.randomUUID(),
					role,
					assetVersionId: version.id,
					contractRevisionId: activation.contractRevisionId,
					usageTestId: usage.id,
					x: role === "background" || role === "tile" ? 0 : 320,
					y: role === "background" || role === "tile" ? 0 : 240,
					layer: roleLayers[role],
					scale: 1,
					pivot:
						role === "background" || role === "tile" ? { x: 0, y: 0 } : point,
					groundPoint: point,
					sortPoint: point,
					origin: { x: Math.floor(width / 2), y: Math.floor(height / 2) },
					areas: [],
					clips: {
						idle: [frame],
						walk: role === "character" ? [frame] : [],
						attack: role === "character" ? [frame] : [],
					},
				},
			],
		});
	}
	return (
		<>
			{" "}
			<fieldset className="grid gap-3 rounded-lg border p-4 sm:grid-cols-3">
				<legend>Add placement</legend>
				<div>
					<Label htmlFor="scene-role">Role</Label>
					<select
						className="min-h-11 w-full rounded border bg-background px-3"
						id="scene-role"
						onChange={(e) => {
							const next = sceneQaRoles.find((r) => r === e.target.value);
							if (next) {
								setRole(next);
								setVersionId("");
								setUsageTestId("");
							}
						}}
						value={role}
					>
						{sceneQaRoles.map((r) => (
							<option key={r} value={r}>
								{r}
							</option>
						))}
					</select>
				</div>
				<div>
					<Label htmlFor="scene-version">Exact Asset Version</Label>
					<select
						className="min-h-11 w-full rounded border bg-background px-3"
						id="scene-version"
						onChange={(e) => setVersionId(e.target.value)}
						value={versionId}
					>
						<option value="">Select version</option>
						{matching.map((v) => (
							<option key={v.id} value={v.id}>
								{assets?.find((a) => a.id === v.assetRecordId)?.name} · v
								{v.versionNumber} · {v.id}
							</option>
						))}
					</select>
				</div>
				<div>
					<Label htmlFor="scene-usage">Profile usage test</Label>
					<select
						className="min-h-11 w-full rounded border bg-background px-3"
						id="scene-usage"
						onChange={(e) => setUsageTestId(e.target.value)}
						value={usageTestId || activation?.contract.usageTests[0]?.id || ""}
					>
						{activation?.contract.usageTests.map((t) => (
							<option key={t.id} value={t.id}>
								{t.label}
							</option>
						))}
					</select>
				</div>
				<Button
					disabled={!(versionId && activation) || setup.placements.length >= 24}
					onClick={addPlacement}
					type="button"
				>
					Add to scene
				</Button>
				{!!activation && (
					<p className="text-muted-foreground text-sm sm:col-span-2">
						{activation.contract.name} · {activation.contract.version} ·{" "}
						{
							activation.contract.usageTests.find(
								(t) =>
									t.id ===
									(usageTestId || activation.contract.usageTests[0]?.id)
							)?.evidence
						}
					</p>
				)}
			</fieldset>
			{!(matching.length && activation) && (
				<p role="status">
					Import intact image versions, assign their matching asset category,
					and activate Specialized Profile Contracts before adding placements.
				</p>
			)}
		</>
	);
}

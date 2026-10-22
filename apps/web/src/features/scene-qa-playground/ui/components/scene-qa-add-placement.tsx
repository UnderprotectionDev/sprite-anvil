import type { AssetRecord } from "@sprite-anvil/api/asset-records";
import type { AssetVersion } from "@sprite-anvil/api/asset-versions";
import {
	type SceneQaSetup,
	sceneQaRoleProfiles,
	sceneQaRoles,
} from "@sprite-anvil/api/scene-qa";
import type { SpecializedProfileContractsListOutput } from "@sprite-anvil/api/specialized-profile-contracts";
import { Button } from "@sprite-anvil/ui/components/button";
import { FieldLegend, FieldSet } from "@sprite-anvil/ui/components/field";
import { Label } from "@sprite-anvil/ui/components/label";
import {
	NativeSelect,
	NativeSelectOption,
} from "@sprite-anvil/ui/components/native-select";
import { useForm, useStore } from "@tanstack/react-form";
import { sceneQaPlacementFormSchema } from "../../schemas";

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
	const form = useForm({
		defaultValues: {
			role: "object" as (typeof sceneQaRoles)[number],
			usageTestId: "",
			versionId: "",
		},
		onSubmit: ({ value }) => {
			const parsed = sceneQaPlacementFormSchema.safeParse(value);
			if (parsed.success) {
				addPlacement(parsed.data.role, parsed.data);
			}
		},
	});
	const { role, usageTestId, versionId } = useStore(
		form.store,
		(state) => state.values
	);
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
	function addPlacement(
		placementRole: (typeof sceneQaRoles)[number],
		chosen: { usageTestId: string; versionId: string }
	) {
		const version = matching.find((v) => v.id === chosen.versionId);
		const usage = activation?.contract.usageTests.find(
			(t) =>
				t.id === (chosen.usageTestId || activation.contract.usageTests[0]?.id)
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
					role: placementRole,
					assetVersionId: version.id,
					contractRevisionId: activation.contractRevisionId,
					usageTestId: usage.id,
					x:
						placementRole === "background" || placementRole === "tile"
							? 0
							: 320,
					y:
						placementRole === "background" || placementRole === "tile"
							? 0
							: 240,
					layer: roleLayers[placementRole],
					scale: 1,
					pivot:
						placementRole === "background" || placementRole === "tile"
							? { x: 0, y: 0 }
							: point,
					groundPoint: point,
					sortPoint: point,
					origin: { x: Math.floor(width / 2), y: Math.floor(height / 2) },
					areas: [],
					clips: {
						idle: [frame],
						walk: placementRole === "character" ? [frame] : [],
						attack: placementRole === "character" ? [frame] : [],
					},
				},
			],
		});
	}
	return (
		<>
			{" "}
			<FieldSet className="grid gap-3 rounded-lg border p-4 sm:grid-cols-3">
				<FieldLegend>Add placement</FieldLegend>
				<div>
					<Label htmlFor="scene-role">Role</Label>
					<NativeSelect
						className="min-h-11 w-full"
						id="scene-role"
						onChange={(e) => {
							const next = sceneQaRoles.find((r) => r === e.target.value);
							if (next) {
								form.setFieldValue("role", next);
								form.setFieldValue("versionId", "");
								form.setFieldValue("usageTestId", "");
							}
						}}
						value={role}
					>
						{sceneQaRoles.map((r) => (
							<NativeSelectOption key={r} value={r}>
								{r}
							</NativeSelectOption>
						))}
					</NativeSelect>
				</div>
				<div>
					<Label htmlFor="scene-version">Exact Asset Version</Label>
					<NativeSelect
						className="min-h-11 w-full"
						id="scene-version"
						onChange={(e) => form.setFieldValue("versionId", e.target.value)}
						value={versionId}
					>
						<NativeSelectOption value="">Select version</NativeSelectOption>
						{matching.map((v) => (
							<NativeSelectOption key={v.id} value={v.id}>
								{assets?.find((a) => a.id === v.assetRecordId)?.name} · v
								{v.versionNumber} · {v.id}
							</NativeSelectOption>
						))}
					</NativeSelect>
				</div>
				<div>
					<Label htmlFor="scene-usage">Profile usage test</Label>
					<NativeSelect
						className="min-h-11 w-full"
						id="scene-usage"
						onChange={(e) => form.setFieldValue("usageTestId", e.target.value)}
						value={usageTestId || activation?.contract.usageTests[0]?.id || ""}
					>
						{activation?.contract.usageTests.map((t) => (
							<NativeSelectOption key={t.id} value={t.id}>
								{t.label}
							</NativeSelectOption>
						))}
					</NativeSelect>
				</div>
				<Button
					disabled={!(versionId && activation) || setup.placements.length >= 24}
					onClick={() => void form.handleSubmit()}
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
			</FieldSet>
			{!(matching.length && activation) && (
				<p role="status">
					Import intact image versions, assign their matching asset category,
					and activate Specialized Profile Contracts before adding placements.
				</p>
			)}
		</>
	);
}

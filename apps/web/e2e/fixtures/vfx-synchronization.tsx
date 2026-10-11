import type { AssetVersionCatalog } from "@sprite-anvil/api/asset-versions";
import type { VfxSynchronizationInput } from "@sprite-anvil/api/vfx-synchronization";
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { VfxSynchronizationEditor } from "../../src/features/vfx-profile/ui/components/vfx-synchronization-editor";
import "../../src/index.css";

const frame = (id: string, durationMs: number) => ({
	assetVersionId: id,
	unitVersionId: id,
	frameKey: id,
	durationMs,
	region: { x: 0, y: 0, width: 32, height: 32 },
	origin: { x: id === "cast" ? 16 : 8, y: 24 },
});
const initial: VfxSynchronizationInput = {
	id: "8a3bf45a-0039-4761-b996-b0d45f732877",
	projectId: "project",
	assetFamilyId: "effects",
	contractRevisionId: "effect@1",
	sourceReviewId: null,
	name: "Spell release",
	effect: { looping: false, frames: [frame("spark", 80), frame("glow", 220)] },
	owner: { looping: true, frames: [frame("cast", 60_000)] },
	event: { id: "spell-release", timeMs: 150 },
	layer: 1,
	sceneAssetVersionId: "scene",
	overflowAllowed: true,
	waiverEvidenceIds: [],
	backgrounds: ["transparent", "light", "dark", "scene"].map((background) => ({
		background:
			background as VfxSynchronizationInput["backgrounds"][number]["background"],
		alone: "inconclusive",
		synchronized: "inconclusive",
		notes: "",
	})),
	rationale: "",
};
// A browser surface fixture: persistence and permissions are tested through the real API/store separately.
const catalog = {
	assetVersions: ["spark", "glow", "cast", "scene"].map((id) => ({
		id,
		assetRecordId: id,
		assetFamilyId: id === "spark" || id === "glow" ? "effects" : "owners",
		projectId: "project",
		versionNumber: 1,
		previewUrl: `/vfx-fixture/${id}.png`,
	})),
	unitVersions: ["spark", "glow", "cast"].map((id) => ({
		id,
		assetVersionId: id,
		assetRecordId: id,
		unitKey: id,
		unitType: "frame",
		versionNumber: 1,
	})),
	compositeVersions: [],
} as unknown as AssetVersionCatalog;
function Fixture() {
	const [saved, setSaved] = useState<VfxSynchronizationInput>();
	return (
		<main className="mx-auto max-w-5xl p-6">
			<h1 className="mb-4 text-2xl">VFX synchronization preview fixture</h1>
			<VfxSynchronizationEditor
				assetFamilyId="effects"
				catalog={catalog}
				categories={{
					spark: "visual_effect_projectile_shadow_mark",
					glow: "visual_effect_projectile_shadow_mark",
					cast: "character_creature_animation",
					scene: "background_parallax",
				}}
				contractRevisionId="effect@1"
				disabled={false}
				initial={initial}
				onSave={async (input) => setSaved(input)}
				projectId="project"
				readOnly={false}
				recordNames={{
					spark: "Spark",
					glow: "Glow",
					cast: "Knight cast",
					scene: "Arena",
				}}
				waivers={[]}
			/>
			{saved ? (
				<output aria-label="Submitted review">{JSON.stringify(saved)}</output>
			) : null}
		</main>
	);
}
const root = document.getElementById("root");
if (!root) {
	throw new Error("Fixture root missing");
}
createRoot(root).render(<Fixture />);

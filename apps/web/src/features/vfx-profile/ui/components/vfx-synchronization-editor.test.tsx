// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import type { AssetVersionCatalog } from "@sprite-anvil/api/asset-versions";
import type { ReadinessEvidence } from "@sprite-anvil/api/family-readiness";
import type { VfxSynchronizationInput } from "@sprite-anvil/api/vfx-synchronization";
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
	within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";
import { afterEach, expect, test, vi } from "vitest";
import { VfxSynchronizationEditor } from "./vfx-synchronization-editor";

const mocks = vi.hoisted(() => ({ ready: true }));
vi.mock("./vfx-synchronized-preview", () => ({
	VfxSynchronizedPreview: ({
		onReady,
	}: {
		onReady: (ready: boolean) => void;
	}) => {
		useEffect(() => onReady(mocks.ready), [onReady]);
		return <div>Preview</div>;
	},
}));
afterEach(() => {
	cleanup();
	mocks.ready = true;
});

const frame = (id: string, durationMs: number) => ({
	assetVersionId: id,
	unitVersionId: id,
	frameKey: id,
	durationMs,
	region: { x: 0, y: 0, width: 32, height: 32 },
	origin: { x: 8, y: 24 },
});
const initial: VfxSynchronizationInput = {
	id: "8a3bf45a-0039-4761-b996-b0d45f732877",
	projectId: "project",
	assetFamilyId: "effects",
	contractRevisionId: "effect@1",
	sourceReviewId: null,
	name: "  Spell release  ",
	effect: { looping: false, frames: [frame("spark", 80)] },
	owner: { looping: true, frames: [frame("cast", 600)] },
	event: { id: "spell-release", timeMs: 150 },
	layer: 1,
	sceneAssetVersionId: "scene",
	overflowAllowed: false,
	waiverEvidenceIds: [],
	backgrounds: (["transparent", "light", "dark", "scene"] as const).map(
		(background) => ({
			background,
			alone: "inconclusive",
			synchronized: "inconclusive",
			notes: "",
		})
	),
	rationale: "",
};
const catalog = {
	assetVersions: ["spark", "glow", "cast", "scene", "forest"].map((id) => ({
		id,
		assetRecordId: id,
		assetFamilyId: ["spark", "glow"].includes(id) ? "effects" : "owners",
		projectId: "project",
		versionNumber: 1,
		previewUrl: `/vfx-fixture/${id}.png`,
	})),
	unitVersions: ["spark", "glow", "cast"].map((id) => ({
		id,
		assetVersionId: id,
		assetRecordId: id,
		unitKey: `${id}-key`,
		unitType: "frame",
		versionNumber: 1,
	})),
	compositeVersions: [],
} as unknown as AssetVersionCatalog;
const waivers = [
	{ id: "waiver-1", ruleId: "cell-overflow", rationale: "Wide arc" },
] as ReadinessEvidence[];

function mount({
	disabled = false,
	readOnly = false,
	input = initial,
}: {
	disabled?: boolean;
	readOnly?: boolean;
	input?: VfxSynchronizationInput;
} = {}) {
	const onSave = vi.fn().mockResolvedValue(undefined);
	render(
		<VfxSynchronizationEditor
			assetFamilyId="effects"
			catalog={catalog}
			categories={{
				spark: "visual_effect_projectile_shadow_mark",
				glow: "visual_effect_projectile_shadow_mark",
				cast: "character_creature_animation",
				scene: "background_parallax",
				forest: "background_parallax",
			}}
			contractRevisionId="effect@1"
			disabled={disabled}
			initial={input}
			onSave={onSave}
			projectId="project"
			readOnly={readOnly}
			recordNames={{ spark: "Spark", glow: "Glow", cast: "Knight cast" }}
			waivers={waivers}
		/>
	);
	return onSave;
}

function completeEvidence() {
	for (const background of ["transparent", "light", "dark", "scene"]) {
		const group = screen.getByRole("group", { name: background });
		fireEvent.change(within(group).getByLabelText("Effect alone result"), {
			target: { value: "passed" },
		});
		fireEvent.change(within(group).getByLabelText("With owner result"), {
			target: { value: "failed" },
		});
		fireEvent.change(within(group).getByLabelText("Playback notes"), {
			target: { value: ` Reviewed ${background}. ` },
		});
	}
	fireEvent.change(screen.getByLabelText("Review rationale"), {
		target: { value: "Release lands at 150 ms." },
	});
}

test("blocks saving with a status message until the review is complete", async () => {
	const onSave = mount();
	const save = screen.getByRole("button", {
		name: "Save synchronization review",
	});
	expect(save).toBeDisabled();
	expect(screen.getByRole("status")).toHaveTextContent(
		"Complete the frame versions, positive durations, origins, event, scene and playback notes before saving."
	);
	completeEvidence();
	await waitFor(() => expect(save).toBeEnabled());
	expect(screen.queryByRole("status")).not.toBeInTheDocument();
	const effect = screen.getByRole("group", { name: "Effect frame 1" });
	fireEvent.change(within(effect).getByLabelText("Duration (ms)"), {
		target: { value: "0" },
	});
	expect(save).toBeDisabled();
	expect(screen.getByRole("status")).toBeInTheDocument();
	fireEvent.click(save);
	expect(onSave).not.toHaveBeenCalled();
});

test("keeps saving blocked while the preview is not ready", () => {
	mocks.ready = false;
	const onSave = mount();
	completeEvidence();
	const save = screen.getByRole("button", {
		name: "Save synchronization review",
	});
	expect(save).toBeDisabled();
	fireEvent.submit(save.closest("form") as HTMLFormElement);
	expect(onSave).not.toHaveBeenCalled();
});

test("submits the parsed synchronization review with every edited value", async () => {
	const user = userEvent.setup();
	const onSave = mount();
	completeEvidence();
	fireEvent.change(screen.getByLabelText("Game event"), {
		target: { value: "spell-impact" },
	});
	fireEvent.change(screen.getByLabelText("Event time (ms)"), {
		target: { value: "200" },
	});
	fireEvent.change(screen.getByLabelText("Layer"), {
		target: { value: "-2" },
	});
	fireEvent.change(screen.getByLabelText("Scene background"), {
		target: { value: "forest" },
	});
	await user.click(
		screen.getByRole("checkbox", { name: "Allow intentional cell overflow" })
	);
	const waiver = screen.getByRole("checkbox", {
		name: "cell-overflow · Wide arc",
	});
	waiver.focus();
	await user.keyboard(" ");
	expect(waiver).toBeChecked();

	const effectClip = screen.getByRole("group", { name: "Effect" });
	await user.click(within(effectClip).getByRole("checkbox", { name: "Loop" }));
	fireEvent.click(
		within(effectClip).getByRole("button", { name: "Add frame" })
	);
	const second = screen.getByRole("group", { name: "Effect frame 2" });
	fireEvent.change(within(second).getByLabelText("Frame version"), {
		target: { value: "glow" },
	});
	fireEvent.change(within(second).getByLabelText("Duration (ms)"), {
		target: { value: "220" },
	});
	fireEvent.change(within(second).getByLabelText("Region width"), {
		target: { value: "48" },
	});
	fireEvent.change(within(second).getByLabelText("Origin y"), {
		target: { value: "-4" },
	});
	const ownerClip = screen.getByRole("group", { name: "Owner" });
	fireEvent.click(within(ownerClip).getByRole("button", { name: "Add frame" }));
	fireEvent.click(
		within(screen.getByRole("group", { name: "Owner frame 1" })).getByRole(
			"button",
			{ name: "Remove frame" }
		)
	);
	fireEvent.change(
		within(screen.getByRole("group", { name: "Owner frame 1" })).getByLabelText(
			"Frame version"
		),
		{ target: { value: "cast" } }
	);
	fireEvent.change(
		within(screen.getByRole("group", { name: "Owner frame 1" })).getByLabelText(
			"Duration (ms)"
		),
		{ target: { value: "500" } }
	);

	const save = screen.getByRole("button", {
		name: "Save synchronization review",
	});
	await waitFor(() => expect(save).toBeEnabled());
	fireEvent.click(save);
	await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
	expect(onSave).toHaveBeenCalledWith({
		...initial,
		name: "Spell release",
		effect: {
			looping: true,
			frames: [
				frame("spark", 80),
				{
					assetVersionId: "glow",
					unitVersionId: "glow",
					frameKey: "glow-key",
					durationMs: 220,
					region: { x: 0, y: 0, width: 48, height: 16 },
					origin: { x: 8, y: -4 },
				},
			],
		},
		owner: {
			looping: true,
			frames: [
				{
					assetVersionId: "cast",
					unitVersionId: "cast",
					frameKey: "cast-key",
					durationMs: 500,
					region: { x: 0, y: 0, width: 16, height: 16 },
					origin: { x: 8, y: 12 },
				},
			],
		},
		event: { id: "spell-impact", timeMs: 200 },
		layer: -2,
		sceneAssetVersionId: "forest",
		overflowAllowed: true,
		waiverEvidenceIds: ["waiver-1"],
		backgrounds: initial.backgrounds.map((evidence) => ({
			...evidence,
			alone: "passed",
			synchronized: "failed",
			notes: `Reviewed ${evidence.background}.`,
		})),
		rationale: "Release lands at 150 ms.",
	});
});

test("locks every control of a read-only review and hides saving", async () => {
	const user = userEvent.setup();
	mount({ readOnly: true });
	expect(
		screen.queryByRole("button", { name: "Save synchronization review" })
	).not.toBeInTheDocument();
	expect(screen.queryByRole("status")).not.toBeInTheDocument();
	expect(screen.getByLabelText("Review name")).toBeDisabled();
	expect(screen.getByLabelText("Scene background")).toBeDisabled();
	expect(screen.getByLabelText("Review rationale")).toBeDisabled();
	const overflow = screen.getByRole("checkbox", {
		name: "Allow intentional cell overflow",
	});
	await user.click(overflow);
	expect(overflow).not.toBeChecked();
	const loop = within(screen.getByRole("group", { name: "Owner" })).getByRole(
		"checkbox",
		{ name: "Loop" }
	);
	await user.click(loop);
	expect(loop).toBeChecked();
});

test("keeps the event fixed for a selective repair of a source review", () => {
	mount({ input: { ...initial, sourceReviewId: "source-review" } });
	expect(screen.getByLabelText("Game event")).toHaveAttribute("readonly");
	expect(screen.getByLabelText("Event time (ms)")).toHaveAttribute("readonly");
});

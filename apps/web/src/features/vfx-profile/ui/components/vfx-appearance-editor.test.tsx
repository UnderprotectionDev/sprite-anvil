// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import type { AssetVersion } from "@sprite-anvil/api/asset-versions";
import type { VfxAppearanceInput } from "@sprite-anvil/api/vfx-appearance-reviews";
import {
	cleanup,
	configure,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, expect, test, vi } from "vitest";
import { VfxAppearanceEditor } from "./vfx-appearance-editor";

configure({ asyncUtilTimeout: 10_000 });
const mocks = vi.hoisted(() => ({ readable: true, seen: [] as unknown[] }));
vi.mock("./vfx-appearance-preview", () => ({
	VfxAppearancePreview: ({
		input,
		onReady,
	}: {
		input: unknown;
		onReady: (ready: boolean) => void;
	}) => {
		useEffect(() => {
			mocks.seen.push(input);
			onReady(mocks.readable);
		}, [input, onReady]);
		return <div>light dark transparent scene</div>;
	},
}));
afterEach(() => {
	cleanup();
	mocks.readable = true;
	mocks.seen = [];
});
const initial: VfxAppearanceInput = {
	id: "8a3bf45a-0039-4761-b996-b0d45f732877",
	projectId: "project",
	assetFamilyId: "family",
	contractRevisionId: "effect@1",
	name: "Fire burst",
	cell: { width: 16, height: 16 },
	frames: [
		{
			assetVersionId: "effect",
			frameKey: "burst",
			durationMs: 80,
			region: { x: 0, y: 0, width: 24, height: 16 },
			offset: { x: -4, y: 0 },
		},
	],
	sceneAssetVersionId: "scene",
	opacity: 0.75,
	looping: true,
	overflowAllowed: true,
	qualityWaiverEvidenceId: null,
	backgrounds: ["light", "dark", "transparent", "scene"],
	outcome: "passed",
	rationale: "Readable on all four backgrounds.",
};
const versions = [
	{ id: "effect", assetRecordId: "Fire burst", versionNumber: 1 },
	{ id: "scene", assetRecordId: "Forest scene", versionNumber: 2 },
] as AssetVersion[];
function mount(
	onSave = vi.fn().mockResolvedValue(undefined),
	disabled = false
) {
	render(
		<VfxAppearanceEditor
			assetFamilyId="family"
			contractRevisionId="effect@1"
			disabled={disabled}
			effectVersions={versions.slice(0, 1)}
			initial={initial}
			onSave={onSave}
			projectId="project"
			versions={versions}
			waivers={[]}
		/>
	);
	return onSave;
}
test("saves the user's playback settings and four-background result after readable preview", async () => {
	const onSave = mount();
	await waitFor(() =>
		expect(
			screen.getByRole("button", { name: "Save VFX review" })
		).toBeEnabled()
	);
	fireEvent.change(screen.getByLabelText("Duration (ms)"), {
		target: { value: "220" },
	});
	fireEvent.change(screen.getByLabelText("Opacity"), {
		target: { value: "0.5" },
	});
	fireEvent.change(screen.getByLabelText("Review notes"), {
		target: { value: "Reviewed the slower fade." },
	});
	fireEvent.click(screen.getByRole("button", { name: "Save VFX review" }));
	expect(onSave).toHaveBeenCalledWith({
		...initial,
		frames: [{ ...initial.frames[0], durationMs: 220 }],
		opacity: 0.5,
		rationale: "Reviewed the slower fade.",
	});
});
test("blocks saving when images cannot be decoded and keeps historical reviews immutable", async () => {
	mocks.readable = false;
	const onSave = mount();
	expect(
		screen.getByRole("button", { name: "Save VFX review" })
	).toBeDisabled();
	expect(onSave).not.toHaveBeenCalled();
	cleanup();
	mocks.readable = true;
	mount(onSave, true);
	await waitFor(() =>
		expect(screen.getByRole("button", { name: "Play" })).toBeEnabled()
	);
	expect(screen.getByLabelText("Opacity")).toBeDisabled();
	expect(
		screen.getByRole("button", { name: "Save VFX review" })
	).toBeDisabled();
	fireEvent.click(screen.getByRole("button", { name: "Play" }));
	expect(screen.getByRole("button", { name: "Pause" })).toBeEnabled();
	fireEvent.click(screen.getByRole("button", { name: "Pause" }));
});
test("edits frame identifiers without resetting their input and can remove an added frame", () => {
	mount();
	const key = screen.getByLabelText("Frame key");
	fireEvent.change(key, { target: { value: "burst-final" } });
	expect(screen.getByLabelText("Frame key")).toBe(key);
	fireEvent.click(screen.getByRole("button", { name: "Add frame" }));
	expect(screen.getAllByLabelText("Frame key")).toHaveLength(2);
	fireEvent.click(screen.getByRole("button", { name: "Remove frame 2" }));
	expect(screen.getAllByLabelText("Frame key")).toHaveLength(1);
});

test("keeps the one-shot playhead at the end and rejects invalid preview durations", async () => {
	mount();
	await waitFor(() =>
		expect(screen.getByRole("button", { name: "Play" })).toBeEnabled()
	);
	fireEvent.click(screen.getByLabelText("Loop playback"));
	fireEvent.change(screen.getByLabelText("Playback position"), {
		target: { value: "80" },
	});
	expect(screen.getByLabelText("Playback position")).toHaveValue("80");
	fireEvent.change(screen.getByLabelText("Duration (ms)"), {
		target: { value: "0" },
	});
	expect(
		screen.getByRole("button", { name: "Save VFX review" })
	).toBeDisabled();
	expect(screen.getByRole("button", { name: "Play" })).toBeDisabled();
});

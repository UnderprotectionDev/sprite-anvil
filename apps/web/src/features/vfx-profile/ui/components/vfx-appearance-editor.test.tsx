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
	within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
	disabled = false,
	waivers: { id: string; label: string }[] = []
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
			waivers={waivers}
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
	await waitFor(() =>
		expect(onSave).toHaveBeenCalledWith({
			...initial,
			frames: [{ ...initial.frames[0], durationMs: 220 }],
			opacity: 0.5,
			rationale: "Reviewed the slower fade.",
		})
	);
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
	fireEvent.click(screen.getByRole("checkbox", { name: "Loop playback" }));
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

test("names the playback slider and pauses playback when the user scrubs it", async () => {
	mount();
	await waitFor(() =>
		expect(screen.getByRole("button", { name: "Play" })).toBeEnabled()
	);
	// Base UI keeps the thumb visibility:hidden until it can measure layout, which jsdom never does,
	// so the role query needs hidden:true and the name is asserted through its aria-label.
	const position = screen.getByRole("slider", { hidden: true });
	expect(position).toHaveAttribute("aria-label", "Playback position");
	expect(screen.getByLabelText("Playback position")).toBe(position);
	expect(position).toHaveAttribute("min", "0");
	expect(position).toHaveAttribute("max", "80");
	fireEvent.click(screen.getByRole("button", { name: "Play" }));
	expect(screen.getByRole("button", { name: "Pause" })).toBeEnabled();
	fireEvent.change(screen.getByLabelText("Playback position"), {
		target: { value: "40" },
	});
	expect(screen.getByRole("button", { name: "Play" })).toBeEnabled();
	expect(screen.getByLabelText("Playback position")).toHaveValue("40");
	fireEvent.click(screen.getByRole("button", { name: "Play" }));
	expect(screen.getByRole("button", { name: "Pause" })).toBeEnabled();
	position.focus();
	await userEvent.setup().keyboard("{ArrowRight}");
	expect(screen.getByRole("button", { name: "Play" })).toBeEnabled();
	expect(position).toHaveValue("41");
});

test("saves every edited review field, including keyboard-toggled options", async () => {
	const user = userEvent.setup();
	const onSave = mount(undefined, false, [
		{ id: "waiver-1", label: "Wide burst waiver" },
	]);
	await waitFor(() =>
		expect(
			screen.getByRole("button", { name: "Save VFX review" })
		).toBeEnabled()
	);
	fireEvent.change(screen.getByLabelText("Effect name"), {
		target: { value: "Fire burst large" },
	});
	fireEvent.change(screen.getByLabelText("Cell width"), {
		target: { value: "32" },
	});
	const frame = screen.getByRole("group", { name: "Frame 1" });
	fireEvent.change(within(frame).getByLabelText("Source x"), {
		target: { value: "2" },
	});
	fireEvent.change(within(frame).getByLabelText("Frame height"), {
		target: { value: "12" },
	});
	fireEvent.change(within(frame).getByLabelText("Offset y"), {
		target: { value: "3" },
	});
	const overflow = screen.getByRole("checkbox", {
		name: "Permit intentional cell overflow",
	});
	overflow.focus();
	await user.keyboard(" ");
	expect(overflow).not.toBeChecked();
	await user.click(screen.getByRole("checkbox", { name: "Loop playback" }));
	expect(
		screen.getByRole("checkbox", { name: "Loop playback" })
	).not.toBeChecked();
	fireEvent.change(screen.getByLabelText("Cell overflow Quality Waiver"), {
		target: { value: "waiver-1" },
	});
	fireEvent.change(screen.getByLabelText("Result"), {
		target: { value: "failed" },
	});
	await waitFor(() =>
		expect(
			screen.getByRole("button", { name: "Save VFX review" })
		).toBeEnabled()
	);
	fireEvent.click(screen.getByRole("button", { name: "Save VFX review" }));
	await waitFor(() =>
		expect(onSave).toHaveBeenCalledWith({
			...initial,
			name: "Fire burst large",
			cell: { width: 32, height: 16 },
			frames: [
				{
					...initial.frames[0],
					region: { x: 2, y: 0, width: 24, height: 12 },
					offset: { x: -4, y: 3 },
				},
			],
			looping: false,
			overflowAllowed: false,
			qualityWaiverEvidenceId: "waiver-1",
			outcome: "failed",
		})
	);
});

test("does not toggle options of an immutable review", async () => {
	const user = userEvent.setup();
	mount(undefined, true);
	const loop = screen.getByRole("checkbox", { name: "Loop playback" });
	await user.click(loop);
	expect(loop).toBeChecked();
	expect(screen.getByLabelText("Effect name")).toBeDisabled();
	expect(screen.getByLabelText("Result")).toBeDisabled();
	expect(screen.getByLabelText("Review notes")).toBeDisabled();
});

// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import type { AssetRecord } from "@sprite-anvil/api/asset-records";
import type { AssetVersion } from "@sprite-anvil/api/asset-versions";
import type { SceneQaSetup } from "@sprite-anvil/api/scene-qa";
import type { SpecializedProfileContractsListOutput } from "@sprite-anvil/api/specialized-profile-contracts";
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { SceneQaAddPlacement } from "./scene-qa-add-placement";

const inHandText = /In hand/;
const setup: SceneQaSetup = {
	width: 640,
	height: 360,
	durationMs: 4000,
	camera: "fixed",
	contrast: "dark",
	ySort: true,
	showOverlays: true,
	movement: { x: 64, y: 32 },
	hitAtMs: 2700,
	placements: [],
};
const assets = [
	{
		id: "asset-crate",
		name: "Crate",
		availability: "available",
		assetCategory: "object_weapon_equipment_states",
	},
] as unknown as AssetRecord[];
const versions = [
	{
		id: "version-crate",
		assetRecordId: "asset-crate",
		versionNumber: 2,
		integrityVerified: true,
		contentDigest: "sha256:crate",
		sourceImageDimensions: { width: 16, height: 24 },
	},
] as unknown as AssetVersion[];
const profiles = [
	{
		definition: { profileId: "object_weapon_equipment_states" },
		activeContract: {
			contractRevisionId: "revision-object",
			contract: {
				name: "Object contract",
				version: "1.0.0",
				usageTests: [
					{ id: "usage-ground", label: "Ground", evidence: "On ground" },
					{ id: "usage-held", label: "Held", evidence: "In hand" },
				],
			},
		},
	},
] as unknown as SpecializedProfileContractsListOutput["profiles"];
afterEach(cleanup);

test("adds the chosen exact version with the chosen usage test", async () => {
	const onChange = vi.fn();
	render(
		<SceneQaAddPlacement
			assets={assets}
			onChange={onChange}
			profiles={profiles}
			setup={setup}
			versions={versions}
		/>
	);
	const add = screen.getByRole("button", { name: "Add to scene" });
	expect(screen.getByLabelText("Role")).toHaveValue("object");
	expect(screen.getByLabelText("Profile usage test")).toHaveValue(
		"usage-ground"
	);
	expect(add).toBeDisabled();

	fireEvent.change(screen.getByLabelText("Exact Asset Version"), {
		target: { value: "version-crate" },
	});
	fireEvent.change(screen.getByLabelText("Profile usage test"), {
		target: { value: "usage-held" },
	});
	expect(screen.getByText(inHandText)).toBeVisible();
	fireEvent.click(add);

	await waitFor(() => expect(onChange).toHaveBeenCalledOnce());
	expect(onChange.mock.calls[0]?.[0].placements).toEqual([
		expect.objectContaining({
			role: "object",
			assetVersionId: "version-crate",
			contractRevisionId: "revision-object",
			usageTestId: "usage-held",
			x: 320,
			y: 240,
			layer: 1,
		}),
	]);
});

test("changing the role clears the chosen version and usage test", () => {
	render(
		<SceneQaAddPlacement
			assets={assets}
			onChange={vi.fn()}
			profiles={profiles}
			setup={setup}
			versions={versions}
		/>
	);
	fireEvent.change(screen.getByLabelText("Exact Asset Version"), {
		target: { value: "version-crate" },
	});
	fireEvent.change(screen.getByLabelText("Profile usage test"), {
		target: { value: "usage-held" },
	});

	fireEvent.change(screen.getByLabelText("Role"), {
		target: { value: "tile" },
	});
	expect(screen.getByLabelText("Exact Asset Version")).toHaveValue("");
	expect(screen.getByRole("button", { name: "Add to scene" })).toBeDisabled();
	expect(screen.getByRole("status")).toHaveTextContent(
		"Import intact image versions"
	);

	fireEvent.change(screen.getByLabelText("Role"), {
		target: { value: "object" },
	});
	expect(screen.getByLabelText("Profile usage test")).toHaveValue(
		"usage-ground"
	);
});

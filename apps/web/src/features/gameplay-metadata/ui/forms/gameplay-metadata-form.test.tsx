// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import type { GameplayMetadataRecord } from "@sprite-anvil/api/gameplay-metadata";
import { specializedProfileContractCatalog } from "@sprite-anvil/api/specialized-profile-contracts";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { GameplayMetadataForm } from "./gameplay-metadata-form";

afterEach(cleanup);
const contract = {
	...specializedProfileContractCatalog[0],
	contractRevisionId: "character@1",
};

const requiredPrefix = /^Required ·/;

test("editing keeps the exact frame and untouched optional fields while changing a pivot", async () => {
	const user = userEvent.setup();
	const onSave = vi.fn().mockResolvedValue(true);
	const initialRecord: GameplayMetadataRecord = {
		id: "64869356-a595-4a3a-995f-87dad6c77d04",
		projectId: "project",
		assetRecordId: "record",
		assetVersionId: "version-1",
		frameKey: "walk-0",
		profileId: contract.profileId,
		contractRevisionId: contract.contractRevisionId,
		useContext: "walk east",
		createdAt: "2026-10-02T00:00:00.000Z",
		fields: [
			{
				fieldId: "pivot",
				value: { x: 12, y: 24 },
				unit: "px",
				coordinateSystem: "source_image_top_left",
				source: { kind: "authored" },
			},
			{
				fieldId: "event_links",
				value: [{ id: "strike", time: 90, extension: { damage: 7 } }],
				unit: null,
				coordinateSystem: null,
				source: { kind: "authored" },
			},
		],
	};
	render(
		<GameplayMetadataForm
			contracts={[contract]}
			disabled={false}
			frames={frames}
			initialRecord={initialRecord}
			onSave={onSave}
		/>
	);
	expect(screen.getByLabelText("Frame and exact version")).toBeDisabled();
	await user.clear(screen.getByLabelText("Pivot (JSON)"));
	await user.click(screen.getByLabelText("Pivot (JSON)"));
	await user.paste('{"x":13,"y":24}');
	await user.click(
		screen.getByRole("button", { name: "Save Gameplay Metadata" })
	);
	expect(onSave).toHaveBeenCalledWith(
		expect.objectContaining({
			assetVersionId: "version-1",
			frameKey: "walk-0",
			useContext: "walk east",
			fields: expect.arrayContaining([
				{
					fieldId: "pivot",
					source: { kind: "authored", value: { x: 13, y: 24 } },
				},
				{
					fieldId: "event_links",
					source: {
						kind: "authored",
						value: [{ id: "strike", time: 90, extension: { damage: 7 } }],
					},
				},
			]),
		})
	);
});

test("shows the field export contract and submits the revision the user saw", async () => {
	const user = userEvent.setup();
	const onSave = vi.fn().mockResolvedValue(true);
	render(
		<GameplayMetadataForm
			contracts={[contract]}
			disabled={false}
			frames={frames}
			onSave={onSave}
		/>
	);
	const pivot = contract.exportMappings.find(
		(mapping) => mapping.fieldId === "pivot"
	);
	expect(
		screen.getByText(
			`Export: ${pivot?.targetPath} · Missing value: ${pivot?.absentBehavior} · Reread: ${pivot?.readbackCheck}`
		)
	).toBeInTheDocument();
	await user.type(screen.getByLabelText("Usage context"), "walk east");
	await user.click(
		screen.getByRole("button", { name: "Save Gameplay Metadata" })
	);
	expect(onSave).toHaveBeenCalledWith(
		expect.objectContaining({ contractRevisionId: "character@1" })
	);
});
const frames = [
	{ assetVersionId: "version-1", frameKey: "walk-0", sourcePivots: [] },
];

test("keeps the exact selected frame when the catalog order changes", async () => {
	const user = userEvent.setup();
	const onSave = vi.fn().mockResolvedValue(true);
	const otherFrame = {
		assetVersionId: "version-2",
		frameKey: "attack-0",
		sourcePivots: [],
	};
	const props = {
		frames: [...frames, otherFrame],
		contracts: [contract],
		onSave,
		disabled: false,
	};
	const view = render(<GameplayMetadataForm {...props} />);
	await user.type(screen.getByLabelText("Usage context"), "walk east");
	view.rerender(
		<GameplayMetadataForm {...props} frames={[otherFrame, ...frames]} />
	);
	await user.click(
		screen.getByRole("button", { name: "Save Gameplay Metadata" })
	);
	expect(onSave).toHaveBeenCalledWith(
		expect.objectContaining({ assetVersionId: "version-1", frameKey: "walk-0" })
	);
});

test("submits the user's pivot with an exact frame and use context", async () => {
	const user = userEvent.setup();
	const onSave = vi.fn().mockResolvedValue(true);
	render(
		<GameplayMetadataForm
			contracts={[contract]}
			disabled={false}
			frames={frames}
			onSave={onSave}
		/>
	);
	await user.type(screen.getByLabelText("Usage context"), "walk east");
	await user.click(screen.getByLabelText("Pivot (JSON)"));
	await user.paste('{"x":12,"y":24}');
	await user.click(
		screen.getByRole("button", { name: "Save Gameplay Metadata" })
	);
	expect(onSave).toHaveBeenCalledWith(
		expect.objectContaining({
			assetVersionId: "version-1",
			frameKey: "walk-0",
			useContext: "walk east",
			fields: expect.arrayContaining([
				{
					fieldId: "pivot",
					source: { kind: "authored", value: { x: 12, y: 24 } },
				},
				{ fieldId: "collision_areas", source: null },
			]),
		})
	);
});

test("keeps malformed JSON out of the saved metadata", async () => {
	const user = userEvent.setup();
	const onSave = vi.fn();
	render(
		<GameplayMetadataForm
			contracts={[contract]}
			disabled={false}
			frames={frames}
			onSave={onSave}
		/>
	);
	await user.type(screen.getByLabelText("Usage context"), "walk east");
	await user.click(screen.getByLabelText("Pivot (JSON)"));
	await user.paste("{invalid");
	await user.click(
		screen.getByRole("button", { name: "Save Gameplay Metadata" })
	);
	expect(onSave).not.toHaveBeenCalled();
	expect(screen.getByRole("alert")).toHaveTextContent("valid JSON");
});

test("keeps the finalized source selection when the source catalog is reordered", async () => {
	const user = userEvent.setup();
	const onSave = vi.fn().mockResolvedValue(true);
	const pivot = {
		kind: "finalized_source" as const,
		proposalId: "373ae13d-de81-4aee-91f5-05d4bb5e3b19",
		sourceEntryId: "917ad7ee-86d4-49cd-8a3d-bcf2418c4680",
		sourcePath: "$.frames[0].pivot",
		value: { x: 3, y: 17 },
	};
	const view = render(
		<GameplayMetadataForm
			contracts={[contract]}
			disabled={false}
			frames={[{ ...frames[0], sourcePivots: [pivot] }]}
			onSave={onSave}
		/>
	);
	await user.type(screen.getByLabelText("Usage context"), "walk east");
	await user.selectOptions(
		screen.getByLabelText("Pivot source"),
		screen.getByRole("option", {
			name: 'Confirmed source: {"x":3,"y":17}',
		})
	);
	view.rerender(
		<GameplayMetadataForm
			contracts={[contract]}
			disabled={false}
			frames={[
				{
					...frames[0],
					sourcePivots: [
						{
							...pivot,
							sourcePath: "$.frames[1].pivot",
							value: { x: 30, y: 40 },
						},
						pivot,
					],
				},
			]}
			onSave={onSave}
		/>
	);
	expect(screen.getByLabelText("Pivot (JSON)")).toBeDisabled();
	await user.click(
		screen.getByRole("button", { name: "Save Gameplay Metadata" })
	);
	expect(onSave).toHaveBeenCalledWith(
		expect.objectContaining({
			fields: expect.arrayContaining([
				{
					fieldId: "pivot",
					source: {
						kind: "finalized_source",
						proposalId: pivot.proposalId,
						sourceEntryId: pivot.sourceEntryId,
						sourcePath: pivot.sourcePath,
					},
				},
			]),
		})
	);
});

test("requires a frame, active profile and non-blank use context before saving", async () => {
	const user = userEvent.setup();
	const onSave = vi.fn().mockResolvedValue(true);
	render(
		<GameplayMetadataForm
			contracts={[contract]}
			disabled={false}
			frames={frames}
			onSave={onSave}
		/>
	);
	await user.type(screen.getByLabelText("Usage context"), "   ");
	await user.click(
		screen.getByRole("button", { name: "Save Gameplay Metadata" })
	);
	expect(onSave).not.toHaveBeenCalled();
	expect(screen.getByRole("alert")).toHaveTextContent(
		"Select a frame, active profile, and usage context."
	);
	await user.type(screen.getByLabelText("Usage context"), "walk east  ");
	expect(screen.getByRole("alert")).toHaveTextContent(
		"Select a frame, active profile, and usage context."
	);
	await user.click(
		screen.getByRole("button", { name: "Save Gameplay Metadata" })
	);
	expect(onSave).toHaveBeenCalledWith(
		expect.objectContaining({ useContext: "walk east" })
	);
	expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

test("disables saving until a frame and profile are chosen", async () => {
	const user = userEvent.setup();
	render(
		<GameplayMetadataForm
			contracts={[contract]}
			disabled={false}
			frames={frames}
			onSave={vi.fn()}
		/>
	);
	const save = screen.getByRole("button", {
		name: "Save Gameplay Metadata",
	});
	expect(save).toBeEnabled();
	await user.selectOptions(
		screen.getByLabelText("Active specialized profile"),
		""
	);
	expect(save).toBeDisabled();
	expect(screen.queryByLabelText("Pivot (JSON)")).not.toBeInTheDocument();
});

test("names a required field left blank", async () => {
	const user = userEvent.setup();
	const onSave = vi.fn();
	const requiredPivot = {
		...contract,
		metadataFields: contract.metadataFields.map((field) =>
			field.id === "pivot" ? { ...field, required: true } : field
		),
	};
	render(
		<GameplayMetadataForm
			contracts={[requiredPivot]}
			disabled={false}
			frames={frames}
			onSave={onSave}
		/>
	);
	await user.type(screen.getByLabelText("Usage context"), "walk east");
	await user.click(
		screen.getByRole("button", { name: "Save Gameplay Metadata" })
	);
	expect(onSave).not.toHaveBeenCalled();
	expect(screen.getByRole("alert")).toHaveTextContent(
		"Dönüş noktası is required."
	);
	expect(screen.getByText(requiredPrefix)).toBeInTheDocument();
});

test("changing the frame clears drafted field values", async () => {
	const user = userEvent.setup();
	const onSave = vi.fn().mockResolvedValue(true);
	const otherFrame = {
		assetVersionId: "version-2",
		frameKey: "attack-0",
		sourcePivots: [],
	};
	render(
		<GameplayMetadataForm
			contracts={[contract]}
			disabled={false}
			frames={[...frames, otherFrame]}
			onSave={onSave}
		/>
	);
	await user.click(screen.getByLabelText("Pivot (JSON)"));
	await user.paste('{"x":1,"y":2}');
	await user.selectOptions(
		screen.getByLabelText("Frame and exact version"),
		screen.getByRole("option", { name: "attack-0 — version-2" })
	);
	expect(screen.getByLabelText("Pivot (JSON)")).toHaveValue("");
	await user.type(screen.getByLabelText("Usage context"), "attack");
	await user.click(
		screen.getByRole("button", { name: "Save Gameplay Metadata" })
	);
	expect(onSave).toHaveBeenCalledWith(
		expect.objectContaining({
			assetVersionId: "version-2",
			frameKey: "attack-0",
			fields: expect.arrayContaining([{ fieldId: "pivot", source: null }]),
		})
	);
});

test("reports a finalized source that disappeared from the catalog", async () => {
	const user = userEvent.setup();
	const onSave = vi.fn();
	const pivot = {
		kind: "finalized_source" as const,
		proposalId: "373ae13d-de81-4aee-91f5-05d4bb5e3b19",
		sourceEntryId: "917ad7ee-86d4-49cd-8a3d-bcf2418c4680",
		sourcePath: "$.frames[0].pivot",
		value: { x: 3, y: 17 },
	};
	const view = render(
		<GameplayMetadataForm
			contracts={[contract]}
			disabled={false}
			frames={[{ ...frames[0], sourcePivots: [pivot] }]}
			onSave={onSave}
		/>
	);
	await user.type(screen.getByLabelText("Usage context"), "walk east");
	await user.selectOptions(
		screen.getByLabelText("Pivot source"),
		screen.getByRole("option", {
			name: 'Confirmed source: {"x":3,"y":17}',
		})
	);
	view.rerender(
		<GameplayMetadataForm
			contracts={[contract]}
			disabled={false}
			frames={[
				{
					...frames[0],
					sourcePivots: [{ ...pivot, sourcePath: "$.frames[9].pivot" }],
				},
			]}
			onSave={onSave}
		/>
	);
	await user.click(
		screen.getByRole("button", { name: "Save Gameplay Metadata" })
	);
	expect(onSave).not.toHaveBeenCalled();
	expect(screen.getByRole("alert")).toHaveTextContent(
		"The selected source is no longer available. Select the pivot source again."
	);
});

test("shows a save failure and the fallback for a non-error failure", async () => {
	const user = userEvent.setup();
	const onSave = vi
		.fn()
		.mockRejectedValueOnce(new Error("Sunucu reddetti."))
		.mockRejectedValueOnce("offline");
	render(
		<GameplayMetadataForm
			contracts={[contract]}
			disabled={false}
			frames={frames}
			onSave={onSave}
		/>
	);
	await user.type(screen.getByLabelText("Usage context"), "walk east");
	const save = screen.getByRole("button", {
		name: "Save Gameplay Metadata",
	});
	await user.click(save);
	expect(await screen.findByRole("alert")).toHaveTextContent(
		"Sunucu reddetti."
	);
	await user.click(save);
	expect(await screen.findByRole("alert")).toHaveTextContent(
		"Could not save Gameplay Metadata."
	);
	expect(screen.getByLabelText("Usage context")).toHaveValue("walk east");
});

test("disables every control while the parent write is unavailable", () => {
	render(
		<GameplayMetadataForm
			contracts={[contract]}
			disabled
			frames={frames}
			onSave={vi.fn()}
		/>
	);
	expect(screen.getByLabelText("Usage context")).toBeDisabled();
	expect(screen.getByLabelText("Pivot (JSON)")).toBeDisabled();
	expect(
		screen.getByRole("button", { name: "Save Gameplay Metadata" })
	).toBeDisabled();
});

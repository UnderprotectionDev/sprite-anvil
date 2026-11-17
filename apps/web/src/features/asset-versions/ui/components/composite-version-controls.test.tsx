// @vitest-environment jsdom

import type {
	AssetVersion,
	CompositeVersion,
	UnitVersion,
} from "@sprite-anvil/api/asset-versions";
import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { CompositeVersionControls } from "./composite-version-controls";

vi.mock("@/utils/orpc", () => ({
	client: {
		measurementEvents: {
			recordCandidatePreviewBoundary: vi
				.fn()
				.mockResolvedValue({ accepted: true }),
		},
	},
}));

const assetRecordId = "record-knight";
const projectId = "project-knight";
const createdAt = "2026-09-27T12:00:00.000Z";

const assetVersions: AssetVersion[] = [
	{
		id: "asset-frame-v1",
		projectId,
		assetFamilyId: "family-knight",
		assetRecordId,
		versionNumber: 1,
		contentType: "image/png",
		contentLength: 128,
		contentDigest: "a".repeat(64),
		productionEvidence: {
			evidenceLevel: "unknown",
			managedSnapshots: [],
			manualImportEvidence: null,
			sourceKind: "unknown",
		},
		integrityVerified: true,
		previewUrl: `/api/projects/${projectId}/asset-versions/asset-frame-v1/preview`,
		reviewDisposition: "approved",
		reviewEvents: [],
		createdAt,
	},
	{
		id: "asset-frame-v2",
		projectId,
		assetFamilyId: "family-knight",
		assetRecordId,
		versionNumber: 2,
		contentType: "image/png",
		contentLength: 128,
		contentDigest: "b".repeat(64),
		productionEvidence: {
			evidenceLevel: "unknown",
			managedSnapshots: [],
			manualImportEvidence: null,
			sourceKind: "unknown",
		},
		integrityVerified: true,
		previewUrl: `/api/projects/${projectId}/asset-versions/asset-frame-v2/preview`,
		reviewDisposition: "approved",
		reviewEvents: [],
		createdAt,
	},
	{
		id: "asset-direction-north-v1",
		projectId,
		assetFamilyId: "family-knight",
		assetRecordId,
		versionNumber: 3,
		contentType: "image/png",
		contentLength: 128,
		contentDigest: "c".repeat(64),
		productionEvidence: {
			evidenceLevel: "unknown",
			managedSnapshots: [],
			manualImportEvidence: null,
			sourceKind: "unknown",
		},
		integrityVerified: true,
		previewUrl: `/api/projects/${projectId}/asset-versions/asset-direction-north-v1/preview`,
		reviewDisposition: "approved",
		reviewEvents: [],
		createdAt,
	},
];

const unitVersions: UnitVersion[] = [
	{
		id: "unit-frame-v1",
		projectId,
		assetRecordId,
		assetVersionId: "asset-frame-v1",
		sourceAssetVersionId: "asset-frame-v1",
		unitType: "frame",
		unitKey: "attack/frame-3",
		versionNumber: 1,
		createdAt,
	},
	{
		id: "unit-frame-v2",
		projectId,
		assetRecordId,
		assetVersionId: "asset-frame-v2",
		sourceAssetVersionId: "asset-frame-v1",
		unitType: "frame",
		unitKey: "attack/frame-3",
		versionNumber: 2,
		createdAt,
	},
	{
		id: "unit-direction-north-v1",
		projectId,
		assetRecordId,
		assetVersionId: "asset-direction-north-v1",
		sourceAssetVersionId: "asset-direction-north-v1",
		unitType: "direction",
		unitKey: "north",
		versionNumber: 1,
		createdAt,
	},
];

const compositeVersions: CompositeVersion[] = [
	{
		id: "composite-v1",
		projectId,
		assetRecordId,
		versionNumber: 1,
		reviewDisposition: "approved",
		reviewEvents: [
			{
				id: "review-composite-v1",
				compositeVersionId: "composite-v1",
				type: "approved",
				rationale: "The previous composition was accepted.",
				createdAt,
			},
		],
		compositionMemberships: [
			{
				id: "membership-frame-v1",
				projectId,
				assetRecordId,
				compositeVersionId: "composite-v1",
				unitVersionId: "unit-frame-v1",
				unitType: "frame",
				unitKey: "attack/frame-3",
				createdAt,
			},
			{
				id: "membership-direction-v1",
				projectId,
				assetRecordId,
				compositeVersionId: "composite-v1",
				unitVersionId: "unit-direction-north-v1",
				unitType: "direction",
				unitKey: "north",
				createdAt,
			},
		],
		createdAt,
	},
	{
		id: "composite-v2",
		projectId,
		assetRecordId,
		versionNumber: 2,
		reviewDisposition: "candidate",
		reviewEvents: [
			{
				id: "review-composite-v2",
				compositeVersionId: "composite-v2",
				type: "candidate",
				rationale: null,
				createdAt,
			},
		],
		compositionMemberships: [
			{
				id: "membership-frame-v2",
				projectId,
				assetRecordId,
				compositeVersionId: "composite-v2",
				unitVersionId: "unit-frame-v2",
				unitType: "frame",
				unitKey: "attack/frame-3",
				createdAt,
			},
			{
				id: "membership-direction-v2",
				projectId,
				assetRecordId,
				compositeVersionId: "composite-v2",
				unitVersionId: "unit-direction-north-v1",
				unitType: "direction",
				unitKey: "north",
				createdAt,
			},
		],
		createdAt,
	},
];

afterEach(cleanup);

test("builds from one Composite Version, replaces one exact Unit Version, and reviews the composition separately", async () => {
	const user = userEvent.setup();
	const createCompositeVersion = vi.fn().mockResolvedValue(true);
	const reviewCompositeVersion = vi.fn().mockResolvedValue(true);
	const writes = {
		createCompositeVersion,
		reviewCompositeVersion,
		writesDisabled: false,
	} as never;

	render(
		<CompositeVersionControls
			assetRecordId={assetRecordId}
			assetRecordName="Ash Knight attack"
			assetVersions={assetVersions}
			compositeVersions={compositeVersions}
			unitVersions={unitVersions}
			writes={writes}
		/>
	);

	const sourceSelect = screen.getByLabelText("Starting Composite Version");
	await user.selectOptions(sourceSelect, "composite-v1");
	const frameSelect = screen.getByLabelText("Frame · attack/frame-3");
	const directionSelect = screen.getByLabelText("Direction · north");
	expect((frameSelect as HTMLSelectElement).value).toBe("unit-frame-v1");
	expect((directionSelect as HTMLSelectElement).value).toBe(
		"unit-direction-north-v1"
	);

	await user.selectOptions(frameSelect, "unit-frame-v2");
	await user.click(
		screen.getByRole("button", { name: "Save new Composite Version" })
	);

	expect(createCompositeVersion).toHaveBeenCalledWith(assetRecordId, [
		"unit-frame-v2",
		"unit-direction-north-v1",
	]);
	expect(
		screen.getByRole("heading", { name: "Composite Version 1 · Approved" })
	).toBeTruthy();
	expect(
		screen.getByRole("heading", { name: "Composite Version 2 · Candidate" })
	).toBeTruthy();
	expect(
		screen.getAllByText("Frame · attack/frame-3 · Unit Version 2")
	).toHaveLength(1);
	expect(
		screen.getAllByText("Direction · north · Unit Version 1")
	).toHaveLength(2);

	await user.type(
		screen.getByLabelText("Composite Version 2 review rationale"),
		"The corrected frame works with the retained direction."
	);
	await user.click(screen.getByRole("button", { name: "Approve" }));
	expect(reviewCompositeVersion).toHaveBeenCalledWith(
		"composite-v2",
		"approved",
		"The corrected frame works with the retained direction."
	);
});

test("keeps the selection after a failed save and clears it after a successful save", async () => {
	const user = userEvent.setup();
	const createCompositeVersion = vi
		.fn()
		.mockResolvedValueOnce(false)
		.mockResolvedValueOnce(true);
	render(
		<CompositeVersionControls
			assetRecordId={assetRecordId}
			assetRecordName="Ash Knight attack"
			assetVersions={assetVersions}
			compositeVersions={compositeVersions}
			unitVersions={unitVersions}
			writes={
				{
					createCompositeVersion,
					reviewCompositeVersion: vi.fn(),
					writesDisabled: false,
				} as never
			}
		/>
	);
	const save = screen.getByRole("button", {
		name: "Save new Composite Version",
	});
	const sourceSelect = screen.getByLabelText("Starting Composite Version");
	const frameSelect = screen.getByLabelText("Frame · attack/frame-3");
	const directionSelect = screen.getByLabelText("Direction · north");
	expect(save).toBeDisabled();

	await user.selectOptions(directionSelect, "unit-direction-north-v1");
	expect(save).toBeEnabled();
	await user.selectOptions(sourceSelect, "composite-v2");
	expect(frameSelect).toHaveValue("unit-frame-v2");
	expect(
		screen.getByText("Composite Version 2 memberships selected.")
	).toBeInTheDocument();
	await user.selectOptions(directionSelect, "");

	await user.click(save);
	expect(createCompositeVersion).toHaveBeenLastCalledWith(assetRecordId, [
		"unit-frame-v2",
	]);
	expect(sourceSelect).toHaveValue("composite-v2");
	expect(frameSelect).toHaveValue("unit-frame-v2");

	await user.click(save);
	expect(createCompositeVersion).toHaveBeenCalledTimes(2);
	expect(sourceSelect).toHaveValue("");
	expect(frameSelect).toHaveValue("");
	expect(save).toBeDisabled();
});

test("disables the composite controls while writes are disabled", () => {
	render(
		<CompositeVersionControls
			assetRecordId={assetRecordId}
			assetRecordName="Ash Knight attack"
			assetVersions={assetVersions}
			compositeVersions={compositeVersions}
			unitVersions={unitVersions}
			writes={
				{
					createCompositeVersion: vi.fn(),
					reviewCompositeVersion: vi.fn(),
					writesDisabled: true,
				} as never
			}
		/>
	);
	expect(screen.getByLabelText("Starting Composite Version")).toBeDisabled();
	expect(screen.getByLabelText("Frame · attack/frame-3")).toBeDisabled();
	expect(
		screen.getByLabelText("Composite Version 2 review rationale")
	).toBeDisabled();
	expect(
		screen.getByRole("group", {
			name: "Unit Versions for the new Composite Version",
		})
	).toBeInTheDocument();
});

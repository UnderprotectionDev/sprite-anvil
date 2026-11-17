// @vitest-environment jsdom

import type {
	AssetVersion,
	UnitVersion,
} from "@sprite-anvil/api/asset-versions";
import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import {
	UnitVersionCorrectionForm,
	UnitVersionHistory,
} from "./unit-version-correction-form";

const assetRecordId = "record-knight";

const assetVersions: AssetVersion[] = [
	{
		id: "version-source",
		projectId: "project-knight",
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
		previewUrl:
			"/api/projects/project-knight/asset-versions/version-source/preview",
		reviewDisposition: "approved",
		reviewEvents: [],
		createdAt: "2026-09-27T12:00:00.000Z",
	},
	{
		id: "version-frame-1",
		projectId: "project-knight",
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
		previewUrl:
			"/api/projects/project-knight/asset-versions/version-frame-1/preview",
		reviewDisposition: "candidate",
		reviewEvents: [],
		createdAt: "2026-09-27T12:01:00.000Z",
	},
	{
		id: "version-unrelated-tile",
		projectId: "project-knight",
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
		previewUrl:
			"/api/projects/project-knight/asset-versions/version-unrelated-tile/preview",
		reviewDisposition: "candidate",
		reviewEvents: [],
		createdAt: "2026-09-27T12:02:00.000Z",
	},
];

const unitVersions: UnitVersion[] = [
	{
		id: "unit-frame-1",
		projectId: "project-knight",
		assetRecordId,
		assetVersionId: "version-frame-1",
		sourceAssetVersionId: "version-source",
		unitType: "frame",
		unitKey: "attack/frame-3",
		versionNumber: 1,
		createdAt: "2026-09-27T12:01:00.000Z",
	},
	{
		id: "unit-unrelated-tile",
		projectId: "project-knight",
		assetRecordId,
		assetVersionId: "version-unrelated-tile",
		sourceAssetVersionId: "version-source",
		unitType: "tile",
		unitKey: "grass/inner-corner",
		versionNumber: 1,
		createdAt: "2026-09-27T12:02:00.000Z",
	},
];

afterEach(cleanup);

test("uploads one corrected unit from an exact source while retaining the previous and unrelated Unit Versions", async () => {
	const user = userEvent.setup();
	const upload = vi.fn().mockResolvedValue(true);
	const writes = { upload, writesDisabled: false } as never;
	const correctedFile = new File([new Uint8Array([1, 2, 3])], "frame.png", {
		type: "image/png",
	});

	render(
		<>
			<UnitVersionHistory
				assetVersions={assetVersions}
				unitVersions={unitVersions}
			/>
			<UnitVersionCorrectionForm
				assetRecordId={assetRecordId}
				assetVersions={assetVersions}
				unitVersions={unitVersions}
				writes={writes}
			/>
		</>
	);

	await user.type(screen.getByLabelText("Unit name"), "attack/frame-3");
	const sourceSelect = screen.getByLabelText("Source Asset Version");
	expect(
		screen.queryByRole("option", { name: "Version 3 · Candidate" })
	).toBeNull();
	await user.selectOptions(sourceSelect, "version-frame-1");
	const fileInput = screen.getByLabelText("Corrected PNG or WebP");
	await user.upload(fileInput, correctedFile);
	expect((sourceSelect as HTMLSelectElement).value).toBe("version-frame-1");
	expect((fileInput as HTMLInputElement).files).toHaveLength(1);
	const submit = screen.getByRole("button", {
		name: "Save unit correction",
	});
	expect((submit as HTMLButtonElement).disabled).toBe(false);
	await user.click(submit);

	expect(upload).toHaveBeenCalledWith(assetRecordId, correctedFile, {
		unitCorrection: {
			sourceAssetVersionId: "version-frame-1",
			unitType: "frame",
			unitKey: "attack/frame-3",
		},
	});
	expect(
		screen.getByText("Frame · attack/frame-3 · Unit Version 1")
	).toBeTruthy();
	expect(
		screen.getByText("Karo · grass/inner-corner · Unit Version 1")
	).toBeTruthy();
});

test("keeps the save disabled until a unit name, source, and file are present, and clears the file only after a successful upload", async () => {
	const user = userEvent.setup();
	const upload = vi
		.fn()
		.mockResolvedValueOnce(false)
		.mockResolvedValueOnce(true);
	const writes = { upload, writesDisabled: false } as never;
	const correctedFile = new File([new Uint8Array([1])], "tile.png", {
		type: "image/png",
	});
	render(
		<UnitVersionCorrectionForm
			assetRecordId={assetRecordId}
			assetVersions={assetVersions}
			unitVersions={unitVersions}
			writes={writes}
		/>
	);
	const submit = screen.getByRole("button", {
		name: "Save unit correction",
	});
	const typeSelect = screen.getByLabelText("Unit type");
	const sourceSelect = screen.getByLabelText("Source Asset Version");
	expect(typeSelect).toHaveValue("frame");
	expect(submit).toBeDisabled();

	await user.type(screen.getByLabelText("Unit name"), "   ");
	await user.selectOptions(sourceSelect, "version-source");
	await user.upload(
		screen.getByLabelText("Corrected PNG or WebP"),
		correctedFile
	);
	expect(submit).toBeDisabled();

	await user.clear(screen.getByLabelText("Unit name"));
	await user.type(screen.getByLabelText("Unit name"), " grass/inner-corner ");
	expect(
		screen.queryByRole("option", { name: "Version 3 · Candidate" })
	).toBeNull();
	await user.selectOptions(typeSelect, "tile");
	expect(
		screen.getByRole("option", { name: "Version 3 · Candidate" })
	).toBeInTheDocument();
	expect(
		screen.queryByRole("option", { name: "Version 2 · Candidate" })
	).toBeNull();
	expect(sourceSelect).toHaveValue("version-source");
	expect(submit).toBeEnabled();

	await user.click(submit);
	expect(upload).toHaveBeenLastCalledWith(assetRecordId, correctedFile, {
		unitCorrection: {
			sourceAssetVersionId: "version-source",
			unitType: "tile",
			unitKey: "grass/inner-corner",
		},
	});
	expect(submit).toBeEnabled();

	await user.click(submit);
	expect(upload).toHaveBeenCalledTimes(2);
	expect(submit).toBeDisabled();
	expect(screen.getByLabelText("Unit name")).toHaveValue(
		" grass/inner-corner "
	);
	expect(sourceSelect).toHaveValue("version-source");
});

test("drops a selected source that no longer matches the unit and disables writes", async () => {
	const user = userEvent.setup();
	const { rerender } = render(
		<UnitVersionCorrectionForm
			assetRecordId={assetRecordId}
			assetVersions={assetVersions}
			unitVersions={unitVersions}
			writes={{ upload: vi.fn(), writesDisabled: false } as never}
		/>
	);
	await user.type(screen.getByLabelText("Unit name"), "attack/frame-3");
	await user.selectOptions(
		screen.getByLabelText("Source Asset Version"),
		"version-frame-1"
	);
	await user.selectOptions(screen.getByLabelText("Unit type"), "direction");
	expect(screen.getByLabelText("Source Asset Version")).toHaveValue("");

	rerender(
		<UnitVersionCorrectionForm
			assetRecordId={assetRecordId}
			assetVersions={assetVersions}
			unitVersions={unitVersions}
			writes={{ upload: vi.fn(), writesDisabled: true } as never}
		/>
	);
	for (const label of [
		"Unit type",
		"Unit name",
		"Source Asset Version",
		"Corrected PNG or WebP",
	]) {
		expect(screen.getByLabelText(label)).toBeDisabled();
	}
	expect(
		screen.getByRole("button", { name: "Save unit correction" })
	).toBeDisabled();
});

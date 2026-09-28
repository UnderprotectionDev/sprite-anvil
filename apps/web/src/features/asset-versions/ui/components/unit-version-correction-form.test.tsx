// @vitest-environment jsdom

import type {
	AssetVersion,
	UnitVersion,
} from "@sprite-anvil/api/asset-versions";
import { cleanup, render, screen } from "@testing-library/react";
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

	await user.type(screen.getByLabelText("Birim adı"), "attack/frame-3");
	const sourceSelect = screen.getByLabelText("Kaynak Varlık Sürümü");
	expect(screen.queryByRole("option", { name: "Sürüm 3 · Aday" })).toBeNull();
	await user.selectOptions(sourceSelect, "version-frame-1");
	const fileInput = screen.getByLabelText("Düzeltilmiş PNG veya WebP");
	await user.upload(fileInput, correctedFile);
	expect((sourceSelect as HTMLSelectElement).value).toBe("version-frame-1");
	expect((fileInput as HTMLInputElement).files).toHaveLength(1);
	const submit = screen.getByRole("button", {
		name: "Birim düzeltmesini kaydet",
	});
	expect((submit as HTMLButtonElement).disabled).toBe(false);
	await user.click(submit);

	expect(upload).toHaveBeenCalledWith(assetRecordId, correctedFile, {
		sourceAssetVersionId: "version-frame-1",
		unitType: "frame",
		unitKey: "attack/frame-3",
	});
	expect(
		screen.getByText("Kare · attack/frame-3 · Birim Sürümü 1")
	).toBeTruthy();
	expect(
		screen.getByText("Karo · grass/inner-corner · Birim Sürümü 1")
	).toBeTruthy();
});

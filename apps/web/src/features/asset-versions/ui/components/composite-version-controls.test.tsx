// @vitest-environment jsdom

import type {
	AssetVersion,
	CompositeVersion,
	UnitVersion,
} from "@sprite-anvil/api/asset-versions";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { CompositeVersionControls } from "./composite-version-controls";

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

	const sourceSelect = screen.getByLabelText("Başlangıç Birleşik Sürümü");
	await user.selectOptions(sourceSelect, "composite-v1");
	const frameSelect = screen.getByLabelText("Kare · attack/frame-3");
	const directionSelect = screen.getByLabelText("Yön · north");
	expect((frameSelect as HTMLSelectElement).value).toBe("unit-frame-v1");
	expect((directionSelect as HTMLSelectElement).value).toBe(
		"unit-direction-north-v1"
	);

	await user.selectOptions(frameSelect, "unit-frame-v2");
	await user.click(
		screen.getByRole("button", { name: "Yeni Birleşik Sürüm kaydet" })
	);

	expect(createCompositeVersion).toHaveBeenCalledWith(assetRecordId, [
		"unit-frame-v2",
		"unit-direction-north-v1",
	]);
	expect(
		screen.getByRole("heading", { name: "Birleşik Sürüm 1 · Onaylandı" })
	).toBeTruthy();
	expect(
		screen.getByRole("heading", { name: "Birleşik Sürüm 2 · Aday" })
	).toBeTruthy();
	expect(
		screen.getAllByText("Kare · attack/frame-3 · Birim Sürümü 2")
	).toHaveLength(1);
	expect(screen.getAllByText("Yön · north · Birim Sürümü 1")).toHaveLength(2);

	await user.type(
		screen.getByLabelText("Birleşik Sürüm 2 inceleme gerekçesi"),
		"The corrected frame works with the retained direction."
	);
	await user.click(screen.getByRole("button", { name: "Onayla" }));
	expect(reviewCompositeVersion).toHaveBeenCalledWith(
		"composite-v2",
		"approved",
		"The corrected frame works with the retained direction."
	);
});

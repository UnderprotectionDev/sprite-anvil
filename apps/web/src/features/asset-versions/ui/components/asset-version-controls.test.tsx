// @vitest-environment jsdom

import type { AssetFamilyCatalog } from "@sprite-anvil/api/asset-families";
import type { AssetVersionCatalog } from "@sprite-anvil/api/asset-versions";
import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { AssetVersionControls } from "./asset-version-controls";

afterEach(cleanup);

const assetRecordId = "asset-record-id";
const assetVersionId = "provider-version-id";
const projectId = "project-id";

const catalog: AssetFamilyCatalog = {
	assetFamilies: [
		{
			createdAt: "2026-09-28T08:00:00.000Z",
			id: "asset-family-id",
			name: "Knight",
			projectId,
			subjectIdentityId: "subject-id",
			useContext: "game sprite",
			visualWorldId: "visual-world-id",
		},
	],
	assetRecords: [
		{
			assetFamilyId: "asset-family-id",
			createdAt: "2026-09-28T08:00:00.000Z",
			id: assetRecordId,
			name: "Idle pose",
			projectId,
		},
	],
	relationships: [],
	subjectIdentities: [],
};

const assetVersionCatalog: AssetVersionCatalog = {
	assetVersions: [
		{
			assetFamilyId: "asset-family-id",
			assetRecordId,
			contentDigest: "a".repeat(64),
			contentLength: 128,
			contentType: "image/png",
			createdAt: "2026-09-28T08:00:00.000Z",
			id: assetVersionId,
			integrityVerified: true,
			previewUrl: `/api/projects/${projectId}/asset-versions/${assetVersionId}/preview`,
			productionSource: "user_reported_provider",
			providerGenerationRecord: null,
			projectId,
			reviewDisposition: "candidate",
			reviewEvents: [],
			versionNumber: 1,
		},
	],
	canonicalDesigns: [],
	compositeVersions: [],
	unitVersions: [],
};

test("renders the provider record form for provider results and submits it from the version", async () => {
	const user = userEvent.setup();
	const recordProviderGeneration = vi.fn().mockResolvedValue(true);
	const writes = { recordProviderGeneration } as never;
	render(
		<AssetVersionControls
			assetVersionCatalog={assetVersionCatalog}
			catalog={catalog}
			writes={writes}
		/>
	);

	expect(screen.getByRole("status")).toHaveTextContent(
		"Sağlayıcı ekranında görülen ayrıntıları kullanıcı bildirimli olarak"
	);
	const approvalButton = screen.getByRole("button", { name: "Onayla" });
	expect(approvalButton).toBeDisabled();
	await user.type(
		screen.getByLabelText("İnceleme gerekçesi"),
		"Görüntü manuel olarak incelendi."
	);
	expect(approvalButton).toBeEnabled();
	await user.type(screen.getByLabelText("Sağlayıcı"), "Example Provider");
	await user.click(
		screen.getByRole("button", { name: "Sağlayıcı üretim kaydını kaydet" })
	);

	expect(recordProviderGeneration).toHaveBeenCalledWith(assetVersionId, {
		actualDimensions: null,
		interface: null,
		model: null,
		modelVersion: null,
		palette: [],
		provider: "Example Provider",
		providerParameters: {},
		referenceIds: [],
		requestedDimensions: null,
		seed: null,
	});
});

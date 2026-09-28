// @vitest-environment jsdom

import type { AssetFamilyCatalog } from "@sprite-anvil/api/asset-families";
import type { AssetVersionCatalog } from "@sprite-anvil/api/asset-versions";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, expect, test, vi } from "vitest";
import type { useAssetVersionWrites } from "../hooks/use-asset-version-writes";
import { AssetVersionControls } from "./asset-version-controls";

vi.mock("./composite-version-controls", () => ({
	CompositeVersionControls: () => null,
}));

vi.mock("@tanstack/react-router", () => ({
	Link: ({ children }: { children: ReactNode }) => (
		<a href="/projects">{children}</a>
	),
}));

vi.mock("./unit-version-correction-form", () => ({
	UnitVersionCorrectionForm: () => null,
	UnitVersionHistory: () => null,
}));

vi.mock(
	"@/features/production-provenance/ui/components/version-production-evidence-panel",
	() => ({ VersionProductionEvidencePanel: () => null })
);

afterEach(cleanup);

const projectId = "project-ash-knight";
const assetFamilyId = "family-ash-knight";
const assetRecordId = "record-ash-knight";
const createdAt = "2026-09-28T12:00:00.000Z";

const catalog = {
	assetFamilies: [
		{
			createdAt,
			id: assetFamilyId,
			name: "Ash Knight",
			projectId,
			subjectIdentityId: "identity-ash-knight",
			useContext: "Gameplay sprite",
			visualWorldId: "visual-world-pixel-art",
		},
	],
	assetRecords: [
		{
			assetFamilyId,
			createdAt,
			id: assetRecordId,
			name: "Ash Knight idle",
			projectId,
		},
	],
	relationships: [],
	subjectIdentities: [
		{
			createdAt,
			id: "identity-ash-knight",
			name: "Ash Knight",
			projectId,
		},
	],
} satisfies AssetFamilyCatalog;

const assetVersionCatalog = {
	assetVersions: [],
	canonicalDesigns: [],
	compositeVersions: [],
	unitVersions: [],
} satisfies AssetVersionCatalog;

test("paired web import writes an external edit Candidate Version with its Managed Snapshot", async () => {
	const user = userEvent.setup();
	const writes = {
		activeAction: null,
		checkWriteOutcome: vi.fn(),
		createCompositeVersion: vi.fn(),
		isCheckingOutcome: false,
		review: vi.fn(),
		reviewCompositeVersion: vi.fn(),
		refreshCatalogs: vi.fn(),
		selectCanonicalDesign: vi.fn(),
		statusMessage: null,
		upload: vi.fn().mockResolvedValue(true),
		writeOutcomeUncertain: false,
		writesDisabled: false,
	} satisfies ReturnType<typeof useAssetVersionWrites>;
	const candidateFile = new File(
		[new Uint8Array([5, 6, 7])],
		"ash-knight.webp",
		{ type: "image/webp" }
	);
	const sourceFile = new File(
		[new Uint8Array([1, 2, 3, 4])],
		"Ash Knight.aseprite",
		{ type: "application/octet-stream" }
	);
	render(
		<AssetVersionControls
			assetVersionCatalog={assetVersionCatalog}
			catalog={catalog}
			writes={writes}
		/>
	);

	fireEvent.change(screen.getByLabelText("PNG/WebP dışa aktarımı"), {
		target: { files: [candidateFile] },
	});
	fireEvent.change(screen.getByLabelText("Düzenlenebilir çalışma dosyası"), {
		target: { files: [sourceFile] },
	});
	await user.click(
		screen.getByRole("button", {
			name: "Aday Sürüm ve Yönetilen Kopyayı kaydet",
		})
	);

	expect(writes.upload).toHaveBeenCalledWith(
		assetRecordId,
		candidateFile,
		undefined,
		{
			managedSnapshot: sourceFile,
			sourceKind: "external_working_file_edit",
		}
	);
});

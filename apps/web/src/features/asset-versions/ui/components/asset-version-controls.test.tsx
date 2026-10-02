// @vitest-environment jsdom

import type { AssetFamilyCatalog } from "@sprite-anvil/api/asset-families";
import type { AssetVersionCatalog } from "@sprite-anvil/api/asset-versions";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, expect, test, vi } from "vitest";
import type { useAssetVersionWrites } from "../hooks/use-asset-version-writes";
import { AssetVersionControls } from "./asset-version-controls";

vi.mock("@/utils/orpc", () => ({
	client: { assetVersions: { previewBatchReview: vi.fn() } },
}));

vi.mock("./composite-version-controls", () => ({
	CompositeVersionControls: () => null,
}));

vi.mock("@tanstack/react-router", () => ({
	Link: ({
		children,
		params,
		to,
	}: {
		children: ReactNode;
		params?: Record<string, string>;
		to: string;
	}) => (
		<a data-params={JSON.stringify(params)} href={to}>
			{children}
		</a>
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
const assetVersionId = "provider-version-id";
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

const writes = (
	overrides: Partial<ReturnType<typeof useAssetVersionWrites>> = {}
) =>
	({
		activeAction: null,
		checkWriteOutcome: vi.fn(),
		createCompositeVersion: vi.fn().mockResolvedValue(true),
		isCheckingOutcome: false,
		recordProviderGeneration: vi.fn().mockResolvedValue(true),
		refreshCatalogs: vi.fn().mockResolvedValue({ isError: false }),
		review: vi.fn().mockResolvedValue(true),
		reviewBatch: vi.fn().mockResolvedValue(true),
		reviewCompositeVersion: vi.fn().mockResolvedValue(true),
		selectCanonicalDesign: vi.fn().mockResolvedValue(true),
		statusMessage: null,
		upload: vi.fn().mockResolvedValue(true),
		writeOutcomeUncertain: false,
		writesDisabled: false,
		...overrides,
	}) satisfies ReturnType<typeof useAssetVersionWrites>;

const emptyAssetVersionCatalog = {
	assetVersions: [],
	canonicalDesigns: [],
	compositeVersions: [],
	unitVersions: [],
} satisfies AssetVersionCatalog;

test("paired web import writes an external edit Candidate Version with its Managed Snapshot", async () => {
	const user = userEvent.setup();
	const versionWrites = writes();
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
			assetVersionCatalog={emptyAssetVersionCatalog}
			catalog={catalog}
			writes={versionWrites}
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

	expect(versionWrites.upload).toHaveBeenCalledWith(
		assetRecordId,
		candidateFile,
		{
			managedSnapshot: sourceFile,
			sourceKind: "external_working_file_edit",
		}
	);
});

test("renders and saves user-reported provider details without blocking approval", async () => {
	const user = userEvent.setup();
	const recordProviderGeneration = vi.fn().mockResolvedValue(true);
	const versionWrites = writes({ recordProviderGeneration });
	const assetVersionCatalog: AssetVersionCatalog = {
		assetVersions: [
			{
				assetFamilyId,
				assetRecordId,
				contentDigest: "a".repeat(64),
				contentLength: 128,
				contentType: "image/png",
				createdAt,
				id: assetVersionId,
				integrityVerified: true,
				previewUrl: `/api/projects/${projectId}/asset-versions/${assetVersionId}/preview`,
				productionEvidence: {
					evidenceLevel: "unknown",
					managedSnapshots: [],
					manualImportEvidence: null,
					sourceKind: "unknown",
				},
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

	render(
		<AssetVersionControls
			assetVersionCatalog={assetVersionCatalog}
			catalog={catalog}
			writes={versionWrites}
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

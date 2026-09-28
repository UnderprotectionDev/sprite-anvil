// @vitest-environment jsdom

import type {
	AssetVersionProductionSource,
	ProviderGenerationRecord,
} from "@sprite-anvil/api/provider-generation-records";
import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, expect, test } from "vitest";
import { ProviderGenerationRecordDetails } from "./provider-generation-record-details";

afterEach(cleanup);

const parameterSchemaVersionPattern = /provider-generation-parameters\/1\.0\.0/;

const record: ProviderGenerationRecord = {
	actualDimensions: { height: 96, width: 128 },
	assetRecordId: "b73b2ff3-cccb-4e3b-bd65-99484d9109ba",
	assetVersionId: "a7301990-3d79-49c8-887a-c1fa9a468f85",
	createdAt: "2026-09-28T08:00:00.000Z",
	id: "5436c215-0cb2-4d5f-a979-cbe8ec5f33f2",
	interface: "Images API v2",
	model: "pixel-art-v4",
	modelVersion: "2026-08-15",
	palette: ["#202030", "#f4c95d"],
	parameterSnapshot: {
		parameters: { steps: 28, sampler: "euler" },
		schemaVersion: "provider-generation-parameters/1.0.0",
	},
	projectId: "00c1bc3a-8c39-436a-892e-0c3a6d37aed2",
	provider: "Example Provider",
	referenceIds: ["reference-42"],
	requestedDimensions: { height: 96, width: 96 },
	seed: 7231,
};

test("shows reread provider facts and the versioned parameter snapshot", () => {
	render(
		<ProviderGenerationRecordDetails
			productionSource={
				"connected_provider" satisfies AssetVersionProductionSource
			}
			providerGenerationRecord={record}
		/>
	);

	expect(
		screen.getByRole("heading", { name: "Sağlayıcı Üretim Kaydı" })
	).toBeInTheDocument();
	expect(screen.getByText("Example Provider")).toBeInTheDocument();
	expect(screen.getByText("Images API v2")).toBeInTheDocument();
	expect(screen.getByText("pixel-art-v4")).toBeInTheDocument();
	expect(screen.getByText("2026-08-15")).toBeInTheDocument();
	expect(screen.getByText("96 × 96 px")).toBeInTheDocument();
	expect(screen.getByText("128 × 96 px")).toBeInTheDocument();
	expect(screen.getByText("reference-42")).toBeInTheDocument();
	expect(screen.getByText("#202030, #f4c95d")).toBeInTheDocument();
	expect(screen.getByText("7231")).toBeInTheDocument();
	expect(screen.getByText(parameterSchemaVersionPattern)).toBeInTheDocument();
	expect(
		screen.getByText(
			"Bu kayıt aynı görselin yeniden üretileceğini garanti etmez."
		)
	).toBeInTheDocument();
});

test("explains when a connected-provider result is waiting for its record", () => {
	render(
		<ProviderGenerationRecordDetails
			productionSource="connected_provider"
			providerGenerationRecord={null}
		/>
	);

	expect(screen.getByRole("status")).toHaveTextContent(
		"Sağlayıcı Üretim Kaydı bekleniyor"
	);
});

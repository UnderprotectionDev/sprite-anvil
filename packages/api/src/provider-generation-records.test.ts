import { expect, test } from "bun:test";
import { providerGenerationRecordCreateInputSchema } from "./provider-generation-records";

test("accepts normalized provider details and provider-specific parameters", () => {
	const input = {
		actualDimensions: { height: 96, width: 128 },
		assetVersionId: "a7301990-3d79-49c8-887a-c1fa9a468f85",
		interface: "Images API v2",
		model: "pixel-art-v4",
		modelVersion: "2026-08-15",
		palette: ["#202030", "#f4c95d"],
		projectId: "00c1bc3a-8c39-436a-892e-0c3a6d37aed2",
		provider: "Example Provider",
		providerParameters: {
			steps: 28,
			advanced: { guidanceScale: 6.5, sampler: "euler" },
		},
		referenceIds: ["reference-42"],
		requestedDimensions: { height: 96, width: 96 },
		seed: 7231,
	};

	expect(providerGenerationRecordCreateInputSchema.parse(input)).toEqual(input);
});

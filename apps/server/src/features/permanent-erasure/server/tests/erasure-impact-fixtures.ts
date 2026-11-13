import type { ErasureImpactSource } from "@sprite-anvil/api/permanent-erasure";

export const userId = "user-1";
export const projectId = "7a1f0f0e-8f4e-4c36-9a53-0b0b6a2f2a01";
export const assetRecordId = "11111111-1111-4111-8111-111111111101";
export const versionId = "22222222-2222-4222-8222-222222222201";
export const otherVersionId = "22222222-2222-4222-8222-222222222202";
export const bundleId = "33333333-3333-4333-8333-333333333301";
export const archiveId = "44444444-4444-4444-8444-444444444401";
export const fulfilmentId = "55555555-5555-4555-8555-555555555501";

/** YAS-04: one Asset Version held by an Export Bundle, a Project Archive and a Delivery Fulfilment. */
export function yas04Source(): ErasureImpactSource {
	return {
		archives: [
			{
				files: [
					{
						assetVersionId: versionId,
						kind: "asset_version",
						presence: "included",
						sourceId: versionId,
					},
					{
						assetVersionId: otherVersionId,
						kind: "asset_version",
						presence: "included",
						sourceId: otherVersionId,
					},
				],
				id: archiveId,
				manifestDigest: "a".repeat(64),
			},
		],
		assetRecord: { availability: "active", id: assetRecordId },
		bundles: [
			{
				files: [
					{ assetVersionId: versionId, path: "sprites/hero.png" },
					{ assetVersionId: null, path: "manifest.json" },
				],
				id: bundleId,
				manifestDigest: "b".repeat(64),
			},
		],
		fulfilments: [
			{
				deliveryTargetId: "target-1",
				id: fulfilmentId,
				requirements: [{ assetVersionIds: [versionId], bundleId }],
				revisionNumber: 2,
			},
		],
		versions: [
			{
				byteSize: 120,
				contentType: "image/png",
				fileName: "hero.png",
				id: versionId,
				sha256: "c".repeat(64),
			},
		],
	};
}

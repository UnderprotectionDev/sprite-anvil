import { ORPCError } from "@orpc/server";
import {
	type AnimationMetadataPackageTargetReader,
	createAnimationMetadataPackageTarget,
} from "@sprite-anvil/api/animation-metadata-package";

function frameIdentity(assetVersionId: string, frameKey: string) {
	return JSON.stringify([assetVersionId, frameKey]);
}

export const readAnimationMetadataPackageTarget: AnimationMetadataPackageTargetReader =
	async ({
		userId,
		input,
		assetRecordStore,
		assetVersionStore,
		gameplayMetadataStore,
	}) => {
		const record = await assetRecordStore.get(
			userId,
			input.projectId,
			input.assetRecordId
		);
		if (!record || record.availability === "erased") {
			throw new ORPCError("NOT_FOUND", { message: "Asset Record not found" });
		}
		if (record.assetCategory !== "character_creature_animation") {
			throw new ORPCError("BAD_REQUEST", {
				message:
					"Animasyon Metadata Paketi yalnız karakter, yaratık ve animasyon varlık kategorisinde kullanılabilir.",
			});
		}

		const catalog = await assetVersionStore.list(userId, input.projectId);
		if (!catalog) {
			throw new ORPCError("NOT_FOUND", { message: "Asset Record not found" });
		}
		const compositeVersion = catalog.compositeVersions.find(
			(candidate) =>
				candidate.id === input.compositeVersionId &&
				candidate.projectId === input.projectId &&
				candidate.assetRecordId === input.assetRecordId
		);
		if (!compositeVersion) {
			throw new ORPCError("NOT_FOUND", {
				message: "Composite Version not found",
			});
		}

		const unitVersionsById = new Map(
			catalog.unitVersions.map((unitVersion) => [unitVersion.id, unitVersion])
		);
		const unitVersions = compositeVersion.compositionMemberships.map(
			(membership) => {
				const unitVersion = unitVersionsById.get(membership.unitVersionId);
				if (
					membership.compositeVersionId !== compositeVersion.id ||
					membership.projectId !== input.projectId ||
					membership.assetRecordId !== input.assetRecordId ||
					!unitVersion ||
					unitVersion.projectId !== input.projectId ||
					unitVersion.assetRecordId !== input.assetRecordId ||
					unitVersion.unitType !== membership.unitType ||
					unitVersion.unitKey !== membership.unitKey
				) {
					throw new ORPCError("BAD_REQUEST", {
						message:
							"Bütünlük hatası: Composite Version üyeliğinin kesin Unit Version kaydı bulunamadı.",
					});
				}
				return unitVersion;
			}
		);
		if (!unitVersions.length) {
			throw new ORPCError("BAD_REQUEST", {
				message:
					"Bütünlük hatası: Composite Version içinde paketlenecek Unit Version bulunamadı.",
			});
		}

		const selectedAssetVersionIds = new Set(
			unitVersions.map((unitVersion) => unitVersion.assetVersionId)
		);
		const selectedAssetVersions = catalog.assetVersions.filter((version) =>
			selectedAssetVersionIds.has(version.id)
		);
		if (
			selectedAssetVersions.length !== selectedAssetVersionIds.size ||
			selectedAssetVersions.some(
				(version) =>
					version.projectId !== input.projectId ||
					version.assetRecordId !== input.assetRecordId
			)
		) {
			throw new ORPCError("BAD_REQUEST", {
				message:
					"Bütünlük hatası: Composite Version içindeki kesin Asset Version kaydı bulunamadı.",
			});
		}
		const assetVersionPins = selectedAssetVersions.map((version) => ({
			id: version.id,
			assetRecordId: version.assetRecordId,
			versionNumber: version.versionNumber,
			contentType: version.contentType,
			contentLength: version.contentLength,
			contentDigest: version.contentDigest,
			integrityVerified: version.integrityVerified,
		}));

		const metadataCatalog = await gameplayMetadataStore.list(
			userId,
			input.projectId,
			input.assetRecordId
		);
		if (!metadataCatalog) {
			throw new ORPCError("NOT_FOUND", {
				message: "Gameplay Metadata not found",
			});
		}
		const selectedFrameIdentities = new Set(
			unitVersions
				.filter((unitVersion) => unitVersion.unitType === "frame")
				.map((unitVersion) =>
					frameIdentity(unitVersion.assetVersionId, unitVersion.unitKey)
				)
		);
		const frames = metadataCatalog.frames.filter((frame) =>
			selectedFrameIdentities.has(
				frameIdentity(frame.assetVersionId, frame.frameKey)
			)
		);
		const records = metadataCatalog.records.filter((metadataRecord) =>
			selectedFrameIdentities.has(
				frameIdentity(metadataRecord.assetVersionId, metadataRecord.frameKey)
			)
		);

		const familyIds = new Set(
			selectedAssetVersions.map((version) => version.assetFamilyId)
		);
		if (familyIds.size !== 1) {
			throw new ORPCError("BAD_REQUEST", {
				message:
					"Bütünlük hatası: Composite Version, tek bir Asset Family içindeki sürümleri içermelidir.",
			});
		}

		return createAnimationMetadataPackageTarget({
			compositeVersion,
			unitVersions,
			assetVersionPins,
			frames,
			records,
		});
	};

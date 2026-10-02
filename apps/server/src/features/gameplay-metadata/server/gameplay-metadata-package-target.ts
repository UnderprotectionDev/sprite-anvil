import { ORPCError } from "@orpc/server";
import { getGameplayMetadataReviewSourceErrors } from "@sprite-anvil/api/gameplay-metadata-integrity";
import type { GameplayMetadataPackageTargetReader } from "@sprite-anvil/api/gameplay-metadata-package";

export const readGameplayMetadataPackageTarget: GameplayMetadataPackageTargetReader =
	async ({ userId, input, store }) => {
		const catalog = await store.list(
			userId,
			input.projectId,
			input.assetRecordId
		);
		if (!catalog) {
			throw new ORPCError("NOT_FOUND", { message: "Asset Record not found" });
		}
		const record = catalog.records.find(
			(candidate) => candidate.id === input.recordId
		);
		if (!record) {
			throw new ORPCError("NOT_FOUND", {
				message: "Gameplay Metadata record not found",
			});
		}
		if (
			record.projectId !== input.projectId ||
			record.assetRecordId !== input.assetRecordId
		) {
			throw new ORPCError("BAD_REQUEST", {
				message:
					"Bütünlük hatası: kayıt proje veya varlık bağlantısı korunamadı.",
			});
		}
		const errors = getGameplayMetadataReviewSourceErrors(
			record,
			catalog.records
		);
		if (errors.length) {
			throw new ORPCError("BAD_REQUEST", {
				message: `Bütünlük hatası: ${errors.join(" ")}`,
			});
		}
		return { record, frames: catalog.frames };
	};

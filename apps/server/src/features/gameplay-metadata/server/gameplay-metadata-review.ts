import { isDeepStrictEqual } from "node:util";
import { ORPCError } from "@orpc/server";
import {
	type GameplayMetadataReviewHandler,
	gameplayMetadataRecordSchema,
} from "@sprite-anvil/api/gameplay-metadata";
import {
	getGameplayMetadataIntegrityErrors,
	getGameplayMetadataReviewSourceErrors,
} from "@sprite-anvil/api/gameplay-metadata-integrity";

export const reviewGameplayMetadata: GameplayMetadataReviewHandler = async ({
	userId,
	input,
	store,
	contractStore,
}) => {
	const catalog = await store.list(
		userId,
		input.projectId,
		input.assetRecordId
	);
	if (!catalog) {
		throw new ORPCError("NOT_FOUND", { message: "Asset Record not found" });
	}
	const existing = catalog.records.find(
		(candidate) => candidate.id === input.id
	);
	if (existing) {
		if (
			existing.review?.sourceRecordId !== input.recordId ||
			existing.review.reviewedByUserId !== userId ||
			existing.projectId !== input.projectId ||
			existing.assetRecordId !== input.assetRecordId
		) {
			throw new ORPCError("CONFLICT", {
				message: "Gameplay Metadata review operation id was reused.",
			});
		}
		const errors = [
			...getGameplayMetadataIntegrityErrors(existing, catalog.frames),
			...getGameplayMetadataReviewSourceErrors(existing, catalog.records),
		];
		if (errors.length) {
			throw new ORPCError("BAD_REQUEST", {
				message: `Bütünlük hatası: ${errors.join(" ")}`,
			});
		}
		return existing;
	}
	const source = catalog.records.find(
		(candidate) => candidate.id === input.recordId
	);
	if (
		!source ||
		source.review ||
		source.projectId !== input.projectId ||
		source.assetRecordId !== input.assetRecordId
	) {
		throw new ORPCError("BAD_REQUEST", {
			message: "Select an authored Gameplay Metadata record to review.",
		});
	}
	const activation = source.contractSnapshot
		? null
		: await contractStore?.getActive(userId, input.projectId, source.profileId);
	const contract =
		source.contractSnapshot ??
		(activation?.contractRevisionId === source.contractRevisionId
			? activation.contract
			: undefined);
	const errors = getGameplayMetadataIntegrityErrors(
		source,
		catalog.frames,
		contract
	);
	if (errors.length) {
		throw new ORPCError("BAD_REQUEST", {
			message: `Bütünlük hatası: ${errors.join(" ")}`,
		});
	}
	const reviewedAt = new Date().toISOString();
	const record = gameplayMetadataRecordSchema.parse({
		...source,
		id: input.id,
		createdAt: reviewedAt,
		contractSnapshot: contract,
		review: { sourceRecordId: source.id, reviewedByUserId: userId, reviewedAt },
	});
	const saved = await store.append(userId, record);
	if (!saved) {
		throw new ORPCError("CONFLICT", {
			message: "Gameplay Metadata review target changed.",
		});
	}
	const reread = await store.list(userId, input.projectId, input.assetRecordId);
	const persisted = reread?.records.find(
		(candidate) => candidate.id === record.id
	);
	if (!(persisted && isDeepStrictEqual(record, persisted))) {
		throw new ORPCError("INTERNAL_SERVER_ERROR", {
			message:
				"Gameplay Metadata review could not be read back. Retry the same operation.",
		});
	}
	return persisted;
};

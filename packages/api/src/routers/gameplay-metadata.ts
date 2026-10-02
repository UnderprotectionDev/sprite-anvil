import { isDeepStrictEqual } from "node:util";
import { ORPCError } from "@orpc/server";
import type { Context } from "../context";
import {
	type GameplayMetadataRecord,
	type GameplayMetadataWriteInput,
	gameplayMetadataCatalogSchema,
	gameplayMetadataListInputSchema,
	gameplayMetadataRecordSchema,
	gameplayMetadataReviewInputSchema,
	gameplayMetadataWriteInputSchema,
	getGameplayMetadataFields,
} from "../gameplay-metadata";
import { isGameplayMetadataValueValid } from "../gameplay-metadata-integrity";
import {
	createGameplayMetadataPackage,
	type GameplayMetadataPackage,
	gameplayMetadataPackageInputSchema,
	gameplayMetadataPackageReadInputSchema,
	gameplayMetadataPackageSchema,
	readGameplayMetadataPackage,
} from "../gameplay-metadata-package";
import { protectedProcedure } from "../index";

async function readPackageTarget(
	context: Context,
	input: { projectId: string; assetRecordId: string; recordId: string }
) {
	if (!context.readGameplayMetadataPackageTarget) {
		throw new ORPCError("INTERNAL_SERVER_ERROR", {
			message: "Gameplay Metadata package service is unavailable.",
		});
	}
	return await context.readGameplayMetadataPackageTarget({
		userId: context.session?.user.id ?? "",
		input,
		store: getStore(context),
	});
}

function getStore(context: Context) {
	if (!context.gameplayMetadataStore) {
		throw new ORPCError("INTERNAL_SERVER_ERROR", {
			message: "Gameplay Metadata storage is unavailable.",
		});
	}
	return context.gameplayMetadataStore;
}

async function withGameplayMetadataPackageErrors(
	operation: () => Promise<GameplayMetadataPackage>
) {
	try {
		return await operation();
	} catch (failure) {
		throw new ORPCError("BAD_REQUEST", {
			cause: failure,
			message:
				failure instanceof Error
					? failure.message
					: "Gameplay Metadata package is invalid.",
		});
	}
}

/**
 * Compares a saved record with a resubmitted operation for idempotent replay.
 * The routing fields must match exactly, and every saved field needs a
 * submitted counterpart: authored or absent sources resolve to a value with
 * authored/unknown provenance, while finalized_source must match verbatim.
 */
function matchesSavedOperation(
	record: GameplayMetadataRecord,
	input: GameplayMetadataWriteInput
) {
	const {
		fields,
		createdAt: _createdAt,
		contractSnapshot: _snapshot,
		review,
		...target
	} = record;
	const { fields: submittedFields, ...submittedTarget } = input;
	if (
		review ||
		!isDeepStrictEqual(target, submittedTarget) ||
		new Set(submittedFields.map((field) => field.fieldId)).size !==
			submittedFields.length ||
		submittedFields.some(
			(field) => !fields.some((saved) => saved.fieldId === field.fieldId)
		)
	) {
		return false;
	}
	return fields.every((field) => {
		const source = submittedFields.find(
			(submitted) => submitted.fieldId === field.fieldId
		)?.source;
		if (source?.kind === "finalized_source") {
			return isDeepStrictEqual(source, field.source);
		}
		const value = source?.value ?? null;
		const provenance = { kind: value === null ? "unknown" : "authored" };
		return isDeepStrictEqual(
			{ value, source: provenance },
			{ value: field.value, source: field.source }
		);
	});
}

export const gameplayMetadataRouter = {
	createPackage: protectedProcedure
		.input(gameplayMetadataPackageInputSchema)
		.output(gameplayMetadataPackageSchema)
		.handler(async ({ context, input }) => {
			const { record, frames } = await readPackageTarget(context, input);
			return await withGameplayMetadataPackageErrors(() =>
				createGameplayMetadataPackage(record, frames)
			);
		}),
	readPackage: protectedProcedure
		.input(gameplayMetadataPackageReadInputSchema)
		.output(gameplayMetadataPackageSchema)
		.handler(async ({ context, input }) => {
			const { record, frames } = await readPackageTarget(context, input);
			return await withGameplayMetadataPackageErrors(() =>
				readGameplayMetadataPackage(input.package, record, frames)
			);
		}),
	review: protectedProcedure
		.input(gameplayMetadataReviewInputSchema)
		.output(gameplayMetadataRecordSchema)
		.handler(async ({ context, input }) => {
			if (!context.reviewGameplayMetadata) {
				throw new ORPCError("INTERNAL_SERVER_ERROR", {
					message: "Gameplay Metadata review service is unavailable.",
				});
			}
			return await context.reviewGameplayMetadata({
				userId: context.session.user.id,
				input,
				store: getStore(context),
				contractStore: context.specializedProfileContractStore,
			});
		}),
	list: protectedProcedure
		.input(gameplayMetadataListInputSchema)
		.output(gameplayMetadataCatalogSchema)
		.handler(async ({ context, input }) => {
			const catalog = await getStore(context).list(
				context.session.user.id,
				input.projectId,
				input.assetRecordId
			);
			if (!catalog) {
				throw new ORPCError("NOT_FOUND", { message: "Asset Record not found" });
			}
			return catalog;
		}),
	write: protectedProcedure
		.input(gameplayMetadataWriteInputSchema)
		.output(gameplayMetadataRecordSchema)
		.handler(async ({ context, input }) => {
			const store = getStore(context);
			const catalog = await store.list(
				context.session.user.id,
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
				if (!matchesSavedOperation(existing, input)) {
					throw new ORPCError("CONFLICT", {
						message:
							"Gameplay Metadata operation id was reused with different input.",
					});
				}
				return existing;
			}
			const frame = catalog.frames.find(
				(candidate) =>
					candidate.assetVersionId === input.assetVersionId &&
					candidate.frameKey === input.frameKey
			);
			if (!frame) {
				throw new ORPCError("BAD_REQUEST", {
					message:
						"Gameplay Metadata requires an existing exact frame and Asset Version.",
				});
			}
			const activation =
				await context.specializedProfileContractStore?.getActive(
					context.session.user.id,
					input.projectId,
					input.profileId
				);
			if (!activation) {
				throw new ORPCError("BAD_REQUEST", {
					message:
						"Activate a Specialized Profile Contract before authoring Gameplay Metadata.",
				});
			}
			if (activation.contractRevisionId !== input.contractRevisionId) {
				throw new ORPCError("CONFLICT", {
					message:
						"The selected Specialized Profile Contract revision changed. Reload and select the active contract.",
				});
			}
			const definitions = getGameplayMetadataFields(activation.contract);
			if (
				!definitions.length ||
				new Set(input.fields.map((field) => field.fieldId)).size !==
					input.fields.length ||
				input.fields.some(
					(field) =>
						!definitions.some((definition) => definition.id === field.fieldId)
				)
			) {
				throw new ORPCError("BAD_REQUEST", {
					message: "Duplicate or unsupported Gameplay Metadata field.",
				});
			}
			const fields = definitions.map((definition) => {
				const submitted = input.fields.find(
					(field) => field.fieldId === definition.id
				);
				const source = submitted?.source;
				let value = source?.kind === "authored" ? source.value : null;
				if (source?.kind === "finalized_source") {
					const pivot =
						definition.id === "pivot"
							? frame.sourcePivots.find(
									(candidate) =>
										candidate.proposalId === source.proposalId &&
										candidate.sourceEntryId === source.sourceEntryId &&
										candidate.sourcePath === source.sourcePath
								)
							: undefined;
					if (!pivot) {
						throw new ORPCError("BAD_REQUEST", {
							message:
								"Source metadata must be finalized for this exact frame and Asset Version.",
						});
					}
					({ value } = pivot);
				}
				if (!isGameplayMetadataValueValid(definition, value)) {
					throw new ORPCError("BAD_REQUEST", {
						message: `Invalid or missing Gameplay Metadata field: ${definition.id}.`,
					});
				}
				let provenance: { kind: "unknown" | "authored" } | typeof source = {
					kind: "authored",
				};
				if (value === null) {
					provenance = { kind: "unknown" };
				} else if (source?.kind === "finalized_source") {
					provenance = source;
				}
				return {
					fieldId: definition.id,
					value,
					unit: definition.unit,
					coordinateSystem: definition.coordinateSystem,
					source: provenance,
				};
			});
			const record = gameplayMetadataRecordSchema.parse({
				...input,
				fields,
				contractRevisionId: activation.contractRevisionId,
				createdAt: new Date().toISOString(),
				contractSnapshot: activation.contract,
			});
			const saved = await store.append(context.session.user.id, record);
			if (!saved) {
				throw new ORPCError("CONFLICT", {
					message:
						"Gameplay Metadata target changed or the operation id was reused.",
				});
			}
			const readback = await store.list(
				context.session.user.id,
				input.projectId,
				input.assetRecordId
			);
			const persisted = readback?.records.find(
				(candidate) => candidate.id === saved.id
			);
			if (!(persisted && isDeepStrictEqual(record, persisted))) {
				throw new ORPCError("INTERNAL_SERVER_ERROR", {
					message:
						"Gameplay Metadata integrity failed during readback. Check the saved records before retrying.",
				});
			}
			return persisted;
		}),
};

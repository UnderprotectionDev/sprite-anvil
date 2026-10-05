import { ORPCError } from "@orpc/server";
import {
	type AnimationMetadataPackage,
	animationMetadataPackageInputSchema,
	animationMetadataPackageReadInputSchema,
	animationMetadataPackageSchema,
	createAnimationMetadataPackage,
	readAnimationMetadataPackage,
} from "../animation-metadata-package";
import type { Context } from "../context";
import { protectedProcedure } from "../index";

async function readPackageTarget(
	context: Context,
	input: {
		projectId: string;
		assetRecordId: string;
		compositeVersionId: string;
	}
) {
	if (!context.readAnimationMetadataPackageTarget) {
		throw new ORPCError("INTERNAL_SERVER_ERROR", {
			message: "Animation Metadata Package service is unavailable.",
		});
	}
	if (!context.gameplayMetadataStore) {
		throw new ORPCError("INTERNAL_SERVER_ERROR", {
			message: "Animation Metadata Package metadata storage is unavailable.",
		});
	}
	return await context.readAnimationMetadataPackageTarget({
		userId: context.session?.user.id ?? "",
		input,
		assetRecordStore: context.assetRecordStore,
		assetVersionStore: context.assetVersionStore,
		gameplayMetadataStore: context.gameplayMetadataStore,
	});
}

async function withPackageErrors(
	operation: () => Promise<AnimationMetadataPackage>
) {
	try {
		return await operation();
	} catch (failure) {
		throw new ORPCError("BAD_REQUEST", {
			cause: failure,
			message:
				failure instanceof Error
					? failure.message
					: "Animation Metadata Package is invalid.",
		});
	}
}

export const animationMetadataPackageRouter = {
	createPackage: protectedProcedure
		.input(animationMetadataPackageInputSchema)
		.output(animationMetadataPackageSchema)
		.handler(async ({ context, input }) => {
			const target = await readPackageTarget(context, input);
			return await withPackageErrors(() =>
				createAnimationMetadataPackage(target)
			);
		}),
	readPackage: protectedProcedure
		.input(animationMetadataPackageReadInputSchema)
		.output(animationMetadataPackageSchema)
		.handler(async ({ context, input }) => {
			const target = await readPackageTarget(context, input);
			return await withPackageErrors(() =>
				readAnimationMetadataPackage(input.package, target)
			);
		}),
};

import { ORPCError } from "@orpc/server";
import { prepareGenerationPackage } from "../generation-package-preparation";
import {
	generationPackageCreateInputSchema,
	generationPackageListInputSchema,
	generationPackageSchema,
} from "../generation-packages";
import { protectedProcedure } from "../index";

export const generationPackagesRouter = {
	create: protectedProcedure
		.input(generationPackageCreateInputSchema)
		.output(generationPackageSchema)
		.handler(({ context, input }) =>
			prepareGenerationPackage(context, context.session.user.id, input)
		),
	list: protectedProcedure
		.input(generationPackageListInputSchema)
		.output(generationPackageSchema.array())
		.handler(async ({ context, input }) => {
			if (!context.generationPackageStore) {
				throw new ORPCError("INTERNAL_SERVER_ERROR", {
					message: "Generation Package storage is not configured.",
				});
			}
			const packages = await context.generationPackageStore.list(
				context.session.user.id,
				input.projectId,
				input.assetRecordId
			);
			if (!packages) {
				throw new ORPCError("NOT_FOUND", {
					message: "Varlık kaydı veya proje bulunamadı.",
				});
			}
			return packages.map((generationPackage) =>
				generationPackageSchema.parse(generationPackage)
			);
		}),
};

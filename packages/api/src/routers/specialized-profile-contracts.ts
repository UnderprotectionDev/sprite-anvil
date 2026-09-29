import { ORPCError } from "@orpc/server";
import type { Context } from "../context";
import { protectedProcedure } from "../index";
import {
	getSpecializedProfileContract,
	projectProfileContractActivationSchema,
	specializedProfileContractCatalog,
	specializedProfileContractInputSchema,
	specializedProfileContractSchema,
	specializedProfileContractsListInputSchema,
	specializedProfileContractsListOutputSchema,
} from "../specialized-profile-contracts";

function getStore(context: Context) {
	const store = context.specializedProfileContractStore;
	if (!store) {
		throw new ORPCError("INTERNAL_SERVER_ERROR", {
			message: "Specialized Profile Contract storage is unavailable.",
		});
	}
	return store;
}

export const specializedProfileContractsRouter = {
	list: protectedProcedure
		.input(specializedProfileContractsListInputSchema)
		.output(specializedProfileContractsListOutputSchema)
		.handler(async ({ context, input }) => {
			const store = getStore(context);
			const activations = await store.list(
				context.session.user.id,
				input.projectId
			);
			if (!activations) {
				throw new ORPCError("NOT_FOUND", { message: "Project not found" });
			}
			return specializedProfileContractsListOutputSchema.parse({
				profiles: specializedProfileContractCatalog.map((definition) => ({
					activeContract:
						activations.find(
							(activation) =>
								activation.contract.profileId === definition.profileId
						) ?? null,
					definition,
				})),
			});
		}),
	activate: protectedProcedure
		.input(specializedProfileContractInputSchema)
		.output(projectProfileContractActivationSchema)
		.handler(async ({ context, input }) => {
			const store = getStore(context);
			const contract = getSpecializedProfileContract(input.profileId);
			if (!contract) {
				throw new ORPCError("NOT_FOUND", {
					message: "Specialized Profile Contract not found",
				});
			}
			const canonicalContract =
				specializedProfileContractSchema.parse(contract);
			const activated = await store.activate(
				context.session.user.id,
				input.projectId,
				input.profileId,
				canonicalContract
			);
			if (!activated) {
				throw new ORPCError("NOT_FOUND", { message: "Project not found" });
			}
			const persistedActivation = await store.getActive(
				context.session.user.id,
				input.projectId,
				input.profileId
			);
			if (!persistedActivation) {
				throw new ORPCError("INTERNAL_SERVER_ERROR", {
					message:
						"The activated Specialized Profile Contract could not be read back.",
				});
			}
			return projectProfileContractActivationSchema.parse(persistedActivation);
		}),
	getActive: protectedProcedure
		.input(specializedProfileContractInputSchema)
		.output(projectProfileContractActivationSchema.nullable())
		.handler(async ({ context, input }) => {
			const store = getStore(context);
			const accessibleProject = await store.list(
				context.session.user.id,
				input.projectId
			);
			if (!accessibleProject) {
				throw new ORPCError("NOT_FOUND", { message: "Project not found" });
			}
			const activation = await store.getActive(
				context.session.user.id,
				input.projectId,
				input.profileId
			);
			return activation
				? projectProfileContractActivationSchema.parse(activation)
				: null;
		}),
};

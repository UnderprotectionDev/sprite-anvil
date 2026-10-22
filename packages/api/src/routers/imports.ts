import { ORPCError } from "@orpc/server";
import z from "zod";
import {
	importInboxEntriesSchema,
	importInboxListInputSchema,
} from "../import-inbox";
import { protectedProcedure } from "../index";
import {
	type SourceMetadataMappingProposal,
	type SourceMetadataMappingProposalStore,
	sourceMetadataMappingFinalizationReadInputSchema,
	sourceMetadataMappingFinalizationSchema,
	sourceMetadataMappingFinalizeRequestSchema,
	sourceMetadataMappingProposalCreateRequestSchema,
	sourceMetadataMappingProposalListInputSchema,
	sourceMetadataMappingProposalSchema,
	sourceMetadataMappingProposalsSchema,
} from "../source-metadata-mapping";

const identifierSchema = z.uuid();

function notFound() {
	return new ORPCError("NOT_FOUND", { message: "Not found" });
}

function unavailable(service: string) {
	return new ORPCError("INTERNAL_SERVER_ERROR", {
		message: `${service} is not configured.`,
	});
}

function parseIdentifier(value: string) {
	const result = identifierSchema.safeParse(value);
	if (!result.success) {
		throw notFound();
	}
	return result.data;
}

async function requireProject(
	context: {
		projectAccess: {
			getProject: (
				ownerId: string,
				projectId: string
			) => Promise<unknown | null>;
		};
	},
	userId: string,
	projectId: string
) {
	const parsed = identifierSchema.safeParse(projectId);
	if (
		!(
			parsed.success &&
			(await context.projectAccess.getProject(userId, projectId))
		)
	) {
		throw notFound();
	}
	return parsed.data;
}

async function findProposal(
	proposalStore: SourceMetadataMappingProposalStore,
	request: {
		entryId: string;
		projectId: string;
		proposalId: string;
		userId: string;
	}
): Promise<SourceMetadataMappingProposal> {
	const proposals = await proposalStore.listProposals(
		request.userId,
		request.projectId,
		request.entryId
	);
	const proposal = proposals?.find(
		(candidate) => candidate.id === request.proposalId
	);
	if (!proposal) {
		throw notFound();
	}
	return proposal;
}

export const importsRouter = {
	createSourceMetadataMappingProposal: protectedProcedure
		.input(sourceMetadataMappingProposalCreateRequestSchema)
		.output(sourceMetadataMappingProposalSchema)
		.handler(async ({ context, input }) => {
			if (!context.createSourceMetadataMappingProposal) {
				throw unavailable("Source metadata mapping proposals");
			}
			const userId = context.session.user.id;
			const projectId = await requireProject(context, userId, input.projectId);
			const result = await context.createSourceMetadataMappingProposal({
				input: input.input,
				projectId,
				sourceEntryId: parseIdentifier(input.entryId),
				userId,
			});
			if (result.ok) {
				return result.proposal;
			}
			if (result.reason === "not_found") {
				throw notFound();
			}
			if (result.reason === "too_large") {
				throw new ORPCError("PAYLOAD_TOO_LARGE", {
					message: "Source metadata sidecars exceed the maximum size",
				});
			}
			throw new ORPCError("UNPROCESSABLE_CONTENT", {
				message:
					result.reason === "unsupported_format"
						? "Unsupported source metadata format"
						: "Invalid source metadata JSON",
			});
		}),
	finalizeSourceMetadataMapping: protectedProcedure
		.input(sourceMetadataMappingFinalizeRequestSchema)
		.output(sourceMetadataMappingFinalizationSchema)
		.handler(async ({ context, input }) => {
			if (
				!(
					context.finalizeSourceMetadataMapping &&
					context.sourceMetadataMappingProposalStore
				)
			) {
				throw unavailable("Source metadata mapping finalization");
			}
			const userId = context.session.user.id;
			const projectId = await requireProject(context, userId, input.projectId);
			const entryId = parseIdentifier(input.entryId);
			const proposal = await findProposal(
				context.sourceMetadataMappingProposalStore,
				{
					entryId,
					projectId,
					proposalId: parseIdentifier(input.proposalId),
					userId,
				}
			);
			const result = await context.finalizeSourceMetadataMapping({
				entryId,
				input: input.input,
				projectId,
				proposal,
				userId,
			});
			if (result.ok) {
				return result.finalization;
			}
			switch (result.reason) {
				case "not_found":
					throw notFound();
				case "finalized_differently":
					throw new ORPCError("CONFLICT", {
						message: "Source metadata mapping already finalized differently",
					});
				case "candidate_conflict":
					throw new ORPCError("CONFLICT", {
						message: "Source metadata mapping conflict",
					});
				case "invalid_decisions":
					throw new ORPCError("UNPROCESSABLE_CONTENT", {
						message: "Invalid source metadata mapping decisions",
					});
				case "unsupported_source_image":
					throw new ORPCError("UNPROCESSABLE_CONTENT", {
						message: "Unsupported source image",
					});
				default:
					throw new ORPCError("UNPROCESSABLE_CONTENT", {
						message: "Invalid source image",
					});
			}
		}),
	getSourceMetadataMappingFinalization: protectedProcedure
		.input(sourceMetadataMappingFinalizationReadInputSchema)
		.output(sourceMetadataMappingFinalizationSchema.nullable())
		.handler(async ({ context, input }) => {
			if (!context.sourceMetadataMappingProposalStore) {
				throw unavailable("Source metadata mapping storage");
			}
			const userId = context.session.user.id;
			const projectId = await requireProject(context, userId, input.projectId);
			const proposal = await findProposal(
				context.sourceMetadataMappingProposalStore,
				{
					entryId: parseIdentifier(input.entryId),
					projectId,
					proposalId: parseIdentifier(input.proposalId),
					userId,
				}
			);
			return await context.sourceMetadataMappingProposalStore.getFinalization(
				userId,
				projectId,
				proposal.id
			);
		}),
	listEntries: protectedProcedure
		.input(importInboxListInputSchema)
		.output(importInboxEntriesSchema)
		.handler(async ({ context, input }) => {
			if (!context.importInboxStore) {
				throw unavailable("Import Inbox storage");
			}
			const userId = context.session.user.id;
			const projectId = await requireProject(context, userId, input.projectId);
			const entries = await context.importInboxStore.listEntries(
				userId,
				projectId
			);
			if (!entries) {
				throw notFound();
			}
			return entries;
		}),
	listSourceMetadataMappingProposals: protectedProcedure
		.input(sourceMetadataMappingProposalListInputSchema)
		.output(sourceMetadataMappingProposalsSchema)
		.handler(async ({ context, input }) => {
			if (
				!(
					context.importInboxStore && context.sourceMetadataMappingProposalStore
				)
			) {
				throw unavailable("Source metadata mapping storage");
			}
			const userId = context.session.user.id;
			const projectId = await requireProject(context, userId, input.projectId);
			const entryId = parseIdentifier(input.entryId);
			const source = await context.importInboxStore.getFileRecord(
				userId,
				projectId,
				entryId
			);
			const proposals = source
				? await context.sourceMetadataMappingProposalStore.listProposals(
						userId,
						projectId,
						entryId
					)
				: null;
			if (!proposals) {
				throw notFound();
			}
			return proposals;
		}),
};

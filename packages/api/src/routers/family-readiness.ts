import { ORPCError } from "@orpc/server";
import type { Context } from "../context";
import type {
	ReadinessEvidenceInput,
	RecordEvidenceFailureReason,
} from "../family-readiness";
import {
	familyReadinessSchema,
	readinessEvidenceInputSchema,
	requiredSetActivateInputSchema,
	requiredSetListInputSchema,
	requiredSetRevisionSchema,
	requiredSetSaveInputSchema,
} from "../family-readiness";
import { protectedProcedure } from "../index";
import { recordProductBoundary } from "../measurement-workflows";

function getFamilyReadinessStore(context: Context) {
	if (!context.familyReadinessStore) {
		throw new ORPCError("INTERNAL_SERVER_ERROR", {
			message: "Family readiness storage is unavailable.",
		});
	}
	return context.familyReadinessStore;
}

async function readFamilyReadiness(
	context: Context,
	projectId: string,
	assetFamilyId: string
) {
	const readiness = await getFamilyReadinessStore(context).list(
		context.session?.user.id ?? "",
		projectId,
		assetFamilyId
	);
	if (!readiness) {
		throw new ORPCError("NOT_FOUND", { message: "Asset Family not found." });
	}
	return familyReadinessSchema.parse(readiness);
}

function evidenceRejectionMessage(
	reason: RecordEvidenceFailureReason,
	input: ReadinessEvidenceInput
) {
	if (reason === "invalid_usage_test_context") {
		return "Object scene evidence must pin an approved character version in the same Project and at least two ground versions from different Asset Records. Record the evidence again with current versions.";
	}
	if (input.kind === "quality" && input.result === "waived") {
		return "A Quality Waiver requires current measurement evidence for the same rule, observed value, method, and exact scope. Refresh the evaluation; integrity, required human reviews, and usage tests cannot be waived.";
	}
	return "Evidence requires an active Required Set, current Asset Versions, and a Context Revision; the quality rule, required human review, or usage test must match the active Specialized Profile Contract.";
}

export const familyReadinessRouter = {
	list: protectedProcedure
		.input(requiredSetListInputSchema)
		.output(familyReadinessSchema)
		.handler(async ({ context, input }) =>
			readFamilyReadiness(context, input.projectId, input.assetFamilyId)
		),
	saveDraft: protectedProcedure
		.input(requiredSetSaveInputSchema)
		.output(requiredSetRevisionSchema)
		.handler(async ({ context, input }) => {
			const revision = await getFamilyReadinessStore(context).saveDraft(
				context.session.user.id,
				input
			);
			if (revision) {
				return requiredSetRevisionSchema.parse(revision);
			}
			const catalog = await context.assetFamilyStore.list(
				context.session.user.id,
				input.projectId
			);
			if (
				!catalog?.assetFamilies.some(
					(family) => family.id === input.assetFamilyId
				)
			) {
				throw new ORPCError("NOT_FOUND", {
					message: "Asset Family not found.",
				});
			}
			throw new ORPCError("BAD_REQUEST", {
				message:
					"Required Set items must reference Asset Records in the same Asset Family. Retry if the version number conflicts.",
			});
		}),
	activate: protectedProcedure
		.input(requiredSetActivateInputSchema)
		.output(familyReadinessSchema)
		.handler(async ({ context, input }) => {
			const readiness = await getFamilyReadinessStore(context).activate(
				context.session.user.id,
				input
			);
			if (!readiness) {
				throw new ORPCError("NOT_FOUND", {
					message: "Required Set revision to activate was not found.",
				});
			}
			return familyReadinessSchema.parse(readiness);
		}),
	recordEvidence: protectedProcedure
		.input(readinessEvidenceInputSchema)
		.output(familyReadinessSchema)
		.handler(async ({ context, input }) => {
			const result = await getFamilyReadinessStore(context).recordEvidence(
				context.session.user.id,
				input
			);
			if (result.status === "rejected") {
				throw new ORPCError("BAD_REQUEST", {
					message: evidenceRejectionMessage(result.reason, input),
				});
			}
			const readiness = familyReadinessSchema.parse(result.readiness);
			if (
				input.kind === "quality" &&
				input.result === "failed" &&
				input.versionTarget
			) {
				await recordProductBoundary(context, {
					userId: context.session.user.id,
					projectId: input.projectId,
					workflowId: input.versionTarget.id,
					eventFamily: "review_and_repair",
					eventName: "review_issue_recorded",
					phase: "start",
					recordKind:
						input.versionTarget.kind === "unit"
							? "unit_version"
							: "composite_version",
					outcomeClass: "workflow_started",
					counters: {},
				});
			}
			return readiness;
		}),
};

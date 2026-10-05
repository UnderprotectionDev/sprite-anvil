import { ORPCError } from "@orpc/server";
import type { Context } from "../context";
import {
	familyReadinessSchema,
	type ReadinessEvidenceInput,
	type RecordEvidenceFailureReason,
	readinessEvidenceInputSchema,
	requiredSetActivateInputSchema,
	requiredSetListInputSchema,
	requiredSetRevisionSchema,
	requiredSetSaveInputSchema,
} from "../family-readiness";
import { protectedProcedure } from "../index";

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
		throw new ORPCError("NOT_FOUND", { message: "Varlık Ailesi bulunamadı." });
	}
	return familyReadinessSchema.parse(readiness);
}

function evidenceRejectionMessage(
	reason: RecordEvidenceFailureReason,
	input: ReadinessEvidenceInput
) {
	if (reason === "invalid_usage_test_context") {
		return "Obje sahne kanıtı, aynı projedeki en son inceleme kararı onaylı bir karakter sürümünü ve farklı Varlık Kayıtlarına bağlı en az iki zemin sürümünü sabitlemelidir. Kanıtı güncel sürümlerle yeniden kaydedin.";
	}
	if (input.kind === "quality" && input.result === "waived") {
		return "Kalite İstisnası için aynı kural, gözlenen değer, yöntem ve kesin kapsama ait güncel ölçüm kanıtı gerekir. Değerlendirmeyi yenileyin; bütünlük, zorunlu insan incelemesi ve kullanım testi istisna alamaz.";
	}
	return "Kanıt için etkin Gerekli Öğeler Listesi, güncel Varlık Sürümleri ve Bağlam Sürümü gerekir; kalite kuralı, zorunlu insan incelemesi veya kullanım testi etkin Özel Profil Sözleşmesiyle eşleşmelidir.";
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
					message: "Varlık Ailesi bulunamadı.",
				});
			}
			throw new ORPCError("BAD_REQUEST", {
				message:
					"Liste öğeleri aynı Varlık Ailesindeki Varlık Kayıtlarına bağlanmalı; çakışan sürüm numarası varsa yeniden deneyin.",
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
					message:
						"Etkinleştirilecek Gerekli Öğeler Listesi sürümü bulunamadı.",
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
			return familyReadinessSchema.parse(result.readiness);
		}),
};

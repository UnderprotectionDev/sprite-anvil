import {
	rightsRecordEvidenceFileLimitBytes,
	rightsRecordStates,
} from "@sprite-anvil/api/rights-records";
import z from "zod";

export const documentedEvidenceError =
	"Belgelendi durumunda destekleyici kanıt gerekir.";
export const restrictedRestrictionsError =
	"Kısıtlı durumunda bilinen en az bir kısıt gerekir.";

export const rightsRecordDraftSchema = z.object({
	assertedScope: z.string(),
	evidence: z.string(),
	restrictions: z.string(),
	rightsHolderOrProvider: z.string(),
	source: z.string(),
	state: z.enum(rightsRecordStates),
	uncertainty: z.string(),
});

export type RightsRecordDraft = z.infer<typeof rightsRecordDraftSchema>;
export type RightsRecordValidationField = "evidence" | "restrictions";

export function isRightsRecordFieldRequired(
	key: Exclude<keyof RightsRecordDraft, "state">,
	state: RightsRecordDraft["state"],
	hasEvidenceFile: boolean
) {
	if (key === "evidence") {
		return state === "documented" && !hasEvidenceFile;
	}
	return key === "restrictions" && state === "restricted";
}

export function rightsRecordFormSchema(hasEvidenceFile: boolean) {
	return rightsRecordDraftSchema.superRefine((draft, context) => {
		if (
			isRightsRecordFieldRequired("evidence", draft.state, hasEvidenceFile) &&
			!draft.evidence.trim()
		) {
			context.addIssue({
				code: "custom",
				message: documentedEvidenceError,
				path: ["evidence"],
			});
		}
		if (
			isRightsRecordFieldRequired(
				"restrictions",
				draft.state,
				hasEvidenceFile
			) &&
			!draft.restrictions.trim()
		) {
			context.addIssue({
				code: "custom",
				message: restrictedRestrictionsError,
				path: ["restrictions"],
			});
		}
	});
}

export function rightsRecordFormErrors(
	draft: RightsRecordDraft,
	hasEvidenceFile: boolean
) {
	const fields: Partial<Record<RightsRecordValidationField, string>> = {};
	const issues =
		rightsRecordFormSchema(hasEvidenceFile).safeParse(draft).error?.issues ??
		[];
	for (const issue of issues) {
		const [field] = issue.path;
		if (field === "evidence" || field === "restrictions") {
			fields[field] ??= issue.message;
		}
	}
	return fields;
}

export function rightsRecordRequiredFieldSchema(
	required: boolean,
	message: string
) {
	return z.string().refine((value) => !required || value.trim() !== "", {
		message,
	});
}

export const rightsRecordEvidenceFileSchema = z
	.instanceof(File)
	.refine((file) => file.size > 0, { message: "Kanıt dosyası boş olamaz." })
	.refine((file) => file.size <= rightsRecordEvidenceFileLimitBytes, {
		message: "Kanıt dosyası 5 MiB sınırını aşıyor.",
	});

export function rightsRecordEvidenceFileError(file: File | null) {
	if (!file) {
		return null;
	}
	return (
		rightsRecordEvidenceFileSchema.safeParse(file).error?.issues[0]?.message ??
		null
	);
}

import {
	optionalRuntimeEnvironmentText,
	requiredRuntimeEnvironmentText,
} from "@sprite-anvil/api/runtime-environment";
import {
	runtimeValidationEvidenceFileLimitBytes,
	runtimeValidationEvidenceKindSchema,
	runtimeValidationEvidenceSourceSchema,
	runtimeValidationEvidenceTextLimit,
} from "@sprite-anvil/api/runtime-validation";
import {
	runtimeValidationConfirmedFailureSourceSchema,
	runtimeValidationOutcomeSchema,
} from "@sprite-anvil/api/runtime-validation-decisions";
import { z } from "zod";

export const runtimeValidationRecordFormSchema = z.object({
	adapterVersion: optionalRuntimeEnvironmentText(),
	bundleId: z.string().min(1, "Choose the Export Bundle that was tested."),
	engineVersion: requiredRuntimeEnvironmentText("Enter the engine version."),
	gameBuild: requiredRuntimeEnvironmentText("Enter the game build."),
	/** "" when this is not a retest or fix of an earlier record. */
	supersedesRecordId: z.string(),
});

/** "" is the unchosen starting value: the user must pick the outcome themselves. */
export const runtimeValidationOutcomeFormSchema = z.object({
	outcome: z
		.union([runtimeValidationOutcomeSchema, z.literal("")])
		.refine((value) => value !== "", "Choose the outcome of this test."),
});

export const runtimeValidationFailureSourceFormSchema = z.object({
	failureSource: z
		.union([runtimeValidationConfirmedFailureSourceSchema, z.literal("")])
		.refine((value) => value !== "", "Choose the failure source."),
});

export const runtimeValidationEvidenceFormSchema = z
	.object({
		file: z.instanceof(File).nullable(),
		kind: runtimeValidationEvidenceKindSchema,
		source: runtimeValidationEvidenceSourceSchema,
		text: z
			.string()
			.trim()
			.max(
				runtimeValidationEvidenceTextLimit,
				`Use at most ${runtimeValidationEvidenceTextLimit} characters.`
			),
	})
	.superRefine((value, context) => {
		const needsFile = value.kind === "screenshot" || value.kind === "recording";
		const needsText = value.kind === "observation";
		if (value.file && value.file.size === 0) {
			context.addIssue({
				code: "custom",
				message: "The file is empty.",
				path: ["file"],
			});
		}
		if (
			value.file &&
			value.file.size > runtimeValidationEvidenceFileLimitBytes
		) {
			context.addIssue({
				code: "custom",
				message: "The file is larger than 5 MiB.",
				path: ["file"],
			});
		}
		if (needsFile && !value.file) {
			context.addIssue({
				code: "custom",
				message: "Attach a file.",
				path: ["file"],
			});
		}
		if (needsText && !value.text) {
			context.addIssue({
				code: "custom",
				message: "Write the observation.",
				path: ["text"],
			});
		}
		if (value.kind === "test_result" && !(value.file || value.text)) {
			context.addIssue({
				code: "custom",
				message: "Write the test result or attach a file.",
				path: ["text"],
			});
		}
		if (value.file && value.text) {
			context.addIssue({
				code: "custom",
				message: "Add the text and the file as separate evidence.",
				path: ["text"],
			});
		}
		if (needsText && value.file) {
			context.addIssue({
				code: "custom",
				message: "An observation is text only.",
				path: ["file"],
			});
		}
		if (needsFile && value.text) {
			context.addIssue({
				code: "custom",
				message: "A screenshot or recording is a file only.",
				path: ["text"],
			});
		}
	});

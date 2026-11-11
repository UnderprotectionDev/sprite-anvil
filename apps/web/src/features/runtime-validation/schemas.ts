import {
	runtimeValidationEvidenceFileLimitBytes,
	runtimeValidationEvidenceKindSchema,
	runtimeValidationEvidenceSourceSchema,
	runtimeValidationEvidenceTextLimit,
} from "@sprite-anvil/api/runtime-validation";
import { z } from "zod";

const requiredText = (message: string) =>
	z.string().trim().min(1, message).max(200, "Use at most 200 characters.");

export const runtimeValidationRecordFormSchema = z.object({
	adapterVersion: z.string().trim().max(200, "Use at most 200 characters."),
	bundleId: z.string().min(1, "Choose the Export Bundle that was tested."),
	engineVersion: requiredText("Enter the engine version."),
	gameBuild: requiredText("Enter the game build."),
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

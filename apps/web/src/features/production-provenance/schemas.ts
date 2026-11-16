import z from "zod";

const maxManagedSnapshotBytes = 100 * 1024 * 1024;

function isSupportedCandidateExport(file: File) {
	const name = file.name.toLowerCase();
	return (
		file.type === "image/png" ||
		file.type === "image/webp" ||
		name.endsWith(".png") ||
		name.endsWith(".webp")
	);
}

export const candidateExportFileSchema = z
	.instanceof(File)
	.refine((file) => file.size > 0 && isSupportedCandidateExport(file), {
		message: "The Candidate Version file must be a nonempty PNG or WebP.",
	});

export const managedSnapshotFileSchema = z
	.instanceof(File)
	.refine((file) => file.size > 0 && file.size <= maxManagedSnapshotBytes, {
		message: "The working file must be nonempty and no larger than 100 MB.",
	});

export const externalWorkingFileEditFormSchema = z.object({
	candidateFile: candidateExportFileSchema.nullable().refine(Boolean),
	sourceFile: managedSnapshotFileSchema.nullable().refine(Boolean),
});

export function fileSelectionError(schema: z.ZodType<File>, file: File) {
	return schema.safeParse(file).error?.issues[0]?.message ?? null;
}

export const manualImportEvidenceFormSchema = z.object({
	actualInstruction: z
		.string()
		.min(1, "Actual production instruction is required."),
	generationPackageId: z.string().min(1, "Select a Generation Package."),
	sourceSurface: z.string().min(1, "Source surface is required."),
});

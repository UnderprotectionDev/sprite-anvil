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
		message: "Aday Sürüm dosyası PNG veya WebP olmalı ve boş olamaz.",
	});

export const managedSnapshotFileSchema = z
	.instanceof(File)
	.refine((file) => file.size > 0 && file.size <= maxManagedSnapshotBytes, {
		message: "Çalışma dosyası boş olamaz ve 100 MB sınırını aşamaz.",
	});

export const externalWorkingFileEditFormSchema = z.object({
	candidateFile: candidateExportFileSchema.nullable().refine(Boolean),
	sourceFile: managedSnapshotFileSchema.nullable().refine(Boolean),
});

export function fileSelectionError(schema: z.ZodType<File>, file: File) {
	return schema.safeParse(file).error?.issues[0]?.message ?? null;
}

export const manualImportEvidenceFormSchema = z.object({
	actualInstruction: z.string().min(1, "Gerçek üretim talimatı gerekli."),
	generationPackageId: z.string().min(1, "Üretim Paketi seçin."),
	sourceSurface: z.string().min(1, "Kaynak yüzeyi gerekli."),
});

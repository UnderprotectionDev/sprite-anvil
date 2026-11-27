import type {
	ProjectArchive,
	ProjectArchiveSummary,
} from "@sprite-anvil/api/project-archives";
import type { ProjectCoverRecord } from "@/utils/project-cover";

export type AccountArchive = ProjectArchiveSummary & {
	projectName: string;
	hasPreview?: boolean;
	previewAssetVersionId?: string | null;
	project: ProjectCoverRecord;
};
export function archiveBytes(archive?: ProjectArchive) {
	return archive?.manifest.files
		.filter((file) => file.presence === "included")
		.reduce((sum, file) => sum + file.byteSize, 0);
}
export function formatArchiveBytes(bytes: number | undefined) {
	return bytes === undefined ? "—" : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
export function includedArchiveSize(archive?: ProjectArchive) {
	return formatArchiveBytes(archiveBytes(archive));
}
const archiveDateFormatter = new Intl.DateTimeFormat("en-GB", {
	day: "2-digit",
	month: "short",
	year: "numeric",
});
export function archiveDate(value: string) {
	return archiveDateFormatter.format(new Date(value));
}
export function archiveSectionCount(
	sections: readonly { name: string; recordCount: number }[],
	names: readonly string[]
) {
	const includedNames = new Set(names);
	return sections
		.filter((section) => includedNames.has(section.name))
		.reduce((sum, section) => sum + section.recordCount, 0);
}
export function archiveStats(
	sections: readonly { name: string; recordCount: number }[]
) {
	return [
		{
			label: "Project Context",
			count: archiveSectionCount(sections, ["contextRevisions"]) > 0 ? 1 : 0,
			icon: "context",
		},
		{
			label: "Assets",
			count: archiveSectionCount(sections, ["assetRecords"]),
			icon: "assets",
		},
		{
			label: "Production runs",
			count: archiveSectionCount(sections, ["providerGenerationRecords"]),
			icon: "production",
		},
		{
			label: "Review events",
			count: archiveSectionCount(sections, [
				"reviews",
				"assetVersionReviews",
				"compositeVersionReviews",
			]),
			icon: "review",
		},
		{
			label: "Deliveries",
			count: archiveSectionCount(sections, ["exportBundles"]),
			icon: "deliveries",
		},
	];
}

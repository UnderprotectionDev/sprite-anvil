import { exportBundleManifestSchema } from "@sprite-anvil/api/export-bundle-manifest";
import {
	type ExportBundleIntegrityResult,
	type ExportBundleVerificationFile,
	verifyExportBundle,
} from "@sprite-anvil/api/export-bundle-verification";

export interface ExportBundleManifestSummary {
	contextRevisionNumber: number;
	contractVersion: string;
	fileCount: number;
	profileRevisionNumber: number;
	waiverCount: number;
}

export interface ExportBundleReading {
	manifest: ExportBundleManifestSummary | null;
	/** Why the manifest could not be summarized; null when it was, or when there is none to read. */
	manifestError: string | null;
	result: ExportBundleIntegrityResult;
}

/**
 * The files of a chosen bundle directory, as paths relative to that directory.
 * The browser prefixes each path with the chosen directory's own name.
 */
async function readBundleDirectory(
	files: File[]
): Promise<ExportBundleVerificationFile[]> {
	return await Promise.all(
		files.map(async (file) => {
			const relative = file.webkitRelativePath || file.name;
			return {
				bytes: new Uint8Array(await file.arrayBuffer()),
				path: relative.split("/").slice(1).join("/") || file.name,
			};
		})
	);
}

/** The reason text of a thrown value. */
export function describeError(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

type ManifestSummaryResult =
	| { error: string; summary: null }
	| { error: null; summary: ExportBundleManifestSummary | null };

function summarizeManifest(
	files: ExportBundleVerificationFile[]
): ManifestSummaryResult {
	const manifestFile = files.find((file) => file.path === "manifest.json");
	if (!manifestFile) {
		return { error: null, summary: null };
	}
	let json: unknown;
	try {
		json = JSON.parse(new TextDecoder().decode(manifestFile.bytes));
	} catch (error) {
		return {
			error: `The manifest could not be summarized: ${describeError(error)}`,
			summary: null,
		};
	}
	const parsed = exportBundleManifestSchema.safeParse(json);
	if (!parsed.success) {
		const reasons = parsed.error.issues
			.slice(0, 3)
			.map((issue) => `${issue.path.join(".") || "manifest"}: ${issue.message}`)
			.join("; ");
		return {
			error: `The manifest could not be summarized: ${reasons}`,
			summary: null,
		};
	}
	const manifest = parsed.data;
	return {
		error: null,
		summary: {
			contextRevisionNumber: manifest.context.revisionNumber,
			contractVersion: manifest.contractVersion,
			fileCount: manifest.files.length,
			profileRevisionNumber: manifest.profile.revisionNumber,
			waiverCount: manifest.waivers.length,
		},
	};
}

/** Re-reads the bundle's manifest and verifies it offline, with no server call. */
export async function readExportBundle(
	files: File[]
): Promise<ExportBundleReading> {
	const bundleFiles = await readBundleDirectory(files);
	const { error, summary } = summarizeManifest(bundleFiles);
	return {
		manifest: summary,
		manifestError: error,
		result: await verifyExportBundle(bundleFiles),
	};
}

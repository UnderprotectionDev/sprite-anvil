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
	result: ExportBundleIntegrityResult;
}

/**
 * The files of a chosen bundle directory, as paths relative to that directory.
 * The browser prefixes each path with the chosen directory's own name.
 */
export async function readBundleDirectory(
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

function summarizeManifest(
	files: ExportBundleVerificationFile[]
): ExportBundleManifestSummary | null {
	const manifestFile = files.find((file) => file.path === "manifest.json");
	if (!manifestFile) {
		return null;
	}
	try {
		const parsed = exportBundleManifestSchema.safeParse(
			JSON.parse(new TextDecoder().decode(manifestFile.bytes))
		);
		if (!parsed.success) {
			return null;
		}
		const manifest = parsed.data;
		return {
			contextRevisionNumber: manifest.context.revisionNumber,
			contractVersion: manifest.contractVersion,
			fileCount: manifest.files.length,
			profileRevisionNumber: manifest.profile.revisionNumber,
			waiverCount: manifest.waivers.length,
		};
	} catch {
		return null;
	}
}

/** Re-reads the bundle's manifest and verifies it offline, with no server call. */
export async function readExportBundle(
	files: File[]
): Promise<ExportBundleReading> {
	const bundleFiles = await readBundleDirectory(files);
	return {
		manifest: summarizeManifest(bundleFiles),
		result: await verifyExportBundle(bundleFiles),
	};
}

/**
 * The Package Verification Kit: static, data-only material that lets anyone
 * verify an Engine-Neutral Bundle offline. It carries the manifest JSON
 * Schema, the bundle's deterministic checksum list, a README and example
 * mappings, plus the dependency-free verifier. It is never an installer and
 * carries no agent instruction (ADR 0021).
 */
import type { ExportBundleManifest } from "./export-bundle-manifest";
import {
	exportBundleKitContractVersion,
	exportBundleKitDirectory,
	exportBundleManifestJsonSchema,
} from "./export-bundle-verification";

export interface ExportBundleKitFile {
	content: string;
	path: string;
}

function readmeText(manifest: ExportBundleManifest): string {
	return `# Package Verification Kit

This directory lets you check an Engine-Neutral Bundle without a network.
It is not a project archive and not a game engine project.

Manifest contract version: ${manifest.contractVersion}
Profile contract version: ${manifest.profile.contractVersion}
Kit contract version: ${exportBundleKitContractVersion}

## Contents

- \`schema/manifest.schema.json\`: JSON Schema of \`manifest.json\`.
- \`checksums.txt\`: SHA-256 of every bundle file, sorted by path. It equals the bundle's own \`checksums.txt\`.
- \`examples/\`: example mappings from manifest fields to your own tooling. They are data only.
- \`verify.ts\`: the offline verifier, a single file with no dependencies.

## Verify

Run the verifier with Bun or a current Node over the bundle directory (the directory that holds \`manifest.json\`):

    bun verification-kit/verify.ts .

It prints one JSON result. A missing file, a changed file, a duplicate path, a broken record link, an unknown required field or major version, or a README that contradicts the manifest is an integrity failure. The Workbench shows the same result.
`;
}

function exampleText(): string {
	return `${JSON.stringify(
		{
			description:
				"Example: read image files and their pinned versions from manifest.json.",
			executable: false,
			kitContractVersion: exportBundleKitContractVersion,
			mappings: [
				{ from: "files[].path", to: "image.path" },
				{ from: "files[].sha256", to: "image.sha256" },
				{ from: "files[].itemId", to: "image.requiredSetItem" },
				{ from: "files[].assetVersionId", to: "image.versionId" },
			],
		},
		null,
		2
	)}\n`;
}

/**
 * The kit files for a bundle, path-sorted and deterministic: the same
 * manifest, checksum list and verifier source give the same bytes.
 */
export function buildExportBundleVerificationKit(input: {
	checksumsText: string;
	manifest: ExportBundleManifest;
	verifierSource: string;
}): ExportBundleKitFile[] {
	const schema = {
		...exportBundleManifestJsonSchema,
		"x-contractVersion": input.manifest.contractVersion,
	};
	const files = [
		{ content: input.checksumsText, path: "checksums.txt" },
		{ content: exampleText(), path: "examples/file-mapping.example.json" },
		{ content: readmeText(input.manifest), path: "README.md" },
		{
			content: `${JSON.stringify(schema, null, 2)}\n`,
			path: "schema/manifest.schema.json",
		},
		{ content: input.verifierSource, path: "verify.ts" },
	];
	return files
		.map((file) => ({
			content: file.content,
			path: `${exportBundleKitDirectory}/${file.path}`,
		}))
		.sort(
			(left, right) =>
				Number(left.path > right.path) - Number(left.path < right.path)
		);
}

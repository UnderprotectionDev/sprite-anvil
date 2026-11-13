/**
 * Test fixture: a stored Export Bundle built through the real manifest contract,
 * so the comparison tests on both surfaces start from one exact input. Never
 * imported by product code.
 */
import {
	buildExportBundle,
	type ExportBundleSource,
} from "../src/export-bundle-manifest";
import type { ExportBundle } from "../src/export-bundles";
import { fixtureProfile } from "./export-bundle-verification-fixture";

export { fixtureSource } from "./export-bundle-verification-fixture";

/** One stored bundle for `source`; the id and time differ per call, the meaning does not. */
export async function fixtureExportBundle(
	source: ExportBundleSource,
	overrides: Partial<ExportBundle> = {}
): Promise<ExportBundle> {
	const built = await buildExportBundle(source, {
		adapterVersion: null,
		deliveryTargetRevisionId: null,
		profile: fixtureProfile,
	});
	if (!built.ok) {
		throw new Error("Fixture bundle did not build.");
	}
	return {
		adapterVersion: null,
		contextRevisionId: built.bundle.manifest.context.revisionId,
		contractVersion: built.bundle.manifest.contractVersion,
		createdAt: "2026-11-10T10:00:00.000Z",
		deliveryTargetRevisionId: null,
		files: built.bundle.files,
		id: crypto.randomUUID(),
		isLatest: true,
		manifest: built.bundle.manifest,
		manifestDigest: built.bundle.manifestDigest,
		profileId: fixtureProfile.profileId,
		profileRevisionId: fixtureProfile.revisionId,
		...overrides,
	};
}

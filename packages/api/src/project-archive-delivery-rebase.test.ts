import { expect, test } from "bun:test";
import { buildFixtureBundleFiles } from "../test-support/export-bundle-verification-fixture";
import { exportBundleManifestSchema } from "./export-bundle-manifest";
import { sha256Hex, verifyExportBundle } from "./export-bundle-verification";
import { emptyDeliveryRecords } from "./project-archive-delivery";
import { rebaseArchiveDelivery } from "./project-archive-delivery-rebase";

test("a restored bundle rebases its immutable pins and remains offline verifiable", async () => {
	const source = await buildFixtureBundleFiles();
	const manifestFile = source.find((file) => file.path === "manifest.json");
	if (!manifestFile) {
		throw new Error("Missing test manifest");
	}
	const manifest = exportBundleManifestSchema.parse(
		JSON.parse(new TextDecoder().decode(manifestFile.bytes))
	);
	const delivery = emptyDeliveryRecords();
	delivery.exportBundles.push({
		id: "restored-bundle",
		adapterVersion: null,
		contextRevisionId: "restored-context",
		contractVersion: manifest.contractVersion,
		createdAt: "2026-11-16T00:00:00Z",
		deliveryTargetRevisionId: null,
		manifestDigest: await sha256Hex(manifestFile.bytes),
		profileId: "restored-profile",
		profileRevisionId: "restored-profile-revision",
		files: await Promise.all(
			source.map(async (file) => {
				const asset = manifest.files.find(
					(entry) => entry.path === file.path && entry.assetVersionId
				);
				return {
					path: file.path,
					sha256: await sha256Hex(file.bytes),
					byteSize: file.bytes.length,
					assetVersionId: asset?.assetVersionId
						? `restored-${asset.assetVersionId}`
						: null,
					content: asset ? null : new TextDecoder().decode(file.bytes),
				};
			})
		),
	});
	const ids = new Map([
		[manifest.context.revisionId, "restored-context"],
		[manifest.profile.profileId, "restored-profile"],
		[manifest.profile.revisionId, "restored-profile-revision"],
		["av-1", "restored-av-1"],
		["av-2", "restored-av-2"],
	]);
	await rebaseArchiveDelivery(delivery, ids);
	const [bundle] = delivery.exportBundles;
	if (!bundle) {
		throw new Error("Missing restored bundle");
	}
	const files = bundle.files.map((file) => ({
		path: file.path,
		bytes:
			file.content === null
				? (source.find((entry) => entry.path === file.path)?.bytes ??
					new Uint8Array())
				: new TextEncoder().encode(file.content),
	}));
	expect(await verifyExportBundle(files)).toMatchObject({ ok: true });
	const restoredManifest = bundle.files.find(
		(file) => file.path === "manifest.json"
	);
	expect(restoredManifest?.content).toContain('"restored-context"');
	expect(restoredManifest?.content).toContain('"restored-av-1"');
	expect(bundle.manifestDigest).not.toBe(await sha256Hex(manifestFile.bytes));
	expect(restoredManifest?.sha256).toBe(bundle.manifestDigest);
});

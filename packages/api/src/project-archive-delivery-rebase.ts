import { deliveryRefreshLockDigest } from "./delivery-refresh-lock-digest";
import {
	exportBundleManifestSchema,
	exportBundleSha256,
	renderExportBundleChecksums,
	renderExportBundleManifest,
} from "./export-bundle-manifest";
import type { DeliveryRecords } from "./project-archive-delivery";
import { recordContentDigest } from "./record-content-digest";

const semanticFields = new Set([
	"itemId",
	"unitKey",
	"frameKey",
	"ruleId",
	"fieldId",
	"name",
	"title",
	"description",
	"notes",
	"note",
	"rationale",
	"observation",
	"instruction",
	"actualInstruction",
	"outcomeNote",
]);
function rewrite(
	value: unknown,
	ids: ReadonlyMap<string, string>,
	field?: string
): unknown {
	if (field && semanticFields.has(field)) {
		return value;
	}
	if (typeof value === "string") {
		return ids.get(value) ?? value;
	}
	if (Array.isArray(value)) {
		return value.map((entry) => rewrite(entry, ids));
	}
	if (value && typeof value === "object") {
		return Object.fromEntries(
			Object.entries(value).map(([key, entry]) => [
				ids.get(key) ?? key,
				rewrite(entry, ids, key),
			])
		);
	}
	return value;
}

async function setText(
	file: DeliveryRecords["exportBundles"][number]["files"][number],
	content: string
) {
	file.content = content;
	file.byteSize = new TextEncoder().encode(content).length;
	file.sha256 = await exportBundleSha256(content);
}

async function rebaseBundle(
	bundle: DeliveryRecords["exportBundles"][number],
	ids: ReadonlyMap<string, string>,
	profileDigests: ReadonlyMap<string, string>
) {
	const manifestFile = bundle.files.find(
		(file) => file.path === "manifest.json"
	);
	const checksums = bundle.files.find((file) => file.path === "checksums.txt");
	const kitChecksums = bundle.files.find(
		(file) => file.path === "verification-kit/checksums.txt"
	);
	if (!(manifestFile?.content && checksums && kitChecksums)) {
		throw new Error(
			"The archived bundle is missing generated verification files."
		);
	}
	const original = exportBundleManifestSchema.parse(
		JSON.parse(manifestFile.content)
	);
	const manifest = exportBundleManifestSchema.parse(rewrite(original, ids));
	manifest.profile.contentDigest =
		profileDigests.get(bundle.profileRevisionId) ??
		manifest.profile.contentDigest;
	await setText(manifestFile, renderExportBundleManifest(manifest));
	bundle.manifestDigest = manifestFile.sha256;
	const checksumText = renderExportBundleChecksums([
		...manifest.files,
		{ path: "manifest.json", sha256: manifestFile.sha256 },
	]);
	await Promise.all([
		setText(checksums, checksumText),
		setText(kitChecksums, checksumText),
	]);
}

/** Restored records are independent copies: embedded manifest pins must use their new IDs too. */
export async function rebaseArchiveDelivery(
	delivery: DeliveryRecords,
	ids: ReadonlyMap<string, string>
) {
	await Promise.all(
		delivery.exportProfileRevisions.map(async (revision) => {
			revision.contentDigest = await recordContentDigest({
				contractVersion: revision.contractVersion,
				definition: revision.definition,
			});
		})
	);
	const profileDigests = new Map(
		delivery.exportProfileRevisions.map((revision) => [
			revision.id,
			revision.contentDigest,
		])
	);
	await Promise.all(
		delivery.exportBundles.map((bundle) =>
			rebaseBundle(bundle, ids, profileDigests)
		)
	);
	const bundles = new Map(
		delivery.exportBundles.map((bundle) => [bundle.id, bundle])
	);
	await Promise.all(
		delivery.deliveryRefreshLocks.map(async (lock) => {
			const bundle = bundles.get(lock.bundleId);
			if (!bundle) {
				throw new Error("The restored lock has no Export Bundle.");
			}
			lock.bundleManifestDigest = bundle.manifestDigest;
			const files = new Map(bundle.files.map((file) => [file.path, file]));
			for (const owned of lock.files) {
				const file = files.get(owned.path);
				if (file) {
					owned.sha256 = file.sha256;
					owned.byteSize = file.byteSize;
				}
			}
			lock.lockDigest = await deliveryRefreshLockDigest(lock, lock.files);
		})
	);
	for (const fulfilment of delivery.deliveryFulfilments) {
		for (const requirement of fulfilment.requirements) {
			const bundle = bundles.get(requirement.bundleId);
			if (bundle) {
				requirement.manifestDigest = bundle.manifestDigest;
			}
		}
	}
	for (const validation of delivery.runtimeValidations) {
		const bundle = bundles.get(validation.bundleId);
		if (bundle) {
			validation.manifestDigest = bundle.manifestDigest;
		}
	}
}

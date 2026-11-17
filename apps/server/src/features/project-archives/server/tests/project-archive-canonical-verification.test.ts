import { expect, test } from "bun:test";
import type { ProjectArchiveSource } from "@sprite-anvil/api/project-archives";
import { createProjectArchiveCanonicalVerifier } from "../project-archive-canonical-verification";
import { projectId } from "./project-archive-fixtures";
import { restoreSetup } from "./project-archive-restore-fixtures";

test("detects missing or altered canonical records and files after restore", async () => {
	const fixture = restoreSetup();
	const { archive } = await fixture.createArchive();
	const result = await fixture.restore({
		archiveId: archive.id,
		projectId,
		name: "Restored",
		idempotencyKey: "verify",
	});
	const stored = fixture.memory.restores.get(result.restore.id);
	if (!stored) {
		throw new Error("Missing restore");
	}
	const groups = Object.fromEntries(
		["foundation", "history", "delivery"].map((group) => [
			group,
			Object.fromEntries(
				stored.sections
					.filter((section) => section.group === group)
					.map((section) => [section.name, structuredClone(section.records)])
			),
		])
	);
	const source = {
		records: groups.foundation,
		history: groups.history,
		delivery: groups.delivery,
		files: stored.files
			.filter(
				(file) => file.kind !== "working_file" || file.presence === "included"
			)
			.map(({ restoredId, objectKey, ...file }) => ({
				...file,
				sourceId: restoredId,
				objectKey,
			})),
	} as unknown as ProjectArchiveSource;
	source.records.managedSnapshots = [];
	const verifier = createProjectArchiveCanonicalVerifier({
		read: () => Promise.resolve(source),
	});
	expect(await verifier(stored)).toEqual([]);
	const [bundle] = source.delivery.exportBundles;
	if (!bundle) {
		throw new Error("Missing bundle fixture");
	}
	bundle.files.reverse();
	expect(await verifier(stored)).toEqual([]);
	const [changedFile] = source.files;
	if (!changedFile) {
		throw new Error("Missing restored file fixture");
	}
	changedFile.sha256 = "0".repeat(64);
	expect(await verifier(stored)).toContain(
		`${changedFile.kind}: missing or changed file metadata`
	);
	source.records.assetRecords = [];
	expect(await verifier(stored)).toContain(
		"foundation/assetRecords: missing or changed record"
	);
});

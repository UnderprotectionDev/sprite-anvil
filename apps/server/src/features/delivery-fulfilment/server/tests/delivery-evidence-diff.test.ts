import { expect, test } from "bun:test";
import type { ExportBundle } from "@sprite-anvil/api/export-bundles";
import type { RuntimeValidationRecord } from "@sprite-anvil/api/runtime-validation";
import {
	compareDeliveryEvidence,
	readDeliveryEvidence,
} from "../delivery-evidence-diff";
import type { StoredDeliveryFulfilment } from "../delivery-fulfilment-storage";

const fulfilment = (date: string) =>
	({
		projectId: "project",
		createdAt: new Date(date),
		requirements: [{ bundleId: "bundle", manifestDigest: "digest" }],
	}) as StoredDeliveryFulfilment;
const bundle = (id: string) =>
	({
		id: "bundle",
		manifestDigest: "digest",
		manifest: {
			qualityEvidence: [{ evidenceId: id, result: "passed" }],
			waivers: [{ evidenceId: id, rationale: "Accepted" }],
			rightsEvidence: [
				{
					assetRecordId: "record",
					rightsRecordId: id,
					state: "documented",
					versionNumber: 1,
				},
			],
		},
	}) as unknown as ExportBundle;

test("compares quality, waiver, rights and runtime pins rather than returning placeholders", async () => {
	let current = bundle("before");
	let evidenceId = "before";
	const deps = {
		bundles: { get: () => Promise.resolve(current) },
		runtimeValidation: {
			list: () =>
				Promise.resolve({
					records: [
						{
							id: evidenceId,
							projectId: "project",
							bundleId: "bundle",
							manifestDigest: "digest",
							createdAt: "2026-11-01T00:00:00.000Z",
							decisions: [],
							evidence: [],
						} as unknown as RuntimeValidationRecord,
					],
				}),
		},
	};
	const from = await readDeliveryEvidence(
		deps,
		"user",
		fulfilment("2026-11-02T00:00:00.000Z")
	);
	current = bundle("after");
	evidenceId = "after";
	const to = await readDeliveryEvidence(
		deps,
		"user",
		fulfilment("2026-11-03T00:00:00.000Z")
	);
	const diff = compareDeliveryEvidence(from, to);
	for (const section of Object.values(diff)) {
		expect(section.status).toBe("recorded");
		if (section.status === "recorded") {
			expect(section.changes.length).toBeGreaterThan(0);
		}
	}
	expect(compareDeliveryEvidence(from, from).rights).toMatchObject({
		status: "recorded",
		changes: [],
		unchangedCount: 1,
	});
});

test("does not read a different manifest or evidence written after delivery as historical evidence", async () => {
	let current = bundle("evidence");
	const record = {
		id: "runtime",
		projectId: "project",
		bundleId: "bundle",
		manifestDigest: "digest",
		createdAt: "2026-11-01T00:00:00.000Z",
		decisions: [],
		evidence: [{ id: "later", createdAt: "2026-11-05T00:00:00.000Z" }],
	} as unknown as RuntimeValidationRecord;
	const deps = {
		bundles: { get: () => Promise.resolve(current) },
		runtimeValidation: { list: () => Promise.resolve({ records: [record] }) },
	};
	const before = await readDeliveryEvidence(
		deps,
		"user",
		fulfilment("2026-11-02T00:00:00.000Z")
	);
	const after = await readDeliveryEvidence(
		deps,
		"user",
		fulfilment("2026-11-06T00:00:00.000Z")
	);
	expect(compareDeliveryEvidence(before, after).runtimeEvidence).toMatchObject({
		status: "recorded",
		changes: [{ kind: "changed" }],
	});
	current = { ...current, manifestDigest: "wrong" };
	const missing = await readDeliveryEvidence(
		deps,
		"user",
		fulfilment("2026-11-06T00:00:00.000Z")
	);
	expect(compareDeliveryEvidence(before, missing).qualityEvidence.status).toBe(
		"not_recorded"
	);
});

test("preserves multiple revisions and exposes changed evidence content", async () => {
	const current = bundle("rights");
	const [first] = current.manifest.rightsEvidence;
	if (!first) {
		throw new Error("Missing Rights Record fixture");
	}
	current.manifest.rightsEvidence.push({
		...first,
		versionNumber: 2,
	});
	const deps = { bundles: { get: () => Promise.resolve(current) } };
	const before = await readDeliveryEvidence(
		deps,
		"user",
		fulfilment("2026-11-02T00:00:00.000Z")
	);
	current.manifest.rightsEvidence = [first];
	const after = await readDeliveryEvidence(
		deps,
		"user",
		fulfilment("2026-11-03T00:00:00.000Z")
	);
	expect(compareDeliveryEvidence(before, after).rights).toMatchObject({
		status: "recorded",
		unchangedCount: 1,
		changes: [
			{
				kind: "removed",
				from: { details: expect.stringContaining('"versionNumber": 2') },
			},
		],
	});
});

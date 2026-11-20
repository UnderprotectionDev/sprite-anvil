import { expect, test } from "bun:test";
import type { InteractiveTransaction } from "@sprite-anvil/db/interactive-database";
import { getTableName } from "drizzle-orm";
import { insertArchiveDelivery } from "../project-archive-delivery-materialization";
import type { StoredProjectArchiveRestoreRecord } from "../project-archive-restore-storage";

type Tx = InteractiveTransaction;

test("materializes an Export Profile under the independent project", async () => {
	const record: StoredProjectArchiveRestoreRecord = {
		files: [],
		ids: [],
		projectName: "Restored",
		restore: {
			archiveId: "archive",
			createdAt: new Date("2026-01-01T00:00:00Z"),
			createdByUserId: "owner",
			id: "restore",
			manifestDigest: "digest",
			requestDigest: "request",
			restoredProjectId: "restored",
			sourceProjectId: "source",
		},
		sections: [
			{
				group: "delivery",
				name: "exportProfiles",
				digest: "d",
				sourceDigest: "d",
				recordCount: 1,
				records: [
					{
						id: "profile",
						name: "Desktop",
						createdAt: "2026-01-01T00:00:00.000Z",
					},
				],
			},
		],
	};
	const inserts: { table: string; rows: unknown[] }[] = [];
	const tx = {
		insert: (table: Parameters<typeof getTableName>[0]) => ({
			values: (rows: unknown[]) => {
				inserts.push({ table: getTableName(table), rows });
				return Promise.resolve();
			},
		}),
	} as unknown as Tx;
	await insertArchiveDelivery(tx, record);
	expect(inserts).toEqual([
		{
			table: "export_profiles",
			rows: [
				{
					id: "profile",
					name: "Desktop",
					projectId: "restored",
					createdByUserId: "owner",
					createdAt: new Date("2026-01-01T00:00:00.000Z"),
				},
			],
		},
	]);
});

test("materializes delivery rows in dependency order and preserves excluded runtime file metadata", async () => {
	const { deliverySource, deliveryIds } = await import(
		"./project-archive-delivery-fixtures"
	);
	const source = deliverySource();
	source.delivery.exportBundleMarkers = [
		{
			id: "restored",
			bundleId: deliveryIds.bundle2,
			updatedAt: "2026-11-08T00:00:00.000Z",
		},
	];
	const sections = Object.entries(source.delivery).map(([name, rows]) => ({
		group: "delivery",
		name,
		digest: "d",
		sourceDigest: "d",
		recordCount: rows.length,
		records: rows,
	}));
	const record: StoredProjectArchiveRestoreRecord = {
		files: source.files
			.filter((file) => file.kind === "runtime_evidence_file")
			.map(({ objectKey: _source, ...file }) => ({
				...file,
				restoredId: file.sourceId,
				presence: "excluded" as const,
				exclusionReason: "evidence_not_archived" as const,
				objectKey: null,
			})),
		ids: [],
		sections,
		projectName: "Restored",
		restore: {
			archiveId: "archive",
			createdAt: new Date("2026-01-01T00:00:00Z"),
			createdByUserId: "owner",
			id: "restore",
			manifestDigest: "digest",
			requestDigest: "request",
			restoredProjectId: "restored",
			sourceProjectId: "source",
		},
	};
	const inserts: { table: string; rows: Record<string, unknown>[] }[] = [];
	const tx = {
		insert: (table: Parameters<typeof getTableName>[0]) => ({
			values: (rows: Record<string, unknown>[]) => {
				inserts.push({ table: getTableName(table), rows });
				return Promise.resolve();
			},
		}),
	} as unknown as Tx;
	await insertArchiveDelivery(tx, record);
	const tables = inserts.map((entry) => entry.table);
	expect(tables.indexOf("delivery_target_drafts")).toBeLessThan(
		tables.indexOf("delivery_target_revisions")
	);
	expect(tables.indexOf("export_bundles")).toBeLessThan(
		tables.indexOf("delivery_fulfilments")
	);
	expect(tables.indexOf("runtime_validation_records")).toBeLessThan(
		tables.indexOf("runtime_validation_evidence")
	);
	expect(
		inserts.find((entry) => entry.table === "export_bundle_markers")?.rows[0]
	).toMatchObject({ projectId: "restored", bundleId: deliveryIds.bundle2 });
	expect(
		inserts.find((entry) => entry.table === "runtime_validation_evidence")
			?.rows[0]
	).toMatchObject({
		id: deliveryIds.evidence,
		fileName: "run.mp4",
		byteSize: 5_000_000,
		sha256: "e".repeat(64),
		objectKey: null,
	});
});

test("batches a large Export Profile collection without losing order", async () => {
	const profiles = Array.from({ length: 1101 }, (_, index) => ({
		id: `profile-${index}`,
		name: `Profile ${index}`,
		createdAt: "2026-01-01T00:00:00.000Z",
	}));
	const record: StoredProjectArchiveRestoreRecord = {
		files: [],
		ids: [],
		projectName: "Restored",
		restore: {
			archiveId: "archive",
			createdAt: new Date("2026-01-01T00:00:00Z"),
			createdByUserId: "owner",
			id: "restore",
			manifestDigest: "digest",
			requestDigest: "request",
			restoredProjectId: "restored",
			sourceProjectId: "source",
		},
		sections: [
			{
				group: "delivery",
				name: "exportProfiles",
				digest: "d",
				sourceDigest: "d",
				recordCount: profiles.length,
				records: profiles,
			},
		],
	};
	const batches: { id: string }[][] = [];
	const tx = {
		insert: () => ({
			values: (rows: { id: string }[]) => {
				batches.push(rows);
				return Promise.resolve();
			},
		}),
	} as unknown as Tx;
	await insertArchiveDelivery(tx, record);
	expect(batches.map((batch) => batch.length)).toEqual([500, 500, 101]);
	expect(batches.flat().map((row) => row.id)).toEqual(
		profiles.map((row) => row.id)
	);
});

test("lets PostgreSQL assign decision sequences while preserving archived ordering", async () => {
	const { deliverySource } = await import(
		"./project-archive-delivery-fixtures"
	);
	const source = deliverySource();
	const [validation] = source.delivery.runtimeValidations;
	if (!validation) {
		throw new Error("Missing validation fixture");
	}
	validation.evidence = [];
	validation.decisions = [
		{
			id: "later",
			kind: "outcome",
			outcome: "pass",
			failureSource: null,
			sequence: 9,
			createdAt: "2026-01-01T00:00:00.000Z",
		},
		{
			id: "earlier",
			kind: "failure_source",
			outcome: null,
			failureSource: "asset_content",
			sequence: 4,
			createdAt: "2026-01-01T00:00:00.000Z",
		},
	];
	const sections = Object.entries(source.delivery).map(([name, rows]) => ({
		group: "delivery",
		name,
		digest: "d",
		sourceDigest: "d",
		recordCount: rows.length,
		records: rows,
	}));
	const record: StoredProjectArchiveRestoreRecord = {
		files: [],
		ids: [],
		sections,
		projectName: "Restored",
		restore: {
			archiveId: "archive",
			createdAt: new Date("2026-01-01T00:00:00Z"),
			createdByUserId: "owner",
			id: "restore",
			manifestDigest: "digest",
			requestDigest: "request",
			restoredProjectId: "restored",
			sourceProjectId: "source",
		},
	};
	let decisions: Record<string, unknown>[] = [];
	const tx = {
		insert: (table: Parameters<typeof getTableName>[0]) => ({
			values: (rows: Record<string, unknown>[]) => {
				if (getTableName(table) === "runtime_validation_decisions") {
					decisions = rows;
				}
				return Promise.resolve();
			},
		}),
	} as unknown as Tx;
	await insertArchiveDelivery(tx, record);
	expect(decisions.map((row) => row.id)).toEqual(["earlier", "later"]);
	expect(decisions.every((row) => !("sequence" in row))).toBe(true);
});

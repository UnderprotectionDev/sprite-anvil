import { expect, test } from "bun:test";
import { sha256Hex } from "@sprite-anvil/api/export-bundle-verification";
import { Hono } from "hono";
import { createProjectArchiveImportOperations } from "../project-archive-import-operations";
import { mountProjectArchiveImportRoutes } from "../project-archive-import-routes";
import type {
	ArchiveImportRequest,
	ArchiveImportRequestStorage,
} from "../project-archive-import-storage";
import { portableArchiveFixture } from "./portable-archive-fixture";
import { otherProjectId, projectId } from "./project-archive-fixtures";
import { restoreSetup } from "./project-archive-restore-fixtures";

class TestPermanentFailure extends Error {}

async function fixture(config: { enabled?: boolean; limit?: number } = {}) {
	const zip = await portableArchiveFixture();
	const sha256 = await sha256Hex(zip.zipBytes);
	const objects = new Map<string, Uint8Array>();
	const storage = {
		async put(key: string, body: ReadableStream<Uint8Array>) {
			objects.set(key, new Uint8Array(await new Response(body).arrayBuffer()));
		},
		get(key: string, range?: { offset: number; length: number }) {
			const bytes = objects.get(key);
			const part = range
				? bytes?.slice(range.offset, range.offset + range.length)
				: bytes;
			return Promise.resolve(part ? { body: new Response(part).body } : null);
		},
		delete(key: string) {
			objects.delete(key);
			return Promise.resolve();
		},
	};
	const requests = new Map<string, ArchiveImportRequest>();
	const requestStorage: ArchiveImportRequestStorage = {
		complete: (_scope, id, summary) => {
			const entry = requests.get(id);
			if (!entry) {
				throw new Error("missing request");
			}
			entry.completedSummary = summary;
			return Promise.resolve();
		},
		find: (scope, id) =>
			Promise.resolve(
				requests.get(id)?.projectId === scope
					? (requests.get(id) ?? null)
					: null
			),
		insert: (request) => {
			const existing = requests.get(request.id);
			if (existing) {
				return Promise.resolve({ status: "existing", existing });
			}
			requests.set(request.id, request);
			return Promise.resolve({ status: "inserted" });
		},
	};
	const owned = new Map<
		string,
		import("../../../../managed-object-reservations").ManagedObjectReservation
	>();
	const reservations = {
		reserve: (
			entry: import("../../../../managed-object-reservations").ManagedObjectReservation
		) => {
			owned.set(entry.objectKey, entry);
			return Promise.resolve();
		},
		markSettled: (_key: string) => Promise.resolve(),
		release: (key: string) => {
			owned.delete(key);
			return Promise.resolve();
		},
		listOwner: (ownerUserId: string) =>
			Promise.resolve(
				[...owned.values()]
					.filter((entry) => entry.ownerUserId === ownerUserId)
					.map((entry) => ({ ...entry, writeSettled: true }))
			),
	};
	const restore = restoreSetup();
	let sourceAccess = false;
	let enqueuedId = "";
	const operations = createProjectArchiveImportOperations({} as never, {
		requests: requestStorage,
		reservations,
		maxManifestBytes: 1_000_000,
		objects: storage,
		store: restore.projectArchiveRestoreStore,
		getProjectForUser: (_user, scope) => {
			if (scope === projectId) {
				sourceAccess = true;
			}
			return Promise.resolve(scope === otherProjectId ? { id: scope } : null);
		},
		operations: {
			enqueue: (request) => {
				enqueuedId = request.scopeTargetId;
				return Promise.resolve({ ...request, id: "operation" } as never);
			},
		},
		permanentFailure: (message) => new TestPermanentFailure(message),
	});
	const app = new Hono();
	mountProjectArchiveImportRoutes(app, {
		enabled: config.enabled ?? true,
		operations,
		getSession: async (headers) =>
			headers.has("authorization") ? { user: { id: "user-1" } } : null,
	});
	const send = (
		options: {
			scope?: string;
			authorized?: boolean;
			digest?: string;
			noDigest?: boolean;
			bytes?: Uint8Array;
		} = {}
	) =>
		app.request(
			`/api/projects/${options.scope ?? otherProjectId}/project-archives/import`,
			{
				method: "POST",
				headers: {
					...(options.authorized === false ? {} : { authorization: "yes" }),
					"Idempotency-Key": "portable-key",
					"X-Project-Archive-Size": String(
						(options.bytes ?? zip.zipBytes).length
					),
					...(options.noDigest
						? {}
						: { "X-Project-Archive-SHA256": options.digest ?? sha256 }),
					"X-Project-Archive-Name": "Recovered",
				},
				body: options.bytes ?? zip.zipBytes,
			}
		);
	return {
		zip,
		app,
		operations,
		send,
		objects,
		storage,
		requestStorage,
		reservations,
		restore,
		getSourceAccess: () => sourceAccess,
		getEnqueuedId: () => enqueuedId,
	};
}

test("uploads and durably restores an exact ZIP without access to its source project", async () => {
	const f = await fixture();
	expect((await f.send()).status).toBe(202);
	const id = f.getEnqueuedId();
	const result = await f.operations.execute({
		operation: { projectId: otherProjectId, scopeTargetId: id },
	});
	expect(result).toContain("created");
	expect(
		[...f.objects.keys()].filter((key) => key.endsWith("/archive.zip"))
	).toEqual([]);
	expect(f.getSourceAccess()).toBe(false);
	expect(f.restore.memory.projects.size).toBe(1);
	const [restored] = f.restore.memory.restores.values();
	expect(restored?.restore.sourceProjectId).toBe(projectId);
	expect((await f.send()).status).toBe(202);
	expect(
		await f.operations.execute({
			operation: { projectId: otherProjectId, scopeTargetId: id },
		})
	).toContain("replayed");
	expect(f.restore.memory.projects.size).toBe(1);
});

test("rejects unauthorized scope and corrupt upload without publishing a request", async () => {
	const f = await fixture();
	expect((await f.send({ authorized: false })).status).toBe(401);
	expect((await f.send({ scope: projectId })).status).toBe(404);
	expect((await f.send({ digest: "0".repeat(64) })).status).toBe(503);
	expect(f.getEnqueuedId()).toBe("");
	expect(f.restore.memory.projects.size).toBe(0);
});

test("hashes an upload without a digest header and rejects changed bytes on replay", async () => {
	const f = await fixture();
	expect((await f.send({ noDigest: true })).status).toBe(202);
	const changed = f.zip.zipBytes.slice();
	changed[0] = ((changed[0] ?? 0) + 1) % 256;
	expect((await f.send({ noDigest: true, bytes: changed })).status).toBe(409);
});

test("a ZIP with corrupt embedded file never publishes a restored project", async () => {
	const f = await fixture();
	const { readPortableArchive } = await import("../portable-archive-reader");
	const parsed = await readPortableArchive({
		maxManifestBytes: 1_000_000,
		byteSize: f.zip.zipBytes.length,
		range: f.zip.range,
	});
	const [entry] = parsed.files;
	if (!entry) {
		throw new Error("Missing ZIP file");
	}
	const damaged = f.zip.zipBytes.slice();
	damaged[entry.entry.dataOffset] = 99;
	expect((await f.send({ noDigest: true, bytes: damaged })).status).toBe(202);
	await expect(
		f.operations.execute({
			operation: {
				projectId: otherProjectId,
				scopeTargetId: f.getEnqueuedId(),
			},
		})
	).rejects.toBeInstanceOf(TestPermanentFailure);
	expect(f.restore.memory.projects.size).toBe(0);
	expect([...f.objects.keys()]).toHaveLength(0);
});

test("does not accept a ZIP when the manifest limit is not configured", async () => {
	const f = await fixture({ enabled: false });
	expect((await f.send()).status).toBe(503);
	expect(f.objects.size).toBe(0);
	expect(f.getEnqueuedId()).toBe("");
});

test("a worker without the configured limit leaves staged requests retryable", async () => {
	const f = await fixture();
	expect((await f.send()).status).toBe(202);
	const worker = createProjectArchiveImportOperations({} as never, {
		requests: f.requestStorage,
		reservations: f.reservations,
		objects: f.storage,
		store: f.restore.projectArchiveRestoreStore,
		getProjectForUser: () => Promise.resolve({ id: otherProjectId }),
		operations: { enqueue: () => Promise.reject(new Error("unused")) },
		permanentFailure: (message) => new Error(`permanent: ${message}`),
	});
	await expect(
		worker.execute({
			operation: {
				projectId: otherProjectId,
				scopeTargetId: f.getEnqueuedId(),
			},
		})
	).rejects.toThrow("Project Archive import is not configured");
	expect(f.objects.size).toBe(1);
	expect(f.restore.memory.projects.size).toBe(0);
});

test("retains ownership when the ZIP write result is uncertain", async () => {
	const f = await fixture();
	f.storage.put = (key, _body) => {
		f.objects.set(key, new Uint8Array([1]));
		return Promise.reject(new Error("write outcome unknown"));
	};
	expect((await f.send()).status).toBe(503);
	const owned = await f.reservations.listOwner("user-1");
	expect(owned).toHaveLength(1);
	expect(f.objects.has(owned[0]?.objectKey ?? "")).toBe(true);
});

test("retries acknowledged ZIP cleanup before replaying a completed restore", async () => {
	const f = await fixture();
	expect((await f.send()).status).toBe(202);
	const id = f.getEnqueuedId();
	const remove = f.storage.delete;
	let fail = true;
	f.storage.delete = (key) => {
		if (key.endsWith("/archive.zip") && fail) {
			fail = false;
			return Promise.reject(new Error("delete unavailable"));
		}
		return remove(key);
	};
	const operation = { projectId: otherProjectId, scopeTargetId: id };
	await expect(f.operations.execute({ operation })).rejects.toThrow(
		"delete unavailable"
	);
	expect(
		(await f.reservations.listOwner("user-1")).some(
			(entry) => entry.purpose === "archive_import_zip"
		)
	).toBe(true);
	expect(await f.operations.execute({ operation })).toContain("replayed");
	expect(
		(await f.reservations.listOwner("user-1")).some(
			(entry) => entry.purpose === "archive_import_zip"
		)
	).toBe(false);
	expect(f.restore.memory.projects.size).toBe(1);
});

test("never deletes an upload whose settled acknowledgement is missing", async () => {
	const f = await fixture();
	expect((await f.send()).status).toBe(202);
	const list = f.reservations.listOwner;
	f.reservations.listOwner = async (owner) =>
		(await list(owner)).map((item) => ({ ...item, writeSettled: false }));
	await expect(
		f.operations.execute({
			operation: {
				projectId: otherProjectId,
				scopeTargetId: f.getEnqueuedId(),
			},
		})
	).rejects.toThrow("upload outcome is unknown");
	expect(
		[...f.objects.keys()].some((key) => key.endsWith("/archive.zip"))
	).toBe(true);
});

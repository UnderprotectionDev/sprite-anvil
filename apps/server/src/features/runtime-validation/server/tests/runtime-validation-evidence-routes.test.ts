import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import {
	type RuntimeValidationEvidence,
	runtimeValidationEvidenceFileLimitBytes,
} from "@sprite-anvil/api/runtime-validation";
import type { Database } from "@sprite-anvil/db";
import { Hono } from "hono";
import { mountRuntimeValidationEvidenceRoutes } from "../runtime-validation-evidence-routes";
import { createRuntimeValidationStore } from "../runtime-validation-store";
import { createMemoryRuntimeValidationStorage } from "./memory-runtime-validation-storage";

const projectId = "00c1bc3a-8c39-436a-892e-0c3a6d37aed2";
const otherProjectId = "00c1bc3a-8c39-436a-892e-0c3a6d37aed3";
const bundleId = "a7301990-3d79-49c8-887a-c1fa9a468f85";
const manifestDigest = "d".repeat(64);
const uploadPath = (recordId: string, project = projectId) =>
	`/api/projects/${project}/runtime-validation-records/${recordId}/evidence-file`;
const downloadPath = (
	recordId: string,
	evidenceId: string,
	project = projectId
) =>
	`/api/projects/${project}/runtime-validation-records/${recordId}/evidence/${evidenceId}/file`;
const owner = { Authorization: "Bearer owner" };
interface UploadBody {
	evidence: RuntimeValidationEvidence;
	status: string;
}

function createTestServer() {
	const objects = new Map<string, { body: Uint8Array; contentType: string }>();
	const storage = {
		delete(key: string) {
			objects.delete(key);
			return Promise.resolve();
		},
		get(key: string) {
			const found = objects.get(key);
			return Promise.resolve(
				found
					? {
							body: new Blob([found.body]).stream(),
							contentLength: found.body.byteLength,
							contentType: found.contentType,
						}
					: null
			);
		},
		async put(
			key: string,
			body: ReadableStream<Uint8Array>,
			contentType: string
		) {
			objects.set(key, {
				body: new Uint8Array(await new Response(body).arrayBuffer()),
				contentType,
			});
		},
	};
	const runtimeValidationStore = createRuntimeValidationStore({} as Database, {
		getBundle: (_userId, requestedProjectId, requestedBundleId) =>
			Promise.resolve(
				requestedProjectId === projectId && requestedBundleId === bundleId
					? { manifestDigest }
					: null
			),
		getProjectForUser: (userId, requestedProjectId) =>
			Promise.resolve(
				userId === "owner-user" &&
					[projectId, otherProjectId].includes(requestedProjectId)
					? { id: requestedProjectId }
					: null
			),
		storage: createMemoryRuntimeValidationStorage(),
	});
	const app = new Hono();
	app.onError(() => new Response(null, { status: 500 }));
	mountRuntimeValidationEvidenceRoutes(app, {
		createStorage: () => storage,
		getSession: (headers) =>
			Promise.resolve(
				headers.get("Authorization") === "Bearer owner"
					? { user: { id: "owner-user" } }
					: null
			),
		runtimeValidationStore,
	});
	return {
		app,
		createRecord: async () => {
			const result = await runtimeValidationStore.create("owner-user", {
				adapterVersion: null,
				bundleId,
				engineVersion: "Godot 4.4.1",
				gameBuild: "build-1",
				idempotencyKey: "record-key",
				projectId,
				supersedesRecordId: null,
			});
			if (result?.status !== "created") {
				throw new Error("The test record was not created.");
			}
			return result.record.id;
		},
		objects,
		store: runtimeValidationStore,
	};
}

function uploadForm(
	bytes: Uint8Array | string = "frame bytes",
	fields: Record<string, string> = {}
) {
	const form = new FormData();
	form.set("idempotencyKey", fields.idempotencyKey ?? "file-key-1");
	form.set("kind", fields.kind ?? "screenshot");
	form.set("source", fields.source ?? "manual");
	form.set("file", new File([bytes], "hero.png", { type: "image/png" }));
	for (const [name, value] of Object.entries(fields)) {
		if (!["idempotencyKey", "kind", "source"].includes(name)) {
			form.set(name, value);
		}
	}
	return form;
}

test("an uploaded screenshot is stored with its server digest, linked to the record, re-read and downloaded privately", async () => {
	const server = createTestServer();
	const recordId = await server.createRecord();
	const response = await server.app.request(uploadPath(recordId), {
		body: uploadForm("frame bytes"),
		headers: owner,
		method: "POST",
	});
	const body = (await response.json()) as UploadBody;

	expect(response.status).toBe(201);
	expect(body).toMatchObject({
		evidence: {
			file: {
				byteSize: 11,
				fileName: "hero.png",
				sha256: createHash("sha256").update("frame bytes").digest("hex"),
			},
			kind: "screenshot",
			source: "manual",
			text: null,
		},
		status: "created",
	});
	expect(JSON.stringify(body)).not.toContain("objectKey");
	expect(server.objects.size).toBe(1);

	const reread = await server.store.get("owner-user", projectId, recordId);
	expect(reread?.evidence).toEqual([body.evidence]);

	const download = await server.app.request(
		downloadPath(recordId, body.evidence.id),
		{ headers: owner }
	);
	expect(download.status).toBe(200);
	expect(download.headers.get("Cache-Control")).toBe("private, no-store");
	expect(download.headers.get("X-Content-Type-Options")).toBe("nosniff");
	expect(await download.text()).toBe("frame bytes");
});

test("a repeated key replays the file evidence and a changed file under the same key is a conflict", async () => {
	const server = createTestServer();
	const recordId = await server.createRecord();
	const send = (bytes: string) =>
		server.app.request(uploadPath(recordId), {
			body: uploadForm(bytes),
			headers: owner,
			method: "POST",
		});
	const first = await send("frame bytes");
	const replay = await send("frame bytes");
	expect(replay.status).toBe(201);
	expect(((await replay.json()) as UploadBody).status).toBe("replayed");
	expect(server.objects.size).toBe(1);

	const changed = await send("other bytes");
	expect(changed.status).toBe(409);
	// the rejected upload leaves no orphan object and the first evidence untouched
	expect(server.objects.size).toBe(1);
	expect(
		(await server.store.get("owner-user", projectId, recordId))?.evidence
	).toEqual([((await first.json()) as UploadBody).evidence]);
});

test("an oversized, empty or malformed upload stores nothing", async () => {
	const server = createTestServer();
	const recordId = await server.createRecord();
	const send = (form: FormData) =>
		server.app.request(uploadPath(recordId), {
			body: form,
			headers: owner,
			method: "POST",
		});

	const oversized = await send(
		uploadForm(new Uint8Array(runtimeValidationEvidenceFileLimitBytes + 1))
	);
	expect(oversized.status).toBe(413);
	expect((await send(uploadForm(""))).status).toBe(400);
	expect((await send(uploadForm("x", { kind: "observation" }))).status).toBe(
		400
	);
	expect((await send(uploadForm("x", { source: "robot" }))).status).toBe(400);
	expect((await send(uploadForm("x", { idempotencyKey: " " }))).status).toBe(
		400
	);
	const missingFile = new FormData();
	missingFile.set("idempotencyKey", "k");
	missingFile.set("kind", "recording");
	missingFile.set("source", "manual");
	expect((await send(missingFile)).status).toBe(400);

	expect(server.objects.size).toBe(0);
	expect(
		(await server.store.get("owner-user", projectId, recordId))?.evidence
	).toEqual([]);
});

test("a file at exactly the 5 MiB limit is accepted", async () => {
	const server = createTestServer();
	const recordId = await server.createRecord();
	const response = await server.app.request(uploadPath(recordId), {
		body: uploadForm(new Uint8Array(runtimeValidationEvidenceFileLimitBytes)),
		headers: owner,
		method: "POST",
	});
	expect(response.status).toBe(201);
});

test("an unauthenticated caller, another project or an unknown record reaches nothing", async () => {
	const server = createTestServer();
	const recordId = await server.createRecord();
	const unknownRecordId = "a7301990-3d79-49c8-887a-c1fa9a468f99";
	const post = (path: string, headers: Record<string, string>) =>
		server.app.request(path, {
			body: uploadForm(),
			headers,
			method: "POST",
		});

	expect((await post(uploadPath(recordId), {})).status).toBe(401);
	expect(
		(await post(uploadPath(recordId), { Authorization: "Bearer other" })).status
	).toBe(401);
	expect((await post(uploadPath(unknownRecordId), owner)).status).toBe(404);
	expect((await post(uploadPath(recordId, otherProjectId), owner)).status).toBe(
		404
	);
	expect(
		(
			await post(
				"/api/projects/not-a-uuid/runtime-validation-records/x/evidence-file",
				owner
			)
		).status
	).toBe(404);
	expect(server.objects.size).toBe(0);

	const uploaded = await server.app.request(uploadPath(recordId), {
		body: uploadForm(),
		headers: owner,
		method: "POST",
	});
	const { evidence } = (await uploaded.json()) as UploadBody;
	expect(
		(await server.app.request(downloadPath(recordId, evidence.id))).status
	).toBe(401);
	expect(
		(
			await server.app.request(
				downloadPath(recordId, evidence.id, otherProjectId),
				{ headers: owner }
			)
		).status
	).toBe(404);
});

test("evidence whose stored bytes no longer match the recorded digest is not downloaded", async () => {
	const server = createTestServer();
	const recordId = await server.createRecord();
	const uploaded = await server.app.request(uploadPath(recordId), {
		body: uploadForm("frame bytes"),
		headers: owner,
		method: "POST",
	});
	const { evidence } = (await uploaded.json()) as UploadBody;
	for (const object of server.objects.values()) {
		object.body[0] = 0;
	}
	const download = await server.app.request(
		downloadPath(recordId, evidence.id),
		{ headers: owner }
	);
	expect(download.status).toBe(502);
});

test("an upload to a record that already has an outcome is refused and leaves no object", async () => {
	const server = createTestServer();
	const recordId = await server.createRecord();
	await server.store.finalizeOutcome("owner-user", {
		idempotencyKey: "outcome-key",
		outcome: "pass",
		projectId,
		recordId,
	});
	const response = await server.app.request(uploadPath(recordId), {
		body: uploadForm(),
		headers: owner,
		method: "POST",
	});
	expect(response.status).toBe(409);
	// distinct from the idempotency conflict, so the web can say which one happened
	expect(await response.json()).toMatchObject({
		error: "Runtime validation evidence is closed once the outcome is final",
	});
	expect(server.objects.size).toBe(0);
});

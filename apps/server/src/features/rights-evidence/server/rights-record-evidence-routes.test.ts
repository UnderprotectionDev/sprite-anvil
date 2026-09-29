import { expect, test } from "bun:test";
import type {
	RightsRecord,
	RightsRecordStore,
} from "@sprite-anvil/api/rights-records";
import { rightsRecordEvidenceFileLimitBytes } from "@sprite-anvil/api/rights-records";
import { Hono } from "hono";
import { mountRightsRecordEvidenceRoutes } from "./rights-record-evidence-routes";

const projectId = "00c1bc3a-8c39-436a-892e-0c3a6d37aed2";
const assetRecordId = "a7301990-3d79-49c8-887a-c1fa9a468f85";
const rightsRecordId = "3d9d07a4-37af-43d6-8583-e2256baf0a58";
const route = `/api/projects/${projectId}/asset-records/${assetRecordId}/rights-records/${rightsRecordId}/evidence-file`;
const referenceId = "fcd2bb54-60fd-4555-bc6f-a30a1c2e4dd4";
const referenceRoute = `/api/projects/${projectId}/asset-records/${assetRecordId}/references/${referenceId}/rights-records/${rightsRecordId}/evidence-file`;

function createTestServer(
	owner = true,
	simulateDatabaseError = false,
	allowedReferenceId: string | null = null
) {
	let savedRecord: RightsRecord | null = null;
	let storedObject: {
		body: Uint8Array;
		contentLength: number;
		contentType: string;
		key: string;
	} | null = null;
	const storage = {
		delete(key: string) {
			if (storedObject?.key === key) {
				storedObject = null;
			}
			return Promise.resolve();
		},
		get(key: string) {
			if (storedObject?.key !== key) {
				return Promise.resolve(null);
			}
			return Promise.resolve({
				body: new Blob([storedObject.body]).stream(),
				contentLength: storedObject.contentLength,
				contentType: storedObject.contentType,
			});
		},
		async put(
			key: string,
			body: ReadableStream<Uint8Array>,
			contentType: "image/png" | "image/webp" | "application/octet-stream",
			contentLength?: number
		) {
			const bytes = new Uint8Array(await new Response(body).arrayBuffer());
			storedObject = {
				body: bytes,
				contentLength: contentLength ?? bytes.byteLength,
				contentType,
				key,
			};
		},
	};
	const rightsRecordStore: Pick<
		RightsRecordStore,
		| "canAccessAssetRecord"
		| "canAccessReference"
		| "createRevisionWithEvidenceFile"
		| "getEvidenceFile"
	> = {
		canAccessAssetRecord(userId) {
			return Promise.resolve(owner && userId === "owner-user");
		},
		canAccessReference(
			userId,
			_projectId,
			_assetRecordId,
			requestedReferenceId
		) {
			return Promise.resolve(
				owner &&
					userId === "owner-user" &&
					requestedReferenceId === allowedReferenceId
			);
		},
		createRevisionWithEvidenceFile(_userId, input) {
			if (simulateDatabaseError) {
				throw new Error("Database response was lost after commit");
			}
			savedRecord = {
				...input,
				referenceId: input.referenceId ?? null,
				createdAt: "2026-09-29T10:00:00.000Z",
				evidenceFile: {
					contentLength: input.evidenceFile.contentLength,
					fileName: input.evidenceFile.fileName,
					sha256: input.evidenceFile.sha256,
					sourceContentType: input.evidenceFile.sourceContentType,
				},
				versionNumber: 1,
			};
			return Promise.resolve({ ok: true as const, record: savedRecord });
		},
		getEvidenceFile(
			userId,
			_projectId,
			_assetRecordId,
			requestedReferenceId,
			id
		) {
			if (simulateDatabaseError) {
				throw new Error("Database is temporarily unavailable");
			}
			if (
				userId !== "owner-user" ||
				!savedRecord ||
				savedRecord.id !== id ||
				(savedRecord.referenceId ?? null) !== requestedReferenceId ||
				!savedRecord.evidenceFile ||
				!storedObject
			) {
				return Promise.resolve(null);
			}
			return Promise.resolve({
				...savedRecord.evidenceFile,
				objectKey: storedObject.key,
			});
		},
	};
	const app = new Hono();
	app.onError(() => new Response(null, { status: 500 }));
	mountRightsRecordEvidenceRoutes(app, {
		createStorage: () => storage,
		getSession: async (headers) =>
			headers.get("Authorization") === "Bearer owner"
				? { user: { id: "owner-user" } }
				: null,
		rightsRecordStore,
	});
	return {
		app,
		corruptStoredObject() {
			if (storedObject) {
				storedObject.body[0] = (storedObject.body[0] ?? 0) === 0 ? 1 : 0;
			}
		},
		getSavedRecord: () => savedRecord,
		getStoredObject: () => storedObject,
	};
}

function createUploadForm(targetReferenceId: string | null = null) {
	const formData = new FormData();
	const rightsRecord: Record<string, unknown> = {
		assetRecordId,
		assertedScope: "Paid game releases",
		evidence: null,
		id: rightsRecordId,
		projectId,
		restrictions: null,
		rightsHolderOrProvider: "Example Studio",
		source: "https://example.test/source",
		state: "documented",
		uncertainty: null,
	};
	if (targetReferenceId) {
		rightsRecord.referenceId = targetReferenceId;
	}
	formData.set("rightsRecord", JSON.stringify(rightsRecord));
	formData.set(
		"evidenceFile",
		new File(["license evidence"], "license.pdf", {
			type: "application/pdf",
		})
	);
	return formData;
}

test("stores and privately rereads a file as immutable Rights Record evidence", async () => {
	const server = createTestServer();
	const uploadResponse = await server.app.request(route, {
		body: createUploadForm(),
		headers: { Authorization: "Bearer owner" },
		method: "POST",
	});
	const uploadedRecord = await uploadResponse.json();

	expect(uploadResponse.status).toBe(201);
	expect(uploadedRecord).toMatchObject({
		evidence: null,
		evidenceFile: {
			contentLength: 16,
			fileName: "license.pdf",
			sourceContentType: "application/pdf",
		},
		state: "documented",
	});
	expect(server.getSavedRecord()).toMatchObject({ versionNumber: 1 });
	expect(server.getStoredObject()).toMatchObject({
		contentType: "application/octet-stream",
	});

	const downloadResponse = await server.app.request(route, {
		headers: { Authorization: "Bearer owner" },
	});
	expect(downloadResponse.status).toBe(200);
	expect(downloadResponse.headers.get("Cache-Control")).toBe(
		"private, no-store"
	);
	expect(downloadResponse.headers.get("Content-Type")).toBe(
		"application/octet-stream"
	);
	expect(downloadResponse.headers.get("X-Content-Type-Options")).toBe(
		"nosniff"
	);
	expect(downloadResponse.headers.get("Content-Disposition")).toContain(
		"license.pdf"
	);
	expect(await downloadResponse.text()).toBe("license evidence");
});

test("rejects corrupted evidence before starting the download response", async () => {
	const server = createTestServer();
	const uploadResponse = await server.app.request(route, {
		body: createUploadForm(),
		headers: { Authorization: "Bearer owner" },
		method: "POST",
	});
	expect(uploadResponse.status).toBe(201);
	server.corruptStoredObject();

	const downloadResponse = await server.app.request(route, {
		headers: { Authorization: "Bearer owner" },
	});

	expect(downloadResponse.status).toBe(502);
	expect(await downloadResponse.json()).toEqual({
		error: "Rights Record evidence integrity check failed",
	});
});

test("stores and downloads evidence through a reference image Rights Record route", async () => {
	const server = createTestServer(true, false, referenceId);
	const uploadResponse = await server.app.request(referenceRoute, {
		body: createUploadForm(referenceId),
		headers: { Authorization: "Bearer owner" },
		method: "POST",
	});

	expect(uploadResponse.status).toBe(201);
	expect(server.getSavedRecord()).toMatchObject({ referenceId });

	const downloadResponse = await server.app.request(referenceRoute, {
		headers: { Authorization: "Bearer owner" },
	});
	expect(downloadResponse.status).toBe(200);
	expect(await downloadResponse.text()).toBe("license evidence");
});

test("rejects a reference evidence upload whose body names another target", async () => {
	const server = createTestServer(true, false, referenceId);
	const uploadResponse = await server.app.request(referenceRoute, {
		body: createUploadForm(),
		headers: { Authorization: "Bearer owner" },
		method: "POST",
	});

	expect(uploadResponse.status).toBe(400);
	expect(server.getStoredObject()).toBeNull();
});

test("hides reference Rights Record files when the reference is outside the Asset Record", async () => {
	const server = createTestServer();
	const uploadResponse = await server.app.request(referenceRoute, {
		body: createUploadForm(referenceId),
		headers: { Authorization: "Bearer owner" },
		method: "POST",
	});
	const downloadResponse = await server.app.request(referenceRoute, {
		headers: { Authorization: "Bearer owner" },
	});

	expect(uploadResponse.status).toBe(404);
	expect(downloadResponse.status).toBe(404);
	expect(server.getStoredObject()).toBeNull();
});

test("requires project-owner authentication before uploading or downloading evidence", async () => {
	const nonOwnerServer = createTestServer(false);
	const nonOwnerUploadResponse = await nonOwnerServer.app.request(route, {
		body: createUploadForm(),
		headers: { Authorization: "Bearer owner" },
		method: "POST",
	});
	const unauthenticatedServer = createTestServer();
	const unauthenticatedUploadResponse = await unauthenticatedServer.app.request(
		route,
		{ body: createUploadForm(), method: "POST" }
	);
	const unauthenticatedDownloadResponse =
		await unauthenticatedServer.app.request(route);

	expect(nonOwnerUploadResponse.status).toBe(404);
	expect(unauthenticatedUploadResponse.status).toBe(401);
	expect(unauthenticatedDownloadResponse.status).toBe(401);
	expect(nonOwnerServer.getStoredObject()).toBeNull();
	expect(unauthenticatedServer.getStoredObject()).toBeNull();
});

test("rejects oversized evidence files before storage", async () => {
	const server = createTestServer();
	const formData = createUploadForm();
	formData.set(
		"evidenceFile",
		new File(
			[new Uint8Array(rightsRecordEvidenceFileLimitBytes + 1)],
			"oversized.pdf",
			{ type: "application/pdf" }
		)
	);
	const uploadResponse = await server.app.request(route, {
		body: formData,
		headers: { Authorization: "Bearer owner" },
		method: "POST",
	});

	expect(uploadResponse.status).toBe(413);
	expect(server.getStoredObject()).toBeNull();
});

test("accepts a maximum-size evidence file with maximum-length Unicode fields", async () => {
	const server = createTestServer();
	const formData = createUploadForm();
	const maximumField = "界".repeat(5000);
	const rightsRecord = JSON.parse(
		formData.get("rightsRecord") as string
	) as Record<string, unknown>;
	for (const field of [
		"assertedScope",
		"evidence",
		"restrictions",
		"rightsHolderOrProvider",
		"source",
		"uncertainty",
	]) {
		rightsRecord[field] = maximumField;
	}
	formData.set("rightsRecord", JSON.stringify(rightsRecord));
	formData.set(
		"evidenceFile",
		new File(
			[new Uint8Array(rightsRecordEvidenceFileLimitBytes)],
			"maximum.pdf",
			{ type: "application/pdf" }
		)
	);

	const uploadResponse = await server.app.request(route, {
		body: formData,
		headers: { Authorization: "Bearer owner" },
		method: "POST",
	});

	expect(uploadResponse.status).toBe(201);
	expect(server.getStoredObject()?.contentLength).toBe(
		rightsRecordEvidenceFileLimitBytes
	);
});

test("keeps an uploaded object when the database write outcome is unknown", async () => {
	const server = createTestServer(true, true);
	const uploadResponse = await server.app.request(route, {
		body: createUploadForm(),
		headers: { Authorization: "Bearer owner" },
		method: "POST",
	});

	expect(uploadResponse.status).toBe(500);
	expect(server.getStoredObject()).not.toBeNull();
});

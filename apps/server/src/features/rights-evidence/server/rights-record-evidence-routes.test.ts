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

function createTestServer(owner = true, simulateDatabaseError = false) {
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
		| "createRevisionWithEvidenceFile"
		| "getEvidenceFile"
	> = {
		canAccessAssetRecord(userId) {
			return Promise.resolve(owner && userId === "owner-user");
		},
		createRevisionWithEvidenceFile(_userId, input) {
			if (simulateDatabaseError) {
				throw new Error("Database response was lost after commit");
			}
			savedRecord = {
				...input,
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
		getEvidenceFile(userId, _projectId, _assetRecordId, id) {
			if (simulateDatabaseError) {
				throw new Error("Database is temporarily unavailable");
			}
			if (
				userId !== "owner-user" ||
				!savedRecord ||
				savedRecord.id !== id ||
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
		getSavedRecord: () => savedRecord,
		getStoredObject: () => storedObject,
	};
}

function createUploadForm() {
	const formData = new FormData();
	formData.set(
		"rightsRecord",
		JSON.stringify({
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
		})
	);
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

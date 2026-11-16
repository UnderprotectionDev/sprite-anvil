import { expect, test } from "bun:test";
import { sha256Hex } from "@sprite-anvil/api/export-bundle-verification";
import { strFromU8, unzipSync } from "fflate";
import { Hono } from "hono";
import { mountProjectArchiveDownloadRoutes } from "../project-archive-download-routes";
import type { ProjectArchiveStorage } from "../project-archive-storage";
import { foundationSource, projectId, setup } from "./project-archive-fixtures";

async function fixture(
	options: {
		byteSize?: number;
		twoLargeFiles?: boolean;
		secondReadCorrupt?: boolean;
		streaming?: boolean;
	} = {}
) {
	const bytes = options.streaming
		? new Uint8Array(1024 * 1024).fill(42)
		: new TextEncoder().encode("pinned bytes");
	const source = foundationSource();
	source.records.managedSnapshots = [];
	source.records.assetVersions = source.records.assetVersions.slice(
		0,
		options.twoLargeFiles ? 2 : 1
	);
	if (!options.twoLargeFiles) {
		source.records.unitVersions = [];
	}
	const sha256 = await sha256Hex(bytes);
	source.records.assetVersions = source.records.assetVersions.map(
		(version) => ({
			...version,
			byteSize: options.byteSize ?? bytes.length,
			contentDigest: sha256,
		})
	);
	source.files = source.files
		.slice(0, options.twoLargeFiles ? 2 : 1)
		.map((file) => ({
			...file,
			byteSize: options.byteSize ?? bytes.length,
			sha256,
		}));
	let storage!: ProjectArchiveStorage;
	const { create } = setup({
		source,
		wrapStorage: (value) => {
			storage = value;
			return value;
		},
	});
	const { archive } = await create();
	let object: Uint8Array | null = bytes;
	let reads = 0;
	let secondReadChunks = 0;
	let secondReadCancelled = false;
	const app = new Hono();
	mountProjectArchiveDownloadRoutes(app, {
		getSession: async (headers) =>
			headers.has("authorization") ? { user: { id: "owner" } } : null,
		getProjectForUser: async (user, project) =>
			user === "owner" && project === projectId ? { id: project } : null,
		archives: storage,
		objects: {
			get: () => {
				reads += 1;
				const value =
					options.secondReadCorrupt && reads === 2
						? new TextEncoder().encode("wrong bytes!")
						: object;
				if (!value) {
					return Promise.resolve(null);
				}
				const currentRead = reads;
				let offset = 0;
				const body = new ReadableStream<Uint8Array>(
					{
						cancel() {
							if (currentRead === 2) {
								secondReadCancelled = true;
							}
						},
						pull(controller) {
							if (offset >= value.length) {
								controller.close();
								return;
							}
							if (currentRead === 2) {
								secondReadChunks += 1;
							}
							controller.enqueue(value.subarray(offset, offset + 16_384));
							offset += 16_384;
						},
					},
					{ highWaterMark: 0 }
				);
				return Promise.resolve({ body });
			},
		},
	});
	const request = (project = projectId, authorized = true) =>
		app.request(
			`/api/projects/${project}/project-archives/${archive.id}/content`,
			{ headers: authorized ? { authorization: "yes" } : {} }
		);
	return {
		archive,
		bytes,
		getReads: () => reads,
		getSecondReadChunks: () => secondReadChunks,
		getSecondReadCancelled: () => secondReadCancelled,
		request,
		setObject: (value: Uint8Array | null) => {
			object = value;
		},
	};
}

test("downloads a portable archive with verified bytes and no storage keys", async () => {
	const { archive, bytes, request } = await fixture();
	const response = await request();
	expect(response.status).toBe(200);
	expect(response.headers.get("content-type")).toBe("application/zip");
	const entries = unzipSync(new Uint8Array(await response.arrayBuffer()));
	const archiveBytes = entries["archive.json"];
	if (!archiveBytes) {
		throw new Error("Missing archive.json");
	}
	expect(JSON.parse(strFromU8(archiveBytes))).toEqual(archive);
	const fileEntries = Object.entries(entries).filter(([name]) =>
		name.startsWith("files/")
	);
	expect(fileEntries).toHaveLength(1);
	expect(fileEntries[0]?.[1]).toEqual(bytes);
	expect(Object.keys(entries).join()).not.toContain("projects/p/");
	expect(strFromU8(archiveBytes)).not.toContain("projects/p/");
});

test("rejects missing or corrupt bytes before returning a ZIP", async () => {
	const { request, setObject } = await fixture();
	setObject(null);
	expect((await request()).status).toBe(502);
	setObject(new TextEncoder().encode("wrong bytes!"));
	expect((await request()).status).toBe(502);
});

test("denies unauthenticated and foreign project requests", async () => {
	const { request } = await fixture();
	expect((await request(projectId, false)).status).toBe(401);
	expect((await request("foreign-project")).status).toBe(404);
});

test("rechecks the object while streaming and terminates a changed download", async () => {
	const { request, getReads } = await fixture({ secondReadCorrupt: true });
	const response = await request();
	expect(response.status).toBe(200);
	await expect(response.arrayBuffer()).rejects.toThrow();
	expect(getReads()).toBe(2);
});

test("streams file chunks on demand after the complete verification pass", async () => {
	const { request, getSecondReadChunks, getSecondReadCancelled } =
		await fixture({ streaming: true });
	const response = await request();
	expect(response.status).toBe(200);
	const reader = response.body?.getReader();
	if (!reader) {
		throw new Error("Missing stream");
	}
	while (getSecondReadChunks() === 0) {
		// biome-ignore lint/performance/noAwaitInLoops: Read sequentially until the first file chunk.
		const part = await reader.read();
		if (part.done) {
			throw new Error("Missing file bytes");
		}
	}
	expect(getSecondReadChunks()).toBeLessThan(64);
	await reader.cancel();
	expect(getSecondReadCancelled()).toBe(true);
});

test("enforces classic ZIP field boundaries", async () => {
	const { fitsClassicZip } = await import("../project-archive-download-routes");
	const maximumPayload = 0xff_ff_ff_fe - 47;
	expect(fitsClassicZip([{ name: "x", byteSize: maximumPayload }])).toBe(true);
	expect(fitsClassicZip([{ name: "x", byteSize: maximumPayload + 1 }])).toBe(
		false
	);
	expect(fitsClassicZip([{ name: "x", byteSize: 0xff_ff_ff_ff }])).toBe(false);
	expect(fitsClassicZip([{ name: "x".repeat(65_535), byteSize: 1 }])).toBe(
		true
	);
	expect(fitsClassicZip([{ name: "x".repeat(65_536), byteSize: 1 }])).toBe(
		false
	);
	expect(
		fitsClassicZip(
			Array.from({ length: 65_534 }, () => ({ name: "x", byteSize: 1 }))
		)
	).toBe(true);
	expect(
		fitsClassicZip(
			Array.from({ length: 65_535 }, () => ({ name: "x", byteSize: 1 }))
		)
	).toBe(false);
	expect(
		fitsClassicZip([
			{ name: "x", byteSize: maximumPayload - 47 },
			{ name: "y", byteSize: 1 },
		])
	).toBe(false);
});

test("reports the ZIP format limit before reading file content", async () => {
	const { request, getReads } = await fixture({
		byteSize: 2_147_483_647,
		twoLargeFiles: true,
	});
	const response = await request();
	expect(response.status).toBe(413);
	expect(await response.json()).toMatchObject({
		error: "Project Archive exceeds ZIP format limits",
	});
	expect(getReads()).toBe(0);
});

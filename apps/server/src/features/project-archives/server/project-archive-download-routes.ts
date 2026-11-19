import { strToU8, Zip, ZipPassThrough } from "fflate";
import type { Hono } from "hono";
import { serializePublicApiError } from "../../../output-contracts";
import type { ObjectReader } from "./object-file-bytes";
import { verifiedObjectChunks } from "./object-file-bytes";
import type {
	ProjectArchiveStorage,
	StoredProjectArchiveFile,
	StoredProjectArchiveRecord,
} from "./project-archive-storage";
import { integrityFailure, toArchive } from "./project-archive-store";

interface ProjectArchiveDownloadDependencies {
	archives: ProjectArchiveStorage;
	getProjectForUser: (
		userId: string,
		projectId: string
	) => Promise<{ id: string } | null>;
	getSession: (headers: Headers) => Promise<{ user: { id: string } } | null>;
	objects: ObjectReader | null;
}

/** The source id is UTF-8 encoded as hex so even untrusted ids cannot create ZIP paths. */
function filePath(kind: string, sourceId: string) {
	return `files/${kind}/${Buffer.from(sourceId, "utf8").toString("hex")}`;
}

/** fflate writes classic ZIP fields, not ZIP64. Account for headers and descriptors too. */
export function fitsClassicZip(entries: { name: string; byteSize: number }[]) {
	const limit = 0xff_ff_ff_ff;
	if (entries.length >= 0xff_ff) {
		return false;
	}
	let localSize = 0;
	let directorySize = 0;
	for (const entry of entries) {
		const nameLength = strToU8(entry.name).length;
		if (nameLength > 0xff_ff || entry.byteSize >= limit) {
			return false;
		}
		localSize += 30 + nameLength + entry.byteSize + 16;
		directorySize += 46 + nameLength;
		if (localSize >= limit || directorySize >= limit) {
			return false;
		}
	}
	return true;
}

class ZipFormatLimitError extends Error {}

async function* verifiedChunks(
	objects: ObjectReader,
	file: StoredProjectArchiveFile
) {
	if (!file.sourceObjectKey) {
		throw new Error("Missing file location");
	}
	yield* verifiedObjectChunks(objects, file.sourceObjectKey, file);
}

async function prepareDownload(
	stored: StoredProjectArchiveRecord,
	objects: ObjectReader | null
) {
	if (await integrityFailure(stored)) {
		throw new Error("Invalid archive");
	}
	const archive = toArchive(stored);
	const files = stored.files.filter((file) => file.presence === "included");
	const entries = [
		{ name: "archive.json", byteSize: strToU8(JSON.stringify(archive)).length },
		...files.map((file) => ({
			name: filePath(file.kind, file.sourceId),
			byteSize: file.byteSize,
		})),
	];
	if (!fitsClassicZip(entries)) {
		throw new ZipFormatLimitError();
	}
	const paths = new Set<string>();
	for (const file of stored.files) {
		if (file.presence !== "included") {
			continue;
		}
		if (!objects) {
			throw new Error("Missing object storage");
		}
		const path = filePath(file.kind, file.sourceId);
		if (paths.has(path)) {
			throw new Error("Duplicate file");
		}
		paths.add(path);
		// biome-ignore lint/performance/noAwaitInLoops: Reading one file at a time bounds memory.
		for await (const _chunk of verifiedChunks(objects, file)) {
			/* discard verified bytes */
		}
	}
	return archive;
}

async function* zipChunks(
	stored: StoredProjectArchiveRecord,
	objects: ObjectReader | null,
	archive: ReturnType<typeof toArchive>
) {
	const pending: Uint8Array[] = [];
	const zip = new Zip((error, chunk) => {
		if (error) {
			throw error;
		}
		pending.push(chunk);
	});
	try {
		const manifest = new ZipPassThrough("archive.json");
		zip.add(manifest);
		manifest.push(strToU8(JSON.stringify(archive)), true);
		yield* pending.splice(0);
		for (const file of stored.files) {
			if (file.presence !== "included") {
				continue;
			}
			if (!objects) {
				throw new Error("Missing object storage");
			}
			const entry = new ZipPassThrough(filePath(file.kind, file.sourceId));
			zip.add(entry);
			yield* pending.splice(0);
			// biome-ignore lint/performance/noAwaitInLoops: ZIP entries must be streamed sequentially.
			for await (const chunk of verifiedChunks(objects, file)) {
				entry.push(chunk);
				yield* pending.splice(0);
			}
			entry.push(new Uint8Array(), true);
			yield* pending.splice(0);
		}
		zip.end();
		yield* pending.splice(0);
	} finally {
		zip.terminate();
	}
}

function asStream(chunks: AsyncGenerator<Uint8Array>) {
	return new ReadableStream<Uint8Array>({
		async pull(controller) {
			try {
				const result = await chunks.next();
				if (result.done) {
					controller.close();
				} else {
					controller.enqueue(result.value);
				}
			} catch (error) {
				controller.error(error);
			}
		},
		async cancel() {
			await chunks.return(undefined);
		},
	});
}

export function mountProjectArchiveDownloadRoutes(
	app: Hono,
	dependencies: ProjectArchiveDownloadDependencies
) {
	app.get(
		"/api/projects/:projectId/project-archives/:archiveId/content",
		async (c) => {
			c.header("Cache-Control", "private, no-store");
			const session = await dependencies.getSession(c.req.raw.headers);
			if (!session?.user) {
				return c.json(serializePublicApiError("Unauthorized"), 401);
			}
			const { projectId, archiveId } = c.req.param();
			if (
				!(
					projectId &&
					archiveId &&
					(await dependencies.getProjectForUser(session.user.id, projectId))
				)
			) {
				return c.json(serializePublicApiError("Not found"), 404);
			}
			const stored = await dependencies.archives.find(projectId, archiveId);
			if (!stored) {
				return c.json(serializePublicApiError("Not found"), 404);
			}
			try {
				const archive = await prepareDownload(stored, dependencies.objects);
				const stream = asStream(
					zipChunks(stored, dependencies.objects, archive)
				);
				c.header("Content-Type", "application/zip");
				c.header(
					"Content-Disposition",
					`attachment; filename="project-archive.zip"`
				);
				c.header("X-Content-Type-Options", "nosniff");
				return c.body(stream);
			} catch (error) {
				if (error instanceof ZipFormatLimitError) {
					return c.json(
						serializePublicApiError(
							"Project Archive exceeds ZIP format limits"
						),
						413
					);
				}
				return c.json(
					serializePublicApiError("Project Archive integrity check failed"),
					502
				);
			}
		}
	);
}

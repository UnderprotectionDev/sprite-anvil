import { deliveryRelativePathSchema } from "@sprite-anvil/api/delivery-path-schemas";
import type { DeliveryRefreshObservation } from "@sprite-anvil/api/delivery-refresh-classification";
import { sha256Hex } from "@sprite-anvil/api/export-bundle-verification";

const trailingSeparator = /[\\/]$/;
export interface NativeDeliveryFileSystem {
	info: (
		path: string
	) => Promise<{ isDirectory: boolean; isSymlink: boolean } | null>;
	mkdir: (path: string) => Promise<void>;
	read: (path: string) => Promise<Uint8Array>;
	remove: (path: string) => Promise<void>;
	write: (path: string, bytes: Uint8Array, createNew: boolean) => Promise<void>;
}

export interface NativeDeliveryFile {
	bytes: Uint8Array;
	path: string;
	sha256: string;
}

/** Resolve only validated relative paths, rejecting links at every existing component. */
async function destination(
	fs: NativeDeliveryFileSystem,
	root: string,
	relative: string,
	create: boolean
) {
	const parts = deliveryRelativePathSchema.parse(relative).split("/");
	let path = root.replace(trailingSeparator, "");
	for (const [index, part] of parts.entries()) {
		path += `/${part}`;
		// Each child must be checked after its parent; do not traverse a symlink.
		// biome-ignore lint/performance/noAwaitInLoops: Path traversal must be sequential.
		const info = await fs.info(path);
		if (
			info?.isSymlink ||
			(index < parts.length - 1 && info && !info.isDirectory) ||
			(index === parts.length - 1 && info?.isDirectory)
		) {
			throw new Error(`Unsafe delivery path: ${relative}`);
		}
		if (create && index < parts.length - 1 && !info) {
			await fs.mkdir(path);
		}
	}
	return path;
}

async function readExisting(fs: NativeDeliveryFileSystem, path: string) {
	return (await fs.info(path)) ? await fs.read(path) : null;
}

async function digest(value: Uint8Array | null) {
	return value ? await sha256Hex(value) : null;
}

/** Preflight every permitted path, write only those paths, and return verified readback. */
export async function applyNativeDelivery(input: {
	root: string;
	fs: NativeDeliveryFileSystem;
	files: NativeDeliveryFile[];
	/** Exact review observation; absence means first delivery, which may only create files. */
	observed?: DeliveryRefreshObservation[];
}) {
	const rootInfo = await input.fs.info(input.root);
	if (!rootInfo?.isDirectory || rootInfo.isSymlink) {
		throw new Error("Choose a real destination folder.");
	}
	const observations = new Map(
		input.observed?.map((entry) => [entry.path, entry.sha256])
	);
	const prepared = await Promise.all(
		input.files.map(async (file) => {
			if ((await sha256Hex(file.bytes)) !== file.sha256) {
				throw new Error(`Bundle integrity failed: ${file.path}`);
			}
			const path = await destination(input.fs, input.root, file.path, false);
			const previous = await readExisting(input.fs, path);
			const previousDigest = await digest(previous);
			const expected = input.observed ? observations.get(file.path) : null;
			if (previousDigest !== expected && previousDigest !== file.sha256) {
				throw new Error(
					`Destination changed: ${file.path}. Review the folder again.`
				);
			}
			return { file, path, previous, previousDigest };
		})
	);
	if (new Set(prepared.map((entry) => entry.path)).size !== prepared.length) {
		throw new Error("Duplicate delivery paths.");
	}
	const changed: typeof prepared = [];
	try {
		for (const entry of prepared) {
			// Sequential writes bound open files and keep rollback order deterministic.
			// biome-ignore lint/performance/noAwaitInLoops: Files are committed and verified one at a time.
			await writeEntry(input, entry, changed);
		}
		return prepared.map(({ file }) => ({
			path: file.path,
			sha256: file.sha256,
		}));
	} catch (error) {
		const rollback = await Promise.allSettled(
			changed.reverse().map(async (entry) => {
				const current = await readExisting(input.fs, entry.path);
				const currentDigest = await digest(current);
				if (currentDigest === entry.previousDigest) {
					return;
				}
				if (currentDigest !== entry.file.sha256) {
					throw new Error(`Changed during recovery: ${entry.file.path}`);
				}
				if (entry.previous) {
					await input.fs.write(entry.path, entry.previous, false);
				} else {
					await input.fs.remove(entry.path);
				}
			})
		);
		if (rollback.some((result) => result.status === "rejected")) {
			throw new Error(
				"Delivery failed and recovery is incomplete. No lock was recorded. Review the destination before retrying.",
				{ cause: error }
			);
		}
		throw error;
	}
}

async function writeEntry(
	input: { fs: NativeDeliveryFileSystem; root: string },
	entry: {
		file: NativeDeliveryFile;
		path: string;
		previous: Uint8Array | null;
		previousDigest: string | null;
	},
	changed: {
		file: NativeDeliveryFile;
		path: string;
		previous: Uint8Array | null;
		previousDigest: string | null;
	}[]
) {
	if (entry.previousDigest === entry.file.sha256) {
		return;
	}
	await destination(input.fs, input.root, entry.file.path, true);
	if (
		(await digest(await readExisting(input.fs, entry.path))) !==
		entry.previousDigest
	) {
		throw new Error(`Destination changed: ${entry.file.path}`);
	}
	changed.push(entry);
	await input.fs.write(entry.path, entry.file.bytes, entry.previous === null);
	if ((await digest(await input.fs.read(entry.path))) !== entry.file.sha256) {
		throw new Error(`Delivery readback failed: ${entry.file.path}`);
	}
}

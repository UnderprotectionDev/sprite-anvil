import type { DeliveryRefreshObservation } from "@sprite-anvil/api/delivery-refresh-classification";
import { sha256Hex } from "@sprite-anvil/api/export-bundle-verification";

/**
 * A chosen destination folder: its files by path relative to that folder. The browser
 * prefixes every path with the chosen folder's own name, which is dropped here.
 */
export type TargetFolder = Map<string, File>;

/** A folder the user chose; the token tells one choice from the next. */
export interface ChosenFolder {
	files: TargetFolder;
	token: number;
}

let folderChoices = 0;

/** An empty choice clears the folder. */
export function chooseFolder(files: File[]): ChosenFolder | null {
	folderChoices += 1;
	return files.length === 0
		? null
		: { files: indexTargetFolder(files), token: folderChoices };
}

export function indexTargetFolder(files: File[]): TargetFolder {
	return new Map(
		files.map((file) => {
			const relative = file.webkitRelativePath || file.name;
			return [relative.split("/").slice(1).join("/") || file.name, file];
		})
	);
}

/** The SHA-256 of one file's bytes. */
export async function digestOfFile(file: File): Promise<string> {
	return await sha256Hex(new Uint8Array(await file.arrayBuffer()));
}

/**
 * Reads only the given paths. Any other file in the folder is never opened, so an
 * unrecognised file cannot reach the report. A path the folder lacks is reported absent.
 */
export async function observeTargetFolder(
	folder: TargetFolder,
	paths: string[]
): Promise<DeliveryRefreshObservation[]> {
	return await Promise.all(
		paths.map(async (path) => {
			const file = folder.get(path);
			return { path, sha256: file ? await digestOfFile(file) : null };
		})
	);
}

/**
 * The digests of the files a surface wrote, read from the chosen folder, and the paths
 * the folder lacks. Only the given paths are opened.
 */
export async function readWrittenFiles(
	folder: TargetFolder,
	paths: string[]
): Promise<{ missing: string[]; written: { path: string; sha256: string }[] }> {
	const written: { path: string; sha256: string }[] = [];
	const missing: string[] = [];
	for (const { path, sha256 } of await observeTargetFolder(folder, paths)) {
		if (sha256) {
			written.push({ path, sha256 });
		} else {
			missing.push(path);
		}
	}
	return { missing, written };
}

/** The text of a file when it is valid UTF-8, else null (a binary file is compared by digest). */
export async function readTargetText(file: File): Promise<string | null> {
	try {
		return new TextDecoder("utf-8", { fatal: true }).decode(
			await file.arrayBuffer()
		);
	} catch {
		return null;
	}
}

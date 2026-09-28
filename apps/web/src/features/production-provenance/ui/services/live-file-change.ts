const maxSnapshotBytes = 100 * 1024 * 1024;
const pathSeparatorPattern = /[\\/]/;

export interface LiveFileInfo {
	isFile: boolean;
	mtime: Date | null;
	size: number;
}

export interface LiveFileChangeDependencies {
	chooseExport: () => Promise<string | null>;
	readFile: (path: string) => Promise<Uint8Array>;
	stat: (path: string) => Promise<LiveFileInfo>;
}

export type PreparedLiveFileCandidate =
	| { kind: "cancelled" }
	| { kind: "source-changed" }
	| { kind: "source-unavailable" }
	| { kind: "source-too-large" }
	| { kind: "unsupported-export" }
	| { kind: "ready"; candidateFile: File; sourceFile: File };

function fileName(path: string) {
	return path.split(pathSeparatorPattern).filter(Boolean).at(-1) ?? "untitled";
}

function sameFileVersion(left: LiveFileInfo, right: LiveFileInfo) {
	return (
		left.isFile &&
		right.isFile &&
		left.size === right.size &&
		left.mtime?.getTime() === right.mtime?.getTime()
	);
}

function toArrayBuffer(bytes: Uint8Array) {
	const buffer = new ArrayBuffer(bytes.byteLength);
	new Uint8Array(buffer).set(bytes);
	return buffer;
}

export async function prepareLiveFileCandidate(
	sourcePath: string,
	dependencies: LiveFileChangeDependencies
): Promise<PreparedLiveFileCandidate> {
	const initialSourceInfo = await dependencies.stat(sourcePath);
	if (!initialSourceInfo.isFile || initialSourceInfo.size <= 0) {
		return { kind: "source-unavailable" };
	}
	if (initialSourceInfo.size > maxSnapshotBytes) {
		return { kind: "source-too-large" };
	}
	const sourceBytes = await dependencies.readFile(sourcePath);
	if (sourceBytes.byteLength !== initialSourceInfo.size) {
		return { kind: "source-changed" };
	}

	const exportPath = await dependencies.chooseExport();
	if (!exportPath) {
		return { kind: "cancelled" };
	}

	const currentSourceInfo = await dependencies.stat(sourcePath);
	if (!sameFileVersion(initialSourceInfo, currentSourceInfo)) {
		return { kind: "source-changed" };
	}

	const extension = exportPath.split(".").at(-1)?.toLowerCase();
	let contentType: "image/png" | "image/webp" | null = null;
	if (extension === "png") {
		contentType = "image/png";
	} else if (extension === "webp") {
		contentType = "image/webp";
	}
	if (!contentType) {
		return { kind: "unsupported-export" };
	}

	const exportInfo = await dependencies.stat(exportPath);
	if (!exportInfo.isFile || exportInfo.size <= 0) {
		return { kind: "unsupported-export" };
	}
	const exportBytes = await dependencies.readFile(exportPath);
	if (exportBytes.byteLength !== exportInfo.size) {
		return { kind: "unsupported-export" };
	}

	return {
		kind: "ready",
		sourceFile: new File([toArrayBuffer(sourceBytes)], fileName(sourcePath), {
			lastModified: initialSourceInfo.mtime?.getTime() ?? 0,
			type: "application/octet-stream",
		}),
		candidateFile: new File(
			[toArrayBuffer(exportBytes)],
			fileName(exportPath),
			{
				lastModified: exportInfo.mtime?.getTime() ?? 0,
				type: contentType,
			}
		),
	};
}

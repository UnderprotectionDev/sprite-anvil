import { deliveryRelativePathSchema } from "@sprite-anvil/api/delivery-path-schemas";
import type { DeliveryRefreshObservation } from "@sprite-anvil/api/delivery-refresh-classification";
import type { ExportBundle } from "@sprite-anvil/api/export-bundles";
import { isTauri } from "@tauri-apps/api/core";
import { honoGetBytes, projectApiUrl } from "@/utils/hono-api";
import type { NativeDeliveryFileSystem } from "./native-delivery";
import { applyNativeDelivery } from "./native-delivery";
import type { ChosenFolder } from "./read-target-folder";
import { chooseFolder } from "./read-target-folder";

const trailingSeparator = /[\\/]$/u;
const missingPath = /no such file|not found|os error [23]\b/iu;
export const isDesktopDelivery = () => isTauri();

async function desktopFileSystem(): Promise<NativeDeliveryFileSystem> {
	const fs = await import("@tauri-apps/plugin-fs");
	return {
		info: async (path) => {
			try {
				return await fs.lstat(path);
			} catch (error) {
				if (missingPath.test(String(error))) {
					return null;
				}
				throw error;
			}
		},
		mkdir: async (path) => {
			await fs.mkdir(path);
		},
		read: fs.readFile,
		remove: async (path) => {
			await fs.remove(path);
		},
		write: async (path, value, createNew) => {
			await fs.writeFile(path, value, { createNew });
		},
	};
}

/** The native dialog grants access only to the directory explicitly chosen by the user. */
export async function chooseNativeDeliveryFolder(
	paths: string[]
): Promise<ChosenFolder | null> {
	const { open } = await import("@tauri-apps/plugin-dialog");
	const root = await open({
		directory: true,
		multiple: false,
		recursive: true,
		title: "Choose delivery destination",
	});
	if (typeof root !== "string") {
		return null;
	}
	const fs = await desktopFileSystem();
	const files = new Map<string, File>();
	await Promise.all(
		paths.map(async (path) => {
			const parts = deliveryRelativePathSchema.parse(path).split("/");
			let absolute = root.replace(trailingSeparator, "");
			for (const part of parts) {
				absolute += `/${part}`;
				// biome-ignore lint/performance/noAwaitInLoops: Refuse links before traversing each component.
				const info = await fs.info(absolute);
				if (!info) {
					return;
				}
				if (info.isSymlink) {
					throw new Error(`Unsafe delivery path: ${path}`);
				}
			}
			const data = await fs.read(absolute);
			files.set(path, new File([Uint8Array.from(data)], path));
		})
	);
	// chooseFolder owns selection tokens; an empty directory is valid for first delivery.
	const choice = chooseFolder([new File([], "selection")]);
	if (!choice) {
		throw new Error("The folder selection could not be recorded.");
	}
	return { files, nativeRoot: root, token: choice.token };
}

export async function writeNativeBundle(input: {
	bundle: ExportBundle;
	projectId: string;
	folder: ChosenFolder;
	paths: string[];
	observed?: DeliveryRefreshObservation[];
}) {
	if (!input.folder.nativeRoot) {
		throw new Error("Choose a desktop destination folder.");
	}
	const selected = new Set(input.paths);
	const files = await Promise.all(
		input.bundle.files
			.filter((file) => selected.has(file.path))
			.map(async (file) => {
				let bytes: Uint8Array;
				if (file.content === null) {
					if (!file.assetVersionId) {
						throw new Error(`Missing bundle bytes: ${file.path}`);
					}
					bytes = await honoGetBytes(
						`${projectApiUrl(input.projectId)}/asset-versions/${encodeURIComponent(file.assetVersionId)}/preview`,
						"The bundle asset could not be read"
					);
				} else {
					bytes = new TextEncoder().encode(file.content);
				}
				return { path: file.path, sha256: file.sha256, bytes };
			})
	);
	if (files.length !== selected.size) {
		throw new Error("The selected bundle is missing delivery paths.");
	}
	return await applyNativeDelivery({
		root: input.folder.nativeRoot,
		fs: await desktopFileSystem(),
		files,
		observed: input.observed,
	});
}

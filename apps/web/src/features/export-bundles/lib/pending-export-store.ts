import type { EntityTable } from "dexie";
import Dexie from "dexie";
import type { client } from "@/utils/orpc";

type ProfileInput = Parameters<typeof client.exportProfiles.createRevision>[0];
type BundleInput = Parameters<typeof client.exportBundles.create>[0];
export type PendingExport =
	| { key: string; kind: "profile"; input: ProfileInput }
	| { key: string; kind: "bundle"; input: BundleInput };

let database:
	| (Dexie & { requests: EntityTable<PendingExport, "key"> })
	| undefined;
export function pendingExportTable() {
	if (!database) {
		database = new Dexie("sprite-anvil-pending-exports") as Dexie & {
			requests: EntityTable<PendingExport, "key">;
		};
		database.version(1).stores({ requests: "key" });
	}
	return database.requests;
}
export function pendingExportKey(
	userId: string,
	projectId: string,
	kind: "profile" | "bundle"
) {
	return JSON.stringify([userId, projectId, kind]);
}

import { createStore } from "@tanstack/store";

export interface OpenRecord {
	assetRecordId: string;
	name: string;
	projectId: string;
	userId: string;
	versionId?: string;
}
export const createOpenRecordStore = () => createStore<OpenRecord[]>([]);
export type OpenRecordStore = ReturnType<typeof createOpenRecordStore>;
export const openRecordStore = createOpenRecordStore();

export function rememberOpenRecord(store: OpenRecordStore, record: OpenRecord) {
	store.setState((tabs) => {
		const index = tabs.findIndex(
			(tab) =>
				tab.userId === record.userId &&
				tab.projectId === record.projectId &&
				tab.assetRecordId === record.assetRecordId
		);
		if (index < 0) {
			return [...tabs, record];
		}
		return tabs.map((tab, i) => (i === index ? record : tab));
	});
}

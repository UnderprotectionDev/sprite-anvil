import Dexie, { type EntityTable } from "dexie";

export interface LocalDraft {
	id: string;
	name: string;
	pixels: number[];
	updatedAt: number;
}

const database = new Dexie("sprite-anvil-drafts") as Dexie & {
	drafts: EntityTable<LocalDraft, "id">;
};

database.version(1).stores({ drafts: "id, updatedAt" });

export const localDrafts = database.drafts;

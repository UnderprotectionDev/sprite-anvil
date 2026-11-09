export interface StoredReadinessPlanOrder {
	orderedWorkIds: string[];
	projectId: string;
	revisionId: string;
	updatedAt: Date;
	updatedByUserId: string;
}

/**
 * The persistent side of Readiness Plans. Blockers and work are derived on
 * every read; the only stored fact is the user's chosen order of that work.
 */
export interface ReadinessPlanStorage {
	/** The user's saved order for one Delivery Target revision, or null before they have ordered anything. */
	findOrder: (
		projectId: string,
		revisionId: string
	) => Promise<string[] | null>;
	/** Replaces the saved order of the revision as one write. */
	saveOrder: (order: StoredReadinessPlanOrder) => Promise<void>;
}

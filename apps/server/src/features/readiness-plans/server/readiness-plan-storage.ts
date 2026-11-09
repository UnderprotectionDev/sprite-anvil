export interface StoredReadinessPlanOrder {
	deliveryTargetId: string;
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
	/**
	 * Replaces the saved order of the revision as one write that happens only
	 * while the revision is still the Delivery Target's active one. Returns
	 * false, writing nothing, when a newer revision has been activated.
	 */
	saveOrder: (order: StoredReadinessPlanOrder) => Promise<boolean>;
}

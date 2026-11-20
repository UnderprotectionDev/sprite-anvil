export function offlineStagingQueryKey(userId: string, projectId: string) {
	return ["offline-staging", userId, projectId] as const;
}

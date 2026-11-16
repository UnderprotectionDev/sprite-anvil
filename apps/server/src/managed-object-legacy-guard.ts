import type {
	ManagedObjectErasureGate,
	ManagedObjectReservations,
} from "./managed-object-reservations";

const uuidPattern =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const fileKindPattern = /^[a-z_]+$/;
const fileIdPattern = /^(?:[0-9a-f]{2})+$/;

function parseImportKey(prefix: string, key: string) {
	if (!key.startsWith(prefix)) {
		throw new Error("Unexpected archive import object prefix.");
	}
	const segments = key.slice(prefix.length).split("/");
	const [operationId, attempt, kind] = segments;
	const zip = kind === "archive.zip" && segments.length === 3;
	const file =
		kind === "files" &&
		segments.length === 5 &&
		fileKindPattern.test(segments[3] ?? "") &&
		fileIdPattern.test(segments[4] ?? "");
	if (
		!(
			operationId &&
			attempt &&
			uuidPattern.test(operationId) &&
			uuidPattern.test(attempt) &&
			(zip || file)
		)
	) {
		throw new Error(
			"An unmanaged archive import object requires reconciliation before erasure."
		);
	}
	return {
		operationId,
		purpose: zip
			? ("archive_import_zip" as const)
			: ("archive_import_file" as const),
	};
}

/** Register only exact historical archive staging keys under projects this owner still owns. */
export function createManagedObjectLegacyGuard(options: {
	listOwnerProjectIds: (ownerUserId: string) => Promise<string[]>;
	listObjects: (prefix: string) => Promise<string[]>;
	listOwner: ManagedObjectErasureGate["listOwner"];
	reserve: ManagedObjectReservations["reserve"];
}) {
	return async (ownerUserId: string) => {
		const registered = new Set(
			(await options.listOwner(ownerUserId)).map((item) => item.objectKey)
		);
		for (const projectId of await options.listOwnerProjectIds(ownerUserId)) {
			const prefix = `projects/${encodeURIComponent(projectId)}/project-archive-imports/`;
			// biome-ignore lint/performance/noAwaitInLoops: Each owner-scoped prefix must be inventoried before erasure.
			const keys = await options.listObjects(prefix);
			for (const key of keys) {
				if (registered.has(key)) {
					continue;
				}
				const { operationId, purpose } = parseImportKey(prefix, key);
				// biome-ignore lint/performance/noAwaitInLoops: Reservation must be durable before considering this object covered.
				await options.reserve({
					ownerUserId,
					projectId,
					operationId,
					objectKey: key,
					purpose,
				});
				registered.add(key);
			}
		}
	};
}

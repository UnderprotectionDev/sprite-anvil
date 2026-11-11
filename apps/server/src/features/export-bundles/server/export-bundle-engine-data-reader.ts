import type { AnimationTimingReviewStore } from "@sprite-anvil/api/animation-timing-reviews";
import type { ExportBundleEngineData } from "@sprite-anvil/api/export-bundle-engine-data";
import type { GameplayMetadataStore } from "@sprite-anvil/api/gameplay-metadata";
import type { TilesetAdjacencyReviewStore } from "@sprite-anvil/api/tileset-adjacency-reviews";
import type { UiStretchTestStore } from "@sprite-anvil/api/ui-stretch-tests";

export interface ExportBundleEngineDataDependencies {
	animationTimingReviews: Pick<AnimationTimingReviewStore, "list">;
	gameplayMetadata: Pick<GameplayMetadataStore, "list">;
	tilesetAdjacencyReviews: Pick<TilesetAdjacencyReviewStore, "list">;
	uiStretchTests: Pick<UiStretchTestStore, "list">;
}

export interface EngineDataScope {
	assetFamilyIds: string[];
	/** Asset Version id to its Asset Record id, for every version of the project. */
	assetRecordIdByVersionId: Map<string, string>;
	projectId: string;
	/** The Asset Versions the bundle pins as files; frames outside them cannot be referenced. */
	selectedVersionIds: Set<string>;
	userId: string;
}

type TimingRecord = NonNullable<
	Awaited<ReturnType<AnimationTimingReviewStore["list"]>>
>[number];
type TilesetReview = NonNullable<
	Awaited<ReturnType<TilesetAdjacencyReviewStore["list"]>>
>[number];
type GameplayRecord = NonNullable<
	Awaited<ReturnType<GameplayMetadataStore["list"]>>
>["records"][number];

function newestFirst<T extends { createdAt: string }>(records: T[]): T[] {
	return [...records].sort((left, right) =>
		right.createdAt.localeCompare(left.createdAt)
	);
}

function readPivot(value: unknown): { x: number; y: number } | null {
	if (value && typeof value === "object" && !Array.isArray(value)) {
		const { x, y } = value as Record<string, unknown>;
		if (typeof x === "number" && typeof y === "number") {
			return { x, y };
		}
	}
	return null;
}

function readEvents(value: unknown): { id: string; timeMs: number | null }[] {
	if (!Array.isArray(value)) {
		return [];
	}
	return value.flatMap((entry) => {
		if (typeof entry === "string" && entry.length > 0) {
			return [{ id: entry, timeMs: null }];
		}
		if (entry && typeof entry === "object") {
			const { id, timeMs } = entry as Record<string, unknown>;
			if (typeof id === "string" && id.length > 0) {
				return [
					{
						id,
						timeMs:
							typeof timeMs === "number" &&
							Number.isInteger(timeMs) &&
							timeMs >= 0
								? timeMs
								: null,
					},
				];
			}
		}
		return [];
	});
}

/** The newest record that has the field, per frame; a later record without it does not erase an earlier value. */
function latestFieldValue(
	records: GameplayRecord[],
	assetVersionId: string,
	frameKey: string,
	fieldId: "event_links" | "pivot"
): unknown {
	for (const record of newestFirst(records)) {
		if (
			record.assetVersionId === assetVersionId &&
			record.frameKey === frameKey
		) {
			const field = record.fields.find((entry) => entry.fieldId === fieldId);
			if (field) {
				return field.value;
			}
		}
	}
	return null;
}

/** One animation per name: the newest review whose outcome is consistent. */
function latestConsistentByName(records: TimingRecord[]): TimingRecord[] {
	const byName = new Map<string, TimingRecord>();
	for (const record of newestFirst(records)) {
		if (record.outcome === "consistent" && !byName.has(record.animationName)) {
			byName.set(record.animationName, record);
		}
	}
	return [...byName.values()];
}

async function readAnimation(
	dependencies: ExportBundleEngineDataDependencies,
	scope: EngineDataScope,
	assetFamilyId: string,
	review: TimingRecord
): Promise<ExportBundleEngineData["animations"][number] | null> {
	const frames = review.directions.flatMap((entry) => entry.frames);
	if (
		!frames.every((frame) => scope.selectedVersionIds.has(frame.assetVersionId))
	) {
		return null;
	}
	const recordIds = [
		...new Set(
			frames.flatMap((frame) => {
				const recordId = scope.assetRecordIdByVersionId.get(
					frame.assetVersionId
				);
				return recordId ? [recordId] : [];
			})
		),
	];
	const records = (
		await Promise.all(
			recordIds.map((assetRecordId) =>
				dependencies.gameplayMetadata.list(
					scope.userId,
					scope.projectId,
					assetRecordId
				)
			)
		)
	).flatMap((catalog) => catalog?.records ?? []);
	return {
		assetFamilyId,
		directions: review.directions.map((entry) => ({
			direction: entry.direction,
			frames: entry.frames.map((frame) => ({
				assetVersionId: frame.assetVersionId,
				durationMs: frame.durationMs,
				events: readEvents(
					latestFieldValue(
						records,
						frame.assetVersionId,
						frame.frameKey,
						"event_links"
					)
				),
				frameKey: frame.frameKey,
				pivot: readPivot(
					latestFieldValue(
						records,
						frame.assetVersionId,
						frame.frameKey,
						"pivot"
					)
				),
				region: frame.region,
			})),
		})),
		looping: review.looping,
		name: review.animationName,
		playbackSpeed: review.playbackSpeed,
	};
}

async function readAnimations(
	dependencies: ExportBundleEngineDataDependencies,
	scope: EngineDataScope
): Promise<ExportBundleEngineData["animations"]> {
	const perFamily = await Promise.all(
		scope.assetFamilyIds.map(async (assetFamilyId) => {
			const reviews =
				(await dependencies.animationTimingReviews.list(
					scope.userId,
					scope.projectId,
					assetFamilyId
				)) ?? [];
			return await Promise.all(
				latestConsistentByName(reviews).map((review) =>
					readAnimation(dependencies, scope, assetFamilyId, review)
				)
			);
		})
	);
	return perFamily.flat().filter((animation) => animation !== null);
}

function newestTilesetPerComposite(reviews: TilesetReview[]): TilesetReview[] {
	const seen = new Set<string>();
	return newestFirst(reviews).filter((review) => {
		if (seen.has(review.compositeVersionId)) {
			return false;
		}
		seen.add(review.compositeVersionId);
		return true;
	});
}

async function readTilesets(
	dependencies: ExportBundleEngineDataDependencies,
	scope: EngineDataScope
): Promise<ExportBundleEngineData["tilesets"]> {
	const perFamily = await Promise.all(
		scope.assetFamilyIds.map(async (assetFamilyId) => {
			const reviews =
				(await dependencies.tilesetAdjacencyReviews.list(
					scope.userId,
					scope.projectId,
					assetFamilyId
				)) ?? [];
			return newestTilesetPerComposite(reviews).flatMap((review) => {
				const versionByUnit = new Map(
					review.versionPins.map((pin) => [
						pin.unitVersionId,
						pin.assetVersionId,
					])
				);
				const tiles = review.tiles.map((tile) => ({
					assetVersionId: versionByUnit.get(tile.unitVersionId) ?? "",
					edges: tile.edges,
					region: tile.region,
					terrainId: tile.terrainId,
					unitVersionId: tile.unitVersionId,
				}));
				return tiles.every((tile) =>
					scope.selectedVersionIds.has(tile.assetVersionId)
				)
					? [
							{
								assetFamilyId,
								compositeVersionId: review.compositeVersionId,
								tiles,
							},
						]
					: [];
			});
		})
	);
	return perFamily.flat();
}

async function readUiComponents(
	dependencies: ExportBundleEngineDataDependencies,
	scope: EngineDataScope
): Promise<ExportBundleEngineData["uiComponents"]> {
	const perFamily = await Promise.all(
		scope.assetFamilyIds.map(async (assetFamilyId) => {
			const [latest] = newestFirst(
				(await dependencies.uiStretchTests.list(
					scope.userId,
					scope.projectId,
					assetFamilyId
				)) ?? []
			);
			if (!latest) {
				return [];
			}
			const ids = [...new Set(latest.states.map((state) => state.componentId))];
			return ids.flatMap((id) => {
				const states = latest.states.filter(
					(state) => state.componentId === id
				);
				return states.every((state) =>
					scope.selectedVersionIds.has(state.assetVersionId)
				)
					? [
							{
								assetFamilyId,
								id,
								states: states.map((state) => ({
									assetVersionId: state.assetVersionId,
									id: state.stateId,
									naturalSize: state.naturalSize,
									stretchMargins: state.stretchMargins,
									textSafeArea: state.textSafeArea,
								})),
							},
						]
					: [];
			});
		})
	);
	return perFamily.flat();
}

/**
 * The game data of the requested families that the bundle can reference: the
 * newest consistent animation timing review per animation with its pivot and
 * event metadata, the newest adjacency review per tileset, and the newest UI
 * Stretch Test per family. Data whose frames are not pinned files is left out
 * rather than pinned as a dangling reference.
 */
export async function readExportBundleEngineData(
	dependencies: ExportBundleEngineDataDependencies,
	scope: EngineDataScope
): Promise<ExportBundleEngineData> {
	const [animations, tilesets, uiComponents] = await Promise.all([
		readAnimations(dependencies, scope),
		readTilesets(dependencies, scope),
		readUiComponents(dependencies, scope),
	]);
	return { animations, tilesets, uiComponents };
}

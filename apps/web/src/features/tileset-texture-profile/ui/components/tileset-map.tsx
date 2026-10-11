import type { AssetVersion } from "@sprite-anvil/api/asset-versions";
import type {
	TilesetTestMap,
	TilesetTile,
} from "@sprite-anvil/api/tileset-adjacency-reviews";
import { ENV } from "@/env";

const serverUrl = ENV.VITE_SERVER_URL?.replace(/\/$/, "") ?? "";
export function TileImage({
	tile,
	version,
	onReady,
}: {
	tile: TilesetTile;
	version?: AssetVersion;
	onReady?: (ready: boolean) => void;
}) {
	const dimensions = version?.sourceImageDimensions;
	if (!(version && dimensions)) {
		return <span>Unavailable</span>;
	}
	const { region } = tile;
	const scale = 44 / Math.max(region.width, region.height);
	return (
		<span
			className="relative block overflow-hidden"
			style={{ width: region.width * scale, height: region.height * scale }}
		>
			{/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: Image lifecycle verifies previews without input interactions. */}
			<img
				alt=""
				crossOrigin="use-credentials"
				height={dimensions.height}
				onError={() => onReady?.(false)}
				onLoad={(event) =>
					onReady?.(
						event.currentTarget.naturalWidth >= region.x + region.width &&
							event.currentTarget.naturalHeight >= region.y + region.height
					)
				}
				src={`${serverUrl}${version.previewUrl}`}
				style={{
					position: "absolute",
					maxWidth: "none",
					width: dimensions.width * scale,
					height: dimensions.height * scale,
					left: -region.x * scale,
					top: -region.y * scale,
					imageRendering: "pixelated",
				}}
				width={dimensions.width}
			/>
		</span>
	);
}
export function TilesetMap({
	map,
	tiles,
	versions,
	onPaint,
	onInspect,
}: {
	map: TilesetTestMap;
	tiles: (TilesetTile & { tileId: string; assetVersionId: string })[];
	versions: AssetVersion[];
	onPaint?: (index: number) => void;
	onInspect: (index: number) => void;
}) {
	return (
		<div
			aria-label="Paintable test map"
			className="grid w-fit max-w-full gap-0 overflow-auto border"
			role="group"
			style={{ gridTemplateColumns: `repeat(${map.width}, 44px)` }}
		>
			{map.cells.map((unitId, index) => {
				const tile = tiles.find((item) => item.unitVersionId === unitId);
				return (
					<button
						aria-label={`Cell ${index + 1}: ${tile?.tileId ?? "Empty"}`}
						className="flex size-11 items-center justify-center border focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-primary"
						// biome-ignore lint/suspicious/noArrayIndexKey: Grid coordinates identify fixed cells; painting never reorders them.
						key={`${Math.floor(index / map.width)}-${index % map.width}`}
						onClick={() => {
							onInspect(index);
							onPaint?.(index);
						}}
						type="button"
					>
						{tile ? (
							<TileImage
								tile={tile}
								version={versions.find(
									(version) => version.id === tile.assetVersionId
								)}
							/>
						) : (
							<span aria-hidden="true">·</span>
						)}
					</button>
				);
			})}
		</div>
	);
}

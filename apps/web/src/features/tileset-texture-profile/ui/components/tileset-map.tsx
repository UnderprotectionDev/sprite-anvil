import type { AssetVersion } from "@sprite-anvil/api/asset-versions";
import type {
	TilesetTestMap,
	TilesetTile,
} from "@sprite-anvil/api/tileset-adjacency-reviews";
import { Button } from "@sprite-anvil/ui/components/button";
import { ENV } from "@/env";

const serverUrl = ENV.VITE_SERVER_URL?.replace(/\/$/, "") ?? "";
export function TileImage({
	tile,
	version,
	onReady,
	scale: mapScale,
}: {
	tile: TilesetTile;
	version?: AssetVersion;
	onReady?: (ready: boolean) => void;
	scale?: number;
}) {
	const dimensions = version?.sourceImageDimensions;
	if (!(version && dimensions)) {
		return <span>Unavailable</span>;
	}
	const { region } = tile;
	const scale = mapScale ?? 44 / Math.max(region.width, region.height);
	return (
		<span
			className="relative block overflow-hidden"
			style={{
				width: region.width * scale,
				height: region.height * scale,
				flexShrink: 0,
			}}
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
	const cellWidth = Math.max(1, ...tiles.map((tile) => tile.region.width));
	const cellHeight = Math.max(1, ...tiles.map((tile) => tile.region.height));
	const scale = Math.max(1, Math.ceil(44 / Math.min(cellWidth, cellHeight)));
	return (
		<div
			aria-label="Paintable test map"
			className="grid w-fit max-w-full gap-0 overflow-auto"
			role="group"
			style={{
				gridTemplateColumns: `repeat(${map.width}, ${cellWidth * scale}px)`,
			}}
		>
			{map.cells.map((unitId, index) => {
				const tile = tiles.find((item) => item.unitVersionId === unitId);
				return (
					<Button
						aria-label={`Cell ${index + 1}: ${tile?.tileId ?? "Empty"}`}
						className="relative block border-0 bg-transparent p-0 hover:bg-transparent focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-solid focus-visible:-outline-offset-2 focus-visible:ring-0 active:not-aria-[haspopup]:translate-y-0"
						// biome-ignore lint/suspicious/noArrayIndexKey: Grid coordinates identify fixed cells; painting never reorders them.
						key={`${Math.floor(index / map.width)}-${index % map.width}`}
						onClick={() => {
							onInspect(index);
							onPaint?.(index);
						}}
						style={{ width: cellWidth * scale, height: cellHeight * scale }}
						type="button"
						variant="ghost"
					>
						{tile ? (
							<TileImage
								scale={scale}
								tile={tile}
								version={versions.find(
									(version) => version.id === tile.assetVersionId
								)}
							/>
						) : (
							<span aria-hidden="true">·</span>
						)}
					</Button>
				);
			})}
		</div>
	);
}

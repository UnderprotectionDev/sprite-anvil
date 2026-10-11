import type { AssetVersion } from "@sprite-anvil/api/asset-versions";
import type { TilesetTile } from "@sprite-anvil/api/tileset-adjacency-reviews";
import { tilesetEdges } from "@sprite-anvil/api/tileset-adjacency-reviews";
import { TileImage } from "./tileset-map";

const fieldClass = "min-h-11 rounded border bg-background p-2";

/** Editing one tile's declared atlas region and connectors. */
export function TilesetAtlasTileEditor({
	tile,
	tileId,
	version,
	prefix,
	onChange,
	onReady,
}: {
	tile: TilesetTile;
	tileId: string;
	version?: AssetVersion;
	prefix: string;
	onChange: (tile: TilesetTile) => void;
	onReady: (ready: boolean) => void;
}) {
	return (
		<fieldset className="space-y-2 rounded border p-3">
			<legend>{tileId}</legend>
			<TileImage
				key={JSON.stringify(tile.region)}
				onReady={onReady}
				tile={tile}
				version={version}
			/>
			<label className="flex flex-col" htmlFor={`${prefix}-terrain`}>
				Terrain ID
				<input
					className={fieldClass}
					id={`${prefix}-terrain`}
					maxLength={200}
					onChange={(event) =>
						onChange({ ...tile, terrainId: event.target.value })
					}
					value={tile.terrainId}
				/>
			</label>
			<div className="grid grid-cols-2 gap-2">
				{(["x", "y", "width", "height"] as const).map((key) => (
					<label
						className="flex flex-col"
						htmlFor={`${prefix}-region-${key}`}
						key={key}
					>
						Atlas {key}
						<input
							className={fieldClass}
							id={`${prefix}-region-${key}`}
							max={key === "x" || key === "y" ? 16_384 : 4096}
							min={key === "x" || key === "y" ? 0 : 1}
							onChange={(event) => {
								onReady(false);
								onChange({
									...tile,
									region: { ...tile.region, [key]: Number(event.target.value) },
								});
							}}
							type="number"
							value={tile.region[key]}
						/>
					</label>
				))}
			</div>
			<div className="grid grid-cols-2 gap-2">
				{tilesetEdges.map((edge) => (
					<label
						className="flex flex-col"
						htmlFor={`${prefix}-edge-${edge}`}
						key={edge}
					>
						{edge} connector
						<input
							className={fieldClass}
							id={`${prefix}-edge-${edge}`}
							maxLength={200}
							onChange={(event) =>
								onChange({
									...tile,
									edges: { ...tile.edges, [edge]: event.target.value || null },
								})
							}
							placeholder="Unknown"
							value={tile.edges[edge] ?? ""}
						/>
					</label>
				))}
			</div>
		</fieldset>
	);
}

import type { AssetVersion } from "@sprite-anvil/api/asset-versions";
import type { TilesetTile } from "@sprite-anvil/api/tileset-adjacency-reviews";
import { tilesetEdges } from "@sprite-anvil/api/tileset-adjacency-reviews";
import { FieldLegend, FieldSet } from "@sprite-anvil/ui/components/field";
import { Input } from "@sprite-anvil/ui/components/input";
import { Label } from "@sprite-anvil/ui/components/label";
import { TileImage } from "./tileset-map";

const labelClass = "flex flex-col items-stretch gap-1";

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
		<FieldSet className="block space-y-2 rounded border p-3">
			<FieldLegend>{tileId}</FieldLegend>
			<TileImage
				key={JSON.stringify(tile.region)}
				onReady={onReady}
				tile={tile}
				version={version}
			/>
			<Label className={labelClass} htmlFor={`${prefix}-terrain`}>
				Terrain ID
				<Input
					className="min-h-11"
					id={`${prefix}-terrain`}
					maxLength={200}
					onChange={(event) =>
						onChange({ ...tile, terrainId: event.target.value || null })
					}
					placeholder="Optional for independent tiles"
					value={tile.terrainId ?? ""}
				/>
			</Label>
			<div className="grid grid-cols-2 gap-2">
				{(["x", "y", "width", "height"] as const).map((key) => (
					<Label
						className={labelClass}
						htmlFor={`${prefix}-region-${key}`}
						key={key}
					>
						Atlas {key}
						<Input
							className="min-h-11"
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
					</Label>
				))}
			</div>
			<div className="grid grid-cols-2 gap-2">
				{tilesetEdges.map((edge) => (
					<Label
						className={labelClass}
						htmlFor={`${prefix}-edge-${edge}`}
						key={edge}
					>
						{edge} connector
						<Input
							className="min-h-11"
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
					</Label>
				))}
			</div>
		</FieldSet>
	);
}

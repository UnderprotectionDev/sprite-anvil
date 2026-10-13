import type { AssetVersion } from "@sprite-anvil/api/asset-versions";
import {
	type PortraitReviewItem,
	portraitReviewItemSchema,
} from "@sprite-anvil/api/portrait-identity-reviews";
import { Button } from "@sprite-anvil/ui/components/button";
import { PortraitUsagePreview } from "./portrait-usage-preview";

export function PortraitReviewItemFields({
	item,
	index,
	versions,
	names,
	disabled,
	onChange,
	onRemove,
	onReady,
}: {
	item: PortraitReviewItem;
	index: number;
	versions: AssetVersion[];
	names: ReadonlyMap<string, string>;
	disabled: boolean;
	onChange: (item: PortraitReviewItem) => void;
	onRemove: () => void;
	onReady: (ready: boolean) => void;
}) {
	const version = versions.find((v) => v.id === item.assetVersionId);
	const valid = portraitReviewItemSchema.safeParse(item).success;
	return (
		<fieldset className="space-y-3 rounded-md border p-3" disabled={disabled}>
			<legend>İfade {index + 1}</legend>
			<label className="grid gap-1">
				Portre sürümü
				<select
					className="rounded border p-2"
					onChange={(e) => {
						const next = versions.find((v) => v.id === e.target.value);
						if (!next?.sourceImageDimensions) {
							return;
						}
						onChange({
							...item,
							assetRecordId: next.assetRecordId,
							assetVersionId: next.id,
							naturalSize: next.sourceImageDimensions,
							crop: { x: 0, y: 0, ...next.sourceImageDimensions },
						});
					}}
					value={item.assetVersionId}
				>
					{versions.map((v) => (
						<option key={v.id} value={v.id}>
							{names.get(v.assetRecordId)} · Sürüm {v.versionNumber}
						</option>
					))}
				</select>
			</label>
			<label className="grid gap-1">
				İfade adı
				<input
					className="rounded border p-2"
					maxLength={100}
					onChange={(e) => onChange({ ...item, expression: e.target.value })}
					required
					value={item.expression}
				/>
			</label>
			<label className="grid gap-1">
				Kullanım amacı
				<select
					className="rounded border p-2"
					onChange={(e) =>
						onChange({
							...item,
							usagePurpose: e.target.value === "ui" ? "ui" : "dialogue",
						})
					}
					value={item.usagePurpose}
				>
					<option value="dialogue">Diyalog</option>
					<option value="ui">Arayüz</option>
				</select>
			</label>
			<div className="grid grid-cols-2 gap-2">
				{(
					[
						["x", "Kırpma X"],
						["y", "Kırpma Y"],
						["width", "Kırpma genişliği"],
						["height", "Kırpma yüksekliği"],
					] as const
				).map(([key, label]) => (
					<label className="grid gap-1" key={key}>
						{label}
						<input
							className="w-full rounded border p-2"
							min={key === "x" || key === "y" ? 0 : 1}
							onChange={(e) =>
								onChange({
									...item,
									crop: { ...item.crop, [key]: e.target.valueAsNumber },
								})
							}
							required
							step={1}
							type="number"
							value={item.crop[key]}
						/>
					</label>
				))}
				{(
					[
						["width", "Kullanım genişliği"],
						["height", "Kullanım yüksekliği"],
					] as const
				).map(([key, label]) => (
					<label className="grid gap-1" key={key}>
						{label}
						<input
							className="w-full rounded border p-2"
							max={32_768}
							min={1}
							onChange={(e) =>
								onChange({
									...item,
									targetSize: {
										...item.targetSize,
										[key]: e.target.valueAsNumber,
									},
								})
							}
							required
							step={1}
							type="number"
							value={item.targetSize[key]}
						/>
					</label>
				))}
			</div>
			<label className="grid gap-1">
				Arka plan
				<select
					className="rounded border p-2"
					onChange={(e) =>
						onChange({
							...item,
							background: portraitReviewItemSchema.shape.background.parse(
								e.target.value
							),
						})
					}
					value={item.background}
				>
					<option value="light">Açık</option>
					<option value="dark">Koyu</option>
					<option value="transparent">Şeffaf</option>
				</select>
			</label>
			<p className="text-muted-foreground text-sm">
				Kaynak: {item.naturalSize.width} × {item.naturalSize.height} px. Kırpma
				kaynak görselin sol üstünden piksel cinsindendir. Önizleme kesin
				kullanım ölçüsündedir.
			</p>
			{valid ? null : (
				<p role="alert">
					İfade adı, kullanım ölçüsü ve kaynak sınırları içindeki kırpma
					gereklidir.
				</p>
			)}
			{valid && version ? (
				<PortraitUsagePreview
					item={item}
					key={JSON.stringify(item)}
					label={names.get(item.assetRecordId) ?? "Portre"}
					onReady={onReady}
					previewUrl={version.previewUrl}
				/>
			) : null}
			<Button onClick={onRemove} type="button" variant="outline">
				İfadeyi kaldır
			</Button>
		</fieldset>
	);
}

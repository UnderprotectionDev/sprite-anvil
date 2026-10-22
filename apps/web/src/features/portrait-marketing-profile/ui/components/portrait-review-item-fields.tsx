import type { AssetVersion } from "@sprite-anvil/api/asset-versions";
import {
	type PortraitReviewItem,
	portraitReviewItemSchema,
} from "@sprite-anvil/api/portrait-identity-reviews";
import { Button } from "@sprite-anvil/ui/components/button";
import { FieldLegend, FieldSet } from "@sprite-anvil/ui/components/field";
import { Input } from "@sprite-anvil/ui/components/input";
import { Label } from "@sprite-anvil/ui/components/label";
import {
	NativeSelect,
	NativeSelectOption,
} from "@sprite-anvil/ui/components/native-select";
import { PortraitUsagePreview } from "./portrait-usage-preview";

export function PortraitReviewItemFields({
	index,
	versions,
	names,
	disabled,
	field,
	onRemove,
	onReady,
}: {
	field: {
		handleChange: (item: PortraitReviewItem) => void;
		state: { value: PortraitReviewItem };
	};
	index: number;
	versions: AssetVersion[];
	names: ReadonlyMap<string, string>;
	disabled: boolean;
	onRemove: () => void;
	onReady: (ready: boolean) => void;
}) {
	const item = field.state.value;
	const version = versions.find((v) => v.id === item.assetVersionId);
	const valid = portraitReviewItemSchema.safeParse(item).success;
	return (
		<FieldSet className="space-y-3 rounded-md border p-3" disabled={disabled}>
			<FieldLegend>İfade {index + 1}</FieldLegend>
			<Label className="grid gap-1">
				Portre sürümü
				<NativeSelect
					className="w-full"
					onChange={(e) => {
						const next = versions.find((v) => v.id === e.target.value);
						if (!next?.sourceImageDimensions) {
							return;
						}
						field.handleChange({
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
						<NativeSelectOption key={v.id} value={v.id}>
							{names.get(v.assetRecordId)} · Sürüm {v.versionNumber}
						</NativeSelectOption>
					))}
				</NativeSelect>
			</Label>
			<Label className="grid gap-1">
				İfade adı
				<Input
					maxLength={100}
					onChange={(e) =>
						field.handleChange({ ...item, expression: e.target.value })
					}
					required
					value={item.expression}
				/>
			</Label>
			<Label className="grid gap-1">
				Kullanım amacı
				<NativeSelect
					className="w-full"
					onChange={(e) =>
						field.handleChange({
							...item,
							usagePurpose: e.target.value === "ui" ? "ui" : "dialogue",
						})
					}
					value={item.usagePurpose}
				>
					<NativeSelectOption value="dialogue">Diyalog</NativeSelectOption>
					<NativeSelectOption value="ui">Arayüz</NativeSelectOption>
				</NativeSelect>
			</Label>
			<div className="grid grid-cols-2 gap-2">
				{(
					[
						["x", "Kırpma X"],
						["y", "Kırpma Y"],
						["width", "Kırpma genişliği"],
						["height", "Kırpma yüksekliği"],
					] as const
				).map(([key, label]) => (
					<Label className="grid gap-1" key={key}>
						{label}
						<Input
							className="w-full"
							min={key === "x" || key === "y" ? 0 : 1}
							onChange={(e) =>
								field.handleChange({
									...item,
									crop: { ...item.crop, [key]: e.target.valueAsNumber },
								})
							}
							required
							step={1}
							type="number"
							value={item.crop[key]}
						/>
					</Label>
				))}
				{(
					[
						["width", "Kullanım genişliği"],
						["height", "Kullanım yüksekliği"],
					] as const
				).map(([key, label]) => (
					<Label className="grid gap-1" key={key}>
						{label}
						<Input
							className="w-full"
							max={32_768}
							min={1}
							onChange={(e) =>
								field.handleChange({
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
					</Label>
				))}
			</div>
			<Label className="grid gap-1">
				Arka plan
				<NativeSelect
					className="w-full"
					onChange={(e) =>
						field.handleChange({
							...item,
							background: portraitReviewItemSchema.shape.background.parse(
								e.target.value
							),
						})
					}
					value={item.background}
				>
					<NativeSelectOption value="light">Açık</NativeSelectOption>
					<NativeSelectOption value="dark">Koyu</NativeSelectOption>
					<NativeSelectOption value="transparent">Şeffaf</NativeSelectOption>
				</NativeSelect>
			</Label>
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
		</FieldSet>
	);
}

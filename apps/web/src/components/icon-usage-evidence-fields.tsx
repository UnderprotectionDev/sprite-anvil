import type { AssetVersion } from "@sprite-anvil/api/asset-versions";
import { Checkbox } from "@sprite-anvil/ui/components/checkbox";
import { Input } from "@sprite-anvil/ui/components/input";
import { Label } from "@sprite-anvil/ui/components/label";
import { StatusMessage } from "@/components/status-message";

export interface IconPixelDimensions {
	height: number;
	width: number;
}

interface IconUsageAssetRecord {
	assetCategory: string | null;
	id: string;
	logicalResolution?: IconPixelDimensions | null;
	name: string;
}

export interface IconUsagePreviewContext {
	assetRecordIds: string[];
	assetRecords: IconUsageAssetRecord[];
	assetVersions: AssetVersion[];
	currentAssetVersionIds: string[];
}

export function formatIconPixelDimensions(dimensions: IconPixelDimensions) {
	return `${dimensions.width} × ${dimensions.height}`;
}

function IconUsageSizePreview({
	data,
	targetDimensions,
}: {
	data?: IconUsagePreviewContext;
	targetDimensions: IconPixelDimensions | null;
}) {
	const linkedIcons = (data?.assetRecords ?? []).filter(
		(record) =>
			record.assetCategory === "icon" &&
			data?.assetRecordIds.includes(record.id)
	);
	const currentAssetVersionIds = new Set(data?.currentAssetVersionIds ?? []);
	return (
		<section
			aria-label="Icon usage size preview"
			className="space-y-3 rounded-md border p-3"
		>
			<h6 className="text-sm font-medium">Icon usage size preview</h6>
			<p className="text-muted-foreground text-sm">
				At each size, review silhouette recognition, small-size readability, and
				whether internal gaps close on light and dark backgrounds.
			</p>
			{linkedIcons.length === 0 ? (
				<p className="text-muted-foreground text-sm">
					No icon record was found for this usage test.
				</p>
			) : (
				linkedIcons.map((record) => {
					const currentVersion = data?.assetVersions.find(
						(version) =>
							version.assetRecordId === record.id &&
							currentAssetVersionIds.has(version.id)
					);
					if (!currentVersion) {
						return (
							<div className="space-y-2" key={record.id}>
								<p className="text-sm font-medium">{record.name}</p>
								<p className="text-muted-foreground text-sm">
									No current Asset Version was found; an old version is not
									previewed.
								</p>
							</div>
						);
					}

					const sourceDimensions = currentVersion.sourceImageDimensions ?? null;
					const logicalDimensions = record.logicalResolution ?? null;
					return (
						<div className="space-y-3 border-t pt-3" key={record.id}>
							<p className="text-sm font-medium">{record.name}</p>
							<div className="grid gap-3 md:grid-cols-2">
								{sourceDimensions ? (
									<IconDimensionPreview
										assetName={record.name}
										dimensions={sourceDimensions}
										kind="source"
										previewUrl={currentVersion.previewUrl}
									/>
								) : (
									<p className="text-muted-foreground text-sm">
										This Asset Version has no source image dimensions.
									</p>
								)}
								{logicalDimensions ? (
									<IconDimensionPreview
										assetName={record.name}
										dimensions={logicalDimensions}
										kind="logical"
										previewUrl={currentVersion.previewUrl}
									/>
								) : (
									<p className="text-muted-foreground text-sm">
										No verified Logical Resolution was found; it is not derived
										from the source dimensions.
									</p>
								)}
							</div>
							{targetDimensions ? (
								<div className="grid gap-3 md:grid-cols-2">
									<IconDimensionPreview
										assetName={record.name}
										dimensions={targetDimensions}
										kind="target"
										previewUrl={currentVersion.previewUrl}
									/>
									<IconDimensionPreview
										assetName={record.name}
										dimensions={targetDimensions}
										grayscale
										kind="target"
										previewUrl={currentVersion.previewUrl}
									/>
								</div>
							) : (
								<p className="text-muted-foreground text-sm">
									Enter a valid target size to see the target preview.
								</p>
							)}
						</div>
					);
				})
			)}
		</section>
	);
}

function IconDimensionPreview({
	assetName,
	dimensions,
	grayscale = false,
	kind,
	previewUrl,
}: {
	assetName: string;
	dimensions: IconPixelDimensions;
	grayscale?: boolean;
	kind: "source" | "logical" | "target";
	previewUrl: string;
}) {
	const kindLabel = grayscale ? `${kind} grayscale` : kind;
	const previewLabel = `${assetName} · ${kindLabel} ${formatIconPixelDimensions(dimensions)}`;
	const backgrounds = [
		{ label: "light background", name: "Light background", color: "#fafafa" },
		{ label: "dark background", name: "Dark background", color: "#18181b" },
	] as const;
	return (
		<figure className="space-y-2">
			<figcaption className="text-sm font-medium">
				{kindLabel} · {formatIconPixelDimensions(dimensions)}
			</figcaption>
			<div className="grid grid-cols-2 gap-2">
				{backgrounds.map((background) => (
					<div className="space-y-1" key={background.label}>
						<div
							className="flex min-h-20 min-w-20 items-center justify-center overflow-auto rounded border p-2"
							style={{ backgroundColor: background.color }}
						>
							<img
								alt={`${previewLabel} · ${background.label}`}
								height={dimensions.height}
								src={previewUrl}
								style={{
									filter: grayscale ? "grayscale(1)" : undefined,
									height: `${dimensions.height}px`,
									imageRendering: "pixelated",
									objectFit: "contain",
									width: `${dimensions.width}px`,
								}}
								width={dimensions.width}
							/>
						</div>
						<p className="text-muted-foreground text-xs">{background.name}</p>
					</div>
				))}
			</div>
		</figure>
	);
}

export function IconUsageEvidenceFields({
	data,
	formId,
	grayscaleReviewed,
	onGrayscaleReviewedChange,
	onTargetHeightChange,
	onTargetWidthChange,
	onUsageVariantChange,
	targetDimensions,
	targetHeight,
	targetWidth,
	usageVariantError,
	usageVariant,
}: {
	data?: IconUsagePreviewContext;
	formId: string;
	grayscaleReviewed: boolean;
	onGrayscaleReviewedChange: (reviewed: boolean) => void;
	onTargetHeightChange: (height: string) => void;
	onTargetWidthChange: (width: string) => void;
	onUsageVariantChange: (variant: string) => void;
	targetDimensions: IconPixelDimensions | null;
	targetHeight: string;
	targetWidth: string;
	usageVariantError: string;
	usageVariant: string;
}) {
	return (
		<>
			<IconUsageSizePreview data={data} targetDimensions={targetDimensions} />
			<Label
				className="block space-y-1 text-sm"
				htmlFor={`${formId}-usage-variant`}
			>
				<span>Usage variant</span>
				<Input
					aria-describedby={
						usageVariantError ? `${formId}-usage-variant-error` : undefined
					}
					aria-invalid={usageVariantError !== "" || undefined}
					id={`${formId}-usage-variant`}
					maxLength={120}
					onChange={(event) => onUsageVariantChange(event.currentTarget.value)}
					required
					type="text"
					value={usageVariant}
				/>
			</Label>
			{usageVariantError ? (
				<StatusMessage id={`${formId}-usage-variant-error`} tone="error">
					{usageVariantError}
				</StatusMessage>
			) : null}
			<div className="grid gap-3 sm:grid-cols-2">
				<Label
					className="block space-y-1 text-sm"
					htmlFor={`${formId}-target-width`}
				>
					<span>Target width</span>
					<Input
						id={`${formId}-target-width`}
						inputMode="numeric"
						max={2_147_483_647}
						min={1}
						onChange={(event) => onTargetWidthChange(event.currentTarget.value)}
						required
						step={1}
						type="number"
						value={targetWidth}
					/>
				</Label>
				<Label
					className="block space-y-1 text-sm"
					htmlFor={`${formId}-target-height`}
				>
					<span>Target height</span>
					<Input
						id={`${formId}-target-height`}
						inputMode="numeric"
						max={2_147_483_647}
						min={1}
						onChange={(event) =>
							onTargetHeightChange(event.currentTarget.value)
						}
						required
						step={1}
						type="number"
						value={targetHeight}
					/>
				</Label>
			</div>
			<Label
				className="flex items-center gap-2 text-sm"
				htmlFor={`${formId}-grayscale-reviewed`}
			>
				<Checkbox
					checked={grayscaleReviewed}
					id={`${formId}-grayscale-reviewed`}
					onCheckedChange={onGrayscaleReviewedChange}
					required
				/>
				<span>I reviewed grayscale</span>
			</Label>
		</>
	);
}

import type { AssetVersion } from "@sprite-anvil/api/asset-versions";

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
			aria-label="İkon kullanım boyutu önizlemesi"
			className="space-y-3 rounded-md border p-3"
		>
			<h6 className="font-medium text-sm">İkon kullanım boyutu önizlemesi</h6>
			<p className="text-muted-foreground text-sm">
				Her ölçüde siluetin ayırt edilebilirliğini, küçük boyutta okunurluğu ve
				iç boşlukların kapanıp kapanmadığını açık ve koyu zeminde inceleyin.
			</p>
			{linkedIcons.length === 0 ? (
				<p className="text-muted-foreground text-sm">
					Bu kullanım testine bağlı ikon kaydı bulunamadı.
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
								<p className="font-medium text-sm">{record.name}</p>
								<p className="text-muted-foreground text-sm">
									Güncel Varlık Sürümü bulunamadı; eski bir sürüm önizlenmiyor.
								</p>
							</div>
						);
					}

					const sourceDimensions = currentVersion.sourceImageDimensions ?? null;
					const logicalDimensions = record.logicalResolution ?? null;
					return (
						<div className="space-y-3 border-t pt-3" key={record.id}>
							<p className="font-medium text-sm">{record.name}</p>
							<div className="grid gap-3 md:grid-cols-2">
								{sourceDimensions ? (
									<IconDimensionPreview
										assetName={record.name}
										dimensions={sourceDimensions}
										kind="kaynak"
										previewUrl={currentVersion.previewUrl}
									/>
								) : (
									<p className="text-muted-foreground text-sm">
										Bu Varlık Sürümünde kaynak görsel ölçüsü bulunmuyor.
									</p>
								)}
								{logicalDimensions ? (
									<IconDimensionPreview
										assetName={record.name}
										dimensions={logicalDimensions}
										kind="mantıksal"
										previewUrl={currentVersion.previewUrl}
									/>
								) : (
									<p className="text-muted-foreground text-sm">
										Doğrulanmış Mantıksal Çözünürlük bulunamadı; kaynak ölçüden
										türetilmiyor.
									</p>
								)}
							</div>
							{targetDimensions ? (
								<div className="grid gap-3 md:grid-cols-2">
									<IconDimensionPreview
										assetName={record.name}
										dimensions={targetDimensions}
										kind="hedef"
										previewUrl={currentVersion.previewUrl}
									/>
									<IconDimensionPreview
										assetName={record.name}
										dimensions={targetDimensions}
										grayscale
										kind="hedef"
										previewUrl={currentVersion.previewUrl}
									/>
								</div>
							) : (
								<p className="text-muted-foreground text-sm">
									Hedef önizlemeyi görmek için geçerli bir hedef ölçü girin.
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
	kind: "kaynak" | "mantıksal" | "hedef";
	previewUrl: string;
}) {
	const kindLabel = grayscale ? `${kind} gri tonlama` : kind;
	const previewLabel = `${assetName} · ${kindLabel} ${formatIconPixelDimensions(dimensions)}`;
	const backgrounds = [
		{ label: "açık zemin", name: "Açık zemin", color: "#fafafa" },
		{ label: "koyu zemin", name: "Koyu zemin", color: "#18181b" },
	] as const;
	return (
		<figure className="space-y-2">
			<figcaption className="font-medium text-sm">
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
			<label
				className="block space-y-1 text-sm"
				htmlFor={`${formId}-usage-variant`}
			>
				<span>Kullanım Çeşidi</span>
				<input
					aria-describedby={
						usageVariantError ? `${formId}-usage-variant-error` : undefined
					}
					aria-invalid={usageVariantError !== "" || undefined}
					className="w-full rounded-md border bg-background px-3 py-2"
					id={`${formId}-usage-variant`}
					maxLength={120}
					onChange={(event) => onUsageVariantChange(event.currentTarget.value)}
					required
					type="text"
					value={usageVariant}
				/>
			</label>
			{usageVariantError ? (
				<p
					className="text-destructive text-sm"
					id={`${formId}-usage-variant-error`}
					role="alert"
				>
					{usageVariantError}
				</p>
			) : null}
			<div className="grid gap-3 sm:grid-cols-2">
				<label
					className="block space-y-1 text-sm"
					htmlFor={`${formId}-target-width`}
				>
					<span>Hedef genişlik</span>
					<input
						className="w-full rounded-md border bg-background px-3 py-2"
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
				</label>
				<label
					className="block space-y-1 text-sm"
					htmlFor={`${formId}-target-height`}
				>
					<span>Hedef yükseklik</span>
					<input
						className="w-full rounded-md border bg-background px-3 py-2"
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
				</label>
			</div>
			<label
				className="flex items-center gap-2 text-sm"
				htmlFor={`${formId}-grayscale-reviewed`}
			>
				<input
					checked={grayscaleReviewed}
					id={`${formId}-grayscale-reviewed`}
					onChange={(event) =>
						onGrayscaleReviewedChange(event.currentTarget.checked)
					}
					required
					type="checkbox"
				/>
				<span>Gri tonlamayı inceledim</span>
			</label>
		</>
	);
}

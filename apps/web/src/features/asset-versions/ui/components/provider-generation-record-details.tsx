import type {
	AssetVersionProductionSource,
	ProviderGenerationRecord,
} from "@sprite-anvil/api/provider-generation-records";

const unknownProviderFields = [
	"Üretim kaynağı",
	"Sağlayıcı",
	"Arayüz / API",
	"Model",
	"Model sürümü",
	"İstenen ölçü",
	"Gerçekleşen ölçü",
	"Referans kimlikleri",
	"Palet",
	"Tohum",
	"Sağlayıcıya özgü parametreler",
];

function displayUnknown(value: string | number | null) {
	return value === null ? "Bilinmiyor" : String(value);
}

function displayDimensions(
	dimensions: ProviderGenerationRecord["requestedDimensions"]
) {
	return dimensions
		? `${dimensions.width} × ${dimensions.height} px`
		: "Bilinmiyor";
}

export function ProviderGenerationRecordDetails({
	productionSource,
	providerGenerationRecord,
}: {
	productionSource: AssetVersionProductionSource;
	providerGenerationRecord: ProviderGenerationRecord | null;
}) {
	if (!providerGenerationRecord) {
		if (productionSource === "connected_provider") {
			return (
				<p
					className="rounded-md border border-warning/50 bg-warning/10 p-3 text-sm"
					role="status"
				>
					Sağlayıcı Üretim Kaydı bekleniyor. Bu sürüm, kayıt tamamlanmadan
					onaylanamaz.
				</p>
			);
		}

		return (
			<section
				aria-label="Üretim ayrıntıları"
				className="space-y-3 rounded-md border p-3"
			>
				<h5 className="font-medium">Üretim ayrıntıları</h5>
				<dl className="grid gap-2 text-sm sm:grid-cols-2">
					{unknownProviderFields.map((label) => (
						<div key={label}>
							<dt className="text-muted-foreground">{label}</dt>
							<dd>Bilinmiyor</dd>
						</div>
					))}
				</dl>
				<p className="text-muted-foreground text-xs">
					Bu sürümün üretim kaynağı ve sağlayıcı bilgileri kaydedilmemiştir.
				</p>
			</section>
		);
	}

	return (
		<section
			aria-labelledby={`provider-generation-record-${providerGenerationRecord.id}`}
			className="space-y-3 rounded-md border p-3"
		>
			<h5
				className="font-medium"
				id={`provider-generation-record-${providerGenerationRecord.id}`}
			>
				Sağlayıcı Üretim Kaydı
			</h5>
			<dl className="grid gap-2 text-sm sm:grid-cols-2">
				<div>
					<dt className="text-muted-foreground">Sağlayıcı</dt>
					<dd>{providerGenerationRecord.provider}</dd>
				</div>
				<div>
					<dt className="text-muted-foreground">Arayüz / API</dt>
					<dd>{displayUnknown(providerGenerationRecord.interface)}</dd>
				</div>
				<div>
					<dt className="text-muted-foreground">Model</dt>
					<dd>{displayUnknown(providerGenerationRecord.model)}</dd>
				</div>
				<div>
					<dt className="text-muted-foreground">Model sürümü</dt>
					<dd>{displayUnknown(providerGenerationRecord.modelVersion)}</dd>
				</div>
				<div>
					<dt className="text-muted-foreground">İstenen ölçü</dt>
					<dd>
						{displayDimensions(providerGenerationRecord.requestedDimensions)}
					</dd>
				</div>
				<div>
					<dt className="text-muted-foreground">Gerçekleşen ölçü</dt>
					<dd>
						{displayDimensions(providerGenerationRecord.actualDimensions)}
					</dd>
				</div>
				<div>
					<dt className="text-muted-foreground">Referans kimlikleri</dt>
					<dd>
						{providerGenerationRecord.referenceIds.length > 0
							? providerGenerationRecord.referenceIds.join(", ")
							: "Bilinmiyor"}
					</dd>
				</div>
				<div>
					<dt className="text-muted-foreground">Palet</dt>
					<dd>
						{providerGenerationRecord.palette.length > 0
							? providerGenerationRecord.palette.join(", ")
							: "Bilinmiyor"}
					</dd>
				</div>
				<div>
					<dt className="text-muted-foreground">Tohum</dt>
					<dd>{displayUnknown(providerGenerationRecord.seed)}</dd>
				</div>
				<div>
					<dt className="text-muted-foreground">Kaydedilme zamanı</dt>
					<dd>
						<time dateTime={providerGenerationRecord.createdAt}>
							{new Date(providerGenerationRecord.createdAt).toLocaleString(
								"tr-TR"
							)}
						</time>
					</dd>
				</div>
			</dl>
			<details className="text-sm">
				<summary className="cursor-pointer font-medium">
					Sağlayıcıya özgü parametreler
				</summary>
				<pre className="mt-2 max-h-80 overflow-auto rounded-md bg-muted p-3 text-xs">
					{JSON.stringify(providerGenerationRecord.parameterSnapshot, null, 2)}
				</pre>
			</details>
			<p className="text-muted-foreground text-xs">
				Bu kayıt aynı görselin yeniden üretileceğini garanti etmez.
			</p>
		</section>
	);
}

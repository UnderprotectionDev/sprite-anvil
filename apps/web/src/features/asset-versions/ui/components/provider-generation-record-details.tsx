import type {
	AssetVersionProductionSource,
	ProviderGenerationRecord,
} from "@sprite-anvil/api/provider-generation-records";

const unknownProviderFields = [
	"Production source",
	"Provider",
	"Interface / API",
	"Model",
	"Model version",
	"Requested dimensions",
	"Actual dimensions",
	"Reference IDs",
	"Palette",
	"Seed",
	"Provider-specific parameters",
];

function displayUnknown(value: string | number | null) {
	return value === null ? "Unknown" : String(value);
}

function displayDimensions(
	dimensions: ProviderGenerationRecord["requestedDimensions"]
) {
	return dimensions
		? `${dimensions.width} × ${dimensions.height} px`
		: "Unknown";
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
					className="border-warning/50 bg-warning/10 rounded-md border p-3 text-sm"
					role="status"
				>
					A Provider Generation Record is pending. This version cannot be
					approved until the record is complete.
				</p>
			);
		}
		if (productionSource === "user_reported_provider") {
			return (
				<p className="rounded-md border p-3 text-sm" role="status">
					You can save details seen in the provider interface as user
					declarations; they are not verified through a provider connection.
				</p>
			);
		}

		return (
			<section
				aria-label="Production details"
				className="space-y-3 rounded-md border p-3"
			>
				<h5 className="font-medium">Production details</h5>
				<dl className="grid gap-2 text-sm sm:grid-cols-2">
					{unknownProviderFields.map((label) => (
						<div key={label}>
							<dt className="text-muted-foreground">{label}</dt>
							<dd>Unknown</dd>
						</div>
					))}
				</dl>
				<p className="text-muted-foreground text-xs">
					This version's production source and provider details have not been
					recorded.
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
				Provider Generation Record
			</h5>
			<p className="text-muted-foreground text-sm">
				{productionSource === "user_reported_provider"
					? "Reported by the user; not verified through a provider connection."
					: "Recorded through a provider connection."}
			</p>
			<dl className="grid gap-2 text-sm sm:grid-cols-2">
				<div>
					<dt className="text-muted-foreground">Provider</dt>
					<dd>{providerGenerationRecord.provider}</dd>
				</div>
				<div>
					<dt className="text-muted-foreground">Interface / API</dt>
					<dd>{displayUnknown(providerGenerationRecord.interface)}</dd>
				</div>
				<div>
					<dt className="text-muted-foreground">Model</dt>
					<dd>{displayUnknown(providerGenerationRecord.model)}</dd>
				</div>
				<div>
					<dt className="text-muted-foreground">Model version</dt>
					<dd>{displayUnknown(providerGenerationRecord.modelVersion)}</dd>
				</div>
				<div>
					<dt className="text-muted-foreground">Requested dimensions</dt>
					<dd>
						{displayDimensions(providerGenerationRecord.requestedDimensions)}
					</dd>
				</div>
				<div>
					<dt className="text-muted-foreground">Actual dimensions</dt>
					<dd>
						{displayDimensions(providerGenerationRecord.actualDimensions)}
					</dd>
				</div>
				<div>
					<dt className="text-muted-foreground">Reference IDs</dt>
					<dd>
						{providerGenerationRecord.referenceIds.length > 0
							? providerGenerationRecord.referenceIds.join(", ")
							: "Unknown"}
					</dd>
				</div>
				<div>
					<dt className="text-muted-foreground">Palette</dt>
					<dd>
						{providerGenerationRecord.palette.length > 0
							? providerGenerationRecord.palette.join(", ")
							: "Unknown"}
					</dd>
				</div>
				<div>
					<dt className="text-muted-foreground">Seed</dt>
					<dd>{displayUnknown(providerGenerationRecord.seed)}</dd>
				</div>
				<div>
					<dt className="text-muted-foreground">Recorded at</dt>
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
					Provider-specific parameters
				</summary>
				<pre className="bg-muted mt-2 max-h-80 overflow-auto rounded-md p-3 text-xs">
					{Object.keys(providerGenerationRecord.parameterSnapshot.parameters)
						.length > 0
						? JSON.stringify(
								providerGenerationRecord.parameterSnapshot,
								null,
								2
							)
						: "Unknown"}
				</pre>
			</details>
			<p className="text-muted-foreground text-xs">
				This record does not guarantee reproduction of the same image.
			</p>
		</section>
	);
}

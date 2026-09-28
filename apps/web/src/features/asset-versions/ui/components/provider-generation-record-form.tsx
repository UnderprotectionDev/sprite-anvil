import type { ProviderGenerationRecordCreateInput } from "@sprite-anvil/api/provider-generation-records";
import { providerGenerationRecordCreateInputSchema } from "@sprite-anvil/api/provider-generation-records";
import { Button } from "@sprite-anvil/ui/components/button";
import { type SyntheticEvent, useId, useState } from "react";

type ProviderGenerationRecordFields = Omit<
	ProviderGenerationRecordCreateInput,
	"assetVersionId" | "projectId"
>;

function optionalText(value: string) {
	const normalized = value.trim();
	return normalized.length > 0 ? normalized : null;
}

const listSeparatorPattern = /[\r\n,]/;

function splitList(value: string) {
	return value
		.split(listSeparatorPattern)
		.map((entry) => entry.trim())
		.filter((entry) => entry.length > 0);
}

function readDimensions(width: string, height: string) {
	const normalizedWidth = width.trim();
	const normalizedHeight = height.trim();
	if (!(normalizedWidth || normalizedHeight)) {
		return { value: null, error: null };
	}
	if (!(normalizedWidth && normalizedHeight)) {
		return { value: null, error: "pair" };
	}
	const parsedWidth = Number(normalizedWidth);
	const parsedHeight = Number(normalizedHeight);
	if (
		!(Number.isInteger(parsedWidth) && Number.isInteger(parsedHeight)) ||
		parsedWidth < 1 ||
		parsedHeight < 1 ||
		parsedWidth > 100_000 ||
		parsedHeight > 100_000
	) {
		return { value: null, error: "range" };
	}
	return {
		value: { height: parsedHeight, width: parsedWidth },
		error: null,
	};
}

function parseProviderParameters(
	value: string
): ProviderGenerationRecordFields["providerParameters"] {
	if (!value.trim()) {
		return providerGenerationRecordCreateInputSchema.shape.providerParameters.parse(
			{}
		) as ProviderGenerationRecordFields["providerParameters"];
	}
	const parsed: unknown = JSON.parse(value);
	return providerGenerationRecordCreateInputSchema.shape.providerParameters.parse(
		parsed
	) as ProviderGenerationRecordFields["providerParameters"];
}

export function ProviderGenerationRecordForm({
	onSave,
	writesDisabled,
}: {
	onSave: (input: ProviderGenerationRecordFields) => Promise<boolean>;
	writesDisabled: boolean;
}) {
	const id = useId();
	const [provider, setProvider] = useState("");
	const [interfaceName, setInterfaceName] = useState("");
	const [model, setModel] = useState("");
	const [modelVersion, setModelVersion] = useState("");
	const [requestedWidth, setRequestedWidth] = useState("");
	const [requestedHeight, setRequestedHeight] = useState("");
	const [actualWidth, setActualWidth] = useState("");
	const [actualHeight, setActualHeight] = useState("");
	const [referenceIds, setReferenceIds] = useState("");
	const [palette, setPalette] = useState("");
	const [seed, setSeed] = useState("");
	const [providerParameters, setProviderParameters] = useState("");
	const [formError, setFormError] = useState<string | null>(null);

	async function submit(event: SyntheticEvent<HTMLFormElement>) {
		event.preventDefault();
		setFormError(null);
		const requested = readDimensions(requestedWidth, requestedHeight);
		if (requested.error) {
			setFormError(
				requested.error === "pair"
					? "İstenen ölçünün genişlik ve yükseklik değerlerini birlikte girin."
					: "İstenen ölçü 1 ile 100000 arasında tam sayı olmalıdır."
			);
			return;
		}
		const actual = readDimensions(actualWidth, actualHeight);
		if (actual.error) {
			setFormError(
				actual.error === "pair"
					? "Gerçekleşen ölçünün genişlik ve yükseklik değerlerini birlikte girin."
					: "Gerçekleşen ölçü 1 ile 100000 arasında tam sayı olmalıdır."
			);
			return;
		}

		let parameters: ProviderGenerationRecordFields["providerParameters"];
		try {
			parameters = parseProviderParameters(providerParameters);
		} catch {
			setFormError(
				"Sağlayıcıya özgü parametreler geçerli bir JSON nesnesi olmalı ve 50.000 UTF-8 baytı aşmamalıdır."
			);
			return;
		}

		await onSave({
			actualDimensions: actual.value,
			interface: optionalText(interfaceName),
			model: optionalText(model),
			modelVersion: optionalText(modelVersion),
			palette: splitList(palette),
			provider: provider.trim(),
			providerParameters: parameters,
			referenceIds: splitList(referenceIds),
			requestedDimensions: requested.value,
			seed: optionalText(seed),
		});
	}

	return (
		<section
			aria-labelledby={`${id}-heading`}
			className="space-y-3 rounded-md border p-3"
		>
			<h5 className="font-medium" id={`${id}-heading`}>
				Sağlayıcı Üretim Kaydını oluştur
			</h5>
			<p className="text-muted-foreground text-sm">
				Yalnızca sağlayıcı ekranında gördüğünüz değerleri girin. Bu bilgiler
				kullanıcı bildirimi olarak kaydedilir ve sağlayıcı bağlantısıyla
				doğrulanmaz. Boş alanlar Bilinmiyor kalır; sağlayıcıya özgü
				parametrelerde sır veya geçici erişim bağlantısı paylaşmayın.
			</p>
			<form className="grid gap-3 sm:grid-cols-2" onSubmit={submit}>
				<label className="space-y-1 text-sm" htmlFor={`${id}-provider`}>
					<span className="block">Sağlayıcı</span>
					<input
						className="min-h-11 w-full rounded-md border bg-background px-3"
						disabled={writesDisabled}
						id={`${id}-provider`}
						maxLength={200}
						onChange={(event) => setProvider(event.currentTarget.value)}
						required
						value={provider}
					/>
				</label>
				<label className="space-y-1 text-sm" htmlFor={`${id}-interface`}>
					<span className="block">Arayüz / API</span>
					<input
						className="min-h-11 w-full rounded-md border bg-background px-3"
						disabled={writesDisabled}
						id={`${id}-interface`}
						maxLength={500}
						onChange={(event) => setInterfaceName(event.currentTarget.value)}
						value={interfaceName}
					/>
				</label>
				<label className="space-y-1 text-sm" htmlFor={`${id}-model`}>
					<span className="block">Model</span>
					<input
						className="min-h-11 w-full rounded-md border bg-background px-3"
						disabled={writesDisabled}
						id={`${id}-model`}
						maxLength={500}
						onChange={(event) => setModel(event.currentTarget.value)}
						value={model}
					/>
				</label>
				<label className="space-y-1 text-sm" htmlFor={`${id}-model-version`}>
					<span className="block">Model sürümü</span>
					<input
						className="min-h-11 w-full rounded-md border bg-background px-3"
						disabled={writesDisabled}
						id={`${id}-model-version`}
						maxLength={500}
						onChange={(event) => setModelVersion(event.currentTarget.value)}
						value={modelVersion}
					/>
				</label>
				<fieldset className="grid gap-2 sm:col-span-2 sm:grid-cols-2">
					<legend className="mb-2 font-medium text-sm">
						İstenen ölçü (px)
					</legend>
					<label
						className="space-y-1 text-sm"
						htmlFor={`${id}-requested-width`}
					>
						<span className="block">İstenen genişlik (px)</span>
						<input
							className="min-h-11 w-full rounded-md border bg-background px-3"
							disabled={writesDisabled}
							id={`${id}-requested-width`}
							max={100_000}
							min={1}
							onChange={(event) => setRequestedWidth(event.currentTarget.value)}
							step={1}
							type="number"
							value={requestedWidth}
						/>
					</label>
					<label
						className="space-y-1 text-sm"
						htmlFor={`${id}-requested-height`}
					>
						<span className="block">İstenen yükseklik (px)</span>
						<input
							className="min-h-11 w-full rounded-md border bg-background px-3"
							disabled={writesDisabled}
							id={`${id}-requested-height`}
							max={100_000}
							min={1}
							onChange={(event) =>
								setRequestedHeight(event.currentTarget.value)
							}
							step={1}
							type="number"
							value={requestedHeight}
						/>
					</label>
				</fieldset>
				<fieldset className="grid gap-2 sm:col-span-2 sm:grid-cols-2">
					<legend className="mb-2 font-medium text-sm">
						Gerçekleşen ölçü (px)
					</legend>
					<label className="space-y-1 text-sm" htmlFor={`${id}-actual-width`}>
						<span className="block">Gerçekleşen genişlik (px)</span>
						<input
							className="min-h-11 w-full rounded-md border bg-background px-3"
							disabled={writesDisabled}
							id={`${id}-actual-width`}
							max={100_000}
							min={1}
							onChange={(event) => setActualWidth(event.currentTarget.value)}
							step={1}
							type="number"
							value={actualWidth}
						/>
					</label>
					<label className="space-y-1 text-sm" htmlFor={`${id}-actual-height`}>
						<span className="block">Gerçekleşen yükseklik (px)</span>
						<input
							className="min-h-11 w-full rounded-md border bg-background px-3"
							disabled={writesDisabled}
							id={`${id}-actual-height`}
							max={100_000}
							min={1}
							onChange={(event) => setActualHeight(event.currentTarget.value)}
							step={1}
							type="number"
							value={actualHeight}
						/>
					</label>
				</fieldset>
				<label className="space-y-1 text-sm" htmlFor={`${id}-references`}>
					<span className="block">Referans kimlikleri</span>
					<textarea
						className="min-h-20 w-full rounded-md border bg-background px-3 py-2"
						disabled={writesDisabled}
						id={`${id}-references`}
						maxLength={20_000}
						onChange={(event) => setReferenceIds(event.currentTarget.value)}
						value={referenceIds}
					/>
				</label>
				<label className="space-y-1 text-sm" htmlFor={`${id}-palette`}>
					<span className="block">Palet</span>
					<textarea
						className="min-h-20 w-full rounded-md border bg-background px-3 py-2"
						disabled={writesDisabled}
						id={`${id}-palette`}
						maxLength={20_000}
						onChange={(event) => setPalette(event.currentTarget.value)}
						value={palette}
					/>
				</label>
				<label className="space-y-1 text-sm" htmlFor={`${id}-seed`}>
					<span className="block">Tohum</span>
					<input
						className="min-h-11 w-full rounded-md border bg-background px-3"
						disabled={writesDisabled}
						id={`${id}-seed`}
						maxLength={256}
						onChange={(event) => setSeed(event.currentTarget.value)}
						value={seed}
					/>
				</label>
				<label
					className="space-y-1 text-sm sm:col-span-2"
					htmlFor={`${id}-parameters`}
				>
					<span className="block">Sağlayıcıya özgü parametreler (JSON)</span>
					<textarea
						className="min-h-28 w-full rounded-md border bg-background px-3 py-2 font-mono text-xs"
						disabled={writesDisabled}
						id={`${id}-parameters`}
						maxLength={50_000}
						onChange={(event) =>
							setProviderParameters(event.currentTarget.value)
						}
						value={providerParameters}
					/>
				</label>
				{formError ? (
					<p className="text-destructive text-sm sm:col-span-2" role="alert">
						{formError}
					</p>
				) : null}
				<div className="sm:col-span-2">
					<Button disabled={writesDisabled} type="submit">
						Sağlayıcı üretim kaydını kaydet
					</Button>
				</div>
			</form>
		</section>
	);
}

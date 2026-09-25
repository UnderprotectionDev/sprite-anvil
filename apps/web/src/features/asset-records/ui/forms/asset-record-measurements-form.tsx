import type {
	AssetRecord,
	AssetRecordMeasurements,
} from "@sprite-anvil/api/asset-records";
import { Button } from "@sprite-anvil/ui/components/button";
import { Input } from "@sprite-anvil/ui/components/input";
import type { SyntheticEvent } from "react";
import { useEffect, useState } from "react";
import { getErrorMessage } from "@/utils/get-error-message";
import { client } from "@/utils/orpc";

const measurementDefinitions = [
	{
		fields: [
			{ key: "width", label: "Genişlik (px)" },
			{ key: "height", label: "Yükseklik (px)" },
		],
		key: "sourceImageDimensions",
		label: "Kaynak Görsel Ölçüsü",
	},
	{
		fields: [
			{ key: "width", label: "Genişlik (px)" },
			{ key: "height", label: "Yükseklik (px)" },
		],
		key: "logicalResolution",
		label: "Mantıksal Çözünürlük",
	},
	{
		fields: [
			{ key: "width", label: "Genişlik (px)" },
			{ key: "height", label: "Yükseklik (px)" },
		],
		key: "cellDimensions",
		label: "Hücre Ölçüsü",
	},
	{
		fields: [
			{ key: "x", label: "X (px)" },
			{ key: "y", label: "Y (px)" },
			{ key: "width", label: "Genişlik (px)" },
			{ key: "height", label: "Yükseklik (px)" },
		],
		key: "visibleContentBounds",
		label: "Görünür İçerik Sınırı",
	},
	{
		fields: [{ key: "value", label: "Ölçek" }],
		key: "displayScale",
		label: "Gösterim Ölçeği",
	},
	{
		fields: [
			{ key: "width", label: "Genişlik (px)" },
			{ key: "height", label: "Yükseklik (px)" },
		],
		key: "atlasDimensions",
		label: "Atlas Ölçüsü",
	},
] as const;

type MeasurementKey = (typeof measurementDefinitions)[number]["key"];
type MeasurementState = "proposal" | "confirmed";
type MeasurementDraft = Record<string, string>;

const measurementStates: readonly {
	key: MeasurementState;
	label: string;
}[] = [
	{ key: "proposal", label: "Öneri" },
	{ key: "confirmed", label: "Doğrulanmış değer" },
];

function draftKey(
	measurement: MeasurementKey,
	state: MeasurementState,
	field: string
) {
	return `${measurement}.${state}.${field}`;
}

function draftFromMeasurements(
	measurements: AssetRecordMeasurements
): MeasurementDraft {
	const draft: MeasurementDraft = {};
	for (const definition of measurementDefinitions) {
		for (const state of measurementStates) {
			const value = measurements[definition.key][state.key];
			if (typeof value === "number") {
				draft[draftKey(definition.key, state.key, "value")] = String(value);
			} else if (value) {
				for (const [field, fieldValue] of Object.entries(value)) {
					draft[draftKey(definition.key, state.key, field)] =
						String(fieldValue);
				}
			}
		}
	}
	return draft;
}

function readNumber(
	draft: MeasurementDraft,
	measurement: MeasurementKey,
	state: MeasurementState,
	field: string,
	minimum: number,
	integer: boolean,
	label: string
) {
	const value = draft[draftKey(measurement, state, field)] ?? "";
	if (value.trim() === "") {
		return null;
	}
	const number = Number(value);
	if (
		!Number.isFinite(number) ||
		number < minimum ||
		(integer && !Number.isInteger(number))
	) {
		throw new Error(
			`${label} geçerli bir ${integer ? "tam sayı" : "sayı"} olmalı.`
		);
	}
	return number;
}

function readPixelDimensions(
	draft: MeasurementDraft,
	measurement: MeasurementKey,
	state: MeasurementState,
	label: string
) {
	const width = readNumber(draft, measurement, state, "width", 1, true, label);
	const height = readNumber(
		draft,
		measurement,
		state,
		"height",
		1,
		true,
		label
	);
	if (width === null && height === null) {
		return null;
	}
	if (width === null || height === null) {
		throw new Error(`${label} için genişlik ve yükseklik birlikte girilmeli.`);
	}
	return { height, width };
}

function readVisibleContentBounds(
	draft: MeasurementDraft,
	state: MeasurementState
) {
	const measurement = "visibleContentBounds";
	const x = readNumber(
		draft,
		measurement,
		state,
		"x",
		0,
		true,
		"Görünür İçerik Sınırı"
	);
	const y = readNumber(
		draft,
		measurement,
		state,
		"y",
		0,
		true,
		"Görünür İçerik Sınırı"
	);
	const width = readNumber(
		draft,
		measurement,
		state,
		"width",
		1,
		true,
		"Görünür İçerik Sınırı"
	);
	const height = readNumber(
		draft,
		measurement,
		state,
		"height",
		1,
		true,
		"Görünür İçerik Sınırı"
	);
	if (x === null && y === null && width === null && height === null) {
		return null;
	}
	if (x === null || y === null || width === null || height === null) {
		throw new Error(
			"Görünür İçerik Sınırı için X, Y, genişlik ve yükseklik birlikte girilmeli."
		);
	}
	return { height, width, x, y };
}

function readDisplayScale(draft: MeasurementDraft, state: MeasurementState) {
	return readNumber(
		draft,
		"displayScale",
		state,
		"value",
		Number.MIN_VALUE,
		false,
		"Gösterim Ölçeği"
	);
}

function readMeasurements(draft: MeasurementDraft): AssetRecordMeasurements {
	return {
		atlasDimensions: {
			confirmed: readPixelDimensions(
				draft,
				"atlasDimensions",
				"confirmed",
				"Atlas Ölçüsü"
			),
			proposal: readPixelDimensions(
				draft,
				"atlasDimensions",
				"proposal",
				"Atlas Ölçüsü"
			),
		},
		cellDimensions: {
			confirmed: readPixelDimensions(
				draft,
				"cellDimensions",
				"confirmed",
				"Hücre Ölçüsü"
			),
			proposal: readPixelDimensions(
				draft,
				"cellDimensions",
				"proposal",
				"Hücre Ölçüsü"
			),
		},
		displayScale: {
			confirmed: readDisplayScale(draft, "confirmed"),
			proposal: readDisplayScale(draft, "proposal"),
		},
		logicalResolution: {
			confirmed: readPixelDimensions(
				draft,
				"logicalResolution",
				"confirmed",
				"Mantıksal Çözünürlük"
			),
			proposal: readPixelDimensions(
				draft,
				"logicalResolution",
				"proposal",
				"Mantıksal Çözünürlük"
			),
		},
		sourceImageDimensions: {
			confirmed: readPixelDimensions(
				draft,
				"sourceImageDimensions",
				"confirmed",
				"Kaynak Görsel Ölçüsü"
			),
			proposal: readPixelDimensions(
				draft,
				"sourceImageDimensions",
				"proposal",
				"Kaynak Görsel Ölçüsü"
			),
		},
		visibleContentBounds: {
			confirmed: readVisibleContentBounds(draft, "confirmed"),
			proposal: readVisibleContentBounds(draft, "proposal"),
		},
	};
}

function FieldGroup({
	definition,
	disabled,
	draft,
	onChange,
	state,
}: {
	definition: (typeof measurementDefinitions)[number];
	disabled: boolean;
	draft: MeasurementDraft;
	onChange: (key: string, value: string) => void;
	state: (typeof measurementStates)[number];
}) {
	const hasValue = definition.fields.some((field) =>
		Boolean(draft[draftKey(definition.key, state.key, field.key)]?.trim())
	);
	return (
		<fieldset className="space-y-3 rounded-md border p-3" disabled={disabled}>
			<legend className="px-1 font-medium text-sm">{state.label}</legend>
			<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
				{definition.fields.map((field) => {
					const id = `${definition.key}-${state.key}-${field.key}`;
					const key = draftKey(definition.key, state.key, field.key);
					const minimum =
						definition.key === "displayScale" ||
						field.key === "x" ||
						field.key === "y"
							? 0
							: 1;
					return (
						<label
							className="block space-y-1 text-sm"
							htmlFor={id}
							key={field.key}
						>
							<span>
								{field.label}
								{hasValue ? " *" : ""}
							</span>
							<Input
								aria-describedby="asset-record-measurements-help"
								aria-label={`${definition.label} — ${state.label} — ${field.label}`}
								className="min-h-11"
								id={id}
								min={minimum}
								onChange={(event) => onChange(key, event.target.value)}
								required={hasValue}
								step={definition.key === "displayScale" ? "any" : 1}
								type="number"
								value={draft[key] ?? ""}
							/>
						</label>
					);
				})}
			</div>
		</fieldset>
	);
}

export function AssetRecordMeasurementsForm({
	onRefresh,
	record,
}: {
	onRefresh: () => Promise<{ isError: boolean }>;
	record: AssetRecord;
}) {
	const [draft, setDraft] = useState(() =>
		draftFromMeasurements(record.measurements)
	);
	const [isSaving, setIsSaving] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [statusMessage, setStatusMessage] = useState<string | null>(null);

	useEffect(() => {
		setDraft(draftFromMeasurements(record.measurements));
	}, [record.measurements]);

	const displayScaleHasFraction = ["proposal", "confirmed"].some((state) => {
		const value = Number(
			draft[draftKey("displayScale", state as MeasurementState, "value")]
		);
		return Number.isFinite(value) && value > 0 && !Number.isInteger(value);
	});

	function updateDraft(key: string, value: string) {
		setDraft((current) => ({ ...current, [key]: value }));
		setErrorMessage(null);
		setStatusMessage(null);
	}

	async function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
		event.preventDefault();
		if (isSaving) {
			return;
		}
		setErrorMessage(null);
		setStatusMessage(null);
		setIsSaving(true);
		try {
			const saved = await client.assetRecords.updateMeasurements({
				assetRecordId: record.id,
				measurements: readMeasurements(draft),
				projectId: record.projectId,
			});
			setDraft(draftFromMeasurements(saved.measurements));
			const refreshed = await onRefresh();
			if (refreshed.isError) {
				setErrorMessage(
					"Ölçüler kaydedildi ancak kayıt yeniden okunamadı. Sayfayı yenileyerek durumu kontrol edin."
				);
				return;
			}
			setStatusMessage("Ölçüler kaydedildi.");
		} catch (error) {
			setErrorMessage(
				getErrorMessage(
					error,
					"Ölçüler kaydedilemedi. Değerleri kontrol edip yeniden deneyin."
				)
			);
		} finally {
			setIsSaving(false);
		}
	}

	return (
		<section
			aria-labelledby="asset-record-measurements-heading"
			className="space-y-4 rounded-lg border p-5"
		>
			<header className="space-y-2">
				<h2
					className="font-semibold text-xl"
					id="asset-record-measurements-heading"
				>
					Görsel ölçüleri
				</h2>
				<p
					className="text-muted-foreground text-sm"
					id="asset-record-measurements-help"
				>
					Öneri ve doğrulanmış değer ayrı saklanır. Dosya veya sidecar ölçüsü
					tek başına Mantıksal Çözünürlük değildir. Özel kare ve dikdörtgen
					ölçüler kullanabilirsiniz.
				</p>
			</header>
			{displayScaleHasFraction ? (
				<p className="text-sm" role="status">
					Piksel sanatında doğal sayı olmayan Gösterim Ölçeği keskinliği
					bozabilir. Yüksek çözünürlüklü illüstrasyonlar bu kurala zorlanmaz.
				</p>
			) : null}
			<form className="space-y-4" onSubmit={handleSubmit}>
				{measurementDefinitions.map((definition) => (
					<section
						aria-labelledby={`${definition.key}-heading`}
						className="space-y-3 rounded-md border p-4"
						key={definition.key}
					>
						<h3 className="font-medium" id={`${definition.key}-heading`}>
							{definition.label}
						</h3>
						<div className="grid gap-3 lg:grid-cols-2">
							{measurementStates.map((state) => (
								<FieldGroup
									definition={definition}
									disabled={isSaving}
									draft={draft}
									key={state.key}
									onChange={updateDraft}
									state={state}
								/>
							))}
						</div>
					</section>
				))}
				{errorMessage ? (
					<p aria-live="assertive" role="alert">
						{errorMessage}
					</p>
				) : null}
				{statusMessage ? (
					<p aria-live="polite" role="status">
						{statusMessage}
					</p>
				) : null}
				<Button className="min-h-11" disabled={isSaving} type="submit">
					{isSaving ? "Kaydediliyor…" : "Ölçüleri kaydet"}
				</Button>
			</form>
		</section>
	);
}

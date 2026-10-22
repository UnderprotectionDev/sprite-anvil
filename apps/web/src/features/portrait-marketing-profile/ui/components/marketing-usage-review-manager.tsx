import type { AssetVersion } from "@sprite-anvil/api/asset-versions";
import {
	createMarketingUsageReviewPackage,
	type MarketingUsageReviewInput,
	marketingUsageItemSchema,
	marketingUsageReviewInputSchema,
} from "@sprite-anvil/api/marketing-usage-reviews";
import type { ProjectProfileContractActivation } from "@sprite-anvil/api/specialized-profile-contracts";
import { Button } from "@sprite-anvil/ui/components/button";
import { FieldLegend, FieldSet } from "@sprite-anvil/ui/components/field";
import { Input } from "@sprite-anvil/ui/components/input";
import { Label } from "@sprite-anvil/ui/components/label";
import {
	NativeSelect,
	NativeSelectOption,
} from "@sprite-anvil/ui/components/native-select";
import { Textarea } from "@sprite-anvil/ui/components/textarea";
import { useForm, useStore } from "@tanstack/react-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useId, useState } from "react";
import { ENV } from "@/env";
import {
	isWriteOutcomeUncertain,
	showErrorToast,
} from "@/utils/error-notification";
import { getErrorMessage } from "@/utils/get-error-message";
import { mutationMeta } from "@/utils/mutation-meta";
import { orpc } from "@/utils/orpc";
import { MarketingUsagePreview } from "./marketing-usage-preview";

type Version = Pick<
	AssetVersion,
	| "id"
	| "assetRecordId"
	| "versionNumber"
	| "previewUrl"
	| "sourceImageDimensions"
>;
type Item = MarketingUsageReviewInput["items"][number];
const serverUrl = ENV.VITE_SERVER_URL?.replace(/\/$/, "") ?? "";
const geometryLabels = {
	crop: "Kırpma",
	safeArea: "Güvenli alan",
	displaySize: "Küçük kullanım ölçüsü",
};
const observationLabels = {
	readability: "Küçük boyutta okunurluk",
	safeArea: "Güvenli alan sonucu",
	crop: "Kırpma sonucu",
};
const outcomeLabels = {
	passed: "Geçti",
	failed: "Başarısız",
	inconclusive: "Sonuçsuz",
};
const purposeLabels = {
	logo: "Logo",
	opening: "Açılış",
	store: "Mağaza",
	marketing: "Tanıtım",
};
function initialItem(version: Version): Item {
	const size = version.sourceImageDimensions ?? { width: 1, height: 1 };
	return {
		assetRecordId: version.assetRecordId,
		assetVersionId: version.id,
		usePurpose: "logo",
		naturalSize: size,
		crop: { x: 0, y: 0, ...size },
		safeArea: { x: 0, y: 0, ...size },
		displaySize: { width: 64, height: 64 },
		presentation: "transparent",
		opaqueColor: null,
		observations: ["light", "dark"].map((background) => ({
			background: background as "light" | "dark",
			readability: "inconclusive",
			safeArea: "inconclusive",
			crop: "inconclusive",
			notes: "",
		})),
	};
}
export function MarketingUsageReviewManager({
	activation,
	projectId,
	family,
	canonicalDesignId,
	versions,
}: {
	activation: ProjectProfileContractActivation;
	projectId: string;
	family: { id: string; name: string; visualWorldId: string };
	canonicalDesignId: string | null;
	versions: Version[];
}) {
	const prefix = useId();
	const [defaultValues] = useState(() => ({
		item: initialItem(
			versions[0] ?? {
				id: "",
				assetRecordId: "",
				versionNumber: 1,
				previewUrl: "",
				sourceImageDimensions: null,
			}
		),
	}));
	const form = useForm({
		defaultValues,
		onSubmit: () => submit(),
	});
	const item = useStore(form.store, (state) => state.values.item);
	const saveMutation = useMutation(
		orpc.marketingUsageReviews.save.mutationOptions(mutationMeta)
	);
	const [saving, setSaving] = useState(false);
	const [uncertainId, setUncertainId] = useState<string | null>(null);
	const [message, setMessage] = useState("");
	const [readyKey, setReadyKey] = useState<string | null>(null);
	const query = useQuery(
		orpc.marketingUsageReviews.list.queryOptions({
			input: { projectId, assetFamilyId: family.id },
		})
	);
	const version = versions.find(
		(candidate) => candidate.id === item.assetVersionId
	);
	const previewKey = JSON.stringify([
		item.assetVersionId,
		item.crop,
		item.safeArea,
		item.displaySize,
		item.presentation,
		item.opaqueColor,
		version?.previewUrl,
	]);
	const geometryValid = marketingUsageItemSchema.safeParse({
		...item,
		observations: item.observations.map((observation) => ({
			...observation,
			notes: "preview",
		})),
	}).success;
	async function checkRecords() {
		const result = await query.refetch();
		if (
			!result.isError &&
			result.data?.some((record) => record.id === uncertainId)
		) {
			setUncertainId(null);
			setMessage("İnceleme kalıcı kayıttan doğrulandı.");
		} else {
			setMessage(
				"Sonuç henüz doğrulanamadı. Aynı incelemeyi göndermeden güncel kayıtları tekrar kontrol edin."
			);
		}
	}
	async function submit() {
		const result = marketingUsageReviewInputSchema.safeParse({
			id: crypto.randomUUID(),
			projectId,
			assetFamilyId: family.id,
			contractRevisionId: activation.contractRevisionId,
			visualWorldId: family.visualWorldId,
			canonicalDesignId,
			items: [item],
		});
		if (!result.success) {
			setMessage(
				result.error.issues[0]?.message ?? "Kullanım bilgilerini kontrol edin."
			);
			return;
		}
		if (readyKey !== previewKey) {
			setMessage("Önizlemelerin yüklenmesini bekleyin.");
			return;
		}
		setSaving(true);
		setMessage("");
		try {
			await saveMutation.mutateAsync(result.data);
			const reread = await query.refetch();
			if (
				reread.isError ||
				!reread.data?.some((record) => record.id === result.data.id)
			) {
				setUncertainId(result.data.id);
				setMessage(
					"İnceleme kaydedildi; yeniden okuma doğrulanamadı. Güncel kayıtları kontrol edin."
				);
			} else {
				setMessage("İnceleme kalıcı kayıttan doğrulandı.");
			}
		} catch (error) {
			if (isWriteOutcomeUncertain(error)) {
				showErrorToast(error, { kind: "mutation" });
				setUncertainId(result.data.id);
				setMessage("Kaydetme sonucu belirsiz. Güncel kayıtları kontrol edin.");
			} else {
				setMessage(getErrorMessage(error, "İnceleme kaydedilemedi."));
			}
		} finally {
			setSaving(false);
		}
	}
	return (
		<section className="space-y-4 rounded-md border p-4">
			<h3 className="font-semibold">
				Logo ve Tanıtım Kullanımlarını Sınama · {family.name}
			</h3>
			<p className="text-muted-foreground text-sm">
				Kırpma ve güvenli alan kaynak görselin sol üst köşesinden piksel olarak
				ölçülür. Küçük kullanım sonucunu siz değerlendirirsiniz; oyun içi piksel
				ölçeği uygulanmaz. Portre ifade incelemesi ayrı tutulur.
			</p>
			<form
				className="space-y-4"
				onSubmit={(event) => {
					event.preventDefault();
					event.stopPropagation();
					form.handleSubmit();
				}}
			>
				<FieldSet
					className="space-y-4"
					disabled={saving || uncertainId !== null}
				>
					<form.Field name="item">
						{(field) => (
							<MarketingUsageItemFields
								familyName={family.name}
								field={field}
								geometryValid={geometryValid}
								onPreviewReady={(ready) =>
									setReadyKey(ready ? previewKey : null)
								}
								onVersionSelected={() => setReadyKey(null)}
								prefix={prefix}
								previewBaseUrl={serverUrl}
								previewKey={previewKey}
								version={version}
								versions={versions}
							/>
						)}
					</form.Field>
					<Button
						disabled={
							readyKey !== previewKey || query.isPending || query.isError
						}
						type="submit"
					>
						{saving ? "Kaydediliyor…" : "Kullanım incelemesini kaydet"}
					</Button>
				</FieldSet>
			</form>
			{message ? <p role="status">{message}</p> : null}
			{uncertainId ? (
				<Button onClick={checkRecords} type="button" variant="outline">
					Güncel kayıtları kontrol et
				</Button>
			) : null}
			{query.isError ? (
				<div role="alert">
					İncelemeler okunamadı.
					<Button onClick={() => query.refetch()} type="button">
						Retry
					</Button>
				</div>
			) : null}
			<ul className="space-y-3">
				{query.data?.map((record) => (
					<li className="rounded border p-3" key={record.id}>
						<p>{new Date(record.createdAt).toLocaleString("tr-TR")}</p>
						{record.items.map((usage) => (
							<div key={JSON.stringify(usage)}>
								<p>
									{purposeLabels[usage.usePurpose]} · {usage.displaySize.width}{" "}
									× {usage.displaySize.height} px ·{" "}
									{usage.presentation === "opaque" ? "Opak" : "Şeffaf"}
								</p>
								{usage.observations.map((observation) => (
									<p key={observation.background}>
										{observation.background === "light" ? "Açık" : "Koyu"}:{" "}
										{outcomeLabels[observation.readability]} /{" "}
										{outcomeLabels[observation.safeArea]} /{" "}
										{outcomeLabels[observation.crop]} · {observation.notes}
									</p>
								))}
							</div>
						))}
						<Button
							onClick={() => {
								const blob = new Blob(
									[
										JSON.stringify(
											createMarketingUsageReviewPackage(record),
											null,
											2
										),
									],
									{ type: "application/json" }
								);
								const url = URL.createObjectURL(blob);
								const link = document.createElement("a");
								link.href = url;
								link.download = `marketing-usage-${record.id}.json`;
								link.click();
								URL.revokeObjectURL(url);
							}}
							type="button"
							variant="outline"
						>
							Kullanım kanıtını indir
						</Button>
					</li>
				))}
			</ul>
		</section>
	);
}

function MarketingUsageItemFields({
	familyName,
	field,
	geometryValid,
	onPreviewReady,
	onVersionSelected,
	prefix,
	previewKey,
	previewBaseUrl,
	version,
	versions,
}: {
	familyName: string;
	field: {
		handleChange: (item: Item) => void;
		state: { value: Item };
	};
	geometryValid: boolean;
	onPreviewReady: (ready: boolean) => void;
	onVersionSelected: () => void;
	prefix: string;
	previewKey: string;
	previewBaseUrl: string;
	version: Version | undefined;
	versions: Version[];
}) {
	const item = field.state.value;
	const update = (patch: Partial<Item>) =>
		field.handleChange({ ...item, ...patch });
	return (
		<>
			<Label className="block">
				Varlık Sürümü
				<NativeSelect
					aria-label="Varlık Sürümü"
					className="block w-full"
					onChange={(event) => {
						const selected = versions.find(
							(candidate) => candidate.id === event.target.value
						);
						if (selected) {
							field.handleChange(initialItem(selected));
							onVersionSelected();
						}
					}}
					value={item.assetVersionId}
				>
					{versions.map((candidate) => (
						<NativeSelectOption key={candidate.id} value={candidate.id}>
							Sürüm {candidate.versionNumber} · {candidate.id.slice(0, 8)}
						</NativeSelectOption>
					))}
				</NativeSelect>
			</Label>
			<Label className="block">
				Kullanım amacı
				<NativeSelect
					aria-label="Kullanım amacı"
					className="block"
					onChange={(event) =>
						update({
							usePurpose: event.target.value as Item["usePurpose"],
						})
					}
					value={item.usePurpose}
				>
					{Object.entries(purposeLabels).map(([value, label]) => (
						<NativeSelectOption key={value} value={value}>
							{label}
						</NativeSelectOption>
					))}
				</NativeSelect>
			</Label>
			<div className="grid gap-4 sm:grid-cols-3">
				{(["crop", "safeArea", "displaySize"] as const).map((key) => (
					<FieldSet className="space-y-2 rounded border p-3" key={key}>
						<FieldLegend>{geometryLabels[key]}</FieldLegend>
						{Object.entries(item[key]).map(([name, value]) => (
							<Label className="block text-sm" key={name}>
								{name}
								<Input
									aria-label={`${key} ${name}`}
									className="block w-full"
									max={32_768}
									min={name === "x" || name === "y" ? 0 : 1}
									onChange={(event) =>
										update({
											[key]: {
												...item[key],
												[name]: Number(event.target.value),
											},
										})
									}
									required
									step={1}
									type="number"
									value={value}
								/>
							</Label>
						))}
					</FieldSet>
				))}
			</div>
			<Label className="block">
				Sunum
				<NativeSelect
					aria-label="Sunum"
					className="block"
					onChange={(event) =>
						update({
							presentation: event.target.value as Item["presentation"],
							opaqueColor: event.target.value === "opaque" ? "#ffffff" : null,
						})
					}
					value={item.presentation}
				>
					<NativeSelectOption value="transparent">Şeffaf</NativeSelectOption>
					<NativeSelectOption value="opaque">Opak</NativeSelectOption>
				</NativeSelect>
			</Label>
			{item.presentation === "opaque" ? (
				<Label className="block">
					Opak zemin rengi
					<Input
						aria-label="Opak zemin rengi"
						className="block h-auto w-auto"
						onChange={(event) => update({ opaqueColor: event.target.value })}
						type="color"
						value={item.opaqueColor ?? "#ffffff"}
					/>
				</Label>
			) : null}
			{geometryValid && version ? (
				<MarketingUsagePreview
					item={item}
					key={previewKey}
					name={familyName}
					onReady={onPreviewReady}
					previewUrl={`${previewBaseUrl}${version.previewUrl}`}
				/>
			) : (
				<p role="alert">
					Kırpma ve güvenli alanı kaynak ölçüleri içinde tutun.
				</p>
			)}
			{item.observations.map((observation, index) => (
				<FieldSet
					className="space-y-3 rounded border p-3"
					key={observation.background}
				>
					<FieldLegend>
						{observation.background === "light"
							? "Açık zemin değerlendirmesi"
							: "Koyu zemin değerlendirmesi"}
					</FieldLegend>
					{(["readability", "safeArea", "crop"] as const).map((key) => (
						<Label
							className="block"
							htmlFor={`${prefix}-${index}-${key}`}
							key={key}
						>
							{observationLabels[key]}
							<NativeSelect
								className="block"
								id={`${prefix}-${index}-${key}`}
								onChange={(event) =>
									update({
										observations: item.observations.map((entry, i) =>
											i === index
												? {
														...entry,
														[key]: event.target.value,
													}
												: entry
										),
									})
								}
								value={observation[key]}
							>
								{Object.entries(outcomeLabels).map(([value, label]) => (
									<NativeSelectOption key={value} value={value}>
										{label}
									</NativeSelectOption>
								))}
							</NativeSelect>
						</Label>
					))}
					<div>
						<Label className="block" htmlFor={`${prefix}-${index}-notes`}>
							Gözlem
						</Label>
						<Textarea
							className="block w-full"
							id={`${prefix}-${index}-notes`}
							maxLength={2000}
							onChange={(event) =>
								update({
									observations: item.observations.map((entry, i) =>
										i === index
											? { ...entry, notes: event.target.value }
											: entry
									),
								})
							}
							required
							value={observation.notes}
						/>
					</div>
				</FieldSet>
			))}
		</>
	);
}

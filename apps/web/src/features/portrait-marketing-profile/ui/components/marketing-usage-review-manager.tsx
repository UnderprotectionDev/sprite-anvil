import type { AssetVersion } from "@sprite-anvil/api/asset-versions";
import {
	createMarketingUsageReviewPackage,
	type MarketingUsageReviewInput,
	marketingUsageItemSchema,
	marketingUsageReviewInputSchema,
} from "@sprite-anvil/api/marketing-usage-reviews";
import type { ProjectProfileContractActivation } from "@sprite-anvil/api/specialized-profile-contracts";
import { Button } from "@sprite-anvil/ui/components/button";
import { useQuery } from "@tanstack/react-query";
import { type SyntheticEvent, useId, useState } from "react";
import { ENV } from "@/env";
import { isWriteOutcomeUncertain } from "@/utils/error-notification";
import { getErrorMessage } from "@/utils/get-error-message";
import { client, orpc } from "@/utils/orpc";
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
	const [item, setItem] = useState(() =>
		initialItem(
			versions[0] ?? {
				id: "",
				assetRecordId: "",
				versionNumber: 1,
				previewUrl: "",
				sourceImageDimensions: null,
			}
		)
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
	function update(patch: Partial<Item>) {
		setItem((current) => ({ ...current, ...patch }));
	}
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
	async function submit(event: SyntheticEvent<HTMLFormElement>) {
		event.preventDefault();
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
			await client.marketingUsageReviews.save(result.data);
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
			<form className="space-y-4" onSubmit={submit}>
				<fieldset
					className="space-y-4"
					disabled={saving || uncertainId !== null}
				>
					<label className="block">
						Varlık Sürümü
						<select
							aria-label="Varlık Sürümü"
							className="block w-full rounded border p-2"
							onChange={(event) => {
								const selected = versions.find(
									(candidate) => candidate.id === event.target.value
								);
								if (selected) {
									setItem(initialItem(selected));
									setReadyKey(null);
								}
							}}
							value={item.assetVersionId}
						>
							{versions.map((candidate) => (
								<option key={candidate.id} value={candidate.id}>
									Sürüm {candidate.versionNumber} · {candidate.id.slice(0, 8)}
								</option>
							))}
						</select>
					</label>
					<label className="block">
						Kullanım amacı
						<select
							aria-label="Kullanım amacı"
							className="block rounded border p-2"
							onChange={(event) =>
								update({ usePurpose: event.target.value as Item["usePurpose"] })
							}
							value={item.usePurpose}
						>
							{Object.entries(purposeLabels).map(([value, label]) => (
								<option key={value} value={value}>
									{label}
								</option>
							))}
						</select>
					</label>
					<div className="grid gap-4 sm:grid-cols-3">
						{(["crop", "safeArea", "displaySize"] as const).map((key) => (
							<fieldset className="space-y-2 rounded border p-3" key={key}>
								<legend>{geometryLabels[key]}</legend>
								{Object.entries(item[key]).map(([field, value]) => (
									<label className="block text-sm" key={field}>
										{field}
										<input
											aria-label={`${key} ${field}`}
											className="block w-full rounded border p-2"
											max={32_768}
											min={field === "x" || field === "y" ? 0 : 1}
											onChange={(event) =>
												update({
													[key]: {
														...item[key],
														[field]: Number(event.target.value),
													},
												})
											}
											required
											step={1}
											type="number"
											value={value}
										/>
									</label>
								))}
							</fieldset>
						))}
					</div>
					<label className="block">
						Sunum
						<select
							aria-label="Sunum"
							className="block rounded border p-2"
							onChange={(event) =>
								update({
									presentation: event.target.value as Item["presentation"],
									opaqueColor:
										event.target.value === "opaque" ? "#ffffff" : null,
								})
							}
							value={item.presentation}
						>
							<option value="transparent">Şeffaf</option>
							<option value="opaque">Opak</option>
						</select>
					</label>
					{item.presentation === "opaque" ? (
						<label className="block">
							Opak zemin rengi
							<input
								aria-label="Opak zemin rengi"
								className="block"
								onChange={(event) =>
									update({ opaqueColor: event.target.value })
								}
								type="color"
								value={item.opaqueColor ?? "#ffffff"}
							/>
						</label>
					) : null}
					{geometryValid && version ? (
						<MarketingUsagePreview
							item={item}
							key={previewKey}
							name={family.name}
							onReady={(ready) => setReadyKey(ready ? previewKey : null)}
							previewUrl={`${serverUrl}${version.previewUrl}`}
						/>
					) : (
						<p role="alert">
							Kırpma ve güvenli alanı kaynak ölçüleri içinde tutun.
						</p>
					)}
					{item.observations.map((observation, index) => (
						<fieldset
							className="space-y-3 rounded border p-3"
							key={observation.background}
						>
							<legend>
								{observation.background === "light"
									? "Açık zemin değerlendirmesi"
									: "Koyu zemin değerlendirmesi"}
							</legend>
							{(["readability", "safeArea", "crop"] as const).map((key) => (
								<label
									className="block"
									htmlFor={`${prefix}-${index}-${key}`}
									key={key}
								>
									{observationLabels[key]}
									<select
										className="block rounded border p-2"
										id={`${prefix}-${index}-${key}`}
										onChange={(event) =>
											update({
												observations: item.observations.map((entry, i) =>
													i === index
														? { ...entry, [key]: event.target.value }
														: entry
												),
											})
										}
										value={observation[key]}
									>
										{Object.entries(outcomeLabels).map(([value, label]) => (
											<option key={value} value={value}>
												{label}
											</option>
										))}
									</select>
								</label>
							))}
							<div>
								<label className="block" htmlFor={`${prefix}-${index}-notes`}>
									Gözlem
								</label>
								<textarea
									className="block w-full rounded border p-2"
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
						</fieldset>
					))}
					<Button
						disabled={
							readyKey !== previewKey || query.isPending || query.isError
						}
						type="submit"
					>
						{saving ? "Kaydediliyor…" : "Kullanım incelemesini kaydet"}
					</Button>
				</fieldset>
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

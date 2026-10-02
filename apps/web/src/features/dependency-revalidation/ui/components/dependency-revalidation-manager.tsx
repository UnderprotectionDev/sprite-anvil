import type {
	ChangeFacetInput,
	DependencyLinkInput,
} from "@sprite-anvil/api/dependency-revalidation";
import { Button } from "@sprite-anvil/ui/components/button";
import { useQuery } from "@tanstack/react-query";
import { useId, useState } from "react";
import { client, orpc } from "@/utils/orpc";
import {
	DependencyFacets,
	dependencyFacetLabel,
	selectedDependencyFacets,
} from "./dependency-facets";

interface Props {
	canonicalVersionIds: string[];
	onImpactSaved?: () => Promise<void>;
	projectId: string;
	records: { id: string; name: string }[];
	versions: { id: string; assetRecordId: string; versionNumber: number }[];
}

export function DependencyRevalidationManager({
	projectId,
	versions,
	records,
	canonicalVersionIds,
	onImpactSaved,
}: Props) {
	const query = useQuery({
		...orpc.dependencyRevalidation.list.queryOptions({ input: { projectId } }),
	});
	const identifier = useId();
	const [linkKind, setLinkKind] =
		useState<DependencyLinkInput["source"]["kind"]>("asset_version");
	const [linkSourceId, setLinkSourceId] = useState("");
	const [targetId, setTargetId] = useState("");
	const [linkFacets, setLinkFacets] = useState<string[]>([]);
	const [linkOther, setLinkOther] = useState("");
	const [changeKind, setChangeKind] =
		useState<ChangeFacetInput["source"]["kind"]>("canonical_design");
	const [changeSourceId, setChangeSourceId] = useState("");
	const [changeFacets, setChangeFacets] = useState<string[]>([]);
	const [changeOther, setChangeOther] = useState("");
	const [busy, setBusy] = useState(false);
	const [uncertain, setUncertain] = useState(false);
	const [message, setMessage] = useState("");
	const disabled = busy || uncertain || !query.isSuccess || query.isError;
	const names = new Map(records.map((record) => [record.id, record.name]));
	const versionLabels = new Map(
		versions.map((version) => [
			version.id,
			`${names.get(version.assetRecordId) ?? version.assetRecordId} · v${version.versionNumber}`,
		])
	);
	const contexts = query.data?.contextRevisions ?? [];
	const contextOptions = contexts.map((revision) => ({
		id: revision.id,
		label: `Bağlam Sürümü ${revision.revisionNumber}${revision.isActive ? " (etkin)" : ""}`,
	}));
	const linkOptions =
		linkKind === "context_revision"
			? contextOptions
			: versions.map((version) => ({
					id: version.id,
					label: versionLabels.get(version.id) ?? version.id,
				}));
	const changeOptions =
		changeKind === "context_revision"
			? contextOptions
			: versions
					.filter((version) => canonicalVersionIds.includes(version.id))
					.map((version) => ({
						id: version.id,
						label: versionLabels.get(version.id) ?? version.id,
					}));

	async function save(
		operation: () => Promise<unknown>,
		successMessage: string
	) {
		if (disabled) {
			return;
		}
		setBusy(true);
		setMessage("");
		try {
			await operation();
			const result = await query.refetch();
			await onImpactSaved?.();
			if (result.isError) {
				setUncertain(true);
				setMessage(
					"Kayıt kaydedildi ancak sonuç yeniden okunamadı. Durumu kontrol edin."
				);
			} else {
				setMessage(successMessage);
			}
		} catch {
			setUncertain(true);
			setMessage(
				"İşlem tamamlanamadı veya sonucu doğrulanamadı. Yeniden kaydetmeden önce durumu kontrol edin."
			);
		} finally {
			setBusy(false);
		}
	}

	async function checkStatus() {
		setBusy(true);
		try {
			const result = await query.refetch();
			await onImpactSaved?.();
			if (!result.isError) {
				setUncertain(false);
				setMessage(
					"Kalıcı kayıtlar yeniden okundu. Kaydetmeden önce sonucu kontrol edin."
				);
			}
		} catch {
			setMessage("Kayıtlar yeniden okunamadı. Durumu tekrar kontrol edin.");
		} finally {
			setBusy(false);
		}
	}

	return (
		<section
			aria-labelledby={`${identifier}-heading`}
			className="space-y-5 rounded-lg border p-5"
		>
			<h2 className="font-semibold text-2xl" id={`${identifier}-heading`}>
				Değişiklik Etkisini Belirleme
			</h2>
			<p className="text-muted-foreground text-sm">
				Bağımlılıkları kesin sürümlere bağlayın. Değişen özellikleri
				onayladığınızda ilgili doğrudan ve dolaylı Türetilmiş Varlıklar yeniden
				doğrulama ister. Geçmiş onay ve kalite kanıtları değişmez.
			</p>
			{query.isPending ? (
				<p role="status">Bağımlılık kayıtları yükleniyor…</p>
			) : null}
			{query.isError ? (
				<p role="alert">Bağımlılık kayıtları okunamadı.</p>
			) : null}
			{message ? (
				<p aria-live="polite" role="status">
					{message}
				</p>
			) : null}
			{uncertain || query.isError ? (
				<Button
					disabled={busy}
					onClick={() => void checkStatus()}
					type="button"
					variant="outline"
				>
					Durumu kontrol et
				</Button>
			) : null}
			<form
				onSubmit={(event) => {
					event.preventDefault();
					void save(
						() =>
							client.dependencyRevalidation.createLink({
								projectId,
								source: { kind: linkKind, id: linkSourceId },
								targetAssetVersionId: targetId,
								facets: selectedDependencyFacets(linkFacets, linkOther),
							}),
						"Bağımlılık Bağlantısı kaydedildi."
					);
				}}
			>
				<fieldset className="space-y-4" disabled={disabled}>
					<legend className="font-semibold">Bağımlılık Bağlantısı</legend>
					<label className="block" htmlFor={`${identifier}-link-kind`}>
						Bağımlılık kaynak türü
					</label>
					<select
						className="w-full rounded border px-3 py-2"
						id={`${identifier}-link-kind`}
						onChange={(event) => {
							setLinkKind(
								event.target.value === "context_revision"
									? "context_revision"
									: "asset_version"
							);
							setLinkSourceId("");
						}}
						value={linkKind}
					>
						<option value="asset_version">Varlık Sürümü</option>
						<option value="context_revision">Bağlam Sürümü</option>
					</select>
					<label className="block" htmlFor={`${identifier}-link-source`}>
						Bağımlılık kaynağı
					</label>
					<select
						className="w-full rounded border px-3 py-2"
						id={`${identifier}-link-source`}
						onChange={(event) => setLinkSourceId(event.target.value)}
						required
						value={linkSourceId}
					>
						<option value="">Kaynak seçin</option>
						{linkOptions.map((option) => (
							<option key={option.id} value={option.id}>
								{option.label}
							</option>
						))}
					</select>
					<label className="block" htmlFor={`${identifier}-target`}>
						Türetilmiş Varlık Sürümü
					</label>
					<select
						className="w-full rounded border px-3 py-2"
						id={`${identifier}-target`}
						onChange={(event) => setTargetId(event.target.value)}
						required
						value={targetId}
					>
						<option value="">Sürüm seçin</option>
						{versions
							.filter(
								(version) =>
									linkKind !== "asset_version" || version.id !== linkSourceId
							)
							.map((version) => (
								<option key={version.id} value={version.id}>
									{versionLabels.get(version.id)}
								</option>
							))}
					</select>
					<DependencyFacets
						onChange={setLinkFacets}
						onOtherChange={setLinkOther}
						other={linkOther}
						value={linkFacets}
					/>
					<p className="text-muted-foreground text-sm">
						Özellik seçilmezse bağlantı eksik tanımlanmış sayılır ve
						değişikliklerde güvenli tarafta işaretlenir.
					</p>
					<Button
						disabled={
							disabled ||
							!linkSourceId ||
							!targetId ||
							(linkKind === "asset_version" && linkSourceId === targetId)
						}
						type="submit"
					>
						Bağımlılık Bağlantısını Kaydet
					</Button>
				</fieldset>
			</form>
			<form
				onSubmit={(event) => {
					event.preventDefault();
					void save(
						() =>
							client.dependencyRevalidation.determine({
								projectId,
								source: { kind: changeKind, id: changeSourceId },
								facets: selectedDependencyFacets(changeFacets, changeOther),
							}),
						"Değişiklik etkisi kaydedildi."
					);
				}}
			>
				<fieldset className="space-y-4" disabled={disabled}>
					<legend className="font-semibold">Değişiklik Tanımı</legend>
					<label className="block" htmlFor={`${identifier}-change-kind`}>
						Değişen kaynak türü
					</label>
					<select
						className="w-full rounded border px-3 py-2"
						id={`${identifier}-change-kind`}
						onChange={(event) => {
							setChangeKind(
								event.target.value === "context_revision"
									? "context_revision"
									: "canonical_design"
							);
							setChangeSourceId("");
						}}
						value={changeKind}
					>
						<option value="canonical_design">Ana Tasarım</option>
						<option value="context_revision">Bağlam Sürümü</option>
					</select>
					<label className="block" htmlFor={`${identifier}-change-source`}>
						Değişen kaynak
					</label>
					<select
						className="w-full rounded border px-3 py-2"
						id={`${identifier}-change-source`}
						onChange={(event) => setChangeSourceId(event.target.value)}
						required
						value={changeSourceId}
					>
						<option value="">Kaynak seçin</option>
						{changeOptions.map((option) => (
							<option key={option.id} value={option.id}>
								{option.label}
							</option>
						))}
					</select>
					<DependencyFacets
						onChange={setChangeFacets}
						onOtherChange={setChangeOther}
						other={changeOther}
						value={changeFacets}
					/>
					<Button
						disabled={
							disabled ||
							!changeSourceId ||
							selectedDependencyFacets(changeFacets, changeOther).length === 0
						}
						type="submit"
					>
						Değişiklik Etkisini Belirle
					</Button>
				</fieldset>
			</form>
			{query.data ? (
				<div className="space-y-4">
					<h3 className="font-semibold">Kalıcı Bağımlılık Bağlantıları</h3>
					<ul className="space-y-2">
						{query.data.dependencyLinks.map((link) => (
							<li key={link.id}>
								{versionLabels.get(link.targetAssetVersionId) ??
									link.targetAssetVersionId}
								:{" "}
								{link.facets.length > 0
									? link.facets.map(dependencyFacetLabel).join(", ")
									: "Eksik Bağımlılık Bağlantısı"}
							</li>
						))}
					</ul>
					<h3 className="font-semibold">Güncel Yeniden Doğrulama Gerekli</h3>
					{query.data.revalidationRequiredVersionIds.length === 0 ? (
						<p>Kaydedilmiş değişikliklerden etkilenen sürüm yok.</p>
					) : (
						<ul className="space-y-2">
							{query.data.revalidationRequiredVersionIds.map((versionId) => (
								<li key={versionId}>
									{versionLabels.get(versionId) ?? versionId}: Yeniden Doğrulama
									Gerekli
								</li>
							))}
						</ul>
					)}
					<h3 className="font-semibold">Kaydedilmiş Değişiklik Etkileri</h3>
					<ul className="space-y-3">
						{query.data.changeImpacts.map((impact) => (
							<li key={impact.id}>
								{impact.facets.map(dependencyFacetLabel).join(", ")} —{" "}
								{impact.affectedVersions.length} etkilenen sürüm
								<ul>
									{impact.affectedVersions.map((version) => (
										<li key={version.assetVersionId}>
											{versionLabels.get(version.assetVersionId) ??
												version.assetVersionId}
											:{" "}
											{version.reason === "incomplete_dependency"
												? "Eksik Bağımlılık Bağlantısı"
												: "Eşleşen Bağımlılık Bağlantısı"}
										</li>
									))}
								</ul>
							</li>
						))}
					</ul>
				</div>
			) : null}
		</section>
	);
}

import type {
	AssetRecordTrackingDetail,
	AssetVersionCreateInput,
	AssetVersionSummary,
} from "@sprite-anvil/api/asset-record-tracking";
import {
	dependencyFacets,
	referenceFeatures,
	referenceRoles,
} from "@sprite-anvil/api/asset-record-tracking";
import { Button } from "@sprite-anvil/ui/components/button";
import { Input } from "@sprite-anvil/ui/components/input";
import type { ReactNode, SyntheticEvent } from "react";
import { useRef, useState } from "react";
import { isWriteOutcomeUncertain } from "@/utils/error-notification";
import { getErrorMessage } from "@/utils/get-error-message";
import { client } from "@/utils/orpc";

const referenceRoleLabels = {
	identity: "Kimlik",
	pose: "Poz",
	style: "Stil",
	palette: "Palet",
	equipment: "Ekipman",
	composition: "Kompozisyon",
	theme: "Tema",
	custom: "Özel amaç",
} as const;

const featureLabels = {
	identity: "Kimlik",
	pose: "Poz",
	style: "Stil",
	palette: "Palet",
	equipment: "Ekipman",
	composition: "Kompozisyon",
	theme: "Tema",
} as const;

const dependencyFacetLabels = {
	identity: "Kimlik",
	silhouette: "Siluet",
	equipment: "Ekipman",
	palette: "Palet",
	theme: "Tema",
	perspective: "Perspektif",
	timing: "Zamanlama",
	other: "Diğer",
} as const;

const userRelationshipLabels = {
	created_by_user: "Kullanıcı oluşturdu",
	received_from_team: "Ekipten alındı",
	licensed_third_party: "Lisanslı üçüncü taraf",
	unknown: "Bilinmiyor",
} as const;

function displayFileName(fileName: string | null) {
	return fileName ?? "Dosya adı bilinmiyor";
}

interface PendingWrite {
	check: (detail: AssetRecordTrackingDetail) => boolean;
	message: string;
}

interface FamilyAndDerivativeSectionProps {
	actions: {
		createDerivative: (event: SyntheticEvent<HTMLFormElement>) => void;
		createFamily: (event: SyntheticEvent<HTMLFormElement>) => void;
	};
	busy: boolean;
	detail: AssetRecordTrackingDetail;
	form: {
		derivativeAssetRecordId: string;
		familyName: string;
		familyUseContext: string;
		selectedDependencyFacets: (typeof dependencyFacets)[number][];
		visualWorldId: string;
		setDerivativeAssetRecordId: (value: string) => void;
		setFamilyName: (value: string) => void;
		setFamilyUseContext: (value: string) => void;
		setVisualWorldId: (value: string) => void;
		toggleDependencyFacet: (
			value: (typeof dependencyFacets)[number],
			checked: boolean
		) => void;
	};
}

function bytesToBase64(bytes: Uint8Array) {
	const chunkSize = 0x80_00;
	const chunks: string[] = [];
	for (let index = 0; index < bytes.length; index += chunkSize) {
		chunks.push(
			String.fromCharCode(...bytes.subarray(index, index + chunkSize))
		);
	}
	return btoa(chunks.join(""));
}

function fieldsetCheckboxes<T extends string>({
	legend,
	options,
	selected,
	onToggle,
}: {
	legend: string;
	options: readonly T[];
	selected: readonly T[];
	onToggle: (value: T, checked: boolean) => void;
}) {
	return (
		<fieldset className="space-y-2">
			<legend className="font-medium text-sm">{legend}</legend>
			<div className="grid gap-2 sm:grid-cols-2">
				{options.map((value) => {
					const label =
						featureLabels[value as keyof typeof featureLabels] ??
						dependencyFacetLabels[value as keyof typeof dependencyFacetLabels];
					return (
						<label className="flex items-center gap-2 text-sm" key={value}>
							<input
								checked={selected.includes(value)}
								className="size-4 accent-primary"
								onChange={(event) => onToggle(value, event.target.checked)}
								type="checkbox"
							/>
							<span>{label ?? value}</span>
						</label>
					);
				})}
			</div>
		</fieldset>
	);
}

function FamilyAndDerivativeSection({
	detail,
	busy,
	form,
	actions,
}: FamilyAndDerivativeSectionProps) {
	const { record, tracking } = detail;
	let familyControls: ReactNode = null;
	if (tracking.family) {
		familyControls = (
			<form
				className="mt-4 space-y-3 border-t pt-3"
				onSubmit={actions.createDerivative}
			>
				<p className="text-sm">
					Varlık Ailesi: {tracking.family.name} ·{" "}
					{tracking.family.visualWorldName}
				</p>
				<label className="block space-y-1 text-sm" htmlFor="derivative-record">
					<span>Türetilmiş Asset Record</span>
					<select
						className="w-full rounded-md border bg-background px-3 py-2"
						id="derivative-record"
						onChange={(event) =>
							form.setDerivativeAssetRecordId(event.target.value)
						}
						required
						value={form.derivativeAssetRecordId}
					>
						<option value="">Kayıt seçin</option>
						{tracking.availableRecords
							.filter(
								(option) =>
									option.id !== record.id &&
									(!option.assetFamilyId ||
										option.assetFamilyId === tracking.family?.id)
							)
							.map((option) => (
								<option key={option.id} value={option.id}>
									{option.name}
								</option>
							))}
					</select>
				</label>
				{fieldsetCheckboxes({
					legend: "Bağımlılık Tanımı",
					options: dependencyFacets,
					selected: form.selectedDependencyFacets,
					onToggle: form.toggleDependencyFacet,
				})}
				<Button
					disabled={
						busy ||
						!form.derivativeAssetRecordId ||
						form.selectedDependencyFacets.length === 0
					}
					type="submit"
				>
					Türevi bağla
				</Button>
			</form>
		);
	} else if (tracking.approvedVersion && tracking.visualWorlds.length > 0) {
		familyControls = (
			<form
				className="mt-4 space-y-3 border-t pt-3"
				onSubmit={actions.createFamily}
			>
				<h4 className="font-medium text-sm">
					Türetilmiş varlıklar için aile oluştur
				</h4>
				<label className="block space-y-1 text-sm" htmlFor="family-name">
					<span>Aile adı</span>
					<Input
						id="family-name"
						onChange={(event) => form.setFamilyName(event.target.value)}
						required
						value={form.familyName}
					/>
				</label>
				<label className="block space-y-1 text-sm" htmlFor="family-world">
					<span>Görsel Dünya</span>
					<select
						className="w-full rounded-md border bg-background px-3 py-2"
						id="family-world"
						onChange={(event) => form.setVisualWorldId(event.target.value)}
						required
						value={form.visualWorldId}
					>
						<option value="">Görsel Dünya seçin</option>
						{tracking.visualWorlds.map((world) => (
							<option key={world.id} value={world.id}>
								{world.name}
							</option>
						))}
					</select>
				</label>
				<label className="block space-y-1 text-sm" htmlFor="family-use-context">
					<span>Kullanım bağlamı</span>
					<Input
						id="family-use-context"
						onChange={(event) => form.setFamilyUseContext(event.target.value)}
						required
						value={form.familyUseContext}
					/>
				</label>
				<p className="text-muted-foreground text-xs">
					Ana Tasarım olarak Onaylı Sürüm kullanılacak:{" "}
					{displayFileName(tracking.approvedVersion.fileName)}.
				</p>
				<Button
					disabled={
						busy ||
						form.familyName.trim().length === 0 ||
						form.familyUseContext.trim().length === 0 ||
						!form.visualWorldId
					}
					type="submit"
				>
					Aileyi oluştur
				</Button>
			</form>
		);
	} else if (tracking.approvedVersion) {
		familyControls = (
			<p className="mt-3 text-muted-foreground text-xs">
				Önce bir Görsel Dünya oluşturun; Ana Tasarım ve kullanım bağlamı
				kullanıcı tarafından belirlenir.
			</p>
		);
	}

	return (
		<section
			aria-labelledby="derivatives-heading"
			className="rounded-lg border p-4"
		>
			<h3 className="font-medium" id="derivatives-heading">
				Türetilmiş varlıklar
			</h3>
			{tracking.derivatives.length > 0 ? (
				<ul className="mt-2 space-y-2 text-sm">
					{tracking.derivatives.map((derivative) => (
						<li key={derivative.id}>
							{derivative.assetRecordName} · Ana Tasarım Sürümü{" "}
							{tracking.availableVersions.find(
								(version) => version.id === derivative.canonicalVersionId
							)?.versionNumber ?? "?"}
							{derivative.familyStatus === "unassigned"
								? " · Aile bağı yeniden doğrulanmalı"
								: ""}
						</li>
					))}
				</ul>
			) : (
				<p className="mt-2 text-muted-foreground text-sm">
					Bu kayda bağlı türetilmiş varlık yok.
				</p>
			)}
			{familyControls}
		</section>
	);
}

export function AssetRecordTrackingPanel({
	detail,
	onRefresh,
}: {
	detail: AssetRecordTrackingDetail;
	onRefresh: () => Promise<unknown>;
}) {
	const { record, tracking } = detail;
	const pendingWrite = useRef<PendingWrite | null>(null);
	const versionRequest = useRef<{ id: string; signature: string } | null>(null);
	const reviewRequest = useRef<{ id: string; signature: string } | null>(null);
	const familyRequest = useRef<{ id: string; signature: string } | null>(null);
	const derivativeRequest = useRef<{ id: string; signature: string } | null>(
		null
	);
	const referenceRequest = useRef<{ id: string; signature: string } | null>(
		null
	);
	const [activeWrite, setActiveWrite] = useState<string | null>(null);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [statusMessage, setStatusMessage] = useState<string | null>(null);
	const [writeOutcomeUncertain, setWriteOutcomeUncertain] = useState(false);
	const [file, setFile] = useState<File | null>(null);
	const [knownSource, setKnownSource] = useState("");
	const [userRelationship, setUserRelationship] =
		useState<AssetVersionCreateInput["userRelationship"]>("unknown");
	const [supportingEvidence, setSupportingEvidence] = useState("");
	const [reviewRationale, setReviewRationale] = useState("");
	const [familyName, setFamilyName] = useState("");
	const [familyUseContext, setFamilyUseContext] = useState("");
	const [visualWorldId, setVisualWorldId] = useState("");
	const [derivativeAssetRecordId, setDerivativeAssetRecordId] = useState("");
	const [selectedDependencyFacets, setSelectedDependencyFacets] = useState<
		(typeof dependencyFacets)[number][]
	>([]);
	const [targetVersionId, setTargetVersionId] = useState("");
	const [referenceRole, setReferenceRole] =
		useState<(typeof referenceRoles)[number]>("pose");
	const [transferredFeatures, setTransferredFeatures] = useState<
		(typeof referenceFeatures)[number][]
	>([]);
	const [forbiddenFeatures, setForbiddenFeatures] = useState<
		(typeof referenceFeatures)[number][]
	>([]);
	const [referenceNotes, setReferenceNotes] = useState("");

	async function runWrite(
		label: string,
		check: PendingWrite["check"],
		write: () => Promise<unknown>
	) {
		setActiveWrite(label);
		setErrorMessage(null);
		setStatusMessage(null);
		try {
			await write();
			await onRefresh();
			pendingWrite.current = null;
			setWriteOutcomeUncertain(false);
			setStatusMessage(label);
		} catch (error) {
			if (isWriteOutcomeUncertain(error)) {
				pendingWrite.current = { check, message: label };
				setWriteOutcomeUncertain(true);
				setErrorMessage(
					"İşlemin kaydedilip kaydedilmediği doğrulanamadı. Güncel durumu kontrol edin."
				);
			} else {
				setErrorMessage(getErrorMessage(error, "Değişiklik kaydedilemedi."));
			}
		} finally {
			setActiveWrite(null);
		}
	}

	async function checkWriteOutcome() {
		setActiveWrite("Durum kontrol ediliyor…");
		try {
			const result = await onRefresh();
			const refreshedDetail =
				result && typeof result === "object" && "data" in result
					? result.data
					: undefined;
			if (
				refreshedDetail &&
				pendingWrite.current?.check(
					refreshedDetail as AssetRecordTrackingDetail
				)
			) {
				setErrorMessage(null);
				setStatusMessage(pendingWrite.current.message);
				pendingWrite.current = null;
				setWriteOutcomeUncertain(false);
				return;
			}
			setErrorMessage(
				"Kayıt henüz görünmüyor. Aynı bilgiyle yeniden deneyebilirsiniz."
			);
			setWriteOutcomeUncertain(false);
		} catch (error) {
			setErrorMessage(
				getErrorMessage(error, "Güncel durum okunamadı.", "query")
			);
		} finally {
			setActiveWrite(null);
		}
	}

	function toggle<T extends string>(
		current: readonly T[],
		value: T,
		checked: boolean,
		update: (next: T[]) => void
	) {
		update(
			checked
				? [...new Set([...current, value])]
				: current.filter((item) => item !== value)
		);
	}

	async function createVersion(event: SyntheticEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!(file && record)) {
			return;
		}
		const contentBase64 = bytesToBase64(
			new Uint8Array(await file.arrayBuffer())
		);
		const signature = JSON.stringify({
			contentBase64,
			contentType: file.type,
			fileName: file.name,
			knownSource,
			supportingEvidence,
			userRelationship,
		});
		if (versionRequest.current?.signature !== signature) {
			versionRequest.current = { id: crypto.randomUUID(), signature };
		}
		const input: AssetVersionCreateInput = {
			assetRecordId: record.id,
			contentBase64,
			contentType: file.type as AssetVersionCreateInput["contentType"],
			fileName: file.name,
			historyUnknown: true,
			id: versionRequest.current.id,
			knownSource: knownSource.trim() || null,
			projectId: record.projectId,
			supportingEvidence: supportingEvidence.trim() || null,
			userRelationship,
		};
		await runWrite(
			"Aday Sürüm kaydedildi.",
			(refreshed) =>
				refreshed.tracking.availableVersions.some(
					(version) => version.id === input.id
				),
			() => client.assetRecords.createVersion(input)
		);
	}

	async function recordReview(
		versionId: string,
		decision: "approved" | "rejected" | "candidate"
	) {
		if (!record) {
			return;
		}
		const rationale = reviewRationale.trim() || null;
		const signature = JSON.stringify({ versionId, decision, rationale });
		if (reviewRequest.current?.signature !== signature) {
			reviewRequest.current = { id: crypto.randomUUID(), signature };
		}
		const request = reviewRequest.current;
		await runWrite(
			decision === "approved"
				? "Onaylı Sürüm kaydedildi."
				: "İnceleme Kaydı eklendi.",
			(refreshed) =>
				refreshed.tracking.reviewEvents.some(
					(event) => event.id === request.id
				),
			() =>
				client.assetRecords.recordReview({
					assetRecordId: record.id,
					decision,
					id: request.id,
					projectId: record.projectId,
					rationale,
					versionId,
				})
		);
	}

	async function createFamily(event: SyntheticEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!(record && tracking.approvedVersion && visualWorldId)) {
			return;
		}
		const signature = JSON.stringify({
			assetRecordId: record.id,
			canonicalVersionId: tracking.approvedVersion.id,
			name: familyName.trim(),
			useContext: familyUseContext.trim(),
			visualWorldId,
		});
		if (familyRequest.current?.signature !== signature) {
			familyRequest.current = { id: crypto.randomUUID(), signature };
		}
		const request = familyRequest.current;
		await runWrite(
			"Varlık Ailesi kaydedildi.",
			(refreshed) => refreshed.tracking.family?.id === request.id,
			() =>
				client.assetRecords.createFamily({
					assetRecordId: record.id,
					canonicalVersionId: tracking.approvedVersion?.id as string,
					id: request.id,
					name: familyName.trim(),
					projectId: record.projectId,
					useContext: familyUseContext.trim(),
					visualWorldId,
				})
		);
	}

	async function createDerivative(event: SyntheticEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!(record && tracking.family) || selectedDependencyFacets.length === 0) {
			return;
		}
		const signature = JSON.stringify({
			canonicalVersionId: tracking.family.canonicalVersionId,
			dependencyFacets: selectedDependencyFacets,
			derivedAssetRecordId: derivativeAssetRecordId,
			sourceAssetRecordId: record.id,
		});
		if (derivativeRequest.current?.signature !== signature) {
			derivativeRequest.current = { id: crypto.randomUUID(), signature };
		}
		const request = derivativeRequest.current;
		await runWrite(
			"Türetilmiş Varlık bağlantısı kaydedildi.",
			(refreshed) =>
				refreshed.tracking.derivatives.some((entry) => entry.id === request.id),
			() =>
				client.assetRecords.createDerivative({
					canonicalVersionId: tracking.family?.canonicalVersionId as string,
					dependencyFacets: selectedDependencyFacets,
					derivedAssetRecordId: derivativeAssetRecordId,
					id: request.id,
					projectId: record.projectId,
					sourceAssetRecordId: record.id,
				})
		);
	}

	async function createReference(event: SyntheticEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!(record && targetVersionId)) {
			return;
		}
		const signature = JSON.stringify({
			assetRecordId: record.id,
			forbiddenFeatures,
			notes: referenceNotes.trim(),
			role: referenceRole,
			targetVersionId,
			transferredFeatures,
		});
		if (referenceRequest.current?.signature !== signature) {
			referenceRequest.current = { id: crypto.randomUUID(), signature };
		}
		const request = referenceRequest.current;
		await runWrite(
			"Referans kaydedildi.",
			(refreshed) =>
				refreshed.tracking.references.some((entry) => entry.id === request.id),
			() =>
				client.assetRecords.createReference({
					assetRecordId: record.id,
					forbiddenFeatures,
					id: request.id,
					notes: referenceNotes.trim() || null,
					projectId: record.projectId,
					role: referenceRole,
					targetVersionId,
					transferredFeatures,
				})
		);
	}

	const reviewDispositionLabel = {
		candidate: "Aday",
		approved: "Onaylı",
		rejected: "Reddedildi",
	} as const;

	function reviewActions(version: AssetVersionSummary) {
		const decisions = [
			{ decision: "approved", label: "Onayla" },
			{ decision: "rejected", label: "Reddet" },
			{ decision: "candidate", label: "Aday yap" },
		] as const;
		return (
			<div className="flex flex-wrap gap-2">
				{decisions.map(({ decision, label }) => (
					<Button
						disabled={
							activeWrite !== null ||
							writeOutcomeUncertain ||
							version.reviewDisposition === decision
						}
						key={decision}
						onClick={() => void recordReview(version.id, decision)}
						size="sm"
						type="button"
						variant={decision === "approved" ? "default" : "outline"}
					>
						{label}
					</Button>
				))}
			</div>
		);
	}

	return (
		<section aria-labelledby="record-tracking-heading" className="space-y-4">
			<div>
				<h2 className="font-semibold text-xl" id="record-tracking-heading">
					Kayıt izleme
				</h2>
				<p className="mt-1 text-muted-foreground text-sm">
					Onay, kalite ve üretim kanıtı ayrı kayıtlardır. Onay tek başına Dışa
					Aktarıma Hazır sonucu değildir.
				</p>
			</div>
			{errorMessage ? <p role="alert">{errorMessage}</p> : null}
			{statusMessage ? (
				<p aria-live="polite" role="status">
					{statusMessage}
				</p>
			) : null}
			{writeOutcomeUncertain ? (
				<Button
					disabled={activeWrite !== null}
					onClick={() => void checkWriteOutcome()}
					type="button"
					variant="outline"
				>
					{activeWrite ?? "Durumu kontrol et"}
				</Button>
			) : null}

			<div className="grid gap-3 sm:grid-cols-2">
				<section
					aria-labelledby="approved-version-heading"
					className="rounded-lg border p-4"
				>
					<h3 className="font-medium" id="approved-version-heading">
						Onaylı sürüm
					</h3>
					{tracking.approvedVersion ? (
						<div className="mt-2 space-y-2 text-sm">
							<p>
								{displayFileName(tracking.approvedVersion.fileName)} · Sürüm{" "}
								{tracking.approvedVersion.versionNumber}
							</p>
							{reviewActions(tracking.approvedVersion)}
						</div>
					) : (
						<p className="mt-2 text-muted-foreground text-sm">
							Henüz onaylı sürüm yok.
						</p>
					)}
				</section>

				<section
					aria-labelledby="alternatives-heading"
					className="rounded-lg border p-4"
				>
					<h3 className="font-medium" id="alternatives-heading">
						Alternatifler
					</h3>
					{tracking.alternatives.length > 0 ? (
						<ul className="mt-2 space-y-3 text-sm">
							{tracking.alternatives.map((version) => (
								<li className="space-y-1" key={version.id}>
									<p>
										{displayFileName(version.fileName)} · Sürüm{" "}
										{version.versionNumber} ·{" "}
										{reviewDispositionLabel[version.reviewDisposition]}
									</p>
									{reviewActions(version)}
								</li>
							))}
						</ul>
					) : (
						<p className="mt-2 text-muted-foreground text-sm">
							Henüz alternatif sürüm yok.
						</p>
					)}
					<label
						className="mt-3 block space-y-1 text-sm"
						htmlFor="review-rationale"
					>
						<span>İnceleme gerekçesi (isteğe bağlı)</span>
						<textarea
							className="min-h-16 w-full rounded-md border bg-background px-3 py-2"
							id="review-rationale"
							maxLength={1000}
							onChange={(event) => setReviewRationale(event.target.value)}
							value={reviewRationale}
						/>
					</label>
					{tracking.reviewEvents.length > 0 ? (
						<div className="mt-4 border-t pt-3">
							<h4 className="font-medium text-sm">İnceleme geçmişi</h4>
							<ul className="mt-2 space-y-2 text-xs">
								{tracking.reviewEvents.map((event) => {
									const version = [
										tracking.approvedVersion,
										...tracking.alternatives,
									].find((entry) => entry?.id === event.versionId);
									return (
										<li key={event.id}>
											<p>
												{version?.fileName ?? "Sürüm"} ·{" "}
												{reviewDispositionLabel[event.decision]} ·{" "}
												{new Date(event.createdAt).toLocaleString()}
											</p>
											{event.rationale ? (
												<p className="text-muted-foreground">
													{event.rationale}
												</p>
											) : null}
										</li>
									);
								})}
							</ul>
						</div>
					) : null}
				</section>

				<FamilyAndDerivativeSection
					actions={{ createDerivative, createFamily }}
					busy={activeWrite !== null || writeOutcomeUncertain}
					detail={detail}
					form={{
						derivativeAssetRecordId,
						familyName,
						familyUseContext,
						selectedDependencyFacets,
						visualWorldId,
						setDerivativeAssetRecordId,
						setFamilyName,
						setFamilyUseContext,
						setVisualWorldId,
						toggleDependencyFacet: (value, checked) =>
							toggle(
								selectedDependencyFacets,
								value,
								checked,
								setSelectedDependencyFacets
							),
					}}
				/>
				<section
					aria-labelledby="references-heading"
					className="rounded-lg border p-4"
				>
					<h3 className="font-medium" id="references-heading">
						Referanslar
					</h3>
					{tracking.references.length > 0 ? (
						<ul className="mt-2 space-y-2 text-sm">
							{tracking.references.map((reference) => (
								<li className="space-y-1" key={reference.id}>
									<p>
										{reference.assetRecordName} ·{" "}
										{referenceRoleLabels[reference.role]} · Sürüm{" "}
										{reference.versionNumber}
									</p>
									<p className="text-muted-foreground">
										Aktar:{" "}
										{reference.transferredFeatures
											.map((feature) => featureLabels[feature])
											.join(", ") || "yok"}{" "}
										· Kaçın:{" "}
										{reference.forbiddenFeatures
											.map((feature) => featureLabels[feature])
											.join(", ") || "yok"}
									</p>
									{reference.notes ? <p>{reference.notes}</p> : null}
									{reference.conflictFeatures.length > 0 ? (
										<p className="text-destructive">
											Çözülmemiş aktarım çelişkisi:{" "}
											{reference.conflictFeatures
												.map((feature) => featureLabels[feature])
												.join(", ")}
										</p>
									) : null}
								</li>
							))}
						</ul>
					) : (
						<p className="mt-2 text-muted-foreground text-sm">
							Kayıtlı referans yok.
						</p>
					)}
					<form
						className="mt-4 space-y-3 border-t pt-3"
						onSubmit={(event) => void createReference(event)}
					>
						<label
							className="block space-y-1 text-sm"
							htmlFor="reference-version"
						>
							<span>Referans sürümü</span>
							<select
								className="w-full rounded-md border bg-background px-3 py-2"
								id="reference-version"
								onChange={(event) => setTargetVersionId(event.target.value)}
								required
								value={targetVersionId}
							>
								<option value="">Sürüm seçin</option>
								{tracking.availableVersions
									.filter((version) => version.assetRecordId !== record.id)
									.map((version) => (
										<option key={version.id} value={version.id}>
											{version.assetRecordName} ·{" "}
											{displayFileName(version.fileName)} · Sürüm{" "}
											{version.versionNumber}
										</option>
									))}
							</select>
						</label>
						<label className="block space-y-1 text-sm" htmlFor="reference-role">
							<span>Referans Kullanım Amacı</span>
							<select
								className="w-full rounded-md border bg-background px-3 py-2"
								id="reference-role"
								onChange={(event) =>
									setReferenceRole(event.target.value as typeof referenceRole)
								}
								value={referenceRole}
							>
								{referenceRoles.map((role) => (
									<option key={role} value={role}>
										{referenceRoleLabels[role]}
									</option>
								))}
							</select>
						</label>
						{fieldsetCheckboxes({
							legend: "Aktarılabilir özellikler",
							options: referenceFeatures,
							selected: transferredFeatures,
							onToggle: (value, checked) =>
								toggle(
									transferredFeatures,
									value,
									checked,
									setTransferredFeatures
								),
						})}
						{fieldsetCheckboxes({
							legend: "Kaçınılacak özellikler",
							options: referenceFeatures,
							selected: forbiddenFeatures,
							onToggle: (value, checked) =>
								toggle(forbiddenFeatures, value, checked, setForbiddenFeatures),
						})}
						<label
							className="block space-y-1 text-sm"
							htmlFor="reference-notes"
						>
							<span>Not</span>
							<textarea
								className="min-h-20 w-full rounded-md border bg-background px-3 py-2"
								id="reference-notes"
								onChange={(event) => setReferenceNotes(event.target.value)}
								value={referenceNotes}
							/>
						</label>
						<Button
							disabled={
								activeWrite !== null ||
								writeOutcomeUncertain ||
								!targetVersionId ||
								(transferredFeatures.length === 0 &&
									forbiddenFeatures.length === 0) ||
								transferredFeatures.some((feature) =>
									forbiddenFeatures.includes(feature)
								)
							}
							type="submit"
						>
							Referansı ekle
						</Button>
					</form>
				</section>

				<section
					aria-labelledby="quality-heading"
					className="rounded-lg border p-4"
				>
					<h3 className="font-medium" id="quality-heading">
						Kalite
					</h3>
					<p className="mt-2 text-sm">
						{tracking.quality.integrityStatus === "format_signature_matched"
							? `Dosya biçim imzası eşleşti (${tracking.quality.verifiedVersionCount} sürüm).`
							: "Dosya bütünlüğü kanıtı yok."}
					</p>
					<p className="mt-1 text-muted-foreground text-xs">
						Genel Varlık Desteği · Özel profil kalite kanıtı yok. Bu biçim
						kontrolü Dışa Aktarıma Hazır sonucu değildir.
					</p>
				</section>

				<section
					aria-labelledby="production-history-heading"
					className="rounded-lg border p-4"
				>
					<h3 className="font-medium" id="production-history-heading">
						Üretim geçmişi
					</h3>
					{tracking.productionHistory.length > 0 ? (
						<ul className="mt-2 space-y-2 text-sm">
							{tracking.productionHistory.map((entry) => (
								<li key={entry.id}>
									<p>
										Sürüm {entry.versionNumber} ·{" "}
										{entry.knownSource ?? "Kaynak bilinmiyor"}
									</p>
									<p className="text-muted-foreground">
										Geçmiş bilinmiyor ·{" "}
										{userRelationshipLabels[entry.userRelationship]}
									</p>
									{entry.supportingEvidence ? (
										<p>Destekleyici kanıt: {entry.supportingEvidence}</p>
									) : null}
								</li>
							))}
						</ul>
					) : (
						<p className="mt-2 text-muted-foreground text-sm">
							Henüz üretim geçmişi yok.
						</p>
					)}
				</section>
			</div>

			<section
				aria-labelledby="asset-version-create-heading"
				className="rounded-lg border p-4"
			>
				<h3 className="font-medium" id="asset-version-create-heading">
					Aday sürüm oluştur
				</h3>
				<p className="mt-1 text-muted-foreground text-sm">
					Dosya R2’de değişmez Varlık Sürümü olarak saklanır. Bu akış eski
					varlık beyanı alır; bilinmeyen üretim geçmişini tahmin etmez.
				</p>
				<form
					className="mt-4 space-y-3"
					onSubmit={(event) => void createVersion(event)}
				>
					<label
						className="block space-y-1 text-sm"
						htmlFor="asset-version-file"
					>
						<span>PNG veya WebP dosyası</span>
						<Input
							accept="image/png,image/webp"
							id="asset-version-file"
							onChange={(event) => setFile(event.target.files?.[0] ?? null)}
							required
							type="file"
						/>
					</label>
					<label
						className="block space-y-1 text-sm"
						htmlFor="asset-version-source"
					>
						<span>Bilinen kaynak</span>
						<Input
							id="asset-version-source"
							onChange={(event) => setKnownSource(event.target.value)}
							value={knownSource}
						/>
					</label>
					<label
						className="block space-y-1 text-sm"
						htmlFor="asset-version-relationship"
					>
						<span>Varlıkla ilişkiniz</span>
						<select
							className="w-full rounded-md border bg-background px-3 py-2"
							id="asset-version-relationship"
							onChange={(event) =>
								setUserRelationship(
									event.target
										.value as AssetVersionCreateInput["userRelationship"]
								)
							}
							value={userRelationship}
						>
							<option value="unknown">Bilinmiyor</option>
							<option value="created_by_user">Ben oluşturdum</option>
							<option value="received_from_team">Ekipten aldım</option>
							<option value="licensed_third_party">
								Lisanslı üçüncü taraf
							</option>
						</select>
					</label>
					<label
						className="block space-y-1 text-sm"
						htmlFor="asset-version-evidence"
					>
						<span>Destekleyici kanıt</span>
						<textarea
							className="min-h-20 w-full rounded-md border bg-background px-3 py-2"
							id="asset-version-evidence"
							onChange={(event) => setSupportingEvidence(event.target.value)}
							value={supportingEvidence}
						/>
					</label>
					<p className="text-muted-foreground text-xs">
						Eski üretim geçmişi bilinmiyor olarak kaydedilecek.
					</p>
					<Button
						disabled={
							activeWrite !== null ||
							writeOutcomeUncertain ||
							!file ||
							file.size > 5 * 1024 * 1024 ||
							!["image/png", "image/webp"].includes(file.type)
						}
						type="submit"
					>
						{activeWrite === "Aday Sürüm kaydedildi."
							? "Kaydediliyor…"
							: "Aday sürümü kaydet"}
					</Button>
				</form>
			</section>
		</section>
	);
}

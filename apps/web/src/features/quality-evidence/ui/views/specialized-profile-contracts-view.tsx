import type { SpecializedProfileContract } from "@sprite-anvil/api/specialized-profile-contracts";
import { Button } from "@sprite-anvil/ui/components/button";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { isWriteOutcomeUncertain } from "@/utils/error-notification";
import { getErrorMessage } from "@/utils/get-error-message";
import { client, orpc } from "@/utils/orpc";

const ruleClassLabels = {
	integrity_gate: "Bütünlük Denetimi",
	waivable_requirement: "İstisna Verilebilir Gereksinim",
	quality_advisory: "Kalite Uyarısı",
} as const;

export function SpecializedProfileContractsView({
	projectId,
}: {
	projectId: string;
}) {
	const projectQuery = useQuery(
		orpc.projects.get.queryOptions({ input: { projectId } })
	);
	const contractsQueryOptions =
		orpc.specializedProfileContracts.list.queryOptions({
			input: { projectId },
		});
	const contractsQuery = useQuery(contractsQueryOptions);
	const [statusMessage, setStatusMessage] = useState<string | null>(null);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [writeOutcomeUncertain, setWriteOutcomeUncertain] = useState(false);
	const [isCheckingWriteOutcome, setIsCheckingWriteOutcome] = useState(false);
	const activateContract = useMutation({
		mutationFn: (profileId: SpecializedProfileContract["profileId"]) =>
			client.specializedProfileContracts.activate({ projectId, profileId }),
		onSuccess: async (activation) => {
			setWriteOutcomeUncertain(false);
			setErrorMessage(null);
			const result = await contractsQuery.refetch();
			if (result.isError) {
				setStatusMessage(
					`${activation.contract.name} etkinleştirildi. Proje durumunu yeniden yükleyin.`
				);
				return;
			}
			setStatusMessage(
				`${activation.contract.name} ${activation.contract.version} sürümü etkinleştirildi ve yeniden okundu.`
			);
		},
		onError: (error) => {
			setStatusMessage(null);
			setErrorMessage(
				getErrorMessage(error, "Sözleşme etkinleştirilemedi. Yeniden deneyin.")
			);
			if (isWriteOutcomeUncertain(error)) {
				setWriteOutcomeUncertain(true);
			}
		},
	});

	async function refreshContractState() {
		setIsCheckingWriteOutcome(true);
		try {
			const result = await contractsQuery.refetch();
			if (result.isError || !result.data) {
				return;
			}
			setWriteOutcomeUncertain(false);
			setErrorMessage(null);
			const matchingRevision = result.data.profiles.find(
				(profile) =>
					profile.activeContract?.contract.profileId ===
						activateContract.variables &&
					profile.activeContract?.contractRevisionId ===
						`${activateContract.variables}@${profile.definition.version}`
			);
			setStatusMessage(
				matchingRevision
					? `${matchingRevision.definition.name} sözleşmesi projede etkin.`
					: "Proje durumu yeniden okundu. Etkinleştirme görünmüyor; işlemi yeniden deneyebilirsiniz."
			);
		} finally {
			setIsCheckingWriteOutcome(false);
		}
	}

	const profiles = contractsQuery.data?.profiles ?? [];
	const isUnavailable = contractsQuery.isPending || contractsQuery.isError;

	return (
		<main className="mx-auto w-full max-w-6xl space-y-8 overflow-y-auto px-4 py-8 sm:px-6 lg:py-12">
			<header className="space-y-3">
				<Link
					className="text-muted-foreground text-sm underline underline-offset-4"
					params={{ projectId }}
					to="/projects/$projectId/assets"
				>
					Varlık kayıtlarına dön
				</Link>
				<div className="max-w-3xl space-y-2">
					<p className="font-mono text-primary text-xs uppercase tracking-[0.16em]">
						Kalite kanıtı
					</p>
					<h1 className="font-semibold text-3xl sm:text-4xl">
						{projectQuery.data?.name
							? `${projectQuery.data.name} · Özel Profil Sözleşmeleri`
							: "Özel Profil Sözleşmeleri"}
					</h1>
					<p className="text-muted-foreground leading-relaxed">
						Bir sözleşmenin etkinleştirilmesi yalnız bu projeyi etkiler. Etkin
						sözleşme sürümlüdür; her profilin kurallarını, gerekli
						incelemelerini, kullanım testlerini ve dışa aktarım eşlemelerini
						tanımlar.
					</p>
					<p className="text-muted-foreground text-sm leading-relaxed">
						Bu ekran tek kalite puanı veya otomatik sanatsal kabul kararı
						üretmez. Harici Görsel Analiz izni proje ve kategori için ayrı
						yönetilir; izin olmadığında yerel denetimler ve insan incelemesi
						sürer.
					</p>
				</div>
			</header>

			{statusMessage ? (
				<p aria-live="polite" className="text-sm" role="status">
					{statusMessage}
				</p>
			) : null}
			{errorMessage ? (
				<p
					aria-live="assertive"
					className="text-destructive text-sm"
					role="alert"
				>
					{errorMessage}
				</p>
			) : null}
			{writeOutcomeUncertain ? (
				<Button
					disabled={isCheckingWriteOutcome}
					onClick={() => void refreshContractState()}
					type="button"
					variant="outline"
				>
					{isCheckingWriteOutcome
						? "Durum kontrol ediliyor…"
						: "Durumu kontrol et"}
				</Button>
			) : null}

			{contractsQuery.isPending ? (
				<p aria-live="polite">Profil sözleşmeleri yükleniyor…</p>
			) : null}
			{contractsQuery.isError ? (
				<div className="space-y-3 rounded-lg border p-5" role="alert">
					<p>
						Profil sözleşmeleri yüklenemedi. Proje erişimini kontrol edip
						yeniden deneyin.
					</p>
					<Button
						onClick={() => void contractsQuery.refetch()}
						type="button"
						variant="outline"
					>
						Yeniden dene
					</Button>
				</div>
			) : null}

			{profiles.length > 0 ? (
				<section
					aria-labelledby="specialized-profiles-heading"
					className="space-y-5"
				>
					<div className="space-y-1">
						<h2
							className="font-semibold text-2xl"
							id="specialized-profiles-heading"
						>
							Özel profiller
						</h2>
						<p className="text-muted-foreground text-sm">
							Etkinleştirilen revizyon, yalnız bu projenin kalite kanıtında
							kullanılır.
						</p>
					</div>
					<ul className="grid gap-4">
						{profiles.map(({ activeContract, definition }) => (
							<li
								className="min-w-0 space-y-4 rounded-xl border bg-card p-5 shadow-sm"
								key={definition.profileId}
							>
								<article aria-labelledby={`${definition.profileId}-heading`}>
									<div className="flex flex-wrap items-start justify-between gap-4">
										<div className="min-w-0 space-y-1">
											<h3
												className="font-semibold text-xl"
												id={`${definition.profileId}-heading`}
											>
												{definition.name}
											</h3>
											<p className="text-muted-foreground text-sm">
												Sözleşme sürümü {definition.version} · Şema{" "}
												{definition.contractSchemaVersion}
											</p>
											{activeContract ? (
												<p className="font-medium text-sm" role="status">
													Bu projede etkin · {activeContract.contract.version}
												</p>
											) : (
												<p className="text-muted-foreground text-sm">
													Bu projede henüz etkin değil
												</p>
											)}
										</div>
										<Button
											disabled={
												isUnavailable ||
												writeOutcomeUncertain ||
												activateContract.isPending ||
												activeContract?.contractRevisionId ===
													`${definition.profileId}@${definition.version}`
											}
											onClick={() =>
												activateContract.mutate(definition.profileId)
											}
											type="button"
											variant={activeContract ? "outline" : "default"}
										>
											{activeContract?.contractRevisionId ===
											`${definition.profileId}@${definition.version}`
												? "Etkin"
												: "Sözleşmeyi etkinleştir"}
										</Button>
									</div>

									<ContractDetails contract={definition} />
								</article>
							</li>
						))}
					</ul>
				</section>
			) : null}
		</main>
	);
}

function ContractDetails({
	contract,
}: {
	contract: SpecializedProfileContract;
}) {
	return (
		<details className="border-t pt-3">
			<summary className="w-fit cursor-pointer rounded-sm font-medium text-sm underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4">
				Sözleşme ayrıntıları
			</summary>
			<div className="mt-4 grid gap-6 lg:grid-cols-2">
				<section
					aria-label="Metadata alanları ve dışa aktarım eşlemeleri"
					className="space-y-3"
				>
					<h4 className="font-semibold">
						Metadata alanları ve dışa aktarım eşlemeleri
					</h4>
					<ul className="space-y-3">
						{contract.metadataFields.map((field) => {
							const mapping = contract.exportMappings.find(
								(candidate) => candidate.fieldId === field.id
							);
							return (
								<li className="rounded-md border p-3 text-sm" key={field.id}>
									<h5 className="font-medium">
										{field.label} ·{" "}
										{field.required ? "Zorunlu" : "İsteğe bağlı"}
									</h5>
									<p className="mt-1 text-muted-foreground">
										{field.description}
									</p>
									<p className="mt-1">Kapsam: {field.scope}</p>
									<p className="mt-1">Tür: {field.type}</p>
									<p className="mt-1">
										Dışa aktarım hedefi:{" "}
										{mapping?.targetPath ?? field.exportPath}
										{mapping?.unit ? ` · Birim: ${mapping.unit}` : ""}
										{mapping?.coordinateSystem
											? ` · Koordinat: ${mapping.coordinateSystem}`
											: ""}
									</p>
									<p className="mt-1 text-muted-foreground">
										Alan yoksa:{" "}
										{mapping?.absentBehavior === "stop_export"
											? "dışa aktarım durur"
											: "bilinmeyen değer korunur"}
									</p>
									{mapping ? (
										<p className="mt-1 text-muted-foreground">
											Yeniden okuma denetimi: {mapping.readbackCheck}
										</p>
									) : null}
								</li>
							);
						})}
					</ul>
				</section>

				<section aria-label="Kalite kuralları" className="space-y-3">
					<h4 className="font-semibold">Kalite kuralları</h4>
					<ul className="space-y-3">
						{contract.rules.map((rule) => (
							<li className="rounded-md border p-3 text-sm" key={rule.id}>
								<h5 className="font-medium">{rule.id}</h5>
								<p className="mt-1 text-primary">
									{ruleClassLabels[rule.class]}
								</p>
								<dl className="mt-2 grid gap-1">
									<Definition label="Girdi" value={rule.input} />
									<Definition
										label="Başarı sonucu"
										value={rule.successResult}
									/>
									<Definition
										label="Başarısızlık sonucu"
										value={rule.failureResult}
									/>
									<Definition label="Kanıt" value={rule.evidence} />
									<Definition label="Kapsam" value={rule.scope} />
									<Definition
										label="Dışa aktarım etkisi"
										value={rule.exportEffect}
									/>
								</dl>
								<p className="mt-2 text-muted-foreground">
									İstisna uygunluğu: {rule.waiverEligibility ? "izinli" : "yok"}
								</p>
							</li>
						))}
					</ul>
				</section>

				<ContractEvidenceSection
					items={contract.humanReviews}
					label="Zorunlu insan incelemeleri"
				/>
				<ContractEvidenceSection
					items={contract.usageTests}
					label="Zorunlu kullanım testleri"
				/>
			</div>
		</details>
	);
}

function Definition({ label, value }: { label: string; value: string }) {
	return (
		<div>
			<dt className="inline font-medium">{label}: </dt>
			<dd className="inline text-muted-foreground">{value}</dd>
		</div>
	);
}

function ContractEvidenceSection({
	items,
	label,
}: {
	items:
		| SpecializedProfileContract["humanReviews"]
		| SpecializedProfileContract["usageTests"];
	label: string;
}) {
	return (
		<section aria-label={label} className="space-y-3">
			<h4 className="font-semibold">{label}</h4>
			<ul className="space-y-3">
				{items.map((item) => (
					<li className="rounded-md border p-3 text-sm" key={item.id}>
						<h5 className="font-medium">{item.label}</h5>
						<dl className="mt-2 grid gap-1">
							<Definition label="Girdi" value={item.input} />
							<Definition label="Başarı sonucu" value={item.successResult} />
							<Definition
								label="Başarısızlık sonucu"
								value={item.failureResult}
							/>
							<Definition label="Kanıt" value={item.evidence} />
							<Definition label="Kapsam" value={item.scope} />
							<Definition
								label="Dışa aktarım etkisi"
								value={item.exportEffect}
							/>
						</dl>
					</li>
				))}
			</ul>
		</section>
	);
}

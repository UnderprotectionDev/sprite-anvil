import type { ProfileContractsCatalog } from "@sprite-anvil/api/specialized-profile-contracts";
import { Button } from "@sprite-anvil/ui/components/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { assetCategoryLabels } from "@/features/asset-records/ui/category-labels";
import { client, orpc } from "@/utils/orpc";

const profileLabels = {
	character_creature_animation:
		assetCategoryLabels.character_creature_animation,
	object_weapon_equipment_states:
		assetCategoryLabels.object_weapon_equipment_states,
	icon: assetCategoryLabels.icon,
	visual_effect_projectile_shadow_mark:
		assetCategoryLabels.visual_effect_projectile_shadow_mark,
	tileset_terrain_texture: assetCategoryLabels.tileset_terrain_texture,
	background_parallax: assetCategoryLabels.background_parallax,
	ui: assetCategoryLabels.ui,
	portrait_logo_marketing: assetCategoryLabels.portrait_logo_marketing,
} satisfies Record<
	ProfileContractsCatalog["profiles"][number]["profileId"],
	string
>;

const ruleClassLabels = {
	integrity_gate: "Bütünlük Denetimi",
	waivable_requirement: "İstisna Verilebilir Gereksinim",
	quality_advisory: "Kalite Uyarısı",
	human_review: "Zorunlu insan incelemesi",
} as const;

const metadataTypeLabels = {
	string: "metin",
	number: "sayı",
	boolean: "doğru/yanlış",
	string_array: "metin listesi",
} as const;

export function SpecializedProfileContractManager({
	projectId,
}: {
	projectId: string;
}) {
	const queryClient = useQueryClient();
	const query = useQuery({
		...orpc.specializedProfileContracts.list.queryOptions({
			input: { projectId },
		}),
	});
	const [isSaving, setIsSaving] = useState(false);
	const [message, setMessage] = useState("");

	async function activate(
		profileId: ProfileContractsCatalog["profiles"][number]["profileId"],
		templateRevisionNumber: number
	) {
		setIsSaving(true);
		setMessage("");
		try {
			await client.specializedProfileContracts.activate({
				projectId,
				profileId,
				templateRevisionNumber,
			});
			const result = await query.refetch();
			await queryClient.invalidateQueries();
			setMessage(
				result.isError
					? "Sözleşme etkinleştirildi; görünüm yenilenemedi. Sayfayı yenileyin."
					: "Özel Profil Sözleşmesi etkinleştirildi ve kayıttan yeniden okundu."
			);
		} catch (error) {
			setMessage(
				error instanceof Error
					? error.message
					: "Sözleşme etkinleştirilemedi. Yeniden deneyin."
			);
		} finally {
			setIsSaving(false);
		}
	}

	return (
		<section aria-labelledby="profile-contracts-heading" className="space-y-4">
			<div>
				<h3 className="font-semibold text-xl" id="profile-contracts-heading">
					Özel Profil Sözleşmeleri
				</h3>
				<p className="mt-1 text-muted-foreground text-sm">
					Sözleşme revizyonu; metadata alanlarını, kalite kural sınıflarını,
					kullanım testlerini ve dışa aktarım eşlemelerini sabitler. Sözleşmesiz
					profil aileyi tamamlayamaz.
				</p>
			</div>
			{query.isPending ? <p>Sözleşmeler yükleniyor…</p> : null}
			{query.isError ? (
				<p role="alert">Özel Profil Sözleşmeleri yüklenemedi.</p>
			) : null}
			{message ? (
				<p aria-live="polite" role="status">
					{message}
				</p>
			) : null}
			{query.data ? (
				<ul className="grid gap-3 md:grid-cols-2">
					{query.data.profiles.map((profile) => {
						const displayedContract =
							profile.activeRevision?.contract ?? profile.template;
						const needsTemplateActivation =
							profile.activeRevision?.contract.revisionNumber !==
							profile.template.revisionNumber;
						return (
							<li
								className="space-y-3 rounded-lg border p-4"
								key={profile.profileId}
							>
								<div className="flex flex-wrap items-start justify-between gap-3">
									<div>
										<h4 className="font-medium">
											{profileLabels[profile.profileId]}
										</h4>
										<p className="text-muted-foreground text-sm">
											{profile.activeRevision
												? `Etkin revizyon ${profile.activeRevision.revisionNumber}`
												: "Etkin sözleşme yok"}
										</p>
									</div>
									{needsTemplateActivation ? (
										<Button
											disabled={isSaving}
											onClick={() =>
												void activate(
													profile.profileId,
													profile.template.revisionNumber
												)
											}
											type="button"
											variant="outline"
										>
											Sözleşme v{profile.template.revisionNumber}’i etkinleştir
										</Button>
									) : null}
								</div>
								<p className="text-muted-foreground text-xs">
									{displayedContract.metadataFields.length} metadata alanı ·{" "}
									{displayedContract.rules.length} kalite kuralı ·{" "}
									{displayedContract.usageTests.length} kullanım testi ·{" "}
									{displayedContract.exportMappings.length} dışa aktarım
									eşlemesi
								</p>
								<details className="text-sm">
									<summary className="cursor-pointer underline underline-offset-4">
										Sözleşme ayrıntıları
									</summary>
									<div className="mt-3 space-y-3">
										<div>
											<h5 className="font-medium">Metadata alanları</h5>
											<ul className="list-inside list-disc text-muted-foreground">
												{displayedContract.metadataFields.map((field) => (
													<li key={field.id}>
														{field.name} · {field.id} ·{" "}
														{metadataTypeLabels[field.dataType]}
														{field.required ? " · Gerekli" : " · İsteğe bağlı"}
														<p className="ml-5 text-xs">{field.description}</p>
													</li>
												))}
											</ul>
										</div>
										<div>
											<h5 className="font-medium">Kalite kuralları</h5>
											<ul className="list-inside list-disc text-muted-foreground">
												{displayedContract.rules.map((rule) => (
													<li key={rule.id}>
														{rule.name} · {ruleClassLabels[rule.class]}
														<dl className="ml-5 grid gap-x-2 text-xs sm:grid-cols-[max-content_1fr]">
															<dt>Kimlik</dt>
															<dd>{rule.id}</dd>
															<dt>Girdi</dt>
															<dd>{rule.input}</dd>
															<dt>Başarı koşulu</dt>
															<dd>{rule.successCondition}</dd>
															<dt>Başarısızlık koşulu</dt>
															<dd>{rule.failureCondition}</dd>
															<dt>Gerekli kanıt</dt>
															<dd>{rule.evidenceRequirement}</dd>
															<dt>Varlık kapsamı</dt>
															<dd>{rule.assetScope}</dd>
															<dt>Dışa aktarım etkisi</dt>
															<dd>{rule.exportEffect}</dd>
															<dt>Durum</dt>
															<dd>{rule.required ? "Gerekli" : "Uyarı"}</dd>
															{rule.waiverEligible ? (
																<>
																	<dt>İstisna</dt>
																	<dd>Gerekçeli istisnaya izin verilir</dd>
																</>
															) : null}
														</dl>
													</li>
												))}
											</ul>
										</div>
										<div>
											<h5 className="font-medium">Kullanım testleri</h5>
											<ul className="list-inside list-disc text-muted-foreground">
												{displayedContract.usageTests.map((usageTest) => (
													<li key={usageTest.id}>
														{usageTest.name} · {usageTest.id}
														<dl className="ml-5 grid gap-x-2 text-xs sm:grid-cols-[max-content_1fr]">
															<dt>Ortam</dt>
															<dd>{usageTest.environment}</dd>
															<dt>Geçme ölçütü</dt>
															<dd>{usageTest.passCriteria}</dd>
															<dt>Gerekli kanıt</dt>
															<dd>{usageTest.evidenceRequirement}</dd>
															<dt>Durum</dt>
															<dd>
																{usageTest.required
																	? "Gerekli"
																	: "İsteğe bağlı"}
															</dd>
														</dl>
													</li>
												))}
											</ul>
										</div>
										<div>
											<h5 className="font-medium">Dışa aktarım eşlemeleri</h5>
											<ul className="list-inside list-disc text-muted-foreground">
												{displayedContract.exportMappings.map((mapping) => (
													<li key={mapping.id}>
														{mapping.sourceFieldId} → {mapping.targetFieldId}
														<dl className="ml-5 grid gap-x-2 text-xs sm:grid-cols-[max-content_1fr]">
															<dt>Birim</dt>
															<dd>{mapping.unit ?? "Yok"}</dd>
															<dt>Koordinat sistemi</dt>
															<dd>{mapping.coordinateSystem ?? "Yok"}</dd>
															<dt>Varsayılan davranış</dt>
															<dd>{mapping.defaultBehavior}</dd>
															<dt>Geri okuma denetimi</dt>
															<dd>{mapping.readbackCheck}</dd>
															<dt>Durum</dt>
															<dd>
																{mapping.required ? "Gerekli" : "İsteğe bağlı"}
															</dd>
														</dl>
													</li>
												))}
											</ul>
										</div>
									</div>
								</details>
							</li>
						);
					})}
				</ul>
			) : null}
		</section>
	);
}

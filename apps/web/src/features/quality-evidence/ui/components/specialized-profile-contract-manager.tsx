import type { SpecializedProfileContractsListOutput } from "@sprite-anvil/api/specialized-profile-contracts";
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
	SpecializedProfileContractsListOutput["profiles"][number]["definition"]["profileId"],
	string
>;

const ruleClassLabels = {
	integrity_gate: "Bütünlük Denetimi",
	waivable_requirement: "İstisna Verilebilir Gereksinim",
	quality_advisory: "Kalite Uyarısı",
} as const;

const metadataTypeLabels = {
	identifier: "tanımlayıcı",
	text: "metin",
	text_list: "metin listesi",
	integer: "tam sayı",
	number: "sayı",
	boolean: "doğru/yanlış",
	json: "JSON",
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
		profileId: SpecializedProfileContractsListOutput["profiles"][number]["definition"]["profileId"]
	) {
		setIsSaving(true);
		setMessage("");
		try {
			await client.specializedProfileContracts.activate({
				projectId,
				profileId,
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
						const {
							definition,
							activeContract,
							definition: { profileId },
						} = profile;
						const displayedContract = activeContract?.contract ?? definition;
						const needsActivation =
							activeContract?.contract.version !== definition.version;
						return (
							<li className="space-y-3 rounded-lg border p-4" key={profileId}>
								<div className="flex flex-wrap items-start justify-between gap-3">
									<div>
										<h4 className="font-medium">{profileLabels[profileId]}</h4>
										<p className="text-muted-foreground text-sm">
											{activeContract
												? `Etkin sözleşme v${activeContract.contract.version}`
												: "Etkin sözleşme yok"}
										</p>
									</div>
									{needsActivation ? (
										<Button
											disabled={isSaving}
											onClick={() => void activate(profileId)}
											type="button"
											variant="outline"
										>
											Sözleşme v{definition.version}’i etkinleştir
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
														{field.label} · {field.id} ·{" "}
														{metadataTypeLabels[field.type]}
														{field.required ? " · Gerekli" : " · İsteğe bağlı"}
														<p className="ml-5 text-xs">
															{field.description} · {field.scope}
														</p>
													</li>
												))}
											</ul>
										</div>
										<div>
											<h5 className="font-medium">Kalite kuralları</h5>
											<ul className="list-inside list-disc text-muted-foreground">
												{displayedContract.rules.map((rule) => (
													<li key={rule.id}>
														{rule.id} · {ruleClassLabels[rule.class]}
														<dl className="ml-5 grid gap-x-2 text-xs sm:grid-cols-[max-content_1fr]">
															<dt>Kimlik</dt>
															<dd>{rule.id}</dd>
															<dt>Girdi</dt>
															<dd>{rule.input}</dd>
															<dt>Başarı koşulu</dt>
															<dd>{rule.successResult}</dd>
															<dt>Başarısızlık koşulu</dt>
															<dd>{rule.failureResult}</dd>
															<dt>Gerekli kanıt</dt>
															<dd>{rule.evidence}</dd>
															<dt>Varlık kapsamı</dt>
															<dd>{rule.scope}</dd>
															<dt>Dışa aktarım etkisi</dt>
															<dd>{rule.exportEffect}</dd>
															<dt>Durum</dt>
															<dd>
																{rule.class === "quality_advisory"
																	? "Uyarı"
																	: "Gerekli"}
															</dd>
															{rule.waiverEligibility ? (
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
														{usageTest.label} · {usageTest.id}
														<dl className="ml-5 grid gap-x-2 text-xs sm:grid-cols-[max-content_1fr]">
															<dt>Ortam</dt>
															<dd>{usageTest.input}</dd>
															<dt>Geçme ölçütü</dt>
															<dd>{usageTest.successResult}</dd>
															<dt>Gerekli kanıt</dt>
															<dd>{usageTest.evidence}</dd>
															<dt>Durum</dt>
															<dd>Gerekli</dd>
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
														{mapping.fieldId} → {mapping.targetPath}
														<dl className="ml-5 grid gap-x-2 text-xs sm:grid-cols-[max-content_1fr]">
															<dt>Birim</dt>
															<dd>{mapping.unit ?? "Yok"}</dd>
															<dt>Koordinat sistemi</dt>
															<dd>{mapping.coordinateSystem ?? "Yok"}</dd>
															<dt>Varsayılan davranış</dt>
															<dd>{mapping.absentBehavior}</dd>
															<dt>Geri okuma denetimi</dt>
															<dd>{mapping.readbackCheck}</dd>
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

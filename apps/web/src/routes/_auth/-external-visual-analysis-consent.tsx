import { isExternalVisualAnalysisProviderPolicyVerified } from "@sprite-anvil/api/external-visual-analysis-policy";
import type {
	ExternalVisualAnalysisCategory,
	ExternalVisualAnalysisPermission,
} from "@sprite-anvil/api/project-access-store";
import {
	externalVisualAnalysisCategories,
	externalVisualAnalysisPurposeByCategory,
} from "@sprite-anvil/api/project-access-store";
import { Button } from "@sprite-anvil/ui/components/button";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { getErrorMessage } from "@/utils/get-error-message";
import { client, orpc } from "@/utils/orpc";

const categoryDetails: Record<
	ExternalVisualAnalysisCategory,
	{ label: string }
> = {
	identity: {
		label: "Kimlik",
	},
	style: {
		label: "Stil",
	},
	theme: {
		label: "Tema",
	},
};

function getPermissionStatus(
	hasActivePermission: boolean,
	providerPolicyVerified: boolean
): string {
	if (hasActivePermission && providerPolicyVerified) {
		return "İzin etkin";
	}
	if (hasActivePermission) {
		return "İzin kaydı var · kullanım kapalı";
	}
	if (providerPolicyVerified) {
		return "Kapalı";
	}
	return "Kullanılamıyor";
}

export function ExternalVisualAnalysisConsent({
	projectId,
}: {
	projectId: string;
}) {
	const permissionsQuery = useQuery(
		orpc.projects.access.listExternalVisualAnalysis.queryOptions({
			input: { projectId },
		})
	);
	const [savingCategory, setSavingCategory] =
		useState<ExternalVisualAnalysisCategory | null>(null);
	const [revokingId, setRevokingId] = useState<string | null>(null);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [statusMessage, setStatusMessage] = useState<string | null>(null);
	const permissions = permissionsQuery.data ?? [];
	const isSaving = savingCategory !== null || revokingId !== null;
	const providerPolicyVerified =
		isExternalVisualAnalysisProviderPolicyVerified();

	async function grantPermission(category: ExternalVisualAnalysisCategory) {
		setErrorMessage(null);
		setStatusMessage(null);
		setSavingCategory(category);
		try {
			await client.projects.access.grantExternalVisualAnalysis({
				projectId,
				category,
			});
			await permissionsQuery.refetch();
			setStatusMessage(
				`${categoryDetails[category].label} analizi izni kaydedildi.`
			);
		} catch (error) {
			setErrorMessage(
				getErrorMessage(error, "İzin kaydedilemedi. Yeniden deneyin.")
			);
		} finally {
			setSavingCategory(null);
		}
	}

	async function revokePermission(
		permission: ExternalVisualAnalysisPermission
	) {
		setErrorMessage(null);
		setStatusMessage(null);
		setRevokingId(permission.id);
		try {
			await client.projects.access.revokeExternalVisualAnalysis({
				projectId,
				permissionId: permission.id,
			});
			await permissionsQuery.refetch();
			setStatusMessage(
				`${categoryDetails[permission.category].label} analizi izni geri alındı.`
			);
		} catch (error) {
			setErrorMessage(
				getErrorMessage(error, "İzin geri alınamadı. Yeniden deneyin.")
			);
		} finally {
			setRevokingId(null);
		}
	}

	return (
		<section
			aria-labelledby="external-analysis-heading"
			className="space-y-5 rounded-lg border p-5"
		>
			<header className="space-y-2">
				<div className="flex flex-wrap items-center justify-between gap-2">
					<h2 className="font-semibold text-xl" id="external-analysis-heading">
						Harici Görsel Analizi
					</h2>
					<span className="rounded-full border px-2.5 py-1 font-medium text-xs">
						Kullanılamıyor
					</span>
				</div>
				<p className="text-muted-foreground text-sm">
					İzinler proje ve analiz kategorisine göre ayrı tutulur. Sağlayıcı
					koşulları doğrulanana kadar yeni izin verilemez.
				</p>
			</header>

			<div className="space-y-2 rounded-md bg-muted p-4 text-sm">
				<p className="font-medium">Mevcut durum</p>
				<p>Sağlayıcı: seçilmedi</p>
				<p>Gönderilecek veri: bu ekranda görsel seçilmiyor.</p>
				<p>Saklama koşulları: bilinmiyor</p>
				{providerPolicyVerified ? null : (
					<p className="text-muted-foreground">
						Sağlayıcı ve veri işleme koşulları doğrulanana kadar analiz
						kategorileri kullanılamaz; izin oluşturulamaz ve görsel aktarılamaz.
					</p>
				)}
			</div>

			{errorMessage ? <p role="alert">{errorMessage}</p> : null}
			{statusMessage ? (
				<p aria-live="polite" role="status">
					{statusMessage}
				</p>
			) : null}
			{permissionsQuery.isError ? (
				<p role="alert">
					İzinler yüklenemedi: {permissionsQuery.error.message}
				</p>
			) : null}

			<div className="space-y-3">
				{externalVisualAnalysisCategories.map((category) => {
					const details = categoryDetails[category];
					const categoryPermissions = permissions.filter(
						(permission) => permission.category === category
					);
					const [latestPermission] = categoryPermissions;
					const activePermission = categoryPermissions.find(
						(permission) => permission.revokedAt === null
					);
					const categoryIsSaving = savingCategory === category;

					return (
						<fieldset
							className="space-y-3 rounded-lg border p-4"
							key={category}
						>
							<legend className="px-1 font-medium">{details.label}</legend>
							<p className="text-muted-foreground text-sm">
								Amaç: {externalVisualAnalysisPurposeByCategory[category]}
							</p>
							<p className="text-sm">
								{getPermissionStatus(
									activePermission !== undefined,
									providerPolicyVerified
								)}
								{!activePermission && latestPermission?.revokedAt
									? ` · Son izin ${new Date(latestPermission.revokedAt).toLocaleString()} tarihinde geri alındı`
									: ""}
							</p>
							{activePermission ? (
								<Button
									aria-label={`${details.label} analizi iznini geri al`}
									disabled={isSaving}
									onClick={() => revokePermission(activePermission)}
									variant="destructive"
								>
									{revokingId === activePermission.id
										? "Geri alınıyor…"
										: `${details.label} analizi iznini geri al`}
								</Button>
							) : (
								<Button
									disabled={
										isSaving ||
										!providerPolicyVerified ||
										permissionsQuery.isPending ||
										permissionsQuery.isError
									}
									onClick={() => grantPermission(category)}
								>
									{categoryIsSaving
										? "Kaydediliyor…"
										: `${details.label} analizi için izin ver`}
								</Button>
							)}
						</fieldset>
					);
				})}
			</div>
		</section>
	);
}

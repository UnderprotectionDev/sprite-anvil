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
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { QueryRetryButton } from "@/utils/error-notification";
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
	const permissionsQuery = useQuery({
		...orpc.projects.access.listExternalVisualAnalysis.queryOptions({
			input: { projectId },
		}),
		meta: { suppressGlobalErrorToast: true },
	});
	const [statusMessage, setStatusMessage] = useState<string | null>(null);
	const permissions = permissionsQuery.data ?? [];
	const providerPolicyVerified =
		isExternalVisualAnalysisProviderPolicyVerified();
	const grantPermissionMutation = useMutation({
		mutationFn: (category: ExternalVisualAnalysisCategory) =>
			client.projects.access.grantExternalVisualAnalysis({
				projectId,
				category,
			}),
		onSuccess: async (_permission, category) => {
			setStatusMessage(
				`${categoryDetails[category].label} analizi izni kaydedildi.`
			);
			await permissionsQuery.refetch();
		},
	});
	const revokePermissionMutation = useMutation({
		mutationFn: (permission: ExternalVisualAnalysisPermission) =>
			client.projects.access.revokeExternalVisualAnalysis({
				projectId,
				permissionId: permission.id,
			}),
		onSuccess: async (_result, permission) => {
			setStatusMessage(
				`${categoryDetails[permission.category].label} analizi izni geri alındı.`
			);
			await permissionsQuery.refetch();
		},
	});
	const isSaving =
		grantPermissionMutation.isPending || revokePermissionMutation.isPending;
	const revokingId = revokePermissionMutation.isPending
		? revokePermissionMutation.variables?.id
		: null;

	function grantPermission(category: ExternalVisualAnalysisCategory) {
		setStatusMessage(null);
		grantPermissionMutation.mutate(category);
	}

	function revokePermission(permission: ExternalVisualAnalysisPermission) {
		setStatusMessage(null);
		revokePermissionMutation.mutate(permission);
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

			{statusMessage ? (
				<p aria-live="polite" role="status">
					{statusMessage}
				</p>
			) : null}
			{permissionsQuery.isError ? (
				<div className="space-y-2">
					<p role="alert">
						İzinler yüklenemedi:{" "}
						{getErrorMessage(
							permissionsQuery.error,
							"Yeniden deneyin.",
							"query"
						)}
					</p>
					<QueryRetryButton
						disabled={permissionsQuery.isFetching}
						onRetry={() => void permissionsQuery.refetch()}
					/>
				</div>
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
					const categoryIsSaving =
						grantPermissionMutation.isPending &&
						grantPermissionMutation.variables === category;

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

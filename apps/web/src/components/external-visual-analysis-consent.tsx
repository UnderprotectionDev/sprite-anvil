import { isExternalVisualAnalysisProviderPolicyVerified } from "@sprite-anvil/api/external-visual-analysis-policy";
import type {
	ExternalVisualAnalysisCategory,
	ExternalVisualAnalysisPermission,
} from "@sprite-anvil/api/project-access-store";
import { externalVisualAnalysisCategories } from "@sprite-anvil/api/project-access-store";
import { Button } from "@sprite-anvil/ui/components/button";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { orpc } from "@/utils/orpc";

const categoryDetails: Record<
	ExternalVisualAnalysisCategory,
	{ label: string }
> = {
	identity: {
		label: "Identity",
	},
	style: {
		label: "Style",
	},
	theme: {
		label: "Theme",
	},
};

const analysisPurposeLabels: Record<ExternalVisualAnalysisCategory, string> = {
	identity: "Analyze visual identity",
	style: "Analyze visual style",
	theme: "Analyze visual theme",
};

function getPermissionStatus(
	hasActivePermission: boolean,
	providerPolicyVerified: boolean
): string {
	if (hasActivePermission && providerPolicyVerified) {
		return "Permission active";
	}
	if (hasActivePermission) {
		return "Permission recorded · use disabled";
	}
	if (providerPolicyVerified) {
		return "Off";
	}
	return "Unavailable";
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
	});
	const [statusMessage, setStatusMessage] = useState<string | null>(null);
	const permissions = permissionsQuery.data ?? [];
	const providerPolicyVerified =
		isExternalVisualAnalysisProviderPolicyVerified();
	const grantPermissionMutation = useMutation(
		orpc.projects.access.grantExternalVisualAnalysis.mutationOptions({
			onSuccess: async (_permission, { category }) => {
				setStatusMessage(
					`${categoryDetails[category].label} analysis permission saved.`
				);
				await permissionsQuery.refetch();
			},
		})
	);
	const revokePermissionMutation = useMutation(
		orpc.projects.access.revokeExternalVisualAnalysis.mutationOptions({
			onSuccess: async (_result, { permissionId }) => {
				const revoked = permissions.find(
					(permission) => permission.id === permissionId
				);
				setStatusMessage(
					revoked
						? `${categoryDetails[revoked.category].label} analysis permission revoked.`
						: "Analysis permission revoked."
				);
				await permissionsQuery.refetch();
			},
		})
	);
	const isSaving =
		grantPermissionMutation.isPending || revokePermissionMutation.isPending;
	const revokingId = revokePermissionMutation.isPending
		? revokePermissionMutation.variables?.permissionId
		: null;

	function grantPermission(category: ExternalVisualAnalysisCategory) {
		setStatusMessage(null);
		grantPermissionMutation.mutate({ projectId, category });
	}

	function revokePermission(permission: ExternalVisualAnalysisPermission) {
		setStatusMessage(null);
		revokePermissionMutation.mutate({
			projectId,
			permissionId: permission.id,
		});
	}

	return (
		<section
			aria-labelledby="external-analysis-heading"
			className="space-y-5 rounded-lg border p-5"
		>
			<header className="space-y-2">
				<div className="flex flex-wrap items-center justify-between gap-2">
					<h2 className="text-xl font-semibold" id="external-analysis-heading">
						External Visual Analysis
					</h2>
					<span className="rounded-full border px-2.5 py-1 text-xs font-medium">
						Unavailable
					</span>
				</div>
				<p className="text-muted-foreground text-sm">
					Permissions are separate by project and analysis category. New
					permission cannot be granted until provider terms are verified.
				</p>
			</header>

			<div className="bg-muted space-y-2 rounded-md p-4 text-sm">
				<p className="font-medium">Current status</p>
				<p>Provider: not selected</p>
				<p>Data to send: no image is selected on this screen.</p>
				<p>Retention terms: unknown</p>
				{providerPolicyVerified ? null : (
					<p className="text-muted-foreground">
						Analysis categories are unavailable until provider and data
						processing terms are verified; permission cannot be created and
						images cannot be transferred.
					</p>
				)}
			</div>

			{statusMessage ? (
				<p aria-live="polite" role="status">
					{statusMessage}
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
					const categoryIsSaving =
						grantPermissionMutation.isPending &&
						grantPermissionMutation.variables?.category === category;

					return (
						<fieldset
							className="space-y-3 rounded-lg border p-4"
							key={category}
						>
							<legend className="px-1 font-medium">{details.label}</legend>
							<p className="text-muted-foreground text-sm">
								Purpose: {analysisPurposeLabels[category]}
							</p>
							<p className="text-sm">
								{getPermissionStatus(
									activePermission !== undefined,
									providerPolicyVerified
								)}
								{!activePermission && latestPermission?.revokedAt
									? ` · Last permission revoked on ${new Date(latestPermission.revokedAt).toLocaleString()}`
									: ""}
							</p>
							{activePermission ? (
								<Button
									aria-label={`Revoke ${details.label} analysis permission`}
									disabled={isSaving}
									onClick={() => revokePermission(activePermission)}
									variant="destructive"
								>
									{revokingId === activePermission.id
										? "Revoking…"
										: `Revoke ${details.label} analysis permission`}
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
										? "Saving…"
										: `Grant ${details.label} analysis permission`}
								</Button>
							)}
						</fieldset>
					);
				})}
			</div>
		</section>
	);
}

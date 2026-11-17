import type {
	ContextAgentScope,
	ToolAccessPermission,
} from "@sprite-anvil/api/project-access-store";
import { Button } from "@sprite-anvil/ui/components/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { ExternalVisualAnalysisConsent } from "@/components/external-visual-analysis-consent";
import { isWriteOutcomeUncertain } from "@/utils/error-notification";
import { orpc } from "@/utils/orpc";
import {
	ContextAgentPermissionForm,
	scopeOptions,
	useContextAgentPermissionForm,
} from "../forms/context-agent-permission-form";

const connectionScopes = [
	"Read Project Context",
	"Access selected references",
	"Write the result file back as a Candidate Version",
];

export function ProjectAccessScreen({ projectId }: { projectId: string }) {
	const queryClient = useQueryClient();
	const projectQueryOptions = orpc.projects.get.queryOptions({
		input: { projectId },
	});
	const projectQuery = useQuery({
		...projectQueryOptions,
	});
	const permissionsQueryOptions = orpc.projects.access.list.queryOptions({
		input: { projectId },
	});
	const permissionsQuery = useQuery({
		...permissionsQueryOptions,
	});
	const grantForm = useContextAgentPermissionForm(handleGrantPermission);
	const [revokingId, setRevokingId] = useState<string | null>(null);
	const [statusMessage, setStatusMessage] = useState<string | null>(null);
	const [writeOutcomeUncertain, setWriteOutcomeUncertain] = useState(false);
	const [isCheckingWriteOutcome, setIsCheckingWriteOutcome] = useState(false);
	const grantPermission = useMutation(
		orpc.projects.access.grantContextAgent.mutationOptions({
			onSuccess: async () => {
				setStatusMessage("Context Agent permission saved.");
				await queryClient.invalidateQueries({
					queryKey: permissionsQueryOptions.queryKey,
				});
			},
			onError: (error) => {
				if (isWriteOutcomeUncertain(error)) {
					setWriteOutcomeUncertain(true);
				}
			},
		})
	);
	const revokePermission = useMutation(
		orpc.projects.access.revoke.mutationOptions({
			onSuccess: async () => {
				setStatusMessage(
					"Permission revoked. New access requests will be rejected."
				);
				await queryClient.invalidateQueries({
					queryKey: permissionsQueryOptions.queryKey,
				});
			},
			onError: (error) => {
				if (isWriteOutcomeUncertain(error)) {
					setWriteOutcomeUncertain(true);
				}
			},
			onSettled: () => setRevokingId(null),
		})
	);
	const isPermissionStateUnavailable =
		permissionsQuery.isFetching || permissionsQuery.isError;
	const isGrantingLocked =
		grantPermission.isPending || isPermissionStateUnavailable;

	async function refreshPermissionState() {
		setIsCheckingWriteOutcome(true);
		try {
			const result = await permissionsQuery.refetch();
			if (result.isError) {
				return;
			}

			if (writeOutcomeUncertain) {
				setWriteOutcomeUncertain(false);
				setStatusMessage(
					"Permissions refreshed. Check the current state before resubmitting."
				);
			}
		} finally {
			setIsCheckingWriteOutcome(false);
		}
	}

	function handleGrantPermission(input: {
		purpose: string;
		scopes: ContextAgentScope[];
	}) {
		if (writeOutcomeUncertain || isGrantingLocked) {
			return;
		}
		setStatusMessage(null);
		grantPermission.mutate({ projectId, ...input });
	}

	function handleRevokePermission(permissionId: string) {
		if (writeOutcomeUncertain || revokePermission.isPending) {
			return;
		}
		setStatusMessage(null);
		setRevokingId(permissionId);
		revokePermission.mutate({ projectId, permissionId });
	}

	const permissions = permissionsQuery.data ?? [];

	return (
		<main className="mx-auto w-full max-w-3xl space-y-8 px-4 py-8">
			<div className="space-y-3">
				<Link
					className="text-muted-foreground text-sm underline underline-offset-4"
					to="/projects"
				>
					Back to projects
				</Link>
				<ProjectAccessHeader
					isError={projectQuery.isError}
					isPending={projectQuery.isPending}
					projectName={projectQuery.data?.name}
				/>
			</div>

			{statusMessage ? (
				<p aria-live="polite" role="status">
					{statusMessage}
				</p>
			) : null}
			{writeOutcomeUncertain ? (
				<Button
					disabled={isCheckingWriteOutcome}
					onClick={() => void refreshPermissionState()}
					type="button"
					variant="outline"
				>
					{isCheckingWriteOutcome ? "Checking status…" : "Check status"}
				</Button>
			) : null}

			<section
				aria-labelledby="context-agent-heading"
				className="space-y-5 rounded-lg border p-5"
			>
				<div className="space-y-2">
					<div className="flex flex-wrap items-center justify-between gap-2">
						<h2 className="font-semibold text-xl" id="context-agent-heading">
							Context Agent
						</h2>
						<span className="rounded-full border px-2.5 py-1 font-medium text-xs">
							Project permission required
						</span>
					</div>
					<p className="text-muted-foreground text-sm">
						The agent can work only within the purpose and scope selected below.
						Preparing a proposal does not grant permission to activate a Context
						Revision.
					</p>
				</div>

				<ContextAgentPermissionForm
					form={grantForm}
					isDisabled={isPermissionStateUnavailable}
					isSaving={grantPermission.isPending}
					writeOutcomeUncertain={writeOutcomeUncertain}
				/>

				<ContextAgentPermissionHistory
					isError={permissionsQuery.isError}
					isPending={permissionsQuery.isPending}
					onRevoke={handleRevokePermission}
					permissions={permissions}
					revokingId={revokingId}
					writeOutcomeUncertain={writeOutcomeUncertain}
				/>
			</section>

			<section
				aria-labelledby="connection-heading"
				className="space-y-4 rounded-lg border p-5"
			>
				<div className="flex flex-wrap items-center justify-between gap-2">
					<h2 className="font-semibold text-xl" id="connection-heading">
						External Tool Connection
					</h2>
					<span className="rounded-full border px-2.5 py-1 font-medium text-xs">
						No provider selected
					</span>
				</div>
				<p className="text-muted-foreground text-sm">
					Purpose: read Project Context and selected references, and write the
					result file back as a Candidate Version.
				</p>
				<div>
					<p className="font-medium text-sm">Access scope</p>
					<ul className="mt-2 list-inside list-disc space-y-1 text-muted-foreground text-sm">
						{connectionScopes.map((scope) => (
							<li key={scope}>{scope}</li>
						))}
					</ul>
				</div>
				<p className="rounded-md bg-muted p-3 text-sm">
					Connection permission cannot be granted until a provider is selected,
					and every access request is rejected.
				</p>
			</section>

			<ExternalVisualAnalysisConsent projectId={projectId} />

			<p className="text-muted-foreground text-sm">
				External tool permissions do not authorize activating a Context
				Revision, creating a Review Record, granting a Quality Waiver, or
				deleting project content.
			</p>
		</main>
	);
}

function ProjectAccessHeader({
	isError,
	isPending,
	projectName,
}: {
	isError: boolean;
	isPending: boolean;
	projectName?: string;
}) {
	if (isPending) {
		return <p aria-live="polite">Loading project…</p>;
	}
	if (isError) {
		return null;
	}
	return (
		<header className="space-y-2">
			<p className="font-mono text-primary text-xs uppercase tracking-[0.16em]">
				Manage permissions / External tool access
			</p>
			<h1 className="font-medium font-serif text-4xl tracking-tight">
				{projectName}
			</h1>
			<p className="max-w-2xl text-muted-foreground">
				Set the purpose and accessible project information separately for each
				tool.
			</p>
		</header>
	);
}

function ContextAgentPermissionHistory({
	isError,
	isPending,
	onRevoke,
	permissions,
	revokingId,
	writeOutcomeUncertain,
}: {
	isError: boolean;
	isPending: boolean;
	onRevoke: (permissionId: string) => void;
	permissions: ToolAccessPermission[];
	revokingId: string | null;
	writeOutcomeUncertain: boolean;
}) {
	if (isPending) {
		return <p aria-live="polite">Loading permissions…</p>;
	}
	if (isError) {
		return null;
	}
	if (permissions.length === 0) {
		return (
			<p className="rounded-lg border border-dashed p-4 text-muted-foreground text-sm">
				No Context Agent permissions have been saved for this project.
			</p>
		);
	}
	return (
		<ul aria-label="Context Agent permission records" className="space-y-3">
			{permissions.map((permission) => (
				<ContextAgentPermissionRecord
					key={permission.id}
					onRevoke={onRevoke}
					permission={permission}
					revokingId={revokingId}
					writeOutcomeUncertain={writeOutcomeUncertain}
				/>
			))}
		</ul>
	);
}

function ContextAgentPermissionRecord({
	onRevoke,
	permission,
	revokingId,
	writeOutcomeUncertain,
}: {
	onRevoke: (permissionId: string) => void;
	permission: ToolAccessPermission;
	revokingId: string | null;
	writeOutcomeUncertain: boolean;
}) {
	const isActive = permission.revokedAt === null;
	return (
		<li className="space-y-3 rounded-lg border p-4">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<p className="font-medium">{permission.purpose}</p>
				<span className="rounded-full border px-2.5 py-1 text-xs">
					{isActive ? "Active" : "Revoked"}
				</span>
			</div>
			<ul className="list-inside list-disc space-y-1 text-muted-foreground text-sm">
				{permission.scopes.map((scope) => (
					<li key={scope}>
						{scopeOptions.find((option) => option.scope === scope)?.label ??
							scope}
					</li>
				))}
			</ul>
			<p className="text-muted-foreground text-xs">
				Granted: {new Date(permission.createdAt).toLocaleString()}
				{permission.revokedAt
					? ` · Geri alma: ${new Date(permission.revokedAt).toLocaleString()}`
					: ""}
			</p>
			{isActive ? (
				<Button
					aria-label={`${permission.purpose} revoke permission`}
					disabled={revokingId !== null || writeOutcomeUncertain}
					onClick={() => onRevoke(permission.id)}
					variant="destructive"
				>
					{revokingId === permission.id ? "Revoking…" : "Revoke permission"}
				</Button>
			) : null}
		</li>
	);
}

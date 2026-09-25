import type {
	ContextAgentScope,
	ToolAccessPermission,
} from "@sprite-anvil/api/project-access-store";
import { Button } from "@sprite-anvil/ui/components/button";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { type SyntheticEvent, useState } from "react";
import { ExternalVisualAnalysisConsent } from "@/features/external-visual-analysis/ui/components/external-visual-analysis-consent";
import { isWriteOutcomeUncertain } from "@/utils/error-notification";
import { client, orpc } from "@/utils/orpc";
import {
	ContextAgentPermissionForm,
	scopeOptions,
} from "../forms/context-agent-permission-form";

const connectionScopes = [
	"Proje Bağlamı'nı okuma",
	"Seçilen referanslara erişme",
	"Sonuç dosyasını Aday Sürüm olarak geri yazma",
];

export function ProjectAccessScreen({ projectId }: { projectId: string }) {
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
	const [purpose, setPurpose] = useState("Proje Bağlamı için öneri hazırlama");
	const [selectedScopes, setSelectedScopes] = useState<ContextAgentScope[]>([
		"project_context:read",
		"context_proposals:write",
	]);
	const [revokingId, setRevokingId] = useState<string | null>(null);
	const [statusMessage, setStatusMessage] = useState<string | null>(null);
	const [writeOutcomeUncertain, setWriteOutcomeUncertain] = useState(false);
	const [isCheckingWriteOutcome, setIsCheckingWriteOutcome] = useState(false);
	const grantPermission = useMutation({
		mutationFn: (input: { purpose: string; scopes: ContextAgentScope[] }) =>
			client.projects.access.grantContextAgent({ projectId, ...input }),
		onSuccess: async () => {
			setStatusMessage("Bağlam Ajanı izni kaydedildi.");
			await permissionsQuery.refetch();
		},
		onError: (error) => {
			if (isWriteOutcomeUncertain(error)) {
				setWriteOutcomeUncertain(true);
			}
		},
	});
	const revokePermission = useMutation({
		mutationFn: (permissionId: string) =>
			client.projects.access.revoke({ projectId, permissionId }),
		onSuccess: async () => {
			setStatusMessage("İzin geri alındı. Yeni erişim istekleri reddedilir.");
			await permissionsQuery.refetch();
		},
		onError: (error) => {
			if (isWriteOutcomeUncertain(error)) {
				setWriteOutcomeUncertain(true);
			}
		},
		onSettled: () => setRevokingId(null),
	});
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
					"İzin listesi yenilendi. İşlemi yeniden göndermeden önce mevcut durumu kontrol edin."
				);
			}
		} finally {
			setIsCheckingWriteOutcome(false);
		}
	}

	function toggleScope(scope: ContextAgentScope, checked: boolean) {
		setSelectedScopes((current) =>
			checked
				? [...new Set([...current, scope])]
				: current.filter((selectedScope) => selectedScope !== scope)
		);
	}

	function handleGrantPermission(event: SyntheticEvent<HTMLFormElement>) {
		event.preventDefault();
		if (writeOutcomeUncertain || isGrantingLocked) {
			return;
		}
		const trimmedPurpose = purpose.trim();
		if (trimmedPurpose.length < 3 || selectedScopes.length === 0) {
			return;
		}
		setStatusMessage(null);
		grantPermission.mutate({ purpose: trimmedPurpose, scopes: selectedScopes });
	}

	function handleRevokePermission(permissionId: string) {
		if (writeOutcomeUncertain || revokePermission.isPending) {
			return;
		}
		setStatusMessage(null);
		setRevokingId(permissionId);
		revokePermission.mutate(permissionId);
	}

	const permissions = permissionsQuery.data ?? [];

	return (
		<main className="mx-auto w-full max-w-3xl space-y-8 overflow-y-auto px-4 py-8">
			<div className="space-y-3">
				<Link
					className="text-muted-foreground text-sm underline underline-offset-4"
					to="/projects"
				>
					Oyun projelerine dön
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
					{isCheckingWriteOutcome
						? "Durum kontrol ediliyor…"
						: "Durumu kontrol et"}
				</Button>
			) : null}

			<section
				aria-labelledby="context-agent-heading"
				className="space-y-5 rounded-lg border p-5"
			>
				<div className="space-y-2">
					<div className="flex flex-wrap items-center justify-between gap-2">
						<h2 className="font-semibold text-xl" id="context-agent-heading">
							Bağlam Ajanı
						</h2>
						<span className="rounded-full border px-2.5 py-1 font-medium text-xs">
							Proje izni gerekir
						</span>
					</div>
					<p className="text-muted-foreground text-sm">
						Ajan yalnız aşağıda seçtiğiniz amaç ve kapsamda çalışabilir. Öneri
						hazırlamak Bağlam Sürümü'nü etkinleştirme yetkisi vermez.
					</p>
				</div>

				<ContextAgentPermissionForm
					isDisabled={isPermissionStateUnavailable}
					isSaving={grantPermission.isPending}
					onPurposeChange={setPurpose}
					onSubmit={handleGrantPermission}
					onToggleScope={toggleScope}
					purpose={purpose}
					selectedScopes={selectedScopes}
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
						Dış Araç Bağlantısı
					</h2>
					<span className="rounded-full border px-2.5 py-1 font-medium text-xs">
						Sağlayıcı seçilmedi
					</span>
				</div>
				<p className="text-muted-foreground text-sm">
					Amaç: Proje Bağlamı'nı ve seçilen referansları okumak, sonuç dosyasını
					Aday Sürüm olarak geri yazmak.
				</p>
				<div>
					<p className="font-medium text-sm">Erişim kapsamı</p>
					<ul className="mt-2 list-inside list-disc space-y-1 text-muted-foreground text-sm">
						{connectionScopes.map((scope) => (
							<li key={scope}>{scope}</li>
						))}
					</ul>
				</div>
				<p className="rounded-md bg-muted p-3 text-sm">
					Belirli bir sağlayıcı seçilene kadar bağlantı izni verilemez ve her
					erişim isteği reddedilir.
				</p>
			</section>

			<ExternalVisualAnalysisConsent projectId={projectId} />

			<p className="text-muted-foreground text-sm">
				Dış araç izinleri Bağlam Sürümü'nü etkinleştirme, İnceleme Kaydı
				oluşturma, Kalite İstisnası verme veya proje içeriğini silme yetkisi
				vermez.
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
		return <p aria-live="polite">Proje yükleniyor…</p>;
	}
	if (isError) {
		return null;
	}
	return (
		<header className="space-y-2">
			<p className="text-muted-foreground text-sm">Dış araç erişimi</p>
			<h1 className="font-bold text-3xl">{projectName}</h1>
			<p className="text-muted-foreground">
				Her araç için amacı ve erişebileceği proje bilgilerini ayrı belirleyin.
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
		return <p aria-live="polite">İzinler yükleniyor…</p>;
	}
	if (isError) {
		return null;
	}
	if (permissions.length === 0) {
		return (
			<p className="rounded-lg border border-dashed p-4 text-muted-foreground text-sm">
				Bu projede kayıtlı Bağlam Ajanı izni yok.
			</p>
		);
	}
	return (
		<ul aria-label="Bağlam Ajanı izin kayıtları" className="space-y-3">
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
					{isActive ? "Etkin" : "Geri alındı"}
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
				Verilme: {new Date(permission.createdAt).toLocaleString()}
				{permission.revokedAt
					? ` · Geri alma: ${new Date(permission.revokedAt).toLocaleString()}`
					: ""}
			</p>
			{isActive ? (
				<Button
					aria-label={`${permission.purpose} iznini geri al`}
					disabled={revokingId !== null || writeOutcomeUncertain}
					onClick={() => onRevoke(permission.id)}
					variant="destructive"
				>
					{revokingId === permission.id ? "Geri alınıyor…" : "İzni geri al"}
				</Button>
			) : null}
		</li>
	);
}

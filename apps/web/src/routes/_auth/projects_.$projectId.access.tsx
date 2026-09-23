import type {
	ContextAgentScope,
	ToolAccessPermission,
} from "@sprite-anvil/api/project-access-store";
import { Button } from "@sprite-anvil/ui/components/button";
import { Input } from "@sprite-anvil/ui/components/input";
import { Label } from "@sprite-anvil/ui/components/label";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { type SyntheticEvent, useState } from "react";

import { getErrorMessage } from "@/utils/get-error-message";
import { client, orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_auth/projects_/$projectId/access")({
	component: ProjectAccessRoute,
});

const scopeOptions: { label: string; scope: ContextAgentScope }[] = [
	{ label: "Proje Bağlamı'nı okuma", scope: "project_context:read" },
	{ label: "Bağlam Önerisi hazırlama", scope: "context_proposals:write" },
];

const connectionScopes = [
	"Proje Bağlamı'nı okuma",
	"Seçilen referanslara erişme",
	"Sonuç dosyasını Aday Sürüm olarak geri yazma",
];

function ProjectAccessRoute() {
	const { projectId } = Route.useParams();
	return <ProjectAccessScreen projectId={projectId} />;
}

export function ProjectAccessScreen({ projectId }: { projectId: string }) {
	const projectQuery = useQuery(
		orpc.projects.get.queryOptions({ input: { projectId } })
	);
	const permissionsQuery = useQuery(
		orpc.projects.access.list.queryOptions({ input: { projectId } })
	);
	const [purpose, setPurpose] = useState("Proje Bağlamı için öneri hazırlama");
	const [selectedScopes, setSelectedScopes] = useState<ContextAgentScope[]>([
		"project_context:read",
		"context_proposals:write",
	]);
	const [isSaving, setIsSaving] = useState(false);
	const [revokingId, setRevokingId] = useState<string | null>(null);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [statusMessage, setStatusMessage] = useState<string | null>(null);

	function toggleScope(scope: ContextAgentScope, checked: boolean) {
		setSelectedScopes((current) =>
			checked
				? [...new Set([...current, scope])]
				: current.filter((selectedScope) => selectedScope !== scope)
		);
	}

	async function handleGrantPermission(event: SyntheticEvent<HTMLFormElement>) {
		event.preventDefault();
		const trimmedPurpose = purpose.trim();
		if (trimmedPurpose.length < 3 || selectedScopes.length === 0) {
			return;
		}
		setErrorMessage(null);
		setStatusMessage(null);
		setIsSaving(true);
		try {
			await client.projects.access.grantContextAgent({
				projectId,
				purpose: trimmedPurpose,
				scopes: selectedScopes,
			});
			await permissionsQuery.refetch();
			setStatusMessage("Bağlam Ajanı izni kaydedildi.");
		} catch (error) {
			setErrorMessage(
				getErrorMessage(error, "İzin kaydedilemedi. Yeniden deneyin.")
			);
		} finally {
			setIsSaving(false);
		}
	}

	async function handleRevokePermission(permissionId: string) {
		setErrorMessage(null);
		setStatusMessage(null);
		setRevokingId(permissionId);
		try {
			await client.projects.access.revoke({ projectId, permissionId });
			await permissionsQuery.refetch();
			setStatusMessage("İzin geri alındı. Yeni erişim istekleri reddedilir.");
		} catch (error) {
			setErrorMessage(
				getErrorMessage(error, "İzin geri alınamadı. Yeniden deneyin.")
			);
		} finally {
			setRevokingId(null);
		}
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
					errorMessage={
						projectQuery.isError ? projectQuery.error.message : null
					}
					isPending={projectQuery.isPending}
					projectName={projectQuery.data?.name}
				/>
			</div>

			{errorMessage ? <p role="alert">{errorMessage}</p> : null}
			{statusMessage ? (
				<p aria-live="polite" role="status">
					{statusMessage}
				</p>
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

				<form className="space-y-4" onSubmit={handleGrantPermission}>
					<div className="space-y-2">
						<Label htmlFor="context-agent-purpose">Amaç</Label>
						<Input
							id="context-agent-purpose"
							maxLength={160}
							minLength={3}
							name="purpose"
							onChange={(event) => setPurpose(event.target.value)}
							required
							value={purpose}
						/>
					</div>

					<fieldset className="space-y-3">
						<legend className="font-medium">Erişim kapsamı</legend>
						{scopeOptions.map(({ label, scope }) => {
							const id = `scope-${scope.replaceAll(":", "-")}`;
							return (
								<div className="flex items-start gap-3" key={scope}>
									<input
										checked={selectedScopes.includes(scope)}
										className="mt-1 size-4 accent-primary"
										id={id}
										onChange={(event) =>
											toggleScope(scope, event.target.checked)
										}
										type="checkbox"
									/>
									<Label className="font-normal" htmlFor={id}>
										{label}
									</Label>
								</div>
							);
						})}
					</fieldset>

					<Button
						disabled={
							isSaving ||
							purpose.trim().length < 3 ||
							selectedScopes.length === 0
						}
						type="submit"
					>
						{isSaving ? "Kaydediliyor…" : "Bağlam Ajanı izni ver"}
					</Button>
				</form>

				<ContextAgentPermissionHistory
					errorMessage={
						permissionsQuery.isError ? permissionsQuery.error.message : null
					}
					isPending={permissionsQuery.isPending}
					onRevoke={handleRevokePermission}
					permissions={permissions}
					revokingId={revokingId}
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

			<section
				aria-labelledby="external-analysis-heading"
				className="space-y-2 rounded-lg border p-5"
			>
				<div className="flex flex-wrap items-center justify-between gap-2">
					<h2 className="font-semibold text-xl" id="external-analysis-heading">
						Harici Görsel Analizi
					</h2>
					<span className="rounded-full border px-2.5 py-1 font-medium text-xs">
						Kapalı
					</span>
				</div>
				<p className="text-muted-foreground text-sm">
					Bu ekrandan görsel gönderimi etkinleştirilemez. Harici analiz ayrı,
					açık bir kullanıcı izni gerektirir.
				</p>
			</section>

			<p className="text-muted-foreground text-sm">
				Dış araç izinleri Bağlam Sürümü'nü etkinleştirme, İnceleme Kaydı
				oluşturma, Kalite İstisnası verme veya proje içeriğini silme yetkisi
				vermez.
			</p>
		</main>
	);
}

function ProjectAccessHeader({
	errorMessage,
	isPending,
	projectName,
}: {
	errorMessage: string | null;
	isPending: boolean;
	projectName?: string;
}) {
	if (isPending) {
		return <p aria-live="polite">Proje yükleniyor…</p>;
	}
	if (errorMessage) {
		return <p role="alert">Proje açılamadı: {errorMessage}</p>;
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
	errorMessage,
	isPending,
	onRevoke,
	permissions,
	revokingId,
}: {
	errorMessage: string | null;
	isPending: boolean;
	onRevoke: (permissionId: string) => void;
	permissions: ToolAccessPermission[];
	revokingId: string | null;
}) {
	if (isPending) {
		return <p aria-live="polite">İzinler yükleniyor…</p>;
	}
	if (errorMessage) {
		return <p role="alert">İzinler yüklenemedi: {errorMessage}</p>;
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
				/>
			))}
		</ul>
	);
}

function ContextAgentPermissionRecord({
	onRevoke,
	permission,
	revokingId,
}: {
	onRevoke: (permissionId: string) => void;
	permission: ToolAccessPermission;
	revokingId: string | null;
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
					disabled={revokingId !== null}
					onClick={() => onRevoke(permission.id)}
					variant="destructive"
				>
					{revokingId === permission.id ? "Geri alınıyor…" : "İzni geri al"}
				</Button>
			) : null}
		</li>
	);
}

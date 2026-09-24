import { Button } from "@sprite-anvil/ui/components/button";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { SyntheticEvent } from "react";
import { QueryRetryButton } from "@/utils/error-notification";
import { getErrorMessage } from "@/utils/get-error-message";
import { client, orpc } from "@/utils/orpc";
import { AssetFamilyCatalogView } from "../components/asset-family-catalog";
import {
	type AssetFamilyFormHandlers,
	AssetFamilyManagementForms,
} from "../components/asset-family-management-forms";
import { useAssetFamilyFormState } from "../hooks/use-asset-family-form-state";
import { useAssetFamilyWrites } from "../hooks/use-asset-family-writes";

export function AssetFamiliesView({ projectId }: { projectId: string }) {
	const projectsQuery = useQuery({
		...orpc.projectContexts.list.queryOptions(),
		meta: { errorPresentation: "inline" },
	});
	const catalogQuery = useQuery({
		...orpc.assetFamilies.list.queryOptions({ input: { projectId } }),
		meta: { errorPresentation: "inline" },
	});
	const scopeQuery = useQuery({
		...orpc.contextScopes.list.queryOptions({ input: { projectId } }),
		meta: { errorPresentation: "inline" },
	});
	const project = projectsQuery.data?.find((item) => item.id === projectId);
	const catalog = catalogQuery.data;
	const visualWorlds = scopeQuery.data?.visualWorlds ?? [];
	const form = useAssetFamilyFormState(catalog, visualWorlds);
	const writes = useAssetFamilyWrites(catalogQuery.refetch);
	const { state: formState } = form;

	function submitSubjectIdentity(event: SyntheticEvent<HTMLFormElement>) {
		void writes.save(
			event,
			"subject-identity",
			() =>
				client.assetFamilies.createSubjectIdentity({
					projectId,
					name: formState.subjectIdentityName,
				}),
			(record) => form.created.subjectIdentity(record.id),
			"Varlık Kimliği kaydedildi."
		);
	}

	function submitAssetFamily(event: SyntheticEvent<HTMLFormElement>) {
		void writes.save(
			event,
			"asset-family",
			() =>
				client.assetFamilies.createAssetFamily({
					projectId,
					subjectIdentityId: formState.selectedSubjectIdentityId,
					name: formState.familyName,
					visualWorldId: formState.selectedVisualWorldId,
					useContext: formState.familyUseContext,
				}),
			(record) => form.created.assetFamily(record.id),
			"Varlık Ailesi kaydedildi."
		);
	}

	function submitAssetRecord(event: SyntheticEvent<HTMLFormElement>) {
		void writes.save(
			event,
			"asset-record",
			() =>
				client.assetFamilies.createAssetRecord({
					projectId,
					assetFamilyId: formState.selectedAssetRecordFamilyId,
					name: formState.assetRecordName,
				}),
			(record) => form.created.assetRecord(record.id),
			"Varlık Kaydı kaydedildi."
		);
	}

	function submitRelationship(event: SyntheticEvent<HTMLFormElement>) {
		void writes.save(
			event,
			"relationship",
			() =>
				client.assetFamilies.createRelationship({
					projectId,
					assetFamilyId: formState.selectedRelationshipFamilyId,
					sourceAssetRecordId: formState.selectedRelationshipSourceId,
					targetAssetRecordId: formState.selectedRelationshipTargetId,
					type: formState.relationshipType,
				}),
			() => undefined,
			"İlişki kaydedildi."
		);
	}

	const formHandlers: AssetFamilyFormHandlers = {
		...form.changeHandlers,
		submitAssetFamily,
		submitAssetRecord,
		submitRelationship,
		submitSubjectIdentity,
	};

	return (
		<main className="mx-auto w-full max-w-5xl space-y-8 overflow-y-auto px-4 py-8">
			<PageHeader projectName={project?.name} />
			<QueryState
				error={projectsQuery.error}
				failureMessage="Proje yüklenemedi."
				isError={projectsQuery.isError}
				isFetching={projectsQuery.isFetching}
				isPending={projectsQuery.isPending}
				loadingMessage="Projeler yükleniyor…"
				onRetry={() => void projectsQuery.refetch()}
			/>
			{projectsQuery.isSuccess && !project ? (
				<p role="alert">Bu Proje bulunamadı.</p>
			) : null}
			{writes.errorMessage ? <p role="alert">{writes.errorMessage}</p> : null}
			{writes.statusMessage ? (
				<p aria-live="polite" role="status">
					{writes.statusMessage}
				</p>
			) : null}
			{writes.writeOutcomeUncertain ? (
				<Button
					disabled={writes.isCheckingOutcome}
					onClick={() => void writes.checkWriteOutcome()}
					type="button"
					variant="outline"
				>
					{writes.isCheckingOutcome
						? "Durum kontrol ediliyor…"
						: "Durumu kontrol et"}
				</Button>
			) : null}

			<QueryState
				error={catalogQuery.error}
				failureMessage="Varlık Aileleri yüklenemedi."
				isError={catalogQuery.isError}
				isFetching={catalogQuery.isFetching}
				isPending={catalogQuery.isPending}
				loadingMessage="Varlık Aileleri yükleniyor…"
				onRetry={() => void catalogQuery.refetch()}
			/>
			<QueryState
				error={scopeQuery.error}
				failureMessage="Görsel Dünyalar yüklenemedi."
				isError={scopeQuery.isError}
				isFetching={scopeQuery.isFetching}
				isPending={scopeQuery.isPending}
				loadingMessage="Görsel Dünyalar yükleniyor…"
				onRetry={() => void scopeQuery.refetch()}
			/>

			{catalog && !catalogQuery.isError ? (
				<>
					<AssetFamilyManagementForms
						catalog={catalog}
						disabled={writes.writesDisabled}
						formHandlers={formHandlers}
						formState={formState}
						isSaving={writes.savingOperation}
						isScopeError={scopeQuery.isError}
						isScopeLoaded={scopeQuery.isSuccess}
						visualWorlds={visualWorlds}
					/>
					<section
						aria-labelledby="asset-family-catalog-heading"
						className="space-y-4"
					>
						<div>
							<h2
								className="font-semibold text-2xl"
								id="asset-family-catalog-heading"
							>
								Kaydedilmiş Varlık Aileleri
							</h2>
							<p className="mt-1 text-muted-foreground text-sm">
								Aynı Varlık Kimliği altındaki aileler burada ayrı ayrı görünür.
							</p>
						</div>
						<AssetFamilyCatalogView
							catalog={catalog}
							visualWorlds={visualWorlds}
						/>
					</section>
				</>
			) : null}
		</main>
	);
}

function PageHeader({ projectName }: { projectName?: string }) {
	return (
		<div className="space-y-3">
			<Link
				className="text-muted-foreground text-sm underline underline-offset-4"
				to="/projects"
			>
				Oyun projelerine dön
			</Link>
			<header className="space-y-2">
				<p className="font-mono text-primary text-xs uppercase tracking-[0.16em]">
					Varlık kütüphanesi / {projectName ?? "Oyun projesi"}
				</p>
				<h1 className="font-medium font-serif text-4xl tracking-tight">
					Varlık Kimliği ve Aileler
				</h1>
				<p className="text-muted-foreground">
					{projectName ?? "Oyun projesi"} içindeki temsilleri ortak kimliklere
					bağlayın ve aile sınırlarını koruyun.
				</p>
			</header>
		</div>
	);
}

function QueryState({
	error,
	failureMessage,
	isError,
	isFetching,
	isPending,
	loadingMessage,
	onRetry,
}: {
	error: unknown;
	failureMessage: string;
	isError: boolean;
	isFetching: boolean;
	isPending: boolean;
	loadingMessage: string;
	onRetry: () => void;
}) {
	if (isPending) {
		return (
			<p aria-live="polite" role="status">
				{loadingMessage}
			</p>
		);
	}
	if (!isError) {
		return null;
	}
	return (
		<div className="space-y-2">
			<p role="alert">
				{failureMessage} {getErrorMessage(error, "Yeniden deneyin.", "query")}
			</p>
			<QueryRetryButton disabled={isFetching} onRetry={onRetry} />
		</div>
	);
}

import {
	type AssetRecord,
	type AssetRecordMetadataUpdateInput,
	assetRecordCategoryValues,
} from "@sprite-anvil/api/asset-records";
import { Button } from "@sprite-anvil/ui/components/button";
import { Input } from "@sprite-anvil/ui/components/input";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type SyntheticEvent, useEffect, useState } from "react";
import { QueryRetryButton } from "@/utils/error-notification";
import { getErrorMessage } from "@/utils/get-error-message";
import { client, orpc } from "@/utils/orpc";
import { assetCategoryLabels } from "../category-labels";

export function AssetRecordMetadataForm({
	familyWorldId,
	projectId,
	record,
}: {
	familyWorldId: string | null;
	projectId: string;
	record: AssetRecord;
}) {
	const queryClient = useQueryClient();
	const scopeQuery = useQuery({
		...orpc.contextScopes.list.queryOptions({ input: { projectId } }),
		meta: { errorPresentation: "inline" },
	});
	const [assetCategory, setAssetCategory] = useState(
		record.assetCategory ?? ""
	);
	const [visualWorldId, setVisualWorldId] = useState(
		record.visualWorldId ?? familyWorldId ?? ""
	);
	const [themeId, setThemeId] = useState(record.themeId ?? "");
	const [tags, setTags] = useState((record.tags ?? []).join(", "));
	const [statusMessage, setStatusMessage] = useState<string | null>(null);

	useEffect(() => {
		setAssetCategory(record.assetCategory ?? "");
		setVisualWorldId(record.visualWorldId ?? familyWorldId ?? "");
		setThemeId(record.themeId ?? "");
		setTags((record.tags ?? []).join(", "));
	}, [familyWorldId, record]);

	const updateMetadata = useMutation({
		mutationFn: (input: AssetRecordMetadataUpdateInput) =>
			client.assetRecords.updateMetadata(input),
		onSuccess: async () => {
			setStatusMessage("Varlık kaydı metadata’sı kaydedildi.");
			await Promise.all([
				queryClient.invalidateQueries({
					queryKey: orpc.assetRecords.search.queryKey({
						input: { projectId },
					}),
				}),
				queryClient.invalidateQueries({
					queryKey: orpc.assetRecords.tracking.queryKey({
						input: { assetRecordId: record.id, projectId },
					}),
				}),
			]);
		},
	});

	const scopes = scopeQuery.data ?? { themes: [], visualWorlds: [] };
	const availableThemes = scopes.themes.filter(
		(theme) => theme.visualWorldId === visualWorldId
	);

	function submit(event: SyntheticEvent<HTMLFormElement>) {
		event.preventDefault();
		setStatusMessage(null);
		const normalizedTags = [
			...new Map(
				tags
					.split(",")
					.map((tag) => tag.trim())
					.filter(Boolean)
					.map((tag) => [tag.toLocaleLowerCase("tr-TR"), tag] as const)
			).values(),
		];
		updateMetadata.mutate({
			assetCategory: assetCategory
				? (assetCategory as AssetRecordMetadataUpdateInput["assetCategory"])
				: null,
			assetRecordId: record.id,
			projectId,
			tags: normalizedTags,
			themeId: themeId || null,
			visualWorldId: visualWorldId || null,
		});
	}

	return (
		<section
			aria-labelledby="asset-record-metadata-heading"
			className="space-y-4 rounded-lg border p-5"
		>
			<div>
				<h2
					className="font-semibold text-xl"
					id="asset-record-metadata-heading"
				>
					Varlık kaydı metadata’sı
				</h2>
				<p className="mt-1 text-muted-foreground text-sm">
					Kategori ve etiketler bu kayda aittir. Tema ve Görsel Dünya proje
					kapsam kayıtlarından seçilir.
				</p>
			</div>
			{scopeQuery.isPending ? (
				<p aria-live="polite">Tema ve Görsel Dünya kayıtları yükleniyor…</p>
			) : null}
			{scopeQuery.isError ? (
				<div className="space-y-2">
					<p role="alert">
						{getErrorMessage(
							scopeQuery.error,
							"Tema ve Görsel Dünya kayıtları yüklenemedi.",
							"query"
						)}
					</p>
					<QueryRetryButton
						disabled={scopeQuery.isFetching}
						onRetry={() => void scopeQuery.refetch()}
					/>
				</div>
			) : (
				<form className="space-y-4" onSubmit={submit}>
					<label
						className="block space-y-1 text-sm"
						htmlFor="asset-record-metadata-category"
					>
						<span>Varlık kategorisi</span>
						<select
							className="h-8 w-full rounded-md border bg-background px-2 text-sm"
							id="asset-record-metadata-category"
							onChange={(event) => setAssetCategory(event.target.value)}
							value={assetCategory}
						>
							<option value="">Kategori atanmamış</option>
							{assetRecordCategoryValues.map((category) => (
								<option key={category} value={category}>
									{assetCategoryLabels[category]}
								</option>
							))}
						</select>
					</label>
					<label
						className="block space-y-1 text-sm"
						htmlFor="asset-record-metadata-world"
					>
						<span>Görsel Dünya</span>
						<select
							className="h-8 w-full rounded-md border bg-background px-2 text-sm"
							disabled={Boolean(familyWorldId)}
							id="asset-record-metadata-world"
							onChange={(event) => {
								setVisualWorldId(event.target.value);
								setThemeId("");
							}}
							value={visualWorldId}
						>
							<option value="">Görsel Dünya seçilmedi</option>
							{scopes.visualWorlds.map((world) => (
								<option key={world.id} value={world.id}>
									{world.name}
								</option>
							))}
						</select>
					</label>
					<label
						className="block space-y-1 text-sm"
						htmlFor="asset-record-metadata-theme"
					>
						<span>Tema</span>
						<select
							className="h-8 w-full rounded-md border bg-background px-2 text-sm"
							disabled={!visualWorldId}
							id="asset-record-metadata-theme"
							onChange={(event) => setThemeId(event.target.value)}
							value={themeId}
						>
							<option value="">Tema seçilmedi</option>
							{availableThemes.map((theme) => (
								<option key={theme.id} value={theme.id}>
									{theme.name}
								</option>
							))}
						</select>
					</label>
					<label
						className="block space-y-1 text-sm"
						htmlFor="asset-record-metadata-tags"
					>
						<span>Etiketler</span>
						<Input
							id="asset-record-metadata-tags"
							maxLength={1258}
							onChange={(event) => setTags(event.target.value)}
							placeholder="Örn. envanter, nadir"
							value={tags}
						/>
					</label>
					{familyWorldId ? (
						<p className="text-muted-foreground text-sm">
							Varlık Ailesine bağlı bu kaydın Görsel Dünyası aile kapsamıyla
							sabittir.
						</p>
					) : null}
					{updateMetadata.isError ? (
						<p role="alert">
							{getErrorMessage(
								updateMetadata.error,
								"Varlık kaydı metadata’sı kaydedilemedi."
							)}
						</p>
					) : null}
					{statusMessage ? (
						<p aria-live="polite" role="status">
							{statusMessage}
						</p>
					) : null}
					<Button
						disabled={updateMetadata.isPending || scopeQuery.isPending}
						type="submit"
					>
						{updateMetadata.isPending ? "Kaydediliyor…" : "Metadata’yı kaydet"}
					</Button>
				</form>
			)}
		</section>
	);
}

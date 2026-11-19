import type { AssetRecord } from "@sprite-anvil/api/asset-records";
import { assetRecordCategoryValues } from "@sprite-anvil/api/asset-records";
import { Button } from "@sprite-anvil/ui/components/button";
import { Input } from "@sprite-anvil/ui/components/input";
import { Label } from "@sprite-anvil/ui/components/label";
import {
	NativeSelect,
	NativeSelectOption,
} from "@sprite-anvil/ui/components/native-select";
import { useForm, useStore } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { StatusMessage } from "@/components/status-message";
import { assetCategoryLabels } from "@/utils/category-labels";
import { QueryRetryButton } from "@/utils/error-notification";
import { getErrorMessage } from "@/utils/get-error-message";
import { orpc } from "@/utils/orpc";
import { assetRecordMetadataFormSchema } from "../../schemas";

function metadataDefaults(record: AssetRecord, familyWorldId: string | null) {
	return {
		assetCategory: record.assetCategory ?? "",
		tags: (record.tags ?? []).join(", "),
		themeId: record.themeId ?? "",
		visualWorldId: record.visualWorldId ?? familyWorldId ?? "",
	};
}

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
	const [statusMessage, setStatusMessage] = useState<string | null>(null);
	const updateMetadata = useMutation(
		orpc.assetRecords.updateMetadata.mutationOptions({
			onSuccess: async () => {
				setStatusMessage("Asset Record metadata saved.");
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
		})
	);

	const form = useForm({
		defaultValues: metadataDefaults(record, familyWorldId),
		onSubmit: ({ value }) => {
			setStatusMessage(null);
			const metadata = assetRecordMetadataFormSchema.parse(value);
			updateMetadata.mutate({
				assetCategory: metadata.assetCategory || null,
				assetRecordId: record.id,
				projectId,
				tags: metadata.tags,
				themeId: metadata.themeId || null,
				visualWorldId: metadata.visualWorldId || null,
			});
		},
		validators: { onSubmit: assetRecordMetadataFormSchema },
	});
	const visualWorldId = useStore(
		form.store,
		(state) => state.values.visualWorldId
	);

	useEffect(() => {
		const defaults = metadataDefaults(record, familyWorldId);
		form.setFieldValue("assetCategory", defaults.assetCategory);
		form.setFieldValue("visualWorldId", defaults.visualWorldId);
		form.setFieldValue("themeId", defaults.themeId);
		form.setFieldValue("tags", defaults.tags);
	}, [familyWorldId, form, record]);

	const scopes = scopeQuery.data ?? { themes: [], visualWorlds: [] };
	const availableThemes = scopes.themes.filter(
		(theme) => theme.visualWorldId === visualWorldId
	);

	return (
		<section
			aria-labelledby="asset-record-metadata-heading"
			className="space-y-4 rounded-lg border p-5"
		>
			<div>
				<h2
					className="text-xl font-semibold"
					id="asset-record-metadata-heading"
				>
					Asset Record metadata
				</h2>
				<p className="text-muted-foreground mt-1 text-sm">
					Category and tags belong to this record. Theme and Visual World are
					selected from project scope records.
				</p>
			</div>
			{scopeQuery.isPending ? (
				<p aria-live="polite">Loading Theme and Visual World records…</p>
			) : null}
			{scopeQuery.isError ? (
				<div className="space-y-2">
					<StatusMessage tone="error">
						{getErrorMessage(
							scopeQuery.error,
							"Could not load Theme and Visual World records.",
							"query"
						)}
					</StatusMessage>
					<QueryRetryButton
						disabled={scopeQuery.isFetching}
						onRetry={() => void scopeQuery.refetch()}
					/>
				</div>
			) : (
				<form
					className="space-y-4"
					onSubmit={(event) => {
						event.preventDefault();
						event.stopPropagation();
						form.handleSubmit();
					}}
				>
					<form.Field name="assetCategory">
						{(field) => (
							<Label
								className="block space-y-1 text-sm leading-normal"
								htmlFor="asset-record-metadata-category"
							>
								<span>Asset category</span>
								<NativeSelect
									className="w-full"
									id="asset-record-metadata-category"
									onChange={(event) =>
										field.handleChange(
											event.target.value as typeof field.state.value
										)
									}
									value={field.state.value}
								>
									<NativeSelectOption value="">
										No category assigned
									</NativeSelectOption>
									{assetRecordCategoryValues.map((category) => (
										<NativeSelectOption key={category} value={category}>
											{assetCategoryLabels[category]}
										</NativeSelectOption>
									))}
								</NativeSelect>
							</Label>
						)}
					</form.Field>
					<form.Field name="visualWorldId">
						{(field) => (
							<Label
								className="block space-y-1 text-sm leading-normal"
								htmlFor="asset-record-metadata-world"
							>
								<span>Visual World</span>
								<NativeSelect
									className="w-full"
									disabled={Boolean(familyWorldId)}
									id="asset-record-metadata-world"
									onChange={(event) => {
										field.handleChange(event.target.value);
										form.setFieldValue("themeId", "");
									}}
									value={field.state.value}
								>
									<NativeSelectOption value="">
										No Visual World selected
									</NativeSelectOption>
									{scopes.visualWorlds.map((world) => (
										<NativeSelectOption key={world.id} value={world.id}>
											{world.name}
										</NativeSelectOption>
									))}
								</NativeSelect>
							</Label>
						)}
					</form.Field>
					<form.Field name="themeId">
						{(field) => (
							<Label
								className="block space-y-1 text-sm leading-normal"
								htmlFor="asset-record-metadata-theme"
							>
								<span>Theme</span>
								<NativeSelect
									className="w-full"
									disabled={!visualWorldId}
									id="asset-record-metadata-theme"
									onChange={(event) => field.handleChange(event.target.value)}
									value={field.state.value}
								>
									<NativeSelectOption value="">
										No Theme selected
									</NativeSelectOption>
									{availableThemes.map((theme) => (
										<NativeSelectOption key={theme.id} value={theme.id}>
											{theme.name}
										</NativeSelectOption>
									))}
								</NativeSelect>
							</Label>
						)}
					</form.Field>
					<form.Field name="tags">
						{(field) => (
							<Label
								className="block space-y-1 text-sm leading-normal"
								htmlFor="asset-record-metadata-tags"
							>
								<span>Tags</span>
								<Input
									id="asset-record-metadata-tags"
									maxLength={1258}
									onChange={(event) => field.handleChange(event.target.value)}
									placeholder="e.g. inventory, rare"
									value={field.state.value}
								/>
							</Label>
						)}
					</form.Field>
					{familyWorldId ? (
						<p className="text-muted-foreground text-sm">
							This Asset Record's Visual World is fixed by its Asset Family
							scope.
						</p>
					) : null}
					{updateMetadata.isError ? (
						<StatusMessage tone="error">
							{getErrorMessage(
								updateMetadata.error,
								"Could not save Asset Record metadata."
							)}
						</StatusMessage>
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
						{updateMetadata.isPending ? "Saving…" : "Save metadata"}
					</Button>
				</form>
			)}
		</section>
	);
}

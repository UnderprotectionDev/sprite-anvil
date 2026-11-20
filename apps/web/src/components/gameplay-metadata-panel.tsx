import type {
	GameplayMetadataRecord,
	GameplayMetadataWriteInput,
} from "@sprite-anvil/api/gameplay-metadata";
import { getGameplayMetadataFields } from "@sprite-anvil/api/gameplay-metadata";
import { Button } from "@sprite-anvil/ui/components/button";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
	StatusMessage,
	WriteOutcomeMessage,
} from "@/components/status-message";
import { GameplayMetadataForm } from "@/features/gameplay-metadata/ui/forms/gameplay-metadata-form";
import { GameplayMetadataReview } from "@/features/gameplay-metadata/ui/views/gameplay-metadata-review";
import { isWriteOutcomeUncertain } from "@/utils/error-notification";
import { getErrorMessage } from "@/utils/get-error-message";
import { mutationMeta } from "@/utils/mutation-meta";
import { orpc } from "@/utils/orpc";

const sourceLabels = {
	finalized_source: "Confirmed source",
	authored: "User input",
	unknown: "Unknown",
};

export function GameplayMetadataPanel({
	projectId,
	assetRecordId,
}: {
	projectId: string;
	assetRecordId: string;
}) {
	const catalogQuery = useQuery(
		orpc.gameplayMetadata.list.queryOptions({
			input: { projectId, assetRecordId },
		})
	);
	const contractsQuery = useQuery(
		orpc.specializedProfileContracts.list.queryOptions({ input: { projectId } })
	);
	const versionsQuery = useQuery(
		orpc.assetVersions.list.queryOptions({ input: { projectId } })
	);
	const [editing, setEditing] = useState<GameplayMetadataRecord | undefined>();
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const selected = catalogQuery.data?.records.find(
		(record) => record.id === selectedId
	);
	const selectedVersion = versionsQuery.data?.assetVersions.find(
		(version) =>
			version.id === selected?.assetVersionId &&
			version.assetRecordId === assetRecordId &&
			version.integrityVerified
	);
	const [uncertain, setUncertain] = useState<GameplayMetadataWriteInput | null>(
		null
	);
	const [message, setMessage] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const writeMutation = useMutation(
		orpc.gameplayMetadata.write.mutationOptions({
			...mutationMeta,
			onSuccess: async () => {
				setUncertain(null);
				const result = await catalogQuery.refetch();
				setMessage(
					result.isError
						? "Record saved; the list could not be reread. Reload records."
						: "Gameplay Metadata saved and reread."
				);
			},
		})
	);
	const pending = writeMutation.isPending;
	const contracts =
		contractsQuery.data?.profiles.flatMap((profile) =>
			profile.activeContract &&
			getGameplayMetadataFields(profile.activeContract.contract).length
				? [
						{
							...profile.activeContract.contract,
							contractRevisionId: profile.activeContract.contractRevisionId,
						},
					]
				: []
		) ?? [];

	async function save(input: GameplayMetadataWriteInput) {
		setMessage(null);
		setError(null);
		try {
			await writeMutation.mutateAsync(input);
			return true;
		} catch (failure) {
			setError(getErrorMessage(failure, "Could not save Gameplay Metadata."));
			if (isWriteOutcomeUncertain(failure)) {
				setUncertain(input);
			} else {
				// A definitive failure can never commit; release the lock so the
				// user can correct the draft instead of staying stuck behind retry.
				setUncertain(null);
			}
			return false;
		}
	}

	async function checkOutcome() {
		const result = await catalogQuery.refetch();
		if (result.isError) {
			return;
		}
		if (result.data?.records.some((record) => record.id === uncertain?.id)) {
			setUncertain(null);
			setError(null);
			setMessage("Gameplay Metadata reread from the saved record.");
		} else {
			setError(
				"The record is not visible yet. Retry the same operation; no new record will be created."
			);
		}
	}

	return (
		<section aria-label="Gameplay Metadata" className="space-y-4">
			<h2 className="text-xl font-medium">Write and Map Gameplay Metadata</h2>
			{catalogQuery.isPending || contractsQuery.isPending ? (
				<p>Loading Gameplay Metadata…</p>
			) : null}
			{catalogQuery.isError || contractsQuery.isError ? (
				<StatusMessage tone="error">
					Could not open Gameplay Metadata.{" "}
					<Button
						onClick={() => {
							catalogQuery.refetch();
							contractsQuery.refetch();
						}}
						type="button"
					>
						Reload
					</Button>
				</StatusMessage>
			) : null}
			{Boolean(catalogQuery.data && contractsQuery.data) &&
				catalogQuery.data && (
					<>
						{!catalogQuery.data.frames.length && (
							<p>
								Finalize the import mapping or create a Frame Unit Version
								first.
							</p>
						)}
						{!contracts.length && (
							<p>
								Activate a profile with Gameplay Metadata fields on the
								project's Specialized Profile Contracts page first.
							</p>
						)}
						<GameplayMetadataForm
							contracts={
								editing?.contractSnapshot
									? [
											{
												...editing.contractSnapshot,
												contractRevisionId: editing.contractRevisionId,
											},
										]
									: contracts
							}
							disabled={pending || Boolean(uncertain)}
							frames={catalogQuery.data.frames}
							initialRecord={editing}
							key={`form-${editing?.id ?? "new"}`}
							onSave={async (draft) => {
								const saved = await save({
									...draft,
									projectId,
									assetRecordId,
									id: crypto.randomUUID(),
								});
								if (saved) {
									setEditing(undefined);
								}
								return saved;
							}}
						/>
						{Boolean(editing) && (
							<p className="space-x-2">
								<span>
									Editing creates a new unreviewed record; the previous review
									remains unchanged.
								</span>
								<Button
									disabled={pending || Boolean(uncertain)}
									onClick={() => setEditing(undefined)}
									type="button"
								>
									Cancel edit
								</Button>
							</p>
						)}
						{selected && (
							<GameplayMetadataReview
								contract={
									selected.contractSnapshot ??
									contracts.find(
										(contract) =>
											contract.contractRevisionId ===
											selected.contractRevisionId
									)
								}
								frames={catalogQuery.data.frames}
								key={`review-${selected.id}`}
								onReviewed={async (reviewed) => {
									const result = await catalogQuery.refetch();
									if (result.isError) {
										throw new Error(
											"Review saved; the list could not be reread. Retry the same review."
										);
									}
									setSelectedId(reviewed.id);
								}}
								previewUrl={selectedVersion?.previewUrl}
								record={selected}
								records={catalogQuery.data.records}
							/>
						)}
						<h3 className="font-medium">Saved Gameplay Metadata</h3>
						{!catalogQuery.data.records.length && (
							<p>No Gameplay Metadata records yet.</p>
						)}
						{catalogQuery.data.records.map((record) => (
							<article className="space-y-2 rounded border p-3" key={record.id}>
								<p>{record.review ? "Reviewed" : "Not reviewed yet"}</p>
								<p>
									{record.frameKey} — {record.useContext}
								</p>
								<p className="text-muted-foreground text-sm break-all">
									Exact version: {record.assetVersionId} · Contract:{" "}
									{record.contractRevisionId}
								</p>
								<dl>
									{record.fields.map((field) => (
										<div className="space-y-1" key={field.fieldId}>
											<dt>{field.fieldId}</dt>
											<dd className="font-mono text-sm break-all">
												{field.value === null
													? "Unknown"
													: JSON.stringify(field.value)}{" "}
												· {sourceLabels[field.source.kind]}
											</dd>
										</div>
									))}
								</dl>
								<div className="flex gap-2">
									<Button
										disabled={pending || Boolean(uncertain)}
										onClick={() => setSelectedId(record.id)}
										type="button"
									>
										Review metadata
									</Button>
									<Button
										disabled={pending || Boolean(uncertain)}
										onClick={() => setEditing(record)}
										type="button"
									>
										Edit metadata
									</Button>
								</div>
							</article>
						))}
					</>
				)}
			<WriteOutcomeMessage
				message={message ?? ""}
				uncertain={Boolean(uncertain)}
			/>
			{Boolean(error) && <StatusMessage tone="error">{error}</StatusMessage>}
			{uncertain !== null && (
				<div className="flex gap-2">
					<Button disabled={pending} onClick={checkOutcome} type="button">
						Check record
					</Button>
					<Button
						disabled={pending}
						onClick={() => save(uncertain)}
						type="button"
					>
						Retry the same operation
					</Button>
				</div>
			)}
		</section>
	);
}

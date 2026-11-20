import type {
	GameplayMetadataFrame,
	GameplayMetadataRecord,
} from "@sprite-anvil/api/gameplay-metadata";
import {
	getGameplayMetadataIntegrityErrors,
	getGameplayMetadataReviewSourceErrors,
} from "@sprite-anvil/api/gameplay-metadata-integrity";
import { gameplayMetadataPackageReadInputSchema } from "@sprite-anvil/api/gameplay-metadata-package";
import type { SpecializedProfileContract } from "@sprite-anvil/api/specialized-profile-contracts";
import { Button } from "@sprite-anvil/ui/components/button";
import { Input } from "@sprite-anvil/ui/components/input";
import { Label } from "@sprite-anvil/ui/components/label";
import { useMutation } from "@tanstack/react-query";
import { useId, useState } from "react";
import { StatusMessage } from "@/components/status-message";
import { builtinProfilePresentation } from "@/utils/builtin-profile-labels";
import { getErrorMessage } from "@/utils/get-error-message";
import { mutationMeta } from "@/utils/mutation-meta";
import { orpc } from "@/utils/orpc";
import { usePendingIdempotencyKey } from "@/utils/pending-idempotency-key";
import { GameplayMetadataOverlay } from "../components/gameplay-metadata-overlay";

export function GameplayMetadataReview({
	record,
	records,
	frames,
	previewUrl,
	onReviewed,
	contract = record.contractSnapshot,
}: {
	record: GameplayMetadataRecord;
	records: GameplayMetadataRecord[];
	frames: GameplayMetadataFrame[];
	previewUrl: string | undefined;
	onReviewed: (record: GameplayMetadataRecord) => Promise<void>;
	contract?: SpecializedProfileContract;
}) {
	const fileInputId = useId();
	const [ready, setReady] = useState(false);
	const decisionKey = usePendingIdempotencyKey();
	const [error, setError] = useState<string | null>(null);
	const [message, setMessage] = useState<string | null>(null);
	const reviewMutation = useMutation(
		orpc.gameplayMetadata.review.mutationOptions(mutationMeta)
	);
	const createPackageMutation = useMutation(
		orpc.gameplayMetadata.createPackage.mutationOptions(mutationMeta)
	);
	const readPackageMutation = useMutation(
		orpc.gameplayMetadata.readPackage.mutationOptions(mutationMeta)
	);
	const errors = [
		...getGameplayMetadataIntegrityErrors(record, frames, contract),
		...getGameplayMetadataReviewSourceErrors(record, records),
	];
	const target = {
		projectId: record.projectId,
		assetRecordId: record.assetRecordId,
		recordId: record.id,
	};

	const actionMutation = useMutation({
		...mutationMeta,
		networkMode: "always",
		mutationFn: (action: () => Promise<void>) => action(),
	});
	const pending = actionMutation.isPending;

	async function act(action: () => Promise<void>) {
		setError(null);
		setMessage(null);
		try {
			await actionMutation.mutateAsync(action);
		} catch (failure) {
			setError(getErrorMessage(failure, "Could not verify Gameplay Metadata."));
		}
	}

	async function review() {
		await act(async () => {
			const reviewed = await reviewMutation.mutateAsync({
				...target,
				id: decisionKey.keyFor(JSON.stringify(target)),
			});
			await onReviewed(reviewed);
		});
	}

	async function download() {
		await act(async () => {
			const result = await createPackageMutation.mutateAsync(target);
			const blob = new Blob([JSON.stringify(result)], {
				type: "application/json",
			});
			const url = URL.createObjectURL(blob);
			const anchor = document.createElement("a");
			anchor.href = url;
			anchor.download = `gameplay-metadata-${record.id}.json`;
			anchor.click();
			setTimeout(() => URL.revokeObjectURL(url), 1000);
			setMessage("Reviewed Gameplay Metadata package downloaded.");
		});
	}

	async function reread(file: File) {
		await act(async () => {
			if (file.size > 524_288) {
				throw new Error("The package exceeds the 512 KiB limit.");
			}
			const input = gameplayMetadataPackageReadInputSchema.parse({
				...target,
				package: JSON.parse(await file.text()),
			});
			await readPackageMutation.mutateAsync(input);
			setMessage(
				"Package reread; reviewed fields, frame, and exact version are preserved."
			);
		});
	}

	return (
		<section
			aria-label="Review and Preserve Metadata"
			className="space-y-3 rounded border p-4"
		>
			<h3 className="text-lg font-medium">Review and Preserve Metadata</h3>
			<p>
				{record.frameKey} · {record.assetVersionId} · {record.useContext}
			</p>
			<p>{record.review ? "Reviewed" : "Not reviewed yet"}</p>
			{errors.map((failure) => (
				<StatusMessage key={failure} tone="error">
					Integrity error: {failure}
				</StatusMessage>
			))}
			{!previewUrl && (
				<StatusMessage tone="error">
					No verified image was found for the exact version.
				</StatusMessage>
			)}
			{previewUrl && !errors.length && (
				<GameplayMetadataOverlay
					onReady={setReady}
					previewUrl={previewUrl}
					record={record}
				/>
			)}
			<dl>
				{record.fields.map((field) => (
					<div key={field.fieldId}>
						<dt>
							{(contract
								? builtinProfilePresentation(contract)
								: undefined
							)?.metadataFields.find(
								(definition) => definition.id === field.fieldId
							)?.label ?? field.fieldId}
						</dt>
						<dd className="font-mono text-sm break-all">
							{field.value === null ? "Unknown" : JSON.stringify(field.value)}
						</dd>
					</div>
				))}
			</dl>
			{!record.review && (
				<Button
					disabled={pending || !ready || !previewUrl || Boolean(errors.length)}
					onClick={review}
					type="button"
				>
					Save review
				</Button>
			)}
			{Boolean(record.review) && (
				<div className="space-y-2">
					<Button
						disabled={pending || Boolean(errors.length)}
						onClick={download}
						type="button"
					>
						Download Gameplay Metadata package
					</Button>
					<Label className="block" htmlFor={fileInputId}>
						Reread package
					</Label>
					<Input
						accept=".json,application/json"
						disabled={pending || Boolean(errors.length)}
						id={fileInputId}
						onChange={(event) => {
							const file = event.target.files?.[0];
							event.target.value = "";
							if (file) {
								reread(file);
							}
						}}
						type="file"
					/>
					<p className="text-muted-foreground text-sm">
						This package contains only Gameplay Metadata; it is not image files
						or a full Export Bundle. Rereading compares it with the saved review
						record and does not change data.
					</p>
				</div>
			)}
			{error ? <StatusMessage tone="error">{error}</StatusMessage> : null}
			{message ? <p role="status">{message}</p> : null}
		</section>
	);
}

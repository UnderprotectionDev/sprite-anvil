import { ORPCError } from "@orpc/client";
import type { ImportInboxEntry } from "@sprite-anvil/api/import-inbox";
import type { SourceMetadataMappingProposal } from "@sprite-anvil/api/source-metadata-mapping";
import {
	sourceMetadataMappingContractVersion,
	sourceMetadataMappingSidecarLimits,
} from "@sprite-anvil/api/source-metadata-mapping";
import { Button } from "@sprite-anvil/ui/components/button";
import { Checkbox } from "@sprite-anvil/ui/components/checkbox";
import { FieldLegend, FieldSet } from "@sprite-anvil/ui/components/field";
import { Label } from "@sprite-anvil/ui/components/label";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { StatusMessage } from "@/components/status-message";
import { buildErrorNotification } from "@/utils/error-notification";
import { mutationMeta } from "@/utils/mutation-meta";
import { orpc } from "@/utils/orpc";
import {
	fieldLabel,
	formatFieldValue,
	proposalFieldChanges,
	stableValue,
} from "../../lib/source-metadata-mapping-fields";
import { ProposalFinalizationForm } from "./source-metadata-mapping-finalization-form";

function supportReferenceOf(error: unknown) {
	return buildErrorNotification(error, "query").supportReference;
}

function errorStatus(error: unknown) {
	if (typeof error !== "object" || error === null) {
		return;
	}
	const { status } = error as { status?: unknown };
	return typeof status === "number" ? status : undefined;
}

function createErrorMessage(error: unknown) {
	const status = errorStatus(error);
	const message = error instanceof Error ? error.message : undefined;
	if (status === 401) {
		return "Your session has expired. Sign in again.";
	}
	if (status === 404) {
		return "The source or sidecar entry was not found in the Import Inbox.";
	}
	if (status === 422) {
		return message === "Unsupported source metadata format"
			? "No supported Aseprite or TexturePacker JSON was found in the selected files."
			: "The selected JSON sidecar does not contain a valid mapping proposal.";
	}
	if (status === 400) {
		return "Check the sidecar selection and try again.";
	}
	if (status === 413) {
		return message === "Source metadata sidecars exceed the maximum size"
			? "Sidecar files exceed the 5 MiB per-file or 8 MiB total limit."
			: "The proposal request exceeds the 8 KiB limit.";
	}
	return "Could not verify proposal creation. Check saved proposals.";
}

function proposalConflictKeys(proposal: SourceMetadataMappingProposal) {
	return new Set(
		proposal.conflicts.map(
			(conflict) => `${conflict.field}\u0000${conflict.key}`
		)
	);
}

function ProposalDetails({
	proposal,
	projectId,
	entryId,
	previousProposal,
	onRecreate,
	isCreating,
}: {
	proposal: SourceMetadataMappingProposal;
	projectId: string;
	entryId: string;
	previousProposal?: SourceMetadataMappingProposal;
	onRecreate: () => void;
	isCreating: boolean;
}) {
	const conflictKeys = proposalConflictKeys(proposal);
	const [isOpen, setIsOpen] = useState(false);
	const recordsQuery = useQuery({
		...orpc.assetFamilies.list.queryOptions({ input: { projectId } }),
		enabled: isOpen,
	});
	const finalizationQuery = useQuery({
		...orpc.imports.getSourceMetadataMappingFinalization.queryOptions({
			input: { entryId, projectId, proposalId: proposal.id },
		}),
		enabled: isOpen,
	});
	const finalization = finalizationQuery.data;
	const fieldChanges = previousProposal
		? proposalFieldChanges(proposal, previousProposal)
		: [];
	const sidecarsChanged = previousProposal
		? stableValue(
				proposal.sidecars
					.map(({ fileName, sha256 }) => ({ fileName, sha256 }))
					.sort((a, b) => a.fileName.localeCompare(b.fileName))
			) !==
			stableValue(
				previousProposal.sidecars
					.map(({ fileName, sha256 }) => ({ fileName, sha256 }))
					.sort((a, b) => a.fileName.localeCompare(b.fileName))
			)
		: false;
	return (
		<details
			className="rounded-md border p-3 text-sm"
			onToggle={(event) => setIsOpen(event.currentTarget.open)}
		>
			<summary className="min-h-11 cursor-pointer py-2 font-medium">
				Source Metadata Mapping Proposal ·{" "}
				{new Date(proposal.createdAt).toLocaleString("tr-TR")}
			</summary>
			<div className="space-y-4 pt-2">
				{previousProposal ? (
					<section
						aria-label="Changes since previous proposal"
						className="rounded-md border p-3"
					>
						<h3 className="font-medium">Changes since previous proposal</h3>
						{sidecarsChanged ? <p>JSON sidecar sources changed.</p> : null}
						{fieldChanges.length > 0 ? (
							<ul>
								{fieldChanges.map((change) => (
									<li key={change}>{change}</li>
								))}
							</ul>
						) : (
							<p>No changes in recognized fields.</p>
						)}
					</section>
				) : null}
				<dl className="grid gap-x-3 gap-y-2 sm:grid-cols-[auto_1fr]">
					<dt className="text-muted-foreground">
						Source Metadata Mapping contract
					</dt>
					<dd className="font-mono text-xs">{proposal.contractVersion}</dd>
					<dt className="text-muted-foreground">Source SHA-256</dt>
					<dd className="font-mono text-xs break-all">
						{proposal.source.sha256}
					</dd>
					<dt className="text-muted-foreground">JSON sidecar sources</dt>
					<dd>
						<ul className="space-y-2">
							{proposal.sidecars.map((sidecar) => (
								<li key={sidecar.entryId}>
									<p>
										{sidecar.fileName} · {sidecar.format} {sidecar.version} ·{" "}
										{sidecar.jsonLayout}
									</p>
									<p className="font-mono text-xs break-all">
										SHA-256: {sidecar.sha256}
									</p>
								</li>
							))}
						</ul>
					</dd>
				</dl>
				<section aria-label="Proposed relationships and Gameplay Metadata">
					<h3 className="font-medium">
						Proposed relationships and Gameplay Metadata
					</h3>
					<ul className="mt-2 space-y-2">
						<li>Asset Family link: Unknown · no source evidence.</li>
						<li>Required Set link: Unknown · no source evidence.</li>
					</ul>
					<p className="text-muted-foreground mt-2">
						Gameplay Metadata: Unknown · project context required.
					</p>
				</section>
				{proposal.conflicts.length > 0 && !finalization ? (
					<p className="font-medium" role="status">
						Field conflicts: {proposal.conflicts.length}. The proposal is not
						finalized.
					</p>
				) : null}
				{proposal.contractVersion ===
				sourceMetadataMappingContractVersion ? null : (
					<section className="space-y-2 rounded-md border p-3">
						<p>
							This proposal uses an older Source Metadata Mapping contract.
							Create a new proposal with the current contract while preserving
							source files.
						</p>
						<Button disabled={isCreating} onClick={onRecreate} type="button">
							Create proposal with current contract
						</Button>
					</section>
				)}
				{isOpen && finalizationQuery.isPending ? (
					<p role="status">Loading confirmed link…</p>
				) : null}
				{finalizationQuery.isError ? (
					<div className="space-y-2">
						<StatusMessage tone="error">
							Could not load confirmed link.
						</StatusMessage>
						<Button
							onClick={() => void finalizationQuery.refetch()}
							type="button"
							variant="outline"
						>
							Try again
						</Button>
					</div>
				) : null}
				{finalization ? (
					<section
						aria-label="Confirmed link"
						className="space-y-2 rounded-md border p-3"
					>
						<p className="font-medium">
							Confirmed link · Candidate Version created
						</p>
						<p>
							Target record:{" "}
							{recordsQuery.data?.assetRecords.find(
								(record) => record.id === finalization.assetRecordId
							)?.name ?? finalization.assetRecordId}
						</p>
						<ul>
							{finalization.decisions.map((decision) => (
								<li key={`${decision.field}-${decision.key}`}>
									{fieldLabel(decision.field)} · {decision.key}:{" "}
									{decision.sourceEntryId
										? (proposal.fields.find(
												(field) =>
													field.field === decision.field &&
													field.key === decision.key &&
													field.sourceEntryId === decision.sourceEntryId &&
													field.sourcePath === decision.sourcePath
											)?.sourceFileName ?? decision.sourceEntryId)
										: "Unknown"}
								</li>
							))}
						</ul>
						<Link
							params={{ projectId, assetRecordId: finalization.assetRecordId }}
							to="/projects/$projectId/assets/$assetRecordId"
						>
							Open Candidate Version
						</Link>
					</section>
				) : null}
				{proposal.contractVersion !== sourceMetadataMappingContractVersion ||
				finalization ||
				finalizationQuery.isError ||
				(isOpen && finalizationQuery.isPending) ? null : (
					<ProposalFinalizationForm
						entryId={entryId}
						projectId={projectId}
						proposal={proposal}
						records={recordsQuery.data?.assetRecords}
						recordsError={recordsQuery.isError}
					/>
				)}
				<ul aria-label="Proposed source fields" className="space-y-3">
					{proposal.fields.map((field) => {
						const conflict = conflictKeys.has(
							`${field.field}\u0000${field.key}`
						);
						return (
							<li
								className="bg-muted/40 space-y-1 rounded-md p-3"
								key={`${field.sourceEntryId}-${field.sourcePath}-${field.field}`}
							>
								<p className="font-medium">
									{fieldLabel(field.field)} · {field.key}
									{conflict ? (
										<span className="text-destructive ml-2">Conflict</span>
									) : null}
								</p>
								<p className="text-muted-foreground text-xs">
									{field.sourceFileName} · {field.sourcePath}
								</p>
								<pre className="overflow-x-auto font-mono text-xs break-all whitespace-pre-wrap">
									{formatFieldValue(field.value)}
								</pre>
							</li>
						);
					})}
				</ul>
				{proposal.diagnostics.length > 0 ? (
					<ul
						aria-label="Metadata diagnostics"
						className="list-disc space-y-1 pl-5"
					>
						{proposal.diagnostics.map((diagnostic) => (
							<li key={`${diagnostic.sourceEntryId}-${diagnostic.sourcePath}`}>
								{diagnostic.sourcePath}: {diagnostic.message}
							</li>
						))}
					</ul>
				) : null}
			</div>
		</details>
	);
}

export function SourceMetadataMappingPanel({
	entries,
	entry,
	projectId,
}: {
	entries: ImportInboxEntry[];
	entry: ImportInboxEntry;
	projectId: string;
}) {
	const queryClient = useQueryClient();
	const [selectedSidecarEntryIds, setSelectedSidecarEntryIds] = useState<
		string[]
	>([]);
	const [createError, setCreateError] = useState<{
		message: string;
		supportReference?: string;
	} | null>(null);
	const proposalsInput = { entryId: entry.id, projectId };
	const proposalsQuery = useQuery(
		orpc.imports.listSourceMetadataMappingProposals.queryOptions({
			input: proposalsInput,
		})
	);
	const createMutation = useMutation({
		...orpc.imports.createSourceMetadataMappingProposal.mutationOptions(),
		...mutationMeta,
	});
	const isCreating = createMutation.isPending;
	const sidecarEntries = entries.filter(
		(candidate) => candidate.id !== entry.id
	);

	function toggleSidecar(entryId: string) {
		setSelectedSidecarEntryIds((selected) => {
			if (selected.includes(entryId)) {
				return selected.filter((selectedId) => selectedId !== entryId);
			}
			if (selected.length >= sourceMetadataMappingSidecarLimits.count) {
				return selected;
			}
			return [...selected, entryId];
		});
		setCreateError(null);
	}

	async function createProposal(sidecarEntryIds = selectedSidecarEntryIds) {
		if (isCreating || sidecarEntryIds.length === 0) {
			return;
		}
		setCreateError(null);
		const invalidateProposals = () =>
			queryClient.invalidateQueries({
				queryKey: orpc.imports.listSourceMetadataMappingProposals.queryKey({
					input: proposalsInput,
				}),
			});
		try {
			await createMutation.mutateAsync({
				...proposalsInput,
				input: { sidecarEntryIds },
			});
			await invalidateProposals();
		} catch (error) {
			if (error instanceof ORPCError) {
				const { supportReference } = buildErrorNotification(error, "mutation");
				setCreateError({
					message: createErrorMessage(error),
					...(supportReference ? { supportReference } : {}),
				});
				return;
			}
			setCreateError({
				message: "Could not verify proposal creation. Check saved proposals.",
			});
			await invalidateProposals();
		}
	}

	return (
		<section
			aria-label={`Source Metadata Mapping Proposal for ${entry.fileName}`}
			className="space-y-3 border-t pt-3"
		>
			<div>
				<h4 className="text-sm font-medium">
					Source Metadata Mapping Proposal
				</h4>
				<p className="text-muted-foreground mt-1 text-sm">
					Select one or more sidecars for {entry.fileName}. The proposal shows
					source values; it does not finalize the link.
				</p>
			</div>
			<FieldSet className="space-y-2" disabled={isCreating}>
				<FieldLegend className="text-sm font-medium" variant="label">
					JSON sidecar entries
				</FieldLegend>
				<p className="text-muted-foreground text-sm">
					Select up to {sourceMetadataMappingSidecarLimits.count} sidecars. Each
					file is limited to 5 MiB and the total to 8 MiB.
				</p>
				{sidecarEntries.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						Add the JSON sidecar to the Import Inbox first.
					</p>
				) : (
					<ul className="space-y-2">
						{sidecarEntries.map((sidecar) => (
							<li key={sidecar.id}>
								<Label className="min-h-11 text-sm">
									<Checkbox
										checked={selectedSidecarEntryIds.includes(sidecar.id)}
										disabled={
											!selectedSidecarEntryIds.includes(sidecar.id) &&
											selectedSidecarEntryIds.length >=
												sourceMetadataMappingSidecarLimits.count
										}
										onCheckedChange={() => toggleSidecar(sidecar.id)}
									/>
									<span className="break-all">
										{sidecar.fileName} · {sidecar.sourceContentType}
									</span>
								</Label>
							</li>
						))}
					</ul>
				)}
			</FieldSet>
			<Button
				aria-label={`Create Source Metadata Mapping Proposal: ${entry.fileName}`}
				className="min-h-11"
				disabled={isCreating || selectedSidecarEntryIds.length === 0}
				onClick={() => void createProposal()}
				type="button"
			>
				{isCreating
					? "Creating proposal…"
					: "Create Source Metadata Mapping Proposal"}
			</Button>
			{createError ? (
				<div>
					<StatusMessage tone="error">{createError.message}</StatusMessage>
					{createError.supportReference ? (
						<p>Support reference: {createError.supportReference}</p>
					) : null}
				</div>
			) : null}
			{proposalsQuery.isPending ? (
				<p aria-live="polite" role="status">
					Loading proposals…
				</p>
			) : null}
			{proposalsQuery.isError ? (
				<div className="space-y-2">
					<StatusMessage tone="error">
						Could not load Source Metadata Mapping Proposals.
					</StatusMessage>
					{supportReferenceOf(proposalsQuery.error) ? (
						<p>Support reference: {supportReferenceOf(proposalsQuery.error)}</p>
					) : null}
					<Button
						className="min-h-11"
						onClick={() => void proposalsQuery.refetch()}
						type="button"
						variant="outline"
					>
						Try again
					</Button>
				</div>
			) : null}
			{proposalsQuery.data?.map((proposal, index) => (
				<ProposalDetails
					entryId={entry.id}
					isCreating={isCreating}
					key={proposal.id}
					onRecreate={() =>
						void createProposal(
							proposal.sidecars.map((sidecar) => sidecar.entryId)
						)
					}
					previousProposal={proposalsQuery.data[index + 1]}
					projectId={projectId}
					proposal={proposal}
				/>
			))}
		</section>
	);
}

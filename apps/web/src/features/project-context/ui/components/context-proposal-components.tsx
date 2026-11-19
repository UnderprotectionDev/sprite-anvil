import type { ProjectContextScopeCatalog } from "@sprite-anvil/api/context-scopes";
import type {
	ContextProposal,
	ContextProposalReview,
	ContextRule,
	ContextRuleChange,
	ContextRuleValue,
	ContextScope,
	ProjectContext,
} from "@sprite-anvil/api/project-context";
import { Button } from "@sprite-anvil/ui/components/button";
import { Label } from "@sprite-anvil/ui/components/label";
import {
	NativeSelect,
	NativeSelectOption,
} from "@sprite-anvil/ui/components/native-select";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { toast } from "sonner";
import { ScopeRegistryPanel } from "@/components/context-scope-registry";
import { StatusMessage } from "@/components/status-message";
import { TaskWorkspace } from "@/components/task-workspace";
import { orpc } from "@/utils/orpc";
import type { EvidenceKind } from "../forms/proposal-form";
import { operationLabel, ProposalForm } from "../forms/proposal-form";

interface ContextWorkspaceProps {
	isProposalsError: boolean;
	isProposalsPending: boolean;
	isScopeError: boolean;
	isScopePending: boolean;
	onCheckProposalState: () => Promise<boolean>;
	onNewProject: () => void;
	onRefreshProposals: () => Promise<unknown>;
	onRetryProposals: () => void;
	onSelectProject: (project: ProjectContext) => void;
	project: ProjectContext;
	projects: ProjectContext[];
	proposals: ContextProposal[];
	scopeCatalog: ProjectContextScopeCatalog;
}

export function ContextWorkspace({
	isProposalsError,
	isProposalsPending,
	isScopeError,
	isScopePending,
	onCheckProposalState,
	onNewProject,
	onRetryProposals,
	onRefreshProposals,
	onSelectProject,
	project,
	projects,
	scopeCatalog,
	proposals,
}: ContextWorkspaceProps) {
	return (
		<>
			<div className="context-toolbar">
				<Label className="project-select leading-[inherit]">
					<span>Project</span>
					<NativeSelect
						aria-label="Project"
						className="w-full"
						onChange={(event) => {
							const selected = projects.find(
								(candidate) => candidate.id === event.target.value
							);
							if (selected) {
								onSelectProject(selected);
							}
						}}
						value={project.id}
					>
						{projects.map((item) => (
							<NativeSelectOption key={item.id} value={item.id}>
								{item.name}
							</NativeSelectOption>
						))}
					</NativeSelect>
				</Label>
				<Button className="quiet-button" onClick={onNewProject} type="button">
					<Plus aria-hidden="true" size={16} />
					New project
				</Button>
			</div>
			<TaskWorkspace
				key={project.id}
				label="Project Context workspaces"
				sections={[
					{
						id: "proposals",
						label: "Review proposals",
						description:
							"Review saved proposals, their evidence, and activation status.",
						content: (
							<>
								<ProposalLedger
									isError={isProposalsError}
									isPending={isProposalsPending}
									onRetry={onRetryProposals}
									project={project}
									proposals={proposals}
									scopeCatalog={scopeCatalog}
								/>
							</>
						),
					},
					{
						id: "create",
						label: "Propose a rule change",
						description:
							"New rules are saved as proposals and activated by you before use in production.",
						content: (
							<>
								<ProposalForm
									key={`${project.id}:${project.currentContextRevision.id}`}
									onCheckCurrentState={onCheckProposalState}
									onRefresh={onRefreshProposals}
									project={project}
									scopeCatalog={scopeCatalog}
								/>
							</>
						),
					},
					{
						id: "scopes",
						label: "Visual Worlds and Themes",
						description:
							"Define rule scopes and Visual Worlds for use in families.",
						content: (
							<>
								<ScopeRegistryPanel
									isError={isScopeError}
									isPending={isScopePending}
									project={project}
									scopeCatalog={scopeCatalog}
								/>
							</>
						),
					},
				]}
			/>
		</>
	);
}

interface ProposalLedgerProps {
	isError: boolean;
	isPending: boolean;
	onRetry: () => void;
	project: ProjectContext;
	proposals: ContextProposal[];
	scopeCatalog: ProjectContextScopeCatalog;
}

function ProposalLedger({
	isError,
	isPending,
	onRetry,
	project,
	scopeCatalog,
	proposals,
}: ProposalLedgerProps) {
	let content: ReactNode;
	if (isPending) {
		content = (
			<p className="ledger-empty" role="status">
				Loading proposals…
			</p>
		);
	} else if (isError) {
		content = (
			<div className="ledger-empty">
				<StatusMessage tone="error">Could not load proposals.</StatusMessage>
				<Button className="quiet-button" onClick={onRetry} type="button">
					Try again
				</Button>
			</div>
		);
	} else if (proposals.length > 0) {
		content = (
			<div className="proposal-list">
				{proposals.map((proposal) => (
					<ProposalRecord
						key={proposal.id}
						project={project}
						proposal={proposal}
						scopeCatalog={scopeCatalog}
					/>
				))}
			</div>
		);
	} else {
		content = <EmptyProposalLedger />;
	}

	return (
		<aside aria-labelledby="saved-proposals-title" className="context-ledger">
			<div className="ledger-header">
				<div>
					<p className="panel-index">SAVED RECORD</p>
					<h2 id="saved-proposals-title">Proposals</h2>
				</div>
				<span className="ledger-count">{proposals.length}</span>
			</div>
			<div className="ledger-project">
				<strong>{project.name}</strong>
				<span>{project.generalArtDirection}</span>
			</div>
			{content}
		</aside>
	);
}

function ProposalRecord({
	proposal,
	project,
	scopeCatalog,
}: {
	proposal: ContextProposal;
	project: ProjectContext;
	scopeCatalog: ProjectContextScopeCatalog;
}) {
	const queryClient = useQueryClient();
	const [review, setReview] = useState<ContextProposalReview | null>(null);
	const reviewProposal = useMutation(
		orpc.contextProposals.review.mutationOptions({
			meta: { errorOperationKind: "query" },
			onSuccess: setReview,
		})
	);
	const activateProposal = useMutation(
		orpc.contextProposals.activate.mutationOptions({
			onSuccess: () => {
				toast.success("Active Context Revision created.");
				void queryClient.invalidateQueries({
					queryKey: orpc.projectContexts.list.queryKey(),
				});
				void queryClient.invalidateQueries({
					queryKey: orpc.contextProposals.list.queryKey({
						input: { projectId: project.id },
					}),
				});
				reviewProposal.mutate({
					projectId: project.id,
					proposalId: proposal.id,
				});
			},
		})
	);
	const source = describeProposalSource(proposal.source);
	const isCurrent =
		project.currentContextRevision.sourceProposalId === proposal.id;

	return (
		<article className="proposal-record">
			<div className="proposal-record-top">
				<span>{new Date(proposal.createdAt).toLocaleString("en-US")}</span>
				<span
					className={
						isCurrent || proposal.validation.isValid
							? "valid-tag"
							: "conflict-tag"
					}
				>
					{proposalStatusLabel(isCurrent, proposal.validation.isValid)}
				</span>
			</div>
			<h3>{proposal.summary}</h3>
			<p className="proposal-source">Source: {source}</p>
			<p className="proposal-base">
				The base revision is compared with the current Active Context Revision
				during review.
			</p>
			<ul className="proposal-changes">
				{withOccurrenceKeys(proposal.changes, ruleChangeKey).map(
					({ item: change, key }) => (
						<li key={`${proposal.id}-${key}`}>
							<strong>
								{operationLabel(change.operation)} · {change.ruleId}
							</strong>
							<small>
								Scope:{" "}
								{contextScopeLabel(change.scope, scopeCatalog, project.name)}
							</small>
							{"value" in change ? (
								<p>Proposed value: {formatRuleValue(change.value)}</p>
							) : null}
							<p>{change.rationale}</p>
							{withOccurrenceKeys(change.evidence, evidenceKey).map(
								({ item: evidence, key: evidenceItemKey }) => (
									<small key={evidenceItemKey}>
										{evidenceLabel(evidence.kind)}: {evidence.statement}
									</small>
								)
							)}
						</li>
					)
				)}
			</ul>
			<div className="proposal-actions">
				<Button
					className="quiet-button"
					disabled={reviewProposal.isPending}
					onClick={() =>
						reviewProposal.mutate({
							projectId: project.id,
							proposalId: proposal.id,
						})
					}
					type="button"
				>
					{reviewButtonLabel(reviewProposal.isPending, Boolean(review))}
				</Button>
				{review ? (
					<ProposalReviewPanel
						currentRevisionId={project.currentContextRevision.id}
						isActivating={activateProposal.isPending}
						isCurrent={isCurrent}
						onActivate={() =>
							activateProposal.mutate({
								projectId: project.id,
								proposalId: proposal.id,
								expectedCurrentRevisionId: review.currentRevisionId,
							})
						}
						projectName={project.name}
						review={review}
						scopeCatalog={scopeCatalog}
					/>
				) : null}
			</div>
		</article>
	);
}

function proposalStatusLabel(isCurrent: boolean, wasValid: boolean) {
	if (isCurrent) {
		return "Active";
	}
	return wasValid ? "Valid on initial check" : "Conflict on initial check";
}

function reviewButtonLabel(isPending: boolean, hasReview: boolean) {
	if (isPending) {
		return "Checking current revision…";
	}
	return hasReview ? "Refresh review" : "Review proposal";
}

function ProposalReviewPanel({
	currentRevisionId,
	isActivating,
	isCurrent,
	onActivate,
	projectName,
	review,
	scopeCatalog,
}: {
	currentRevisionId: string;
	isActivating: boolean;
	isCurrent: boolean;
	onActivate: () => void;
	projectName: string;
	review: ContextProposalReview;
	scopeCatalog: ProjectContextScopeCatalog;
}) {
	const isStale = !isCurrent && review.currentRevisionId !== currentRevisionId;
	const wasActivated = review.activatedRevisionNumber !== null;
	const activationRevisionNumber =
		review.activatedRevisionNumber ?? review.targetRevisionNumber;
	return (
		<section
			aria-labelledby={`review-${review.proposalId}`}
			className="proposal-review"
		>
			<div className="review-heading">
				<div>
					<p className="panel-index">CURRENT REVIEW</p>
					<h4 id={`review-${review.proposalId}`}>
						{reviewHeadingLabel(isCurrent, review)}
					</h4>
				</div>
				<span
					className={
						(review.activationAllowed && !isStale) || isCurrent
							? "valid-tag"
							: "conflict-tag"
					}
				>
					{reviewStatusLabel(isCurrent, isStale, review)}
				</span>
			</div>
			<dl className="review-revisions">
				<div>
					<dt>Base</dt>
					<dd>R{review.baseRevisionNumber}</dd>
				</div>
				<div>
					<dt>Current</dt>
					<dd>R{review.currentRevisionNumber}</dd>
				</div>
				<div>
					<dt>{wasActivated ? "Activated" : "Result"}</dt>
					<dd>R{activationRevisionNumber}</dd>
				</div>
			</dl>
			{!wasActivated && review.isRebased ? (
				<p className="review-rebase" role="status">
					This proposal was prepared from R{review.baseRevisionNumber}. Current
					rules without conflicts are preserved in the new revision.
				</p>
			) : null}
			{isStale ? (
				<p className="review-rebase" role="status">
					The Active Context Revision changed. Refresh the review before
					activation.
				</p>
			) : null}
			{!isStale && review.conflicts.length > 0 ? (
				<div className="review-conflicts" role="alert">
					<h5>Activation blockers</h5>
					<ul>
						{withOccurrenceKeys(review.conflicts, conflictKey).map(
							({ item: conflict, key }) => (
								<li key={key}>
									<strong>{conflict.ruleId}</strong>
									<span>{conflict.message}</span>
								</li>
							)
						)}
					</ul>
				</div>
			) : null}
			{!(wasActivated || isStale) && review.conflicts.length === 0 ? (
				<p className="review-ready" role="status">
					Scope precedence, overrides, and conflicts have been checked. This
					revision activates only with your approval.
				</p>
			) : null}
			<div className="effective-rules">
				<h5>Revision rule chain · {review.candidateRules.length} rules</h5>
				{review.candidateRules.length ? (
					<ul>
						{withOccurrenceKeys(review.candidateRules, contextRuleKey).map(
							({ item: rule, key }) => (
								<li key={key}>
									<div>
										<strong>{rule.id}</strong>
										<span>
											{contextScopeLabel(rule.scope, scopeCatalog, projectName)}
										</span>
									</div>
									<p>{formatRuleValue(rule.value)}</p>
									<small>
										Precedence:{" "}
										{rule.precedenceChain
											.map((scope) =>
												contextScopeLabel(scope, scopeCatalog, projectName)
											)
											.join(" → ")}
									</small>
									{rule.supersedesRuleId ? (
										<small>Overrides rule: {rule.supersedesRuleId}</small>
									) : null}
									<small>Source: {contextRuleSourceLabel(rule.source)}</small>
									<small>Rationale: {rule.rationale}</small>
								</li>
							)
						)}
					</ul>
				) : (
					<p className="field-hint">No active rules.</p>
				)}
			</div>
			<details className="context-copy-details">
				<summary>Production Context Snapshot</summary>
				<pre>{review.contextCopy}</pre>
			</details>
			<ProposalActivationOutcome
				activationRevisionNumber={activationRevisionNumber}
				currentRevisionNumber={review.currentRevisionNumber}
				isActivating={isActivating}
				isCurrent={isCurrent}
				isStale={isStale}
				onActivate={onActivate}
				review={review}
			/>
		</section>
	);
}

function reviewHeadingLabel(isCurrent: boolean, review: ContextProposalReview) {
	if (isCurrent) {
		const revisionNumber =
			review.activatedRevisionNumber ?? review.currentRevisionNumber;
		return `Active revision · R${revisionNumber}`;
	}
	if (review.activatedRevisionNumber !== null) {
		return `Previous activation · R${review.activatedRevisionNumber}`;
	}
	return `Activation summary · R${review.targetRevisionNumber}`;
}

function ProposalActivationOutcome({
	activationRevisionNumber,
	currentRevisionNumber,
	isActivating,
	isCurrent,
	isStale,
	onActivate,
	review,
}: {
	activationRevisionNumber: number;
	currentRevisionNumber: number;
	isActivating: boolean;
	isCurrent: boolean;
	isStale: boolean;
	onActivate: () => void;
	review: ContextProposalReview;
}) {
	if (isCurrent) {
		return (
			<p className="review-ready" role="status">
				This proposal was saved as Active Context Revision R
				{activationRevisionNumber}.
			</p>
		);
	}
	if (review.activatedRevisionNumber !== null) {
		return (
			<p className="review-rebase" role="status">
				This proposal created R{activationRevisionNumber}. The current Active
				Context Revision is R{currentRevisionNumber}.
			</p>
		);
	}
	return (
		<Button
			className="signal-button activate-proposal"
			disabled={!review.activationAllowed || isActivating || isStale}
			onClick={onActivate}
			type="button"
		>
			{isActivating
				? "Activating…"
				: `Activate R${review.targetRevisionNumber}`}
		</Button>
	);
}

function reviewStatusLabel(
	isCurrent: boolean,
	isStale: boolean,
	review: ContextProposalReview
) {
	if (isCurrent) {
		return "Active";
	}
	if (review.activatedRevisionNumber !== null) {
		return "Previously activated";
	}
	if (isStale) {
		return "Review required again";
	}
	return review.activationAllowed
		? "Ready to activate"
		: `${review.conflicts.length} blockers`;
}

function conflictKey(conflict: ContextProposalReview["conflicts"][number]) {
	return `${conflict.code}:${conflict.ruleId}:${conflict.message}`;
}

function contextRuleKey(rule: ContextRule) {
	return `${rule.id}:${rule.scope.kind}:${rule.scope.id}`;
}

function contextScopeLabel(
	scope: ContextScope,
	scopeCatalog: ProjectContextScopeCatalog,
	projectName: string
) {
	if (scope.kind === "project") {
		return `Project · ${projectName}`;
	}
	if (scope.kind === "visual_world") {
		const visualWorld = scopeCatalog.visualWorlds.find(
			(record) => record.id === scope.id
		);
		return visualWorld
			? `Visual World · ${visualWorld.name}`
			: `Visual World · not found (${scope.id})`;
	}
	if (scope.kind === "theme") {
		const theme = scopeCatalog.themes.find((record) => record.id === scope.id);
		const visualWorld = scopeCatalog.visualWorlds.find(
			(record) => record.id === theme?.visualWorldId
		);
		return theme && visualWorld
			? `Theme · ${visualWorld.name} / ${theme.name}`
			: `Theme · not found (${scope.id})`;
	}
	const labels = {
		asset_family: "Asset Family",
		asset: "Asset",
		operation: "Operation",
	};
	return `${labels[scope.kind]} · ${scope.id}`;
}

function contextRuleSourceLabel(source: ContextRule["source"]) {
	return source.kind === "project_setup"
		? "Project setup"
		: `Context Proposal ${source.proposalId}`;
}

function EmptyProposalLedger() {
	return (
		<div className="ledger-empty">
			<div aria-hidden="true" className="empty-mark">
				<span />
				<span />
				<span />
			</div>
			<h3>No proposals yet</h3>
			<p>Saved proposals appear here with their rationale and evidence.</p>
		</div>
	);
}

function evidenceLabel(kind: EvidenceKind) {
	return kind === "user_decision" ? "User decision" : "Observed change";
}

function formatRuleValue(value: ContextRuleValue) {
	if (value.type === "text_list") {
		return value.value.join(", ");
	}
	if (value.type === "boolean") {
		return value.value ? "Yes" : "No";
	}
	return String(value.value);
}

function ruleChangeKey(change: ContextRuleChange) {
	return JSON.stringify(change);
}

function evidenceKey(evidence: ContextRuleChange["evidence"][number]) {
	return `${evidence.kind}:${evidence.statement}`;
}

function withOccurrenceKeys<T>(
	items: T[],
	getKey: (item: T) => string
): Array<{ item: T; key: string }> {
	const occurrences = new Map<string, number>();
	return items.map((item) => {
		const baseKey = getKey(item);
		const occurrence = occurrences.get(baseKey) ?? 0;
		occurrences.set(baseKey, occurrence + 1);
		return { item, key: `${baseKey}:${occurrence}` };
	});
}

function describeProposalSource(source: ContextProposal["source"]) {
	if (source.kind === "structured_control") {
		return `Structured control · ${source.controlId}`;
	}
	if (source.kind === "production_experiment") {
		return `Production Experiment · ${source.experimentId}`;
	}
	return `Context agent · ${source.agentId} / ${source.modelId}`;
}

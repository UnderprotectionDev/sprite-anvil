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
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { type ReactNode, useState } from "react";
import { toast } from "sonner";
import { ScopeRegistryPanel } from "@/features/visual-worlds/ui/components/context-scope-registry";
import { QueryRetryButton } from "@/utils/error-notification";
import { client, orpc } from "@/utils/orpc";
import {
	type EvidenceKind,
	operationLabel,
	ProposalForm,
} from "../forms/proposal-form";

interface ContextWorkspaceProps {
	isProposalsError: boolean;
	isProposalsFetching: boolean;
	isProposalsPending: boolean;
	isScopeError: boolean;
	isScopeFetching: boolean;
	isScopePending: boolean;
	onCheckProposalState: () => Promise<boolean>;
	onNewProject: () => void;
	onRefreshProposals: () => Promise<unknown>;
	onRetryProposals: () => void;
	onRetryScope: () => void;
	onSelectProject: (project: ProjectContext) => void;
	project: ProjectContext;
	projects: ProjectContext[];
	proposals: ContextProposal[];
	proposalsError?: string;
	scopeCatalog: ProjectContextScopeCatalog;
	scopeError?: string;
}

export function ContextWorkspace({
	isProposalsError,
	isProposalsFetching,
	isProposalsPending,
	isScopeError,
	isScopeFetching,
	isScopePending,
	onCheckProposalState,
	onNewProject,
	onRetryProposals,
	onRetryScope,
	onRefreshProposals,
	onSelectProject,
	project,
	projects,
	scopeCatalog,
	scopeError,
	proposals,
	proposalsError,
}: ContextWorkspaceProps) {
	return (
		<>
			<div className="context-toolbar">
				<label className="project-select">
					<span>Proje</span>
					<select
						aria-label="Proje"
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
							<option key={item.id} value={item.id}>
								{item.name}
							</option>
						))}
					</select>
				</label>
				<Button className="quiet-button" onClick={onNewProject} type="button">
					<Plus aria-hidden="true" size={16} />
					Yeni proje
				</Button>
			</div>
			<ScopeRegistryPanel
				isError={isScopeError}
				isFetching={isScopeFetching}
				isPending={isScopePending}
				onRetry={onRetryScope}
				project={project}
				queryError={scopeError}
				scopeCatalog={scopeCatalog}
			/>
			<div className="context-grid">
				<ProposalForm
					key={`${project.id}:${project.currentContextRevision.id}`}
					onCheckCurrentState={onCheckProposalState}
					onRefresh={onRefreshProposals}
					project={project}
					scopeCatalog={scopeCatalog}
				/>
				<ProposalLedger
					isError={isProposalsError}
					isFetching={isProposalsFetching}
					isPending={isProposalsPending}
					onRetry={onRetryProposals}
					project={project}
					proposals={proposals}
					queryError={proposalsError}
					scopeCatalog={scopeCatalog}
				/>
			</div>
		</>
	);
}

interface ProposalLedgerProps {
	isError: boolean;
	isFetching: boolean;
	isPending: boolean;
	onRetry: () => void;
	project: ProjectContext;
	proposals: ContextProposal[];
	queryError?: string;
	scopeCatalog: ProjectContextScopeCatalog;
}

function ProposalLedger({
	isError,
	isFetching,
	isPending,
	onRetry,
	project,
	scopeCatalog,
	proposals,
	queryError,
}: ProposalLedgerProps) {
	let content: ReactNode;
	if (isPending) {
		content = (
			<p className="ledger-empty" role="status">
				Öneriler yükleniyor…
			</p>
		);
	} else if (isError) {
		content = (
			<div className="space-y-2">
				<p className="context-error" role="alert">
					Öneriler yüklenemedi. {queryError}
				</p>
				<QueryRetryButton
					className="quiet-button"
					disabled={isFetching}
					onRetry={onRetry}
				/>
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
					<p className="panel-index">KALICI KAYIT</p>
					<h2 id="saved-proposals-title">Öneriler</h2>
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
	const reviewProposal = useMutation({
		meta: { errorOperationKind: "query" },
		mutationFn: () =>
			client.contextProposals.review({
				projectId: project.id,
				proposalId: proposal.id,
			}),
		onSuccess: setReview,
	});
	const activateProposal = useMutation({
		mutationFn: (currentReview: ContextProposalReview) =>
			client.contextProposals.activate({
				projectId: project.id,
				proposalId: proposal.id,
				expectedCurrentRevisionId: currentReview.currentRevisionId,
			}),
		onSuccess: () => {
			toast.success("Etkin Bağlam Sürümü oluşturuldu.");
			void queryClient.invalidateQueries({
				queryKey: orpc.projectContexts.list.queryKey(),
			});
			void queryClient.invalidateQueries({
				queryKey: orpc.contextProposals.list.queryKey({
					input: { projectId: project.id },
				}),
			});
			reviewProposal.mutate();
		},
	});
	const source =
		proposal.source.kind === "structured_control"
			? `Yapılandırılmış kontrol · ${proposal.source.controlId}`
			: `Bağlam ajanı · ${proposal.source.agentId} / ${proposal.source.modelId}`;
	const isCurrent =
		project.currentContextRevision.sourceProposalId === proposal.id;

	return (
		<article className="proposal-record">
			<div className="proposal-record-top">
				<span>{new Date(proposal.createdAt).toLocaleString("tr-TR")}</span>
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
			<p className="proposal-source">Kaynak: {source}</p>
			<p className="proposal-base">
				Dayanak sürüm, incelemede güncel Etkin Bağlam Sürümü ile
				karşılaştırılır.
			</p>
			<ul className="proposal-changes">
				{withOccurrenceKeys(proposal.changes, ruleChangeKey).map(
					({ item: change, key }) => (
						<li key={`${proposal.id}-${key}`}>
							<strong>
								{operationLabel(change.operation)} · {change.ruleId}
							</strong>
							<small>
								Kapsam:{" "}
								{contextScopeLabel(change.scope, scopeCatalog, project.name)}
							</small>
							{"value" in change ? (
								<p>Önerilen değer: {formatRuleValue(change.value)}</p>
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
					onClick={() => reviewProposal.mutate()}
					type="button"
				>
					{reviewButtonLabel(reviewProposal.isPending, Boolean(review))}
				</Button>
				{review ? (
					<ProposalReviewPanel
						currentRevisionId={project.currentContextRevision.id}
						isActivating={activateProposal.isPending}
						isCurrent={isCurrent}
						onActivate={() => activateProposal.mutate(review)}
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
		return "Etkin";
	}
	return wasValid ? "İlk kontrolde temiz" : "İlk kontrolde çakışma";
}

function reviewButtonLabel(isPending: boolean, hasReview: boolean) {
	if (isPending) {
		return "Güncel sürüm denetleniyor…";
	}
	return hasReview ? "İncelemeyi yenile" : "Öneriyi incele";
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
					<p className="panel-index">GÜNCEL İNCELEME</p>
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
					<dt>Dayanak</dt>
					<dd>R{review.baseRevisionNumber}</dd>
				</div>
				<div>
					<dt>Güncel</dt>
					<dd>R{review.currentRevisionNumber}</dd>
				</div>
				<div>
					<dt>{wasActivated ? "Etkinleşti" : "Oluşacak"}</dt>
					<dd>R{activationRevisionNumber}</dd>
				</div>
			</dl>
			{!wasActivated && review.isRebased ? (
				<p className="review-rebase" role="status">
					Öneri R{review.baseRevisionNumber} sürümünden hazırlanmış. Çakışmayan
					güncel kurallar yeni sürümde korunuyor.
				</p>
			) : null}
			{isStale ? (
				<p className="review-rebase" role="status">
					Etkin Bağlam Sürümü değişti. Etkinleştirmeden önce incelemeyi
					yenileyin.
				</p>
			) : null}
			{!isStale && review.conflicts.length > 0 ? (
				<div className="review-conflicts" role="alert">
					<h5>Etkinleştirme engelleri</h5>
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
					Kapsam önceliği, istisnalar ve çakışmalar denetlendi. Bu sürüm
					yalnızca onayınızla etkinleşir.
				</p>
			) : null}
			<div className="effective-rules">
				<h5>Sürümün kural zinciri · {review.candidateRules.length} kural</h5>
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
										Öncelik:{" "}
										{rule.precedenceChain
											.map((scope) =>
												contextScopeLabel(scope, scopeCatalog, projectName)
											)
											.join(" → ")}
									</small>
									{rule.supersedesRuleId ? (
										<small>
											İstisna: {rule.supersedesRuleId} kuralını geçersiz kılar
										</small>
									) : null}
									<small>Kaynak: {contextRuleSourceLabel(rule.source)}</small>
									<small>Gerekçe: {rule.rationale}</small>
								</li>
							)
						)}
					</ul>
				) : (
					<p className="field-hint">Etkin kural bulunmuyor.</p>
				)}
			</div>
			<details className="context-copy-details">
				<summary>Üretim Bağlamı Kopyası</summary>
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
		return `Etkin sürüm · R${revisionNumber}`;
	}
	if (review.activatedRevisionNumber !== null) {
		return `Önceki etkinleştirme · R${review.activatedRevisionNumber}`;
	}
	return `Etkinleştirme özeti · R${review.targetRevisionNumber}`;
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
				Bu öneri Etkin Bağlam Sürümü R{activationRevisionNumber} olarak
				kaydedildi.
			</p>
		);
	}
	if (review.activatedRevisionNumber !== null) {
		return (
			<p className="review-rebase" role="status">
				Bu öneri R{activationRevisionNumber} sürümünü oluşturdu. Güncel Etkin
				Bağlam Sürümü R{currentRevisionNumber}.
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
				? "Etkinleştiriliyor…"
				: `R${review.targetRevisionNumber} sürümünü etkinleştir`}
		</Button>
	);
}

function reviewStatusLabel(
	isCurrent: boolean,
	isStale: boolean,
	review: ContextProposalReview
) {
	if (isCurrent) {
		return "Etkin";
	}
	if (review.activatedRevisionNumber !== null) {
		return "Daha önce etkinleştirildi";
	}
	if (isStale) {
		return "Yeniden inceleme gerekli";
	}
	return review.activationAllowed
		? "Etkinleştirilebilir"
		: `${review.conflicts.length} engel`;
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
		return `Proje · ${projectName}`;
	}
	if (scope.kind === "visual_world") {
		const visualWorld = scopeCatalog.visualWorlds.find(
			(record) => record.id === scope.id
		);
		return visualWorld
			? `Görsel Dünya · ${visualWorld.name}`
			: `Görsel Dünya · bulunamadı (${scope.id})`;
	}
	if (scope.kind === "theme") {
		const theme = scopeCatalog.themes.find((record) => record.id === scope.id);
		const visualWorld = scopeCatalog.visualWorlds.find(
			(record) => record.id === theme?.visualWorldId
		);
		return theme && visualWorld
			? `Tema · ${visualWorld.name} / ${theme.name}`
			: `Tema · bulunamadı (${scope.id})`;
	}
	const labels = {
		asset_family: "Varlık Ailesi",
		asset: "Varlık",
		operation: "İşlem",
	};
	return `${labels[scope.kind]} · ${scope.id}`;
}

function contextRuleSourceLabel(source: ContextRule["source"]) {
	return source.kind === "project_setup"
		? "Proje kurulumu"
		: `Bağlam Önerisi ${source.proposalId}`;
}

function EmptyProposalLedger() {
	return (
		<div className="ledger-empty">
			<div aria-hidden="true" className="empty-mark">
				<span />
				<span />
				<span />
			</div>
			<h3>Henüz öneri yok</h3>
			<p>Kaydettiğiniz öneriler, dayanak ve kanıtlarıyla burada görünür.</p>
		</div>
	);
}

function evidenceLabel(kind: EvidenceKind) {
	return kind === "user_decision" ? "Kullanıcı kararı" : "Gözlenen değişiklik";
}

function formatRuleValue(value: ContextRuleValue) {
	if (value.type === "text_list") {
		return value.value.join(", ");
	}
	if (value.type === "boolean") {
		return value.value ? "Evet" : "Hayır";
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

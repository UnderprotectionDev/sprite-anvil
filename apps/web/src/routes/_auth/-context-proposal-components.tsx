import type {
	ContextProposal,
	ContextProposalInput,
	ContextProposalReview,
	ContextRevision,
	ContextRule,
	ContextRuleChange,
	ContextRuleValue,
	ProjectContext,
	ProjectContextCreateInput,
	StructuredContextRuleId,
} from "@sprite-anvil/api/project-context";
import {
	STRUCTURED_CONTEXT_RULE_IDS,
	STRUCTURED_CONTEXT_RULES,
} from "@sprite-anvil/api/project-context";
import { Button } from "@sprite-anvil/ui/components/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Send, Trash2 } from "lucide-react";
import { type ReactNode, type SyntheticEvent, useState } from "react";
import { toast } from "sonner";
import { client, orpc } from "@/utils/orpc";

type EvidenceKind = "user_decision" | "observed_change";
type ValueType =
	(typeof STRUCTURED_CONTEXT_RULES)[StructuredContextRuleId]["valueType"];

const structuredRuleLabels: Record<StructuredContextRuleId, string> = {
	perspective: "Perspektif",
	"camera.approach": "Kamera yaklaşımı",
	palette: "Palet",
	outline: "Kontur",
	"outline.width": "Kontur kalınlığı",
	shading: "Gölgelendirme",
	"light.direction": "Işık yönü",
	"detail.density": "Ayrıntı yoğunluğu",
	"material.language": "Malzeme dili",
	"motif.allowed": "Kullanılabilecek motifler",
	"motif.avoided": "Kaçınılacak motifler",
};

interface ChangeDraft {
	evidence: string;
	evidenceKind: EvidenceKind;
	id: string;
	operation: "add" | "replace" | "remove";
	rationale: string;
	ruleId: string;
	value: string;
}

interface ProjectSetupFormProps {
	error: string | null;
	isPending: boolean;
	onCancel?: () => void;
	onSubmit: (input: ProjectContextCreateInput) => void;
}

export function ProjectSetupForm({
	error,
	isPending,
	onCancel,
	onSubmit,
}: ProjectSetupFormProps) {
	const [name, setName] = useState("");
	const [generalArtDirection, setGeneralArtDirection] = useState("");

	function submit(event: SyntheticEvent<HTMLFormElement>) {
		event.preventDefault();
		onSubmit({ name, generalArtDirection });
	}

	return (
		<section className="context-panel project-setup">
			<div className="panel-heading">
				<div>
					<p className="panel-index">PROJE TEMELİ</p>
					<h2>{onCancel ? "Yeni proje" : "İlk projeyi oluşturun"}</h2>
				</div>
				{onCancel ? (
					<Button className="quiet-button" onClick={onCancel} type="button">
						Vazgeç
					</Button>
				) : null}
			</div>
			<p className="panel-copy">
				Bir proje adı ve genel sanat yaklaşımı başlangıç için yeterlidir. Bu
				adım boş bir taban sürüm oluşturur; kuralı etkinleştirmez.
			</p>
			<form className="context-form" onSubmit={submit}>
				<label className="context-field">
					<span>Proje adı</span>
					<input
						autoComplete="off"
						maxLength={120}
						onChange={(event) => setName(event.target.value)}
						placeholder="Örn. Moonlit Vale"
						required
						value={name}
					/>
				</label>
				<label className="context-field">
					<span>Genel sanat yaklaşımı</span>
					<textarea
						maxLength={1000}
						onChange={(event) => setGeneralArtDirection(event.target.value)}
						placeholder="Oyunun görsel dünyasını birkaç cümleyle tanımlayın."
						required
						rows={3}
						value={generalArtDirection}
					/>
				</label>
				{error ? (
					<p className="context-error" role="alert">
						{error}
					</p>
				) : null}
				<Button className="signal-button" disabled={isPending} type="submit">
					{isPending ? "Oluşturuluyor…" : "Projeyi oluştur"}
				</Button>
			</form>
		</section>
	);
}

interface ContextWorkspaceProps {
	isProposalsError: boolean;
	isProposalsPending: boolean;
	onNewProject: () => void;
	onRefreshProposals: () => Promise<unknown>;
	onSelectProject: (project: ProjectContext) => void;
	project: ProjectContext;
	projects: ProjectContext[];
	proposals: ContextProposal[];
	proposalsError?: string;
}

export function ContextWorkspace({
	isProposalsError,
	isProposalsPending,
	onNewProject,
	onRefreshProposals,
	onSelectProject,
	project,
	projects,
	proposals,
	proposalsError,
}: ContextWorkspaceProps) {
	return (
		<>
			<div className="context-toolbar">
				<label className="project-select">
					<span>Çalışma alanı</span>
					<select
						aria-label="Çalışma alanı"
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
			<div className="context-grid">
				<ProposalForm
					key={`${project.id}:${project.currentContextRevision.id}`}
					onRefresh={onRefreshProposals}
					project={project}
				/>
				<ProposalLedger
					isError={isProposalsError}
					isPending={isProposalsPending}
					project={project}
					proposals={proposals}
					queryError={proposalsError}
				/>
			</div>
		</>
	);
}

interface ProposalFormProps {
	onRefresh: () => Promise<unknown>;
	project: ProjectContext;
}

function ProposalForm({ onRefresh, project }: ProposalFormProps) {
	const [summary, setSummary] = useState("");
	const [changes, setChanges] = useState<ChangeDraft[]>(() => [
		newChangeDraft(
			availableRules(project.currentContextRevision, "add")[0]?.id ?? ""
		),
	]);
	const [formError, setFormError] = useState<string | null>(null);
	const currentRevision = project.currentContextRevision;
	const supportedBaseRuleCount = STRUCTURED_CONTEXT_RULE_IDS.filter((ruleId) =>
		currentRevision.rules.some((rule) => rule.id === ruleId)
	).length;
	const createProposal = useMutation({
		mutationFn: (input: ContextProposalInput) =>
			client.contextProposals.create(input),
		onSuccess: async () => {
			setSummary("");
			setChanges([
				newChangeDraft(availableRules(currentRevision, "add")[0]?.id ?? ""),
			]);
			setFormError(null);
			await onRefresh();
			toast.success("Bağlam Önerisi kaydedildi.");
		},
		onError: (error) => setFormError(error.message),
	});

	function updateChange(id: string, patch: Partial<ChangeDraft>) {
		setChanges((current) =>
			current.map((change) =>
				change.id === id ? { ...change, ...patch } : change
			)
		);
	}

	function submitProposal(event: SyntheticEvent<HTMLFormElement>) {
		event.preventDefault();
		setFormError(null);
		createProposal.mutate({
			projectId: project.id,
			baseContextRevisionId: currentRevision.id,
			summary,
			changes: changes.map((change) => toContextRuleChange(change, project.id)),
		});
	}

	return (
		<section aria-labelledby="proposal-form-title" className="context-panel">
			<div className="panel-heading">
				<div>
					<p className="panel-index">KURAL DEĞİŞİKLİĞİ ÖNERME</p>
					<h2 id="proposal-form-title">Bağlam Önerisi hazırlayın</h2>
				</div>
			</div>
			<div
				aria-label="Öneri taban sürümü"
				className="base-revision"
				role="group"
			>
				<span aria-hidden="true" className="base-revision-mark">
					R{currentRevision.revisionNumber}
				</span>
				<div>
					<span className="stamp-label">DAYANAK BAĞLAM SÜRÜMÜ</span>
					<strong>
						{currentRevision.isActive
							? "Etkin Bağlam Sürümü"
							: "Başlangıç taban sürümü"}
					</strong>
				</div>
				<span className="base-state">
					{currentRevision.isActive ? "Etkin" : "Etkin değil"}
				</span>
			</div>
			<p className="panel-copy">
				Her değişiklik için kuralı, gerekçeyi ve karar ya da gözlem kanıtını
				ekleyin. Bu ekran yapılandırılmış alanları kaydeder; ham{" "}
				<code>context.md</code> düzenlemez.
			</p>
			{supportedBaseRuleCount === 0 ? (
				<p className="context-notice" role="status">
					Bu Bağlam Sürümünde yapılandırılmış kontrollerle değiştirilebilecek
					bir kural yok. Yalnızca ekleme önerisi hazırlayabilirsiniz.
				</p>
			) : null}
			<form className="context-form" onSubmit={submitProposal}>
				<label className="context-field">
					<span>Öneri özeti</span>
					<input
						maxLength={240}
						onChange={(event) => setSummary(event.target.value)}
						placeholder="Örn. Karakter paletini sadeleştirme"
						required
						value={summary}
					/>
				</label>
				<div className="rule-list-heading">
					<h3>Önerilen kural değişiklikleri</h3>
					<span>{changes.length} değişiklik</span>
				</div>
				<div className="rule-drafts">
					{changes.map((change, index) => (
						<RuleDraftCard
							baseRevision={currentRevision}
							canRemove={changes.length > 1}
							change={change}
							index={index}
							key={change.id}
							onChange={(patch) => updateChange(change.id, patch)}
							onRemove={() =>
								setChanges((current) =>
									current.filter((item) => item.id !== change.id)
								)
							}
						/>
					))}
				</div>
				<Button
					className="add-change"
					onClick={() =>
						setChanges((current) => [
							...current,
							newChangeDraft(
								availableRules(currentRevision, "add")[0]?.id ?? ""
							),
						])
					}
					type="button"
				>
					<Plus aria-hidden="true" size={15} />
					Başka kural değişikliği ekle
				</Button>
				{formError ? (
					<p className="context-error" role="alert">
						{formError}
					</p>
				) : null}
				<Button
					className="signal-button submit-proposal"
					disabled={createProposal.isPending}
					type="submit"
				>
					<Send aria-hidden="true" size={15} />
					{createProposal.isPending
						? "Kaydediliyor…"
						: "Bağlam Önerisini kaydet"}
				</Button>
			</form>
		</section>
	);
}

interface RuleDraftCardProps {
	baseRevision: ContextRevision;
	canRemove: boolean;
	change: ChangeDraft;
	index: number;
	onChange: (patch: Partial<ChangeDraft>) => void;
	onRemove: () => void;
}

function RuleDraftCard({
	baseRevision,
	canRemove,
	change,
	index,
	onChange,
	onRemove,
}: RuleDraftCardProps) {
	const operationRules = availableRules(baseRevision, change.operation);
	const addRules = availableRules(baseRevision, "add");
	const existingRules = availableRules(baseRevision, "replace");
	const valueType = structuredValueType(change.ruleId);

	function changeOperation(operation: ChangeDraft["operation"]) {
		const rules = availableRules(baseRevision, operation);
		const ruleId = rules.some((rule) => rule.id === change.ruleId)
			? change.ruleId
			: (rules[0]?.id ?? "");
		onChange({ operation, ruleId, value: "" });
	}

	return (
		<fieldset className="rule-card">
			<legend>
				<span className="rule-card-number">
					{String(index + 1).padStart(2, "0")}
				</span>
				{operationLabel(change.operation)}
			</legend>
			<label className="context-field">
				<span>İşlem</span>
				<select
					aria-label={`Değişiklik ${index + 1} işlemi`}
					onChange={(event) =>
						changeOperation(event.target.value as ChangeDraft["operation"])
					}
					value={change.operation}
				>
					<option disabled={addRules.length === 0} value="add">
						Ekleme
					</option>
					<option disabled={existingRules.length === 0} value="replace">
						Değiştirme
					</option>
					<option disabled={existingRules.length === 0} value="remove">
						Kaldırma
					</option>
				</select>
			</label>
			<label className="context-field">
				<span>Kural</span>
				<select
					aria-label={`Değişiklik ${index + 1} kuralı`}
					onChange={(event) =>
						onChange({ ruleId: event.target.value, value: "" })
					}
					required
					value={change.ruleId}
				>
					<option disabled value="">
						Kural seçin
					</option>
					{operationRules.map((rule) => (
						<option key={rule.id} value={rule.id}>
							{rule.label}
						</option>
					))}
				</select>
				<span className="field-hint">
					{change.operation === "add"
						? "Yalnızca henüz bu sürümde bulunmayan yaygın kurallar eklenebilir."
						: `Bağlam Sürümü ${baseRevision.revisionNumber} içindeki bir kural seçilir.`}
				</span>
			</label>
			{change.operation === "remove" ? (
				<p className="field-hint">
					Kaldırma işlemi taban sürümdeki kuralı hedefler; yeni bir değer
					gerekmez.
				</p>
			) : (
				<div className="field-pair">
					<p className="field-hint">Değer türü: {valueTypeLabel(valueType)}</p>
					<RuleValueField change={change} index={index} onChange={onChange} />
				</div>
			)}
			<label className="context-field">
				<span>Bu değişikliğin gerekçesi</span>
				<textarea
					maxLength={2000}
					onChange={(event) => onChange({ rationale: event.target.value })}
					placeholder="Neden ekleniyor, değişiyor veya kaldırılıyor?"
					required
					rows={2}
					value={change.rationale}
				/>
			</label>
			<div className="field-pair evidence-fields">
				<label className="context-field">
					<span>Dayanak türü</span>
					<select
						aria-label={`Değişiklik ${index + 1} dayanak türü`}
						onChange={(event) =>
							onChange({
								evidenceKind: event.target.value as EvidenceKind,
							})
						}
						value={change.evidenceKind}
					>
						<option value="user_decision">Kullanıcı kararı</option>
						<option value="observed_change">Gözlenen değişiklik</option>
					</select>
				</label>
				<label className="context-field">
					<span>Kanıt</span>
					<textarea
						maxLength={1000}
						onChange={(event) => onChange({ evidence: event.target.value })}
						placeholder="Kararı veya projede görülen değişikliği açıklayın."
						required
						rows={2}
						value={change.evidence}
					/>
				</label>
			</div>
			{canRemove ? (
				<Button className="remove-change" onClick={onRemove} type="button">
					<Trash2 aria-hidden="true" size={14} />
					Değişikliği kaldır
				</Button>
			) : null}
		</fieldset>
	);
}

interface RuleValueFieldProps {
	change: ChangeDraft;
	index: number;
	onChange: (patch: Partial<ChangeDraft>) => void;
}

function RuleValueField({ change, index, onChange }: RuleValueFieldProps) {
	const inputId = `rule-value-${change.id}`;
	return (
		<div className="context-field">
			<label htmlFor={inputId}>Kural değeri</label>
			<RuleValueControl
				id={inputId}
				index={index}
				onChange={(value) => onChange({ value })}
				value={change.value}
				valueType={structuredValueType(change.ruleId)}
			/>
		</div>
	);
}

interface RuleValueControlProps {
	id: string;
	index: number;
	onChange: (value: string) => void;
	value: string;
	valueType: ValueType;
}

function RuleValueControl({
	id,
	index,
	onChange,
	value,
	valueType,
}: RuleValueControlProps) {
	if (valueType === "text_list") {
		return (
			<textarea
				aria-label={`Değişiklik ${index + 1} kural değeri`}
				id={id}
				onChange={(event) => onChange(event.target.value)}
				placeholder="Her satıra bir değer yazın"
				required
				rows={2}
				value={value}
			/>
		);
	}
	return (
		<input
			aria-label={`Değişiklik ${index + 1} kural değeri`}
			id={id}
			max={valueType === "number" ? "1000000000" : undefined}
			maxLength={valueType === "text" ? 2000 : undefined}
			min={valueType === "number" ? "-1000000000" : undefined}
			onChange={(event) => onChange(event.target.value)}
			placeholder={valueType === "number" ? "12" : "Karar verilen değer"}
			required
			step={valueType === "number" ? "any" : undefined}
			type={valueType === "number" ? "number" : "text"}
			value={value}
		/>
	);
}

interface ProposalLedgerProps {
	isError: boolean;
	isPending: boolean;
	project: ProjectContext;
	proposals: ContextProposal[];
	queryError?: string;
}

function ProposalLedger({
	isError,
	isPending,
	project,
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
			<p className="context-error" role="alert">
				Öneriler yüklenemedi. {queryError}
			</p>
		);
	} else if (proposals.length > 0) {
		content = (
			<div className="proposal-list">
				{proposals.map((proposal) => (
					<ProposalRecord
						key={proposal.id}
						project={project}
						proposal={proposal}
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
}: {
	proposal: ContextProposal;
	project: ProjectContext;
}) {
	const queryClient = useQueryClient();
	const [review, setReview] = useState<ContextProposalReview | null>(null);
	const reviewProposal = useMutation({
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
		onSuccess: async () => {
			await Promise.all([
				queryClient.invalidateQueries({
					queryKey: orpc.projectContexts.list.queryKey(),
				}),
				queryClient.invalidateQueries({
					queryKey: orpc.contextProposals.list.queryKey({
						input: { projectId: project.id },
					}),
				}),
			]);
			toast.success("Etkin Bağlam Sürümü oluşturuldu.");
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
				{reviewProposal.error ? (
					<p className="context-error" role="alert">
						İnceleme alınamadı. {reviewProposal.error.message}
					</p>
				) : null}
				{review ? (
					<ProposalReviewPanel
						activationError={activateProposal.error?.message}
						currentRevisionId={project.currentContextRevision.id}
						isActivating={activateProposal.isPending}
						isCurrent={isCurrent}
						onActivate={() => activateProposal.mutate(review)}
						review={review}
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
	activationError,
	currentRevisionId,
	isActivating,
	isCurrent,
	onActivate,
	review,
}: {
	activationError?: string;
	currentRevisionId: string;
	isActivating: boolean;
	isCurrent: boolean;
	onActivate: () => void;
	review: ContextProposalReview;
}) {
	const isStale = !isCurrent && review.currentRevisionId !== currentRevisionId;
	return (
		<section
			aria-labelledby={`review-${review.proposalId}`}
			className="proposal-review"
		>
			<div className="review-heading">
				<div>
					<p className="panel-index">GÜNCEL İNCELEME</p>
					<h4 id={`review-${review.proposalId}`}>
						Etkinleştirme özeti · R{review.targetRevisionNumber}
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
					<dt>Oluşacak</dt>
					<dd>R{review.targetRevisionNumber}</dd>
				</div>
			</dl>
			{review.isRebased ? (
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
			{!isStale && review.conflicts.length === 0 ? (
				<p className="review-ready" role="status">
					Kapsam önceliği, istisnalar ve çakışmalar denetlendi. Bu sürüm
					yalnızca onayınızla etkinleşir.
				</p>
			) : null}
			<div className="effective-rules">
				<h5>Etkin kural zinciri · {review.candidateRules.length} kural</h5>
				{review.candidateRules.length ? (
					<ul>
						{withOccurrenceKeys(review.candidateRules, contextRuleKey).map(
							({ item: rule, key }) => (
								<li key={key}>
									<div>
										<strong>{rule.id}</strong>
										<span>{contextScopeLabel(rule.scope)}</span>
									</div>
									<p>{formatRuleValue(rule.value)}</p>
									<small>
										Öncelik:{" "}
										{rule.precedenceChain.map(contextScopeLabel).join(" → ")}
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
			{activationError ? (
				<p className="context-error" role="alert">
					Etkinleştirme tamamlanamadı. {activationError} İncelemeyi yenileyip
					tekrar deneyin.
				</p>
			) : null}
			{isCurrent ? (
				<p className="review-ready" role="status">
					Bu öneri Etkin Bağlam Sürümü R{review.targetRevisionNumber} olarak
					kaydedildi.
				</p>
			) : (
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
			)}
		</section>
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

function contextScopeLabel(scope: ContextRule["scope"]) {
	const labels = {
		project: "Proje",
		visual_world: "Görsel Dünya",
		theme: "Tema",
		asset_family: "Varlık Ailesi",
		asset: "Varlık",
		operation: "İşlem",
	};
	return scope.kind === "project"
		? labels[scope.kind]
		: `${labels[scope.kind]} · ${scope.id}`;
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

function availableRules(
	baseRevision: ContextRevision,
	operation: ChangeDraft["operation"]
) {
	const existingRuleIds = new Set(baseRevision.rules.map((rule) => rule.id));
	return STRUCTURED_CONTEXT_RULE_IDS.filter((ruleId) =>
		operation === "add"
			? !existingRuleIds.has(ruleId)
			: existingRuleIds.has(ruleId)
	).map((id) => ({ id, label: structuredRuleLabels[id] }));
}

function structuredValueType(ruleId: string): ValueType {
	if (ruleId in STRUCTURED_CONTEXT_RULES) {
		return STRUCTURED_CONTEXT_RULES[ruleId as StructuredContextRuleId]
			.valueType;
	}
	return "text";
}

function valueTypeLabel(valueType: ValueType) {
	switch (valueType) {
		case "number":
			return "sayı";
		case "text_list":
			return "metin listesi";
		default:
			return "metin";
	}
}

function newChangeDraft(ruleId: string): ChangeDraft {
	return {
		id: crypto.randomUUID(),
		operation: "add",
		ruleId,
		value: "",
		rationale: "",
		evidenceKind: "user_decision",
		evidence: "",
	};
}

function toContextRuleChange(
	change: ChangeDraft,
	projectId: string
): ContextRuleChange {
	const shared = {
		ruleId: change.ruleId,
		scope: { kind: "project" as const, id: projectId },
		rationale: change.rationale,
		evidence: [
			{ kind: change.evidenceKind, statement: change.evidence },
		] as ContextRuleChange["evidence"],
	};
	if (change.operation === "remove") {
		return { operation: "remove", ...shared };
	}
	return {
		operation: change.operation,
		...shared,
		value: parseRuleValue(change.value, structuredValueType(change.ruleId)),
	};
}

function parseRuleValue(value: string, valueType: ValueType): ContextRuleValue {
	switch (valueType) {
		case "number":
			return { type: "number", value: Number(value) };
		case "text_list":
			return {
				type: "text_list",
				value: value
					.split("\n")
					.map((item) => item.trim())
					.filter(Boolean),
			};
		default:
			return { type: "text", value: value.trim() };
	}
}

function operationLabel(operation: ChangeDraft["operation"]) {
	if (operation === "replace") {
		return "Değiştirme";
	}
	if (operation === "remove") {
		return "Kaldırma";
	}
	return "Ekleme";
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

import type { ProjectContextScopeCatalog } from "@sprite-anvil/api/context-scopes";
import type {
	ContextProposal,
	ContextProposalInput,
	ContextProposalReview,
	ContextRevision,
	ContextRule,
	ContextRuleChange,
	ContextRuleValue,
	ContextScope,
	ProjectContext,
	ProjectContextCreateInput,
	StructuredContextRuleId,
} from "@sprite-anvil/api/project-context";
import {
	findNearestInheritedContextRule,
	STRUCTURED_CONTEXT_RULE_IDS,
	STRUCTURED_CONTEXT_RULES,
} from "@sprite-anvil/api/project-context";
import { Button } from "@sprite-anvil/ui/components/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Send, Trash2 } from "lucide-react";
import { type ReactNode, type SyntheticEvent, useState } from "react";
import { toast } from "sonner";
import {
	isWriteOutcomeUncertain,
	QueryRetryButton,
} from "@/utils/error-notification";
import { getErrorMessage } from "@/utils/get-error-message";
import { client, orpc } from "@/utils/orpc";
import { ScopeRegistryPanel } from "./-context-scope-registry";

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
	isOverride: boolean;
	operation: "add" | "replace" | "remove";
	precedenceChain: ContextScope[];
	rationale: string;
	ruleId: string;
	scope: ContextScope;
	value: string;
}

interface ProjectSetupFormProps {
	error: string | null;
	isCheckingOutcome?: boolean;
	isOutcomeUncertain?: boolean;
	isPending: boolean;
	onCancel?: () => void;
	onCheckOutcome?: () => void;
	onSubmit: (input: ProjectContextCreateInput) => void;
}

export function ProjectSetupForm({
	error,
	isCheckingOutcome = false,
	isOutcomeUncertain = false,
	isPending,
	onCancel,
	onCheckOutcome,
	onSubmit,
}: ProjectSetupFormProps) {
	const [name, setName] = useState("");
	const [generalArtDirection, setGeneralArtDirection] = useState("");

	function submit(event: SyntheticEvent<HTMLFormElement>) {
		event.preventDefault();
		if (isOutcomeUncertain) {
			return;
		}
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
						disabled={isOutcomeUncertain}
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
						disabled={isOutcomeUncertain}
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
				{isOutcomeUncertain && onCheckOutcome ? (
					<Button
						className="quiet-button"
						disabled={isCheckingOutcome}
						onClick={onCheckOutcome}
						type="button"
					>
						{isCheckingOutcome
							? "Durum kontrol ediliyor…"
							: "Durumu kontrol et"}
					</Button>
				) : null}
				<Button
					className="signal-button"
					disabled={isPending || isOutcomeUncertain}
					type="submit"
				>
					{isPending ? "Oluşturuluyor…" : "Projeyi oluştur"}
				</Button>
			</form>
		</section>
	);
}

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

interface ProposalFormProps {
	onCheckCurrentState: () => Promise<boolean>;
	onRefresh: () => Promise<unknown>;
	project: ProjectContext;
	scopeCatalog: ProjectContextScopeCatalog;
}

function ProposalForm({
	onCheckCurrentState,
	onRefresh,
	project,
	scopeCatalog,
}: ProposalFormProps) {
	const [defaultScopeOption, ...otherScopeOptions] = createScopeOptions(
		project,
		scopeCatalog
	);
	const scopeOptions = [defaultScopeOption, ...otherScopeOptions];
	const [summary, setSummary] = useState("");
	const [changes, setChanges] = useState<ChangeDraft[]>(() => [
		newChangeDraft(
			availableRules(
				project.currentContextRevision,
				"add",
				defaultScopeOption.scope
			)[0]?.id ?? "",
			defaultScopeOption
		),
	]);
	const [formError, setFormError] = useState<string | null>(null);
	const [formStatus, setFormStatus] = useState<string | null>(null);
	const [writeOutcomeUncertain, setWriteOutcomeUncertain] = useState(false);
	const [isCheckingOutcome, setIsCheckingOutcome] = useState(false);
	const currentRevision = project.currentContextRevision;
	const supportedBaseRuleCount = STRUCTURED_CONTEXT_RULE_IDS.filter((ruleId) =>
		currentRevision.rules.some((rule) => rule.id === ruleId)
	).length;
	const createProposal = useMutation({
		meta: { errorPresentation: "inline" },
		mutationFn: (input: ContextProposalInput) =>
			client.contextProposals.create(input),
		onSuccess: async () => {
			setSummary("");
			setChanges([
				newChangeDraft(
					availableRules(currentRevision, "add", defaultScopeOption.scope)[0]
						?.id ?? "",
					defaultScopeOption
				),
			]);
			setFormError(null);
			await onRefresh();
			toast.success("Bağlam Önerisi kaydedildi.");
		},
		onError: (error) => {
			if (isWriteOutcomeUncertain(error)) {
				setWriteOutcomeUncertain(true);
			}
			setFormError(
				getErrorMessage(
					error,
					"Bağlam Önerisi işleminin sonucu doğrulanamadı. Öneri kaydını kontrol edin."
				)
			);
		},
	});

	async function checkCurrentState() {
		setIsCheckingOutcome(true);
		try {
			const failed = await onCheckCurrentState();
			if (failed) {
				setFormError(
					"Öneri durumu doğrulanamadı. Yeniden göndermeden önce öneri listesini yenileyin."
				);
				return;
			}
			setWriteOutcomeUncertain(false);
			setFormError(null);
			setFormStatus("Öneri listesi yenilendi. Kaydı kontrol edin.");
		} finally {
			setIsCheckingOutcome(false);
		}
	}

	function updateChange(id: string, patch: Partial<ChangeDraft>) {
		setChanges((current) =>
			current.map((change) =>
				change.id === id ? { ...change, ...patch } : change
			)
		);
	}

	function submitProposal(event: SyntheticEvent<HTMLFormElement>) {
		event.preventDefault();
		if (writeOutcomeUncertain) {
			return;
		}
		setFormError(null);
		setFormStatus(null);
		createProposal.mutate({
			projectId: project.id,
			baseContextRevisionId: currentRevision.id,
			summary,
			changes: changes.map((change) =>
				toContextRuleChange(change, currentRevision.rules)
			),
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
							scopeOptions={scopeOptions}
						/>
					))}
				</div>
				<Button
					className="add-change"
					onClick={() =>
						setChanges((current) => [
							...current,
							newChangeDraft(
								availableRules(
									currentRevision,
									"add",
									defaultScopeOption.scope
								)[0]?.id ?? "",
								defaultScopeOption
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
				{writeOutcomeUncertain ? (
					<Button
						className="quiet-button"
						disabled={isCheckingOutcome}
						onClick={() => void checkCurrentState()}
						type="button"
					>
						{isCheckingOutcome
							? "Durum kontrol ediliyor…"
							: "Durumu kontrol et"}
					</Button>
				) : null}
				{formStatus ? (
					<p className="context-notice" role="status">
						{formStatus}
					</p>
				) : null}
				<Button
					className="signal-button submit-proposal"
					disabled={createProposal.isPending || writeOutcomeUncertain}
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

interface ScopeOption {
	label: string;
	precedenceChain: ContextScope[];
	scope: ContextScope;
}

interface RuleDraftCardProps {
	baseRevision: ContextRevision;
	canRemove: boolean;
	change: ChangeDraft;
	index: number;
	onChange: (patch: Partial<ChangeDraft>) => void;
	onRemove: () => void;
	scopeOptions: ScopeOption[];
}

function RuleDraftCard({
	baseRevision,
	canRemove,
	change,
	index,
	scopeOptions,
	onChange,
	onRemove,
}: RuleDraftCardProps) {
	const operationRules = availableRules(
		baseRevision,
		change.operation,
		change.scope
	);
	const addRules = availableRules(baseRevision, "add", change.scope);
	const existingRules = availableRules(baseRevision, "replace", change.scope);
	const selectedScopeOption = scopeOptions.find((option) =>
		sameScope(option.scope, change.scope)
	);
	const inheritedRule = findNearestInheritedContextRule(
		change.ruleId,
		change.scope,
		change.precedenceChain,
		baseRevision.rules
	);
	const valueType = structuredValueType(change.ruleId);

	function changeOperation(operation: ChangeDraft["operation"]) {
		const rules = availableRules(baseRevision, operation, change.scope);
		const ruleId = rules.some((rule) => rule.id === change.ruleId)
			? change.ruleId
			: (rules[0]?.id ?? "");
		onChange({
			operation,
			ruleId,
			value: "",
			isOverride: operation === "add" ? false : currentRuleOverride(ruleId),
		});
	}

	function currentRuleOverride(
		ruleId: string,
		scope: ContextScope = change.scope,
		precedenceChain: ContextScope[] = change.precedenceChain
	) {
		const baseRule = baseRevision.rules.find(
			(rule) => rule.id === ruleId && sameScope(rule.scope, scope)
		);
		const nearestInherited = findNearestInheritedContextRule(
			ruleId,
			scope,
			precedenceChain,
			baseRevision.rules
		);
		return Boolean(
			nearestInherited && baseRule?.supersedesRuleId === nearestInherited.id
		);
	}

	function changeScope(scopeKey: string) {
		const option = scopeOptions.find(
			(candidate) => scopeKeyFrom(candidate.scope) === scopeKey
		);
		if (!option) {
			return;
		}
		const operation =
			change.operation !== "add" &&
			availableRules(baseRevision, change.operation, option.scope).length === 0
				? "add"
				: change.operation;
		const rules = availableRules(baseRevision, operation, option.scope);
		const ruleId = rules[0]?.id ?? "";
		onChange({
			operation,
			scope: option.scope,
			precedenceChain: option.precedenceChain,
			ruleId,
			value: "",
			isOverride: currentRuleOverride(
				ruleId,
				option.scope,
				option.precedenceChain
			),
		});
	}

	function changeRule(ruleId: string) {
		onChange({
			ruleId,
			value: "",
			isOverride: currentRuleOverride(ruleId),
		});
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
				<span>Kapsam</span>
				<select
					aria-label={`Değişiklik ${index + 1} kapsamı`}
					onChange={(event) => changeScope(event.target.value)}
					value={scopeKeyFrom(change.scope)}
				>
					{scopeOptions.map((option) => (
						<option
							key={scopeKeyFrom(option.scope)}
							value={scopeKeyFrom(option.scope)}
						>
							{option.label}
						</option>
					))}
				</select>
				{selectedScopeOption ? (
					<span className="field-hint">
						Öncelik:{" "}
						{selectedScopeOption.precedenceChain
							.map((scope) => scopeOptionLabel(scope, scopeOptions))
							.join(" → ")}
					</span>
				) : null}
			</label>
			<label className="context-field">
				<span>Kural</span>
				<select
					aria-label={`Değişiklik ${index + 1} kuralı`}
					onChange={(event) => changeRule(event.target.value)}
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
						? "Yalnızca bu kapsamda henüz tanımlanmamış yaygın kurallar eklenebilir."
						: `Bağlam Sürümü ${baseRevision.revisionNumber} içindeki bu kapsama ait bir kural seçilir.`}
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
			{inheritedRule && change.operation !== "remove" ? (
				<label className="override-control">
					<input
						checked={change.isOverride}
						onChange={(event) => onChange({ isOverride: event.target.checked })}
						type="checkbox"
					/>
					<span>
						<strong>Bağlam Kuralı İstisnası</strong>
						<small>
							{change.ruleId} ·{" "}
							{scopeOptionLabel(inheritedRule.scope, scopeOptions)}
							kuralını geçersiz kılar
						</small>
					</span>
				</label>
			) : null}
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
			setReview(
				await client.contextProposals.review({
					projectId: project.id,
					proposalId: proposal.id,
				})
			);
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
	activationError,
	currentRevisionId,
	isActivating,
	isCurrent,
	onActivate,
	projectName,
	review,
	scopeCatalog,
}: {
	activationError?: string;
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
			{activationError ? (
				<p className="context-error" role="alert">
					Etkinleştirme tamamlanamadı. {activationError} İncelemeyi yenileyip
					tekrar deneyin.
				</p>
			) : null}
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

function availableRules(
	baseRevision: ContextRevision,
	operation: ChangeDraft["operation"],
	scope: ContextScope
) {
	const existingRuleIds = new Set(
		baseRevision.rules
			.filter((rule) => sameScope(rule.scope, scope))
			.map((rule) => rule.id)
	);
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

function newChangeDraft(ruleId: string, scopeOption: ScopeOption): ChangeDraft {
	return {
		id: crypto.randomUUID(),
		operation: "add",
		ruleId,
		scope: scopeOption.scope,
		precedenceChain: scopeOption.precedenceChain,
		isOverride: false,
		value: "",
		rationale: "",
		evidenceKind: "user_decision",
		evidence: "",
	};
}

function toContextRuleChange(
	change: ChangeDraft,
	baseRules: ContextRule[]
): ContextRuleChange {
	const shared = {
		ruleId: change.ruleId,
		scope: change.scope,
		precedenceChain: change.precedenceChain,
		rationale: change.rationale,
		evidence: [
			{ kind: change.evidenceKind, statement: change.evidence },
		] as ContextRuleChange["evidence"],
	};
	if (change.operation === "remove") {
		return { operation: "remove", ...shared };
	}
	const inheritedRule = findNearestInheritedContextRule(
		change.ruleId,
		change.scope,
		change.precedenceChain,
		baseRules
	);
	return {
		operation: change.operation,
		...shared,
		supersedesRuleId:
			change.isOverride && inheritedRule ? inheritedRule.id : null,
		value: parseRuleValue(change.value, structuredValueType(change.ruleId)),
	};
}

function createScopeOptions(
	project: ProjectContext,
	scopeCatalog: ProjectContextScopeCatalog
): [ScopeOption, ...ScopeOption[]] {
	const projectScope: ContextScope = { kind: "project", id: project.id };
	const projectOption: ScopeOption = {
		label: `Proje · ${project.name}`,
		scope: projectScope,
		precedenceChain: [projectScope],
	};
	const visualWorldOptions = scopeCatalog.visualWorlds
		.filter((visualWorld) => visualWorld.projectId === project.id)
		.map((visualWorld) => {
			const scope: ContextScope = {
				kind: "visual_world",
				id: visualWorld.id,
			};
			return {
				label: `Görsel Dünya · ${visualWorld.name}`,
				scope,
				precedenceChain: [scope, projectScope],
			};
		});
	const themeOptions = scopeCatalog.themes.flatMap((theme) => {
		const visualWorld = scopeCatalog.visualWorlds.find(
			(candidate) =>
				candidate.id === theme.visualWorldId &&
				candidate.projectId === project.id
		);
		if (theme.projectId !== project.id || !visualWorld) {
			return [];
		}
		const scope: ContextScope = { kind: "theme", id: theme.id };
		const visualWorldScope: ContextScope = {
			kind: "visual_world",
			id: visualWorld.id,
		};
		return [
			{
				label: `Tema · ${visualWorld.name} / ${theme.name}`,
				scope,
				precedenceChain: [scope, visualWorldScope, projectScope],
			},
		];
	});
	return [projectOption, ...visualWorldOptions, ...themeOptions];
}

function sameScope(left: ContextScope, right: ContextScope) {
	return left.kind === right.kind && left.id === right.id;
}

function scopeKeyFrom(scope: ContextScope) {
	return `${scope.kind}:${scope.id}`;
}

function scopeOptionLabel(scope: ContextScope, options: ScopeOption[]) {
	const matchingOption = options.find((option) =>
		sameScope(option.scope, scope)
	);
	if (matchingOption) {
		return matchingOption.label;
	}
	const labels: Record<ContextScope["kind"], string> = {
		project: "Proje",
		visual_world: "Görsel Dünya",
		theme: "Tema",
		asset_family: "Varlık Ailesi",
		asset: "Varlık",
		operation: "İşlem",
	};
	return scope.kind === "project"
		? labels.project
		: `${labels[scope.kind]} · ${scope.id}`;
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

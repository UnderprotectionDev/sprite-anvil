import type { ProjectContextScopeCatalog } from "@sprite-anvil/api/context-scopes";
import type {
	ContextProposalInput,
	ContextRevision,
	ContextRule,
	ContextRuleChange,
	ContextRuleValue,
	ContextScope,
	ProjectContext,
	StructuredContextRuleId,
} from "@sprite-anvil/api/project-context";
import {
	findNearestInheritedContextRule,
	STRUCTURED_CONTEXT_RULE_IDS,
	STRUCTURED_CONTEXT_RULES,
} from "@sprite-anvil/api/project-context";
import { Button } from "@sprite-anvil/ui/components/button";
import { useMutation } from "@tanstack/react-query";
import { Plus, Send, Trash2 } from "lucide-react";
import { type SyntheticEvent, useState } from "react";
import { toast } from "sonner";
import { isWriteOutcomeUncertain } from "@/utils/error-notification";
import { client } from "@/utils/orpc";

export type EvidenceKind = "user_decision" | "observed_change";
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

interface ProposalFormProps {
	onCheckCurrentState: () => Promise<boolean>;
	onRefresh: () => Promise<unknown>;
	project: ProjectContext;
	scopeCatalog: ProjectContextScopeCatalog;
}

export function ProposalForm({
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
	const [formStatus, setFormStatus] = useState<string | null>(null);
	const [writeOutcomeUncertain, setWriteOutcomeUncertain] = useState(false);
	const [isCheckingOutcome, setIsCheckingOutcome] = useState(false);
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
				newChangeDraft(
					availableRules(currentRevision, "add", defaultScopeOption.scope)[0]
						?.id ?? "",
					defaultScopeOption
				),
			]);
			await onRefresh();
			toast.success("Bağlam Önerisi kaydedildi.");
		},
		onError: (error) => {
			if (isWriteOutcomeUncertain(error)) {
				setWriteOutcomeUncertain(true);
			}
		},
	});

	async function checkCurrentState() {
		setIsCheckingOutcome(true);
		try {
			const failed = await onCheckCurrentState();
			if (failed) {
				return;
			}
			setWriteOutcomeUncertain(false);
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

export function operationLabel(operation: ChangeDraft["operation"]) {
	if (operation === "replace") {
		return "Değiştirme";
	}
	if (operation === "remove") {
		return "Kaldırma";
	}
	return "Ekleme";
}

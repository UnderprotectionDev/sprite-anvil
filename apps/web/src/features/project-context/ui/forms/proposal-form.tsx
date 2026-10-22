import type { ProjectContextScopeCatalog } from "@sprite-anvil/api/context-scopes";
import type {
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
import { Checkbox } from "@sprite-anvil/ui/components/checkbox";
import { FieldLegend, FieldSet } from "@sprite-anvil/ui/components/field";
import { Input } from "@sprite-anvil/ui/components/input";
import { Label } from "@sprite-anvil/ui/components/label";
import {
	NativeSelect,
	NativeSelectOption,
} from "@sprite-anvil/ui/components/native-select";
import { Textarea } from "@sprite-anvil/ui/components/textarea";
import { useForm } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import { Plus, Send, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { isWriteOutcomeUncertain } from "@/utils/error-notification";
import { orpc } from "@/utils/orpc";
import {
	type ProposalChangeDraft,
	type ProposalFormValues,
	proposalFormSchema,
} from "../../schemas";

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

type ChangeDraft = ProposalChangeDraft;

const fieldLabelClass = "context-field leading-[inherit]";
const fullWidthSelectClass = "w-full";

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
	const currentRevision = project.currentContextRevision;
	const createDraft = () =>
		newChangeDraft(
			availableRules(currentRevision, "add", defaultScopeOption.scope)[0]?.id ??
				"",
			defaultScopeOption
		);
	const [initialValues] = useState<ProposalFormValues>(() => ({
		summary: "",
		changes: [createDraft()],
	}));
	const form = useForm({
		defaultValues: initialValues,
		onSubmit: ({ value }) => {
			if (writeOutcomeUncertain) {
				return;
			}
			setFormStatus(null);
			createProposal.mutate({
				projectId: project.id,
				baseContextRevisionId: currentRevision.id,
				summary: value.summary,
				changes: value.changes.map((change) =>
					toContextRuleChange(change, currentRevision.rules)
				),
			});
		},
		validators: { onSubmit: proposalFormSchema },
	});
	const [formStatus, setFormStatus] = useState<string | null>(null);
	const [writeOutcomeUncertain, setWriteOutcomeUncertain] = useState(false);
	const [isCheckingOutcome, setIsCheckingOutcome] = useState(false);
	const supportedBaseRuleCount = STRUCTURED_CONTEXT_RULE_IDS.filter((ruleId) =>
		currentRevision.rules.some((rule) => rule.id === ruleId)
	).length;
	const createProposal = useMutation(
		orpc.contextProposals.create.mutationOptions({
			onSuccess: async () => {
				form.reset();
				await onRefresh();
				toast.success("Bağlam Önerisi kaydedildi.");
			},
			onError: (error) => {
				if (isWriteOutcomeUncertain(error)) {
					setWriteOutcomeUncertain(true);
				}
			},
		})
	);

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
			<form
				className="context-form"
				onSubmit={(event) => {
					event.preventDefault();
					event.stopPropagation();
					form.handleSubmit();
				}}
			>
				<form.Field name="summary">
					{(field) => (
						<Label className={fieldLabelClass}>
							<span>Öneri özeti</span>
							<Input
								maxLength={240}
								name={field.name}
								onBlur={field.handleBlur}
								onChange={(event) => field.handleChange(event.target.value)}
								placeholder="Örn. Karakter paletini sadeleştirme"
								required
								value={field.state.value}
							/>
						</Label>
					)}
				</form.Field>
				<form.Field mode="array" name="changes">
					{(changesField) => (
						<>
							<div className="rule-list-heading">
								<h3>Önerilen kural değişiklikleri</h3>
								<span>{changesField.state.value.length} değişiklik</span>
							</div>
							<div className="rule-drafts">
								{changesField.state.value.map((draft, index) => (
									<form.Field key={draft.id} name={`changes[${index}]`}>
										{(changeField) => (
											<RuleDraftCard
												baseRevision={currentRevision}
												canRemove={changesField.state.value.length > 1}
												change={changeField.state.value}
												index={index}
												onChange={(patch) =>
													changeField.handleChange({
														...changeField.state.value,
														...patch,
													})
												}
												onRemove={() => changesField.removeValue(index)}
												scopeOptions={scopeOptions}
											/>
										)}
									</form.Field>
								))}
							</div>
							<Button
								className="add-change"
								onClick={() => changesField.pushValue(createDraft())}
								type="button"
							>
								<Plus aria-hidden="true" size={15} />
								Başka kural değişikliği ekle
							</Button>
						</>
					)}
				</form.Field>
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
		<FieldSet className="rule-card">
			<FieldLegend>
				<span className="rule-card-number">
					{String(index + 1).padStart(2, "0")}
				</span>
				{operationLabel(change.operation)}
			</FieldLegend>
			<Label className={fieldLabelClass}>
				<span>İşlem</span>
				<NativeSelect
					aria-label={`Değişiklik ${index + 1} işlemi`}
					className={fullWidthSelectClass}
					onChange={(event) =>
						changeOperation(event.target.value as ChangeDraft["operation"])
					}
					value={change.operation}
				>
					<NativeSelectOption disabled={addRules.length === 0} value="add">
						Ekleme
					</NativeSelectOption>
					<NativeSelectOption
						disabled={existingRules.length === 0}
						value="replace"
					>
						Değiştirme
					</NativeSelectOption>
					<NativeSelectOption
						disabled={existingRules.length === 0}
						value="remove"
					>
						Kaldırma
					</NativeSelectOption>
				</NativeSelect>
			</Label>
			<Label className={fieldLabelClass}>
				<span>Kapsam</span>
				<NativeSelect
					aria-label={`Değişiklik ${index + 1} kapsamı`}
					className={fullWidthSelectClass}
					onChange={(event) => changeScope(event.target.value)}
					value={scopeKeyFrom(change.scope)}
				>
					{scopeOptions.map((option) => (
						<NativeSelectOption
							key={scopeKeyFrom(option.scope)}
							value={scopeKeyFrom(option.scope)}
						>
							{option.label}
						</NativeSelectOption>
					))}
				</NativeSelect>
				{selectedScopeOption ? (
					<span className="field-hint">
						Öncelik:{" "}
						{selectedScopeOption.precedenceChain
							.map((scope) => scopeOptionLabel(scope, scopeOptions))
							.join(" → ")}
					</span>
				) : null}
			</Label>
			<Label className={fieldLabelClass}>
				<span>Kural</span>
				<NativeSelect
					aria-label={`Değişiklik ${index + 1} kuralı`}
					className={fullWidthSelectClass}
					onChange={(event) => changeRule(event.target.value)}
					required
					value={change.ruleId}
				>
					<NativeSelectOption disabled value="">
						Kural seçin
					</NativeSelectOption>
					{operationRules.map((rule) => (
						<NativeSelectOption key={rule.id} value={rule.id}>
							{rule.label}
						</NativeSelectOption>
					))}
				</NativeSelect>
				<span className="field-hint">
					{change.operation === "add"
						? "Yalnızca bu kapsamda henüz tanımlanmamış yaygın kurallar eklenebilir."
						: `Bağlam Sürümü ${baseRevision.revisionNumber} içindeki bu kapsama ait bir kural seçilir.`}
				</span>
			</Label>
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
				<Label className="override-control leading-[inherit]">
					<Checkbox
						checked={change.isOverride}
						onCheckedChange={(checked) => onChange({ isOverride: checked })}
					/>
					<span>
						<strong>Bağlam Kuralı İstisnası</strong>
						<small>
							{change.ruleId} ·{" "}
							{scopeOptionLabel(inheritedRule.scope, scopeOptions)}
							kuralını geçersiz kılar
						</small>
					</span>
				</Label>
			) : null}
			<Label className={fieldLabelClass}>
				<span>Bu değişikliğin gerekçesi</span>
				<Textarea
					maxLength={2000}
					onChange={(event) => onChange({ rationale: event.target.value })}
					placeholder="Neden ekleniyor, değişiyor veya kaldırılıyor?"
					required
					rows={2}
					value={change.rationale}
				/>
			</Label>
			<div className="field-pair evidence-fields">
				<Label className={fieldLabelClass}>
					<span>Dayanak türü</span>
					<NativeSelect
						aria-label={`Değişiklik ${index + 1} dayanak türü`}
						className={fullWidthSelectClass}
						onChange={(event) =>
							onChange({
								evidenceKind: event.target.value as EvidenceKind,
							})
						}
						value={change.evidenceKind}
					>
						<NativeSelectOption value="user_decision">
							Kullanıcı kararı
						</NativeSelectOption>
						<NativeSelectOption value="observed_change">
							Gözlenen değişiklik
						</NativeSelectOption>
					</NativeSelect>
				</Label>
				<Label className={fieldLabelClass}>
					<span>Kanıt</span>
					<Textarea
						maxLength={1000}
						onChange={(event) => onChange({ evidence: event.target.value })}
						placeholder="Kararı veya projede görülen değişikliği açıklayın."
						required
						rows={2}
						value={change.evidence}
					/>
				</Label>
			</div>
			{canRemove ? (
				<Button className="remove-change" onClick={onRemove} type="button">
					<Trash2 aria-hidden="true" size={14} />
					Değişikliği kaldır
				</Button>
			) : null}
		</FieldSet>
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
			<Label htmlFor={inputId}>Kural değeri</Label>
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
			<Textarea
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
		<Input
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

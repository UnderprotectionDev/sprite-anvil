import type {
	ContextProposal,
	ContextProposalInput,
	ContextRuleChange,
	ContextRuleValue,
	ProjectContext,
	ProjectContextCreateInput,
} from "@sprite-anvil/api/project-context";
import { Button } from "@sprite-anvil/ui/components/button";
import { useMutation } from "@tanstack/react-query";
import { Plus, Send, Trash2 } from "lucide-react";
import { type ReactNode, type SyntheticEvent, useState } from "react";
import { toast } from "sonner";
import { client } from "@/utils/orpc";

type EvidenceKind = "user_decision" | "observed_change";
type ValueType = "text" | "number" | "boolean" | "text_list";

interface ChangeDraft {
	evidence: string;
	evidenceKind: EvidenceKind;
	id: string;
	operation: "add" | "replace" | "remove";
	rationale: string;
	ruleId: string;
	value: string;
	valueType: ValueType;
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
				<ProposalForm onRefresh={onRefreshProposals} project={project} />
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
		newChangeDraft(),
	]);
	const [formError, setFormError] = useState<string | null>(null);
	const createProposal = useMutation({
		mutationFn: (input: ContextProposalInput) =>
			client.contextProposals.create(input),
		onSuccess: async () => {
			setSummary("");
			setChanges([newChangeDraft()]);
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
			baseContextRevisionId: project.initialContextRevision.id,
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
					R{project.initialContextRevision.revisionNumber}
				</span>
				<div>
					<span className="stamp-label">DAYANAK BAĞLAM SÜRÜMÜ</span>
					<strong>Başlangıç sürümü</strong>
				</div>
				<span className="base-state">Etkin değil</span>
			</div>
			<p className="panel-copy">
				Her değişiklik için kuralı, gerekçeyi ve karar ya da gözlem kanıtını
				ekleyin. Bu ekran yapılandırılmış alanları kaydeder; ham{" "}
				<code>context.md</code> düzenlemez.
			</p>
			{changes.some((change) => change.operation !== "add") ? (
				<p className="context-notice" role="status">
					Başlangıç sürümü boş. Değiştirme ve kaldırma önerileri kaydedilir;
					eşleşen bir kural olmadığında çakışmalı olarak işaretlenir.
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
							baseRevisionNumber={project.initialContextRevision.revisionNumber}
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
						setChanges((current) => [...current, newChangeDraft()])
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
	baseRevisionNumber: number;
	canRemove: boolean;
	change: ChangeDraft;
	index: number;
	onChange: (patch: Partial<ChangeDraft>) => void;
	onRemove: () => void;
}

function RuleDraftCard({
	baseRevisionNumber,
	canRemove,
	change,
	index,
	onChange,
	onRemove,
}: RuleDraftCardProps) {
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
						onChange({
							operation: event.target.value as ChangeDraft["operation"],
						})
					}
					value={change.operation}
				>
					<option value="add">Ekleme</option>
					<option value="replace">Değiştirme</option>
					<option value="remove">Kaldırma</option>
				</select>
			</label>
			<label className="context-field">
				<span>Kural anahtarı</span>
				<input
					autoComplete="off"
					maxLength={128}
					onChange={(event) => onChange({ ruleId: event.target.value })}
					pattern="[a-z][a-z0-9._-]*"
					placeholder="palette.character"
					required
					value={change.ruleId}
				/>
				<span className="field-hint">
					{change.operation === "add"
						? "Bu kimlik sonraki sürümlerde de aynı kuralı tanımlar."
						: `Bağlam Sürümü ${baseRevisionNumber} içinde bu kimlikte bir kural bulunmalıdır.`}
				</span>
			</label>
			{change.operation === "remove" ? (
				<p className="field-hint">
					Kaldırma işlemi taban sürümdeki kuralı hedefler; yeni bir değer
					gerekmez.
				</p>
			) : (
				<div className="field-pair">
					<label className="context-field">
						<span>Değer türü</span>
						<select
							aria-label={`Değişiklik ${index + 1} değer türü`}
							onChange={(event) =>
								onChange({
									valueType: event.target.value as ValueType,
									value: "",
								})
							}
							value={change.valueType}
						>
							<option value="text">Metin</option>
							<option value="number">Sayı</option>
							<option value="boolean">Evet / Hayır</option>
							<option value="text_list">Metin listesi</option>
						</select>
					</label>
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
				change={change}
				id={inputId}
				index={index}
				onChange={(value) => onChange({ value })}
			/>
		</div>
	);
}

interface RuleValueControlProps {
	change: ChangeDraft;
	id: string;
	index: number;
	onChange: (value: string) => void;
}

function RuleValueControl({
	change,
	id,
	index,
	onChange,
}: RuleValueControlProps) {
	if (change.valueType === "text_list") {
		return (
			<textarea
				aria-label={`Değişiklik ${index + 1} kural değeri`}
				id={id}
				onChange={(event) => onChange(event.target.value)}
				placeholder="Her satıra bir değer yazın"
				required
				rows={2}
				value={change.value}
			/>
		);
	}
	if (change.valueType === "boolean") {
		return (
			<select
				aria-label={`Değişiklik ${index + 1} kural değeri`}
				id={id}
				onChange={(event) => onChange(event.target.value)}
				required
				value={change.value}
			>
				<option disabled value="">
					Seçin
				</option>
				<option value="true">Evet</option>
				<option value="false">Hayır</option>
			</select>
		);
	}
	return (
		<input
			aria-label={`Değişiklik ${index + 1} kural değeri`}
			id={id}
			max={change.valueType === "number" ? "1000000000" : undefined}
			maxLength={change.valueType === "text" ? 2000 : undefined}
			min={change.valueType === "number" ? "-1000000000" : undefined}
			onChange={(event) => onChange(event.target.value)}
			placeholder={change.valueType === "number" ? "12" : "Karar verilen değer"}
			required
			type={change.valueType === "number" ? "number" : "text"}
			value={change.value}
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
					<ProposalRecord key={proposal.id} proposal={proposal} />
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

function ProposalRecord({ proposal }: { proposal: ContextProposal }) {
	const source =
		proposal.source.kind === "structured_control"
			? `Yapılandırılmış kontrol · ${proposal.source.controlId}`
			: `Bağlam ajanı · ${proposal.source.agentId} / ${proposal.source.modelId}`;

	return (
		<article className="proposal-record">
			<div className="proposal-record-top">
				<span>{new Date(proposal.createdAt).toLocaleString("tr-TR")}</span>
				<span
					className={proposal.validation.isValid ? "valid-tag" : "conflict-tag"}
				>
					{proposal.validation.isValid ? "Doğrulandı" : "Çakışma var"}
				</span>
			</div>
			<h3>{proposal.summary}</h3>
			<p className="proposal-source">Kaynak: {source}</p>
			<p className="proposal-base">
				Dayanak Bağlam Sürümü: {proposal.baseContextRevisionId}
			</p>
			<ul className="proposal-changes">
				{withOccurrenceKeys(proposal.changes, ruleChangeKey).map(
					({ item: change, key }) => (
						<li key={`${proposal.id}-${key}`}>
							<strong>
								{operationLabel(change.operation)} · {change.ruleId}
							</strong>
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
			<p className="proposal-gate">
				Hazırlandı; etkinleştirme için kullanıcı incelemesi gerekir.
			</p>
		</article>
	);
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

function newChangeDraft(): ChangeDraft {
	return {
		id: crypto.randomUUID(),
		operation: "add",
		ruleId: "",
		valueType: "text",
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
		value: parseRuleValue(change),
	};
}

function parseRuleValue(change: ChangeDraft): ContextRuleValue {
	switch (change.valueType) {
		case "number":
			return { type: "number", value: Number(change.value) };
		case "boolean":
			return { type: "boolean", value: change.value === "true" };
		case "text_list":
			return {
				type: "text_list",
				value: change.value
					.split("\n")
					.map((item) => item.trim())
					.filter(Boolean),
			};
		default:
			return { type: "text", value: change.value.trim() };
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

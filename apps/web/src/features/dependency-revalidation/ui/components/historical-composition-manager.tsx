import type {
	AssetVersionReviewEvent,
	CompositeVersionReviewEvent,
} from "@sprite-anvil/api/asset-versions";
import type { HistoricalCompositionInput } from "@sprite-anvil/api/historical-compositions";
import { Button } from "@sprite-anvil/ui/components/button";
import { useQuery } from "@tanstack/react-query";
import { useId, useState } from "react";
import { isWriteOutcomeUncertain } from "@/utils/error-notification";
import { getErrorMessage } from "@/utils/get-error-message";
import { client, orpc } from "@/utils/orpc";

interface Props {
	canonicalDesigns: { assetVersionId: string }[];
	composites: {
		id: string;
		assetRecordId: string;
		versionNumber: number;
		reviewEvents: CompositeVersionReviewEvent[];
	}[];
	projectId: string;
	records: { id: string; name: string }[];
	versions: {
		id: string;
		assetRecordId: string;
		versionNumber: number;
		reviewEvents?: AssetVersionReviewEvent[];
	}[];
}
type Selection = Omit<
	HistoricalCompositionInput,
	"projectId" | "idempotencyKey"
>;
const emptySelection: Selection = {
	compositeVersionId: "",
	contextRevisionId: "",
	canonicalDesignVersionId: "",
	dependencyLinkIds: [],
	dependencyVersionIds: [],
	readinessEvidenceIds: [],
	profileContractRevisionIds: [],
	reviewEventIds: [],
};

function HistoricalChoices({
	title,
	options,
	selected,
	disabled,
	onChange,
}: {
	title: string;
	options: { id: string; label: string }[];
	selected: string[];
	disabled: boolean;
	onChange: (ids: string[]) => void;
}) {
	return (
		<fieldset className="space-y-2 rounded border p-3" disabled={disabled}>
			<legend>{title}</legend>
			{options.length === 0 ? (
				<p>Seçilebilir kayıt yok; eksik kanıt raporda engel olarak görünür.</p>
			) : (
				options.map((option) => (
					<label className="flex items-start gap-2" key={option.id}>
						<input
							checked={selected.includes(option.id)}
							onChange={(event) =>
								onChange(
									event.target.checked
										? [...selected, option.id]
										: selected.filter((id) => id !== option.id)
								)
							}
							type="checkbox"
						/>
						<span>{option.label}</span>
					</label>
				))
			)}
		</fieldset>
	);
}

export function HistoricalCompositionManager({
	projectId,
	records,
	versions,
	composites,
	canonicalDesigns,
}: Props) {
	const identifier = useId();
	const catalog = useQuery(
		orpc.dependencyRevalidation.list.queryOptions({ input: { projectId } })
	);
	const history = useQuery(
		orpc.dependencyRevalidation.listHistoricalCompositions.queryOptions({
			input: { projectId },
		})
	);
	const options = useQuery(
		orpc.dependencyRevalidation.historicalCompositionOptions.queryOptions({
			input: { projectId },
		})
	);
	const [selection, setSelection] = useState<Selection>(emptySelection);
	const [pending, setPending] = useState<HistoricalCompositionInput | null>(
		null
	);
	const [busy, setBusy] = useState(false);
	const [message, setMessage] = useState("");
	const failedRead = catalog.isError || history.isError || options.isError;
	const loading = !(
		catalog.isSuccess &&
		history.isSuccess &&
		options.isSuccess
	);
	const disabled = busy || pending !== null || loading;
	const names = new Map(records.map((record) => [record.id, record.name]));
	const labels = new Map(
		versions.map((version) => [
			version.id,
			`${names.get(version.assetRecordId) ?? version.assetRecordId} · v${version.versionNumber}`,
		])
	);
	const compositeLabels = new Map(
		composites.map((composite) => [
			composite.id,
			`${names.get(composite.assetRecordId) ?? composite.assetRecordId} · Composite v${composite.versionNumber}`,
		])
	);
	const contexts = new Map(
		catalog.data?.contextRevisions.map((context) => [
			context.id,
			`Bağlam Sürümü ${context.revisionNumber}`,
		])
	);
	const selects = [
		{
			field: "compositeVersionId" as const,
			label: "Historical Composite Version",
			choices: composites.map((composite) => ({
				id: composite.id,
				label: compositeLabels.get(composite.id) ?? composite.id,
			})),
		},
		{
			field: "contextRevisionId" as const,
			label: "Historical Context Revision",
			choices: [...contexts].map(([id, label]) => ({ id, label })),
		},
		{
			field: "canonicalDesignVersionId" as const,
			label: "Historical Canonical Design",
			choices: [
				...new Set(canonicalDesigns.map((design) => design.assetVersionId)),
			].map((id) => ({ id, label: labels.get(id) ?? id })),
		},
	];
	const lists = [
		{
			field: "dependencyVersionIds" as const,
			title: "Historical dependency versions",
			choices: versions.map((version) => ({
				id: version.id,
				label: labels.get(version.id) ?? version.id,
			})),
		},
		{
			field: "dependencyLinkIds" as const,
			title: "Historical Dependency Links",
			choices:
				catalog.data?.dependencyLinks.map((link) => ({
					id: link.id,
					label: `${labels.get(link.source.id) ?? contexts.get(link.source.id) ?? link.source.id} → ${labels.get(link.targetAssetVersionId) ?? link.targetAssetVersionId} · ${link.facets.join(", ") || "eksik tanım"}`,
				})) ?? [],
		},
		{
			field: "profileContractRevisionIds" as const,
			title: "Historical Specialized Profile Contracts",
			choices:
				options.data?.contracts.map((contract) => ({
					id: contract.id,
					label: `${contract.name} · ${contract.id}`,
				})) ?? [],
		},
		{
			field: "readinessEvidenceIds" as const,
			title: "Historical quality and applicability evidence",
			choices:
				options.data?.evidence.map((evidence) => ({
					id: evidence.id,
					label: `${evidence.requirementId ?? evidence.kind} · ${evidence.result} · ${evidence.assetVersionIds.map((id) => labels.get(id) ?? id).join(", ")} · ${contexts.get(evidence.contextRevisionId ?? "") ?? "Bağlam yok"} · Ana Tasarım: ${labels.get(evidence.canonicalDesignVersionId ?? "") ?? "yok"} · ${evidence.versionTargetId ?? "tüm sürümler"} · ${evidence.createdAt}`,
				})) ?? [],
		},
		{
			field: "reviewEventIds" as const,
			title: "Historical Review Events",
			choices: [
				...versions.flatMap(
					(version) =>
						version.reviewEvents?.map((review) => ({
							id: review.id,
							label: `${labels.get(version.id)} · ${review.type} · ${review.createdAt}`,
						})) ?? []
				),
				...composites.flatMap((composite) =>
					composite.reviewEvents.map((review) => ({
						id: review.id,
						label: `${compositeLabels.get(composite.id)} · ${review.type} · ${review.createdAt}`,
					}))
				),
			],
		},
	];
	async function save() {
		if (busy || loading) {
			return;
		}
		const input = pending ?? {
			...selection,
			projectId,
			idempotencyKey: crypto.randomUUID(),
		};
		setPending(input);
		setBusy(true);
		setMessage("");
		try {
			await client.dependencyRevalidation.pinHistoricalComposition(input);
			setPending(null);
			const reread = await history.refetch();
			setMessage(
				reread.isError
					? "Tarihsel seçim kaydedildi, ancak rapor yeniden okunamadı. Refresh historical selections ile tekrar okuyun."
					: "Tarihsel seçim kaydedildi; güncel Yeniden Doğrulama Gerekli durumu değişmedi."
			);
		} catch (error) {
			if (
				!isWriteOutcomeUncertain(error) &&
				typeof error === "object" &&
				error !== null &&
				[
					"BAD_REQUEST",
					"NOT_FOUND",
					"UNAUTHORIZED",
					"FORBIDDEN",
					"CONFLICT",
				].includes(String(Reflect.get(error, "code")))
			) {
				setPending(null);
				setMessage(
					getErrorMessage(
						error,
						"Tarihsel seçim reddedildi. Seçiminizi düzeltip yeniden deneyin."
					)
				);
				return;
			}
			setMessage(
				"Kaydetme sonucu doğrulanamadı. Seçimi değiştirmeden yeniden deneyebilirsiniz."
			);
		} finally {
			setBusy(false);
		}
	}
	return (
		<section
			aria-labelledby={`${identifier}-heading`}
			className="space-y-4 rounded border p-4"
		>
			<h3 className="font-semibold" id={`${identifier}-heading`}>
				Tarihsel Bileşimi Sabitleme
			</h3>
			<p>
				Kesin Birleşik Sürümün birimleri korunur. Geçmiş bağlam, Ana Tasarım,
				bağımlılıklar, İnceleme Kayıtları ve kalite kanıtlarını açıkça seçin. Bu
				işlem paket üretmez veya güncel uygunluğu değiştirmez.
			</p>
			{failedRead ? (
				<p role="alert">Tarihsel seçim kayıtları okunamadı.</p>
			) : null}
			{loading && !failedRead ? (
				<p role="status">Tarihsel seçim kayıtları yükleniyor.</p>
			) : null}
			<form
				className="space-y-3"
				onSubmit={(event) => {
					event.preventDefault();
					save();
				}}
			>
				{selects.map((select) => (
					<div className="space-y-1" key={select.field}>
						<label htmlFor={`${identifier}-${select.field}`}>
							{select.label}
						</label>
						<select
							className="block w-full rounded border p-2"
							disabled={disabled}
							id={`${identifier}-${select.field}`}
							onChange={(event) =>
								setSelection({
									...selection,
									[select.field]: event.target.value,
								})
							}
							required
							value={selection[select.field]}
						>
							<option value="">Select an exact revision</option>
							{select.choices.map((choice) => (
								<option key={choice.id} value={choice.id}>
									{choice.label}
								</option>
							))}
						</select>
					</div>
				))}
				{lists.map((list) => (
					<HistoricalChoices
						disabled={disabled}
						key={list.field}
						onChange={(ids) =>
							setSelection({ ...selection, [list.field]: ids })
						}
						options={list.choices}
						selected={selection[list.field]}
						title={list.title}
					/>
				))}
				<Button
					disabled={
						busy ||
						loading ||
						!selection.compositeVersionId ||
						!selection.contextRevisionId ||
						!selection.canonicalDesignVersionId
					}
					type="submit"
				>
					{pending ? "Retry historical pin" : "Pin historical composition"}
				</Button>
			</form>
			{message ? <p role="status">{message}</p> : null}
			<Button
				disabled={busy}
				onClick={() =>
					Promise.all([history.refetch(), options.refetch(), catalog.refetch()])
				}
				type="button"
				variant="outline"
			>
				Refresh historical selections
			</Button>
			{history.data?.pins.map((pin) => (
				<article className="space-y-2 rounded border p-3" key={pin.id}>
					<h4>Uyumluluk raporu · Tarihsel seçim</h4>
					<p>
						{compositeLabels.get(pin.selection.compositeVersionId) ??
							pin.selection.compositeVersionId}{" "}
						·{" "}
						{contexts.get(pin.selection.contextRevisionId) ??
							pin.selection.contextRevisionId}{" "}
						· Ana Tasarım:{" "}
						{labels.get(pin.selection.canonicalDesignVersionId) ??
							pin.selection.canonicalDesignVersionId}
					</p>
					<p>
						{pin.report.exportEligible
							? "Sabitlenmiş tarihsel bileşim için koşullar karşılandı; paket henüz üretilmedi."
							: "Engeller çözülmeden bu bileşim paketlenemez."}
					</p>
					<p>Birim Sürümleri: {pin.unitVersionIds.join(", ")}</p>
					{lists.map((list) => (
						<p key={list.field}>
							{list.title}:{" "}
							{pin.selection[list.field]
								.map(
									(id) =>
										list.choices.find((choice) => choice.id === id)?.label ?? id
								)
								.join("; ") || "Seçilmedi"}
						</p>
					))}
					<ul>
						{pin.report.blockers.map((blocker) => (
							<li
								key={`${blocker.code}-${blocker.targetId}-${blocker.message}`}
							>
								{blocker.message}
							</li>
						))}
					</ul>
				</article>
			))}
		</section>
	);
}

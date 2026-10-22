import type {
	AssetVersionReviewEvent,
	CompositeVersionReviewEvent,
} from "@sprite-anvil/api/asset-versions";
import type { HistoricalCompositionInput } from "@sprite-anvil/api/historical-compositions";
import { Button } from "@sprite-anvil/ui/components/button";
import { Checkbox } from "@sprite-anvil/ui/components/checkbox";
import { FieldLegend, FieldSet } from "@sprite-anvil/ui/components/field";
import { Label } from "@sprite-anvil/ui/components/label";
import {
	NativeSelect,
	NativeSelectOption,
} from "@sprite-anvil/ui/components/native-select";
import { useForm, useStore } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";
import { isWriteOutcomeUncertain } from "@/utils/error-notification";
import { getErrorMessage } from "@/utils/get-error-message";
import { orpc } from "@/utils/orpc";
import { historicalCompositionFormSchema } from "../../schemas";

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
	field,
	disabled,
}: {
	title: string;
	options: { id: string; label: string }[];
	field: { handleChange: (ids: string[]) => void; state: { value: string[] } };
	disabled: boolean;
}) {
	const selected = field.state.value;
	return (
		<FieldSet className="space-y-2 rounded border p-3" disabled={disabled}>
			<FieldLegend>{title}</FieldLegend>
			{options.length === 0 ? (
				<p>Seçilebilir kayıt yok; eksik kanıt raporda engel olarak görünür.</p>
			) : (
				options.map((option) => (
					<Label className="flex items-start gap-2" key={option.id}>
						<Checkbox
							checked={selected.includes(option.id)}
							disabled={disabled}
							onCheckedChange={(checked) =>
								field.handleChange(
									checked
										? [...selected, option.id]
										: selected.filter((id) => id !== option.id)
								)
							}
						/>
						<span>{option.label}</span>
					</Label>
				))
			)}
		</FieldSet>
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
	const queryClient = useQueryClient();
	const pinMutation = useMutation(
		orpc.dependencyRevalidation.pinHistoricalComposition.mutationOptions()
	);
	const form = useForm({
		defaultValues: emptySelection,
		onSubmit: ({ value }) => save(value),
		validators: { onSubmit: historicalCompositionFormSchema },
	});
	const selection = useStore(form.store, (state) => state.values);
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
			`${names.get(composite.assetRecordId) ?? composite.assetRecordId} · Birleşik Sürüm v${composite.versionNumber}`,
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
			label: "Tarihsel Birleşik Sürüm",
			choices: composites.map((composite) => ({
				id: composite.id,
				label: compositeLabels.get(composite.id) ?? composite.id,
			})),
		},
		{
			field: "contextRevisionId" as const,
			label: "Tarihsel Bağlam Sürümü",
			choices: [...contexts].map(([id, label]) => ({ id, label })),
		},
		{
			field: "canonicalDesignVersionId" as const,
			label: "Tarihsel Ana Tasarım",
			choices: [
				...new Set(canonicalDesigns.map((design) => design.assetVersionId)),
			].map((id) => ({ id, label: labels.get(id) ?? id })),
		},
	];
	const lists = [
		{
			field: "dependencyVersionIds" as const,
			title: "Tarihsel bağımlılık Varlık Sürümleri",
			choices: versions.map((version) => ({
				id: version.id,
				label: labels.get(version.id) ?? version.id,
			})),
		},
		{
			field: "dependencyLinkIds" as const,
			title: "Tarihsel Bağımlılık Bağlantıları",
			choices:
				catalog.data?.dependencyLinks.map((link) => ({
					id: link.id,
					label: `${labels.get(link.source.id) ?? contexts.get(link.source.id) ?? link.source.id} → ${labels.get(link.targetAssetVersionId) ?? link.targetAssetVersionId} · ${link.facets.join(", ") || "eksik tanım"}`,
				})) ?? [],
		},
		{
			field: "profileContractRevisionIds" as const,
			title: "Tarihsel Özel Profil Sözleşmeleri",
			choices:
				options.data?.contracts.map((contract) => ({
					id: contract.id,
					label: `${contract.name} · ${contract.id}`,
				})) ?? [],
		},
		{
			field: "readinessEvidenceIds" as const,
			title: "Tarihsel kalite ve uygunluk kanıtları",
			choices:
				options.data?.evidence.map((evidence) => ({
					id: evidence.id,
					label: `${evidence.requirementId ?? evidence.kind} · ${evidence.result} · ${evidence.assetVersionIds.map((id) => labels.get(id) ?? id).join(", ")} · ${contexts.get(evidence.contextRevisionId ?? "") ?? "Bağlam yok"} · Ana Tasarım: ${labels.get(evidence.canonicalDesignVersionId ?? "") ?? "yok"} · ${evidence.versionTargetId ?? "tüm sürümler"} · ${evidence.createdAt}`,
				})) ?? [],
		},
		{
			field: "reviewEventIds" as const,
			title: "Tarihsel İnceleme Kayıtları",
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
	async function save(values: Selection) {
		if (busy || loading) {
			return;
		}
		const input = pending ?? {
			...values,
			projectId,
			idempotencyKey: crypto.randomUUID(),
		};
		setPending(input);
		setBusy(true);
		setMessage("");
		try {
			await pinMutation.mutateAsync(input);
			setPending(null);
			let rereadFailed = false;
			try {
				await queryClient.invalidateQueries(
					{
						queryKey:
							orpc.dependencyRevalidation.listHistoricalCompositions.queryKey({
								input: { projectId },
							}),
					},
					{ throwOnError: true }
				);
			} catch {
				rereadFailed = true;
			}
			setMessage(
				rereadFailed
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
					event.stopPropagation();
					void form.handleSubmit();
				}}
			>
				{selects.map((select) => (
					<form.Field key={select.field} name={select.field}>
						{(field) => (
							<div className="space-y-1">
								<Label htmlFor={`${identifier}-${select.field}`}>
									{select.label}
								</Label>
								<NativeSelect
									className="block w-full"
									disabled={disabled}
									id={`${identifier}-${select.field}`}
									onChange={(event) => field.handleChange(event.target.value)}
									required
									value={field.state.value}
								>
									<NativeSelectOption value="">
										Kesin sürüm seçin
									</NativeSelectOption>
									{select.choices.map((choice) => (
										<NativeSelectOption key={choice.id} value={choice.id}>
											{choice.label}
										</NativeSelectOption>
									))}
								</NativeSelect>
							</div>
						)}
					</form.Field>
				))}
				{lists.map((list) => (
					<form.Field key={list.field} name={list.field}>
						{(field) => (
							<HistoricalChoices
								disabled={disabled}
								field={field}
								options={list.choices}
								title={list.title}
							/>
						)}
					</form.Field>
				))}
				<Button
					disabled={
						busy ||
						loading ||
						!historicalCompositionFormSchema.safeParse(selection).success
					}
					type="submit"
				>
					{pending
						? "Tarihsel sabitlemeyi yeniden dene"
						: "Tarihsel bileşimi sabitle"}
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
				Tarihsel seçimleri yenile
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

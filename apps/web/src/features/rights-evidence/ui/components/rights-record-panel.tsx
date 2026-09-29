import {
	type RightsRecord,
	type RightsRecordCreateInput,
	type RightsRecordState,
	rightsRecordStates,
} from "@sprite-anvil/api/rights-records";
import { Button } from "@sprite-anvil/ui/components/button";
import { Input } from "@sprite-anvil/ui/components/input";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type SyntheticEvent, useEffect, useRef, useState } from "react";
import {
	isWriteOutcomeUncertain,
	QueryRetryButton,
} from "@/utils/error-notification";
import { getErrorMessage } from "@/utils/get-error-message";
import { client, orpc } from "@/utils/orpc";

const stateLabels: Record<RightsRecordState, string> = {
	assertion_only: "Yalnız Beyan",
	documented: "Belgelendi",
	restricted: "Kısıtlı",
	unknown: "Bilinmiyor",
};
const documentedEvidenceError =
	"Belgelendi durumunda destekleyici kanıt gerekir.";
const restrictedRestrictionsError =
	"Kısıtlı durumunda bilinen en az bir kısıt gerekir.";
type RightsRecordValidationField = "evidence" | "restrictions";

interface RightsRecordDraft {
	assertedScope: string;
	evidence: string;
	restrictions: string;
	rightsHolderOrProvider: string;
	source: string;
	state: RightsRecordState;
	uncertainty: string;
}

const emptyDraft: RightsRecordDraft = {
	assertedScope: "",
	evidence: "",
	restrictions: "",
	rightsHolderOrProvider: "",
	source: "",
	state: "unknown",
	uncertainty: "",
};

function draftFromRightsRecord(record: RightsRecord): RightsRecordDraft {
	return {
		assertedScope: record.assertedScope ?? "",
		evidence: record.evidence ?? "",
		restrictions: record.restrictions ?? "",
		rightsHolderOrProvider: record.rightsHolderOrProvider ?? "",
		source: record.source ?? "",
		state: record.state,
		uncertainty: record.uncertainty ?? "",
	};
}

const textFields = [
	{
		key: "source",
		label: "Kaynak",
		multiline: true,
	},
	{
		key: "rightsHolderOrProvider",
		label: "Hak sahibi veya sağlayıcı",
		multiline: false,
	},
	{
		key: "assertedScope",
		label: "Beyan edilen izin kapsamı",
		multiline: true,
	},
	{
		key: "evidence",
		label: "Hak kaydını destekleyen kanıt",
		multiline: true,
	},
	{
		key: "restrictions",
		label: "Bilinen kısıtlar",
		multiline: true,
	},
	{
		key: "uncertainty",
		label: "Belirsizlik",
		multiline: true,
	},
] as const satisfies ReadonlyArray<{
	key: Exclude<keyof RightsRecordDraft, "state">;
	label: string;
	multiline: boolean;
}>;

function normalizeInputText(value: string) {
	return value.trim() || null;
}

function getDraftValidationErrors(draft: RightsRecordDraft) {
	const errors: Partial<Record<RightsRecordValidationField, string>> = {};
	if (draft.state === "documented" && !draft.evidence.trim()) {
		errors.evidence = documentedEvidenceError;
	}
	if (draft.state === "restricted" && !draft.restrictions.trim()) {
		errors.restrictions = restrictedRestrictionsError;
	}
	return errors;
}

function getCreatedAtLabel(value: string) {
	return new Intl.DateTimeFormat("tr-TR", {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(new Date(value));
}

function HistoryField({
	label,
	value,
}: {
	label: string;
	value: string | null;
}) {
	return (
		<div>
			<dt className="font-medium text-sm">{label}</dt>
			<dd className="mt-1 whitespace-pre-wrap break-words text-muted-foreground text-sm">
				{value || "Belirtilmedi"}
			</dd>
		</div>
	);
}

function RightsRecordHistoryItem({ record }: { record: RightsRecord }) {
	return (
		<li className="space-y-3 rounded-md border p-4">
			<div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
				<h3 className="font-medium">Revizyon {record.versionNumber}</h3>
				<p className="text-muted-foreground text-sm">
					{getCreatedAtLabel(record.createdAt)}
				</p>
			</div>
			<p className="text-sm">{stateLabels[record.state]}</p>
			<dl className="grid gap-3 sm:grid-cols-2">
				<HistoryField label="Kaynak" value={record.source} />
				<HistoryField
					label="Hak sahibi veya sağlayıcı"
					value={record.rightsHolderOrProvider}
				/>
				<HistoryField
					label="Beyan edilen izin kapsamı"
					value={record.assertedScope}
				/>
				<HistoryField
					label="Hak kaydını destekleyen kanıt"
					value={record.evidence}
				/>
				<HistoryField label="Bilinen kısıtlar" value={record.restrictions} />
				<HistoryField label="Belirsizlik" value={record.uncertainty} />
			</dl>
		</li>
	);
}

export function RightsRecordPanel({
	assetRecordId,
	projectId,
}: {
	assetRecordId: string;
	projectId: string;
}) {
	const queryClient = useQueryClient();
	const pendingCreate = useRef<RightsRecordCreateInput | null>(null);
	const hasEditedDraft = useRef(false);
	const initializedFromHistory = useRef(false);
	const [draft, setDraft] = useState<RightsRecordDraft>(emptyDraft);
	const [writeOutcomeUncertain, setWriteOutcomeUncertain] = useState(false);
	const [isCheckingWriteOutcome, setIsCheckingWriteOutcome] = useState(false);
	const [statusMessage, setStatusMessage] = useState<string | null>(null);
	const [validationErrors, setValidationErrors] = useState<Partial<
		Record<RightsRecordValidationField, string>
	> | null>(null);
	const queryInput = { assetRecordId, projectId };
	const historyQuery = useQuery({
		...orpc.rightsRecords.list.queryOptions({ input: queryInput }),
		meta: { errorPresentation: "inline" },
	});
	useEffect(() => {
		if (!historyQuery.isSuccess || initializedFromHistory.current) {
			return;
		}
		initializedFromHistory.current = true;
		const [latest] = historyQuery.data;
		if (latest && !hasEditedDraft.current) {
			setDraft(draftFromRightsRecord(latest));
		}
	}, [historyQuery.data, historyQuery.isSuccess]);

	const createRevision = useMutation({
		mutationFn: (input: RightsRecordCreateInput) =>
			client.rightsRecords.create(input),
		onError(error) {
			if (isWriteOutcomeUncertain(error)) {
				setWriteOutcomeUncertain(true);
			} else {
				pendingCreate.current = null;
			}
		},
		async onSuccess(record) {
			pendingCreate.current = null;
			setWriteOutcomeUncertain(false);
			setValidationErrors(null);
			setStatusMessage(
				`Hak Kaydı Revizyon ${record.versionNumber} oluşturuldu.`
			);
			await queryClient.invalidateQueries({
				queryKey: orpc.rightsRecords.list.queryKey({ input: queryInput }),
			});
		},
	});

	function updateDraft<K extends keyof RightsRecordDraft>(
		key: K,
		value: RightsRecordDraft[K]
	) {
		hasEditedDraft.current = true;
		setDraft((current) => ({ ...current, [key]: value }));
		pendingCreate.current = null;
		setStatusMessage(null);
		if (createRevision.isError) {
			createRevision.reset();
		}
		setValidationErrors((current) => {
			if (!current || key === "state") {
				return null;
			}
			if (key === "evidence" || key === "restrictions") {
				const next = { ...current };
				delete next[key as RightsRecordValidationField];
				return Object.keys(next).length > 0 ? next : null;
			}
			return current;
		});
	}

	function validateField(key: RightsRecordValidationField) {
		const error = getDraftValidationErrors(draft)[key];
		if (error) {
			setValidationErrors((current) => ({
				...current,
				[key]: error,
			}));
		}
	}

	function submit(event: SyntheticEvent<HTMLFormElement>) {
		event.preventDefault();
		if (createRevision.isPending || writeOutcomeUncertain) {
			return;
		}
		const errors = getDraftValidationErrors(draft);
		if (Object.keys(errors).length > 0) {
			setValidationErrors(errors);
			return;
		}
		setValidationErrors(null);

		const input =
			pendingCreate.current ??
			({
				assetRecordId,
				assertedScope: normalizeInputText(draft.assertedScope),
				evidence: normalizeInputText(draft.evidence),
				id: crypto.randomUUID(),
				projectId,
				restrictions: normalizeInputText(draft.restrictions),
				rightsHolderOrProvider: normalizeInputText(
					draft.rightsHolderOrProvider
				),
				source: normalizeInputText(draft.source),
				state: draft.state,
				uncertainty: normalizeInputText(draft.uncertainty),
			} satisfies RightsRecordCreateInput);
		pendingCreate.current = input;
		setStatusMessage(null);
		createRevision.mutate(input);
	}

	async function checkWriteOutcome() {
		setIsCheckingWriteOutcome(true);
		try {
			const result = await historyQuery.refetch();
			if (result.isError) {
				return;
			}

			const expectedId = pendingCreate.current?.id;
			const savedRecord = result.data?.find(
				(record) => record.id === expectedId
			);
			if (savedRecord) {
				pendingCreate.current = null;
				setWriteOutcomeUncertain(false);
				setValidationErrors(null);
				setStatusMessage(
					`Hak Kaydı Revizyon ${savedRecord.versionNumber} oluşturuldu.`
				);
				return;
			}

			pendingCreate.current = null;
			setWriteOutcomeUncertain(false);
			setStatusMessage(
				"Hak Kaydı geçmişi yenilendi. Aynı bilgileri yeniden kaydedebilirsiniz."
			);
		} finally {
			setIsCheckingWriteOutcome(false);
		}
	}

	const history = historyQuery.data ?? [];
	const formDisabled = createRevision.isPending || writeOutcomeUncertain;

	return (
		<section
			aria-labelledby={`rights-record-heading-${assetRecordId}`}
			className="space-y-5 rounded-lg border p-5"
		>
			<header className="space-y-2">
				<h2
					className="font-semibold text-xl"
					id={`rights-record-heading-${assetRecordId}`}
				>
					Hak Kaydı
				</h2>
				<p className="text-muted-foreground text-sm">
					Bu, seçili Varlık Kaydı için kullanıcı beyanıdır. Lisansın hukuki
					geçerliliği hakkında karar vermez ve başka bir varlığa otomatik
					aktarılmaz. Her kaydetme yeni, değişmez bir sürüm oluşturur.
				</p>
			</header>

			<form className="space-y-4" noValidate onSubmit={submit}>
				{textFields.map(({ key, label, multiline }) => {
					const fieldId = `rights-record-${assetRecordId}-${key}`;
					const errorId = `${fieldId}-error`;
					const validationKey =
						key === "evidence" || key === "restrictions" ? key : null;
					const fieldError = validationKey
						? validationErrors?.[validationKey]
						: undefined;
					const isRequired =
						(key === "evidence" && draft.state === "documented") ||
						(key === "restrictions" && draft.state === "restricted");
					return (
						<div className="space-y-1" key={key}>
							<label className="block space-y-1 text-sm" htmlFor={fieldId}>
								<span>
									{label}
									{isRequired ? (
										<span aria-hidden="true"> · gerekli</span>
									) : null}
								</span>
								{multiline ? (
									<textarea
										aria-describedby={fieldError ? errorId : undefined}
										aria-invalid={Boolean(fieldError)}
										aria-required={isRequired}
										className="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm"
										disabled={formDisabled}
										id={fieldId}
										maxLength={5000}
										onBlur={() => {
											if (validationKey) {
												validateField(validationKey);
											}
										}}
										onChange={(event) =>
											updateDraft(key, event.currentTarget.value)
										}
										required={isRequired}
										value={draft[key]}
									/>
								) : (
									<Input
										aria-describedby={fieldError ? errorId : undefined}
										aria-invalid={Boolean(fieldError)}
										aria-required={isRequired}
										className="min-h-11"
										disabled={formDisabled}
										id={fieldId}
										maxLength={5000}
										onBlur={() => {
											if (validationKey) {
												validateField(validationKey);
											}
										}}
										onChange={(event) =>
											updateDraft(key, event.currentTarget.value)
										}
										required={isRequired}
										value={draft[key]}
									/>
								)}
							</label>
							{fieldError ? (
								<p className="text-sm" id={errorId} role="alert">
									{fieldError}
								</p>
							) : null}
						</div>
					);
				})}

				<label
					className="block space-y-1 text-sm"
					htmlFor={`rights-record-${assetRecordId}-state`}
				>
					<span>Beyan edilen hak durumu</span>
					<select
						className="h-11 w-full rounded-md border bg-background px-3 text-sm"
						disabled={formDisabled}
						id={`rights-record-${assetRecordId}-state`}
						onChange={(event) =>
							updateDraft(
								"state",
								event.currentTarget.value as RightsRecordState
							)
						}
						value={draft.state}
					>
						{rightsRecordStates.map((state) => (
							<option key={state} value={state}>
								{stateLabels[state]}
							</option>
						))}
					</select>
				</label>

				{createRevision.isError ? (
					<p role="alert">
						{writeOutcomeUncertain
							? "Kaydetme sonucu doğrulanamadı. Geçmişi yenileyerek kaydın oluşup oluşmadığını denetleyin."
							: getErrorMessage(
									createRevision.error,
									"Hak Kaydı oluşturulamadı. Girdi bilgilerini kontrol edip yeniden deneyin."
								)}
					</p>
				) : null}
				{statusMessage ? (
					<p aria-live="polite" className="text-sm">
						{statusMessage}
					</p>
				) : null}
				{writeOutcomeUncertain ? (
					<Button
						className="min-h-11"
						disabled={isCheckingWriteOutcome}
						onClick={() => void checkWriteOutcome()}
						type="button"
						variant="outline"
					>
						{isCheckingWriteOutcome
							? "Kaydetme sonucu denetleniyor…"
							: "Kaydetme sonucunu denetle"}
					</Button>
				) : (
					<Button className="min-h-11" disabled={formDisabled} type="submit">
						{createRevision.isPending
							? "Hak Kaydı oluşturuluyor…"
							: "Yeni Hak Kaydı sürümü oluştur"}
					</Button>
				)}
			</form>

			<section
				aria-labelledby="rights-record-history-heading"
				className="space-y-3"
			>
				<div>
					<h3 className="font-medium" id="rights-record-history-heading">
						Sürüm geçmişi
					</h3>
				</div>
				{historyQuery.isPending ? (
					<p aria-live="polite" className="text-muted-foreground text-sm">
						Hak Kaydı geçmişi yükleniyor…
					</p>
				) : null}
				{historyQuery.isError ? (
					<div className="space-y-2">
						<p role="alert">
							{getErrorMessage(
								historyQuery.error,
								"Hak Kaydı geçmişi yüklenemedi.",
								"query"
							)}
						</p>
						<QueryRetryButton
							disabled={historyQuery.isFetching}
							onRetry={() => void historyQuery.refetch()}
						/>
					</div>
				) : null}
				{historyQuery.isPending || historyQuery.isError ? null : (
					<ul className="space-y-3">
						{history.length > 0 ? (
							history.map((record) => (
								<RightsRecordHistoryItem key={record.id} record={record} />
							))
						) : (
							<li className="rounded-lg border border-dashed p-4 text-muted-foreground text-sm">
								Bu Varlık Kaydı için henüz Hak Kaydı yok.
							</li>
						)}
					</ul>
				)}
			</section>
		</section>
	);
}

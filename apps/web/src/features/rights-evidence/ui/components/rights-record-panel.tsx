import {
	type RightsRecord,
	type RightsRecordCreateInput,
	type RightsRecordState,
	rightsRecordEvidenceFileLimitBytes,
	rightsRecordSchema,
	rightsRecordStates,
} from "@sprite-anvil/api/rights-records";
import { Button } from "@sprite-anvil/ui/components/button";
import { Input } from "@sprite-anvil/ui/components/input";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	type ChangeEvent,
	type SyntheticEvent,
	useEffect,
	useRef,
	useState,
} from "react";
import {
	isWriteOutcomeUncertain,
	QueryRetryButton,
} from "@/utils/error-notification";
import { getErrorMessage } from "@/utils/get-error-message";
import { client, orpc } from "@/utils/orpc";
import { rightsRecordEvidenceFileUrl } from "./rights-record-api";

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
interface RightsRecordSubmission {
	evidenceFile: File | null;
	input: RightsRecordCreateInput;
}

interface RightsRecordDraft {
	assertedScope: string;
	evidence: string;
	restrictions: string;
	rightsHolderOrProvider: string;
	source: string;
	state: RightsRecordState;
	uncertainty: string;
}

function getEvidenceFileError(file: File | null) {
	if (!file) {
		return null;
	}
	if (file.size === 0) {
		return "Kanıt dosyası boş olamaz.";
	}
	if (file.size > rightsRecordEvidenceFileLimitBytes) {
		return "Kanıt dosyası 5 MiB sınırını aşıyor.";
	}
	return null;
}

function isRightsRecordFieldRequired(
	key: Exclude<keyof RightsRecordDraft, "state">,
	state: RightsRecordState,
	hasEvidenceFile: boolean
) {
	if (key === "evidence") {
		return state === "documented" && !hasEvidenceFile;
	}
	return key === "restrictions" && state === "restricted";
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

function getDraftValidationErrors(
	draft: RightsRecordDraft,
	hasEvidenceFile = false
) {
	const errors: Partial<Record<RightsRecordValidationField, string>> = {};
	if (
		isRightsRecordFieldRequired("evidence", draft.state, hasEvidenceFile) &&
		!draft.evidence.trim()
	) {
		errors.evidence = documentedEvidenceError;
	}
	if (
		isRightsRecordFieldRequired("restrictions", draft.state, hasEvidenceFile) &&
		!draft.restrictions.trim()
	) {
		errors.restrictions = restrictedRestrictionsError;
	}
	return errors;
}

function removeRightsRecordValidationError(
	errors: Partial<Record<RightsRecordValidationField, string>> | null,
	field: RightsRecordValidationField
) {
	if (!errors) {
		return null;
	}
	if (field === "evidence") {
		return errors.restrictions ? { restrictions: errors.restrictions } : null;
	}
	return errors.evidence ? { evidence: errors.evidence } : null;
}

function updateRightsRecordValidationErrors(
	errors: Partial<Record<RightsRecordValidationField, string>> | null,
	key: keyof RightsRecordDraft
) {
	if (key === "state") {
		return null;
	}
	if (key === "evidence" || key === "restrictions") {
		return removeRightsRecordValidationError(errors, key);
	}
	return errors;
}

class RightsRecordEvidenceUploadError extends Error {
	readonly outcomeUncertain: boolean;

	constructor(
		message: string,
		options: ErrorOptions & { outcomeUncertain: boolean }
	) {
		super(message, options);
		this.outcomeUncertain = options.outcomeUncertain;
	}
}

function evidenceUploadErrorMessage(status: number) {
	if (status === 400) {
		return "Kanıt dosyası veya Hak Kaydı bilgileri geçersiz.";
	}
	if (status === 401) {
		return "Oturumunuz sona erdi. Yeniden giriş yapın.";
	}
	if (status === 404) {
		return "Bu Varlık Kaydı bulunamadı.";
	}
	if (status === 409) {
		return "Bu Hak Kaydı sürüm kimliği farklı bilgilerle kullanılmış.";
	}
	if (status === 413) {
		return "Kanıt dosyası 5 MiB sınırını aşıyor.";
	}
	return "Kanıt dosyasıyla Hak Kaydı oluşturulamadı.";
}

async function createRightsRecordRevision(
	projectId: string,
	assetRecordId: string,
	{ input, evidenceFile }: RightsRecordSubmission
) {
	if (!evidenceFile) {
		return client.rightsRecords.create(input);
	}
	const formData = new FormData();
	formData.set("rightsRecord", JSON.stringify(input));
	formData.set("evidenceFile", evidenceFile, evidenceFile.name);
	let response: Response;
	try {
		response = await fetch(
			rightsRecordEvidenceFileUrl(projectId, assetRecordId, input.id),
			{
				body: formData,
				credentials: "include",
				method: "POST",
			}
		);
	} catch (error) {
		throw new RightsRecordEvidenceUploadError(
			"Yükleme sonucu doğrulanamadı. Hak Kaydı geçmişini yenileyip sonucu kontrol edin.",
			{ cause: error, outcomeUncertain: true }
		);
	}
	if (!response.ok) {
		throw new RightsRecordEvidenceUploadError(
			evidenceUploadErrorMessage(response.status),
			{ outcomeUncertain: response.status >= 500 }
		);
	}
	return rightsRecordSchema.parse(await response.json());
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

function RightsRecordHistoryItem({
	projectId,
	record,
}: {
	projectId: string;
	record: RightsRecord;
}) {
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
				{record.evidenceFile ? (
					<div>
						<dt className="font-medium text-sm">Kanıt dosyası</dt>
						<dd className="mt-1 text-sm">
							<a
								download={record.evidenceFile.fileName}
								href={rightsRecordEvidenceFileUrl(
									projectId,
									record.assetRecordId,
									record.id
								)}
							>
								{record.evidenceFile.fileName}
							</a>
						</dd>
					</div>
				) : null}
				<HistoryField label="Bilinen kısıtlar" value={record.restrictions} />
				<HistoryField label="Belirsizlik" value={record.uncertainty} />
			</dl>
		</li>
	);
}

function RightsRecordSaveFeedback({
	error,
	isCheckingWriteOutcome,
	isError,
	isPending,
	onCheckWriteOutcome,
	statusMessage,
	writeOutcomeUncertain,
}: {
	error: unknown;
	isCheckingWriteOutcome: boolean;
	isError: boolean;
	isPending: boolean;
	onCheckWriteOutcome: () => void;
	statusMessage: string | null;
	writeOutcomeUncertain: boolean;
}) {
	return (
		<>
			{isError ? (
				<p role="alert">
					{writeOutcomeUncertain
						? "Kaydetme sonucu doğrulanamadı. Geçmişi yenileyerek kaydın oluşup oluşmadığını denetleyin."
						: getErrorMessage(
								error,
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
					onClick={onCheckWriteOutcome}
					type="button"
					variant="outline"
				>
					{isCheckingWriteOutcome
						? "Kaydetme sonucu denetleniyor…"
						: "Kaydetme sonucunu denetle"}
				</Button>
			) : (
				<Button className="min-h-11" disabled={isPending} type="submit">
					{isPending
						? "Hak Kaydı oluşturuluyor…"
						: "Yeni Hak Kaydı sürümü oluştur"}
				</Button>
			)}
		</>
	);
}

function RightsRecordHistory({
	error,
	history,
	isError,
	isFetching,
	isPending,
	onRetry,
	projectId,
}: {
	error: unknown;
	history: RightsRecord[];
	isError: boolean;
	isFetching: boolean;
	isPending: boolean;
	onRetry: () => void;
	projectId: string;
}) {
	return (
		<section
			aria-labelledby="rights-record-history-heading"
			className="space-y-3"
		>
			<div>
				<h3 className="font-medium" id="rights-record-history-heading">
					Sürüm geçmişi
				</h3>
			</div>
			{isPending ? (
				<p aria-live="polite" className="text-muted-foreground text-sm">
					Hak Kaydı geçmişi yükleniyor…
				</p>
			) : null}
			{isError ? (
				<div className="space-y-2">
					<p role="alert">
						{getErrorMessage(error, "Hak Kaydı geçmişi yüklenemedi.", "query")}
					</p>
					<QueryRetryButton disabled={isFetching} onRetry={onRetry} />
				</div>
			) : null}
			{isPending || isError ? null : (
				<ul className="space-y-3">
					{history.length > 0 ? (
						history.map((record) => (
							<RightsRecordHistoryItem
								key={record.id}
								projectId={projectId}
								record={record}
							/>
						))
					) : (
						<li className="rounded-lg border border-dashed p-4 text-muted-foreground text-sm">
							Bu Varlık Kaydı için henüz Hak Kaydı yok.
						</li>
					)}
				</ul>
			)}
		</section>
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
	const pendingCreate = useRef<RightsRecordSubmission | null>(null);
	const evidenceFileInput = useRef<HTMLInputElement>(null);
	const hasEditedDraft = useRef(false);
	const initializedFromHistory = useRef(false);
	const [draft, setDraft] = useState<RightsRecordDraft>(emptyDraft);
	const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
	const [evidenceFileError, setEvidenceFileError] = useState<string | null>(
		null
	);
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
		mutationFn: (submission: RightsRecordSubmission) =>
			createRightsRecordRevision(projectId, assetRecordId, submission),
		onError(error) {
			if (
				isWriteOutcomeUncertain(error) ||
				(error instanceof RightsRecordEvidenceUploadError &&
					error.outcomeUncertain)
			) {
				setWriteOutcomeUncertain(true);
			} else {
				pendingCreate.current = null;
			}
		},
		async onSuccess(record) {
			pendingCreate.current = null;
			setEvidenceFile(null);
			setEvidenceFileError(null);
			if (evidenceFileInput.current) {
				evidenceFileInput.current.value = "";
			}
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
		setValidationErrors((current) =>
			updateRightsRecordValidationErrors(current, key)
		);
	}

	function updateEvidenceFile(event: ChangeEvent<HTMLInputElement>) {
		const selectedFile = event.currentTarget.files?.[0] ?? null;
		setEvidenceFileError(getEvidenceFileError(selectedFile));
		setEvidenceFile(
			selectedFile &&
				selectedFile.size > 0 &&
				selectedFile.size <= rightsRecordEvidenceFileLimitBytes
				? selectedFile
				: null
		);
		hasEditedDraft.current = true;
		pendingCreate.current = null;
		setStatusMessage(null);
		if (createRevision.isError) {
			createRevision.reset();
		}
		setValidationErrors((current) =>
			removeRightsRecordValidationError(current, "evidence")
		);
	}

	function validateField(key: RightsRecordValidationField) {
		const error = getDraftValidationErrors(draft, Boolean(evidenceFile))[key];
		if (error) {
			setValidationErrors((current) => ({
				...current,
				[key]: error,
			}));
		}
	}

	function submit(event: SyntheticEvent<HTMLFormElement>) {
		event.preventDefault();
		if (
			createRevision.isPending ||
			writeOutcomeUncertain ||
			evidenceFileError
		) {
			return;
		}
		const errors = getDraftValidationErrors(draft, Boolean(evidenceFile));
		if (Object.keys(errors).length > 0) {
			setValidationErrors(errors);
			return;
		}
		setValidationErrors(null);

		const input =
			pendingCreate.current?.input ??
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
		const submission = {
			evidenceFile: pendingCreate.current?.evidenceFile ?? evidenceFile,
			input,
		};
		pendingCreate.current = submission;
		setStatusMessage(null);
		createRevision.mutate(submission);
	}

	function removeEvidenceFile() {
		setEvidenceFile(null);
		setEvidenceFileError(null);
		if (evidenceFileInput.current) {
			evidenceFileInput.current.value = "";
		}
		pendingCreate.current = null;
		setStatusMessage(null);
		if (createRevision.isError) {
			createRevision.reset();
		}
	}

	async function checkWriteOutcome() {
		setIsCheckingWriteOutcome(true);
		try {
			const result = await historyQuery.refetch();
			if (result.isError) {
				return;
			}

			const expectedId = pendingCreate.current?.input.id;
			const savedRecord = result.data?.find(
				(record) => record.id === expectedId
			);
			if (savedRecord) {
				pendingCreate.current = null;
				setWriteOutcomeUncertain(false);
				setEvidenceFile(null);
				if (evidenceFileInput.current) {
					evidenceFileInput.current.value = "";
				}
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
	const evidenceFileInputId = `rights-record-${assetRecordId}-evidence-file`;
	const evidenceFileHelpId = `${evidenceFileInputId}-help`;
	const evidenceFileErrorId = `${evidenceFileInputId}-error`;

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
					const isRequired = isRightsRecordFieldRequired(
						key,
						draft.state,
						Boolean(evidenceFile)
					);
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

				<div className="space-y-1">
					<label
						className="block space-y-1 text-sm"
						htmlFor={evidenceFileInputId}
					>
						<span>Kanıt dosyası ekle</span>
						<input
							aria-describedby={
								evidenceFileError
									? `${evidenceFileHelpId} ${evidenceFileErrorId}`
									: evidenceFileHelpId
							}
							aria-invalid={Boolean(evidenceFileError)}
							className="min-h-11 w-full rounded-md border bg-background px-3 py-2 text-sm file:mr-3 file:rounded-sm file:border-0 file:bg-muted file:px-3 file:py-1"
							disabled={formDisabled}
							id={evidenceFileInputId}
							onChange={updateEvidenceFile}
							ref={evidenceFileInput}
							type="file"
						/>
					</label>
					<p className="text-muted-foreground text-sm" id={evidenceFileHelpId}>
						Tek dosya, en fazla 5 MiB. Metin veya URL alanıyla birlikte
						kullanabilirsiniz.
					</p>
					{evidenceFile ? (
						<p className="text-sm">Seçilen dosya: {evidenceFile.name}</p>
					) : null}
					{evidenceFileError ? (
						<p className="text-sm" id={evidenceFileErrorId} role="alert">
							{evidenceFileError}
						</p>
					) : null}
					{evidenceFile || evidenceFileError ? (
						<Button
							className="min-h-11"
							disabled={formDisabled}
							onClick={removeEvidenceFile}
							type="button"
							variant="outline"
						>
							Kanıt dosyasını kaldır
						</Button>
					) : null}
				</div>

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

				<RightsRecordSaveFeedback
					error={createRevision.error}
					isCheckingWriteOutcome={isCheckingWriteOutcome}
					isError={createRevision.isError}
					isPending={formDisabled}
					onCheckWriteOutcome={() => void checkWriteOutcome()}
					statusMessage={statusMessage}
					writeOutcomeUncertain={writeOutcomeUncertain}
				/>
			</form>

			<RightsRecordHistory
				error={historyQuery.error}
				history={history}
				isError={historyQuery.isError}
				isFetching={historyQuery.isFetching}
				isPending={historyQuery.isPending}
				onRetry={() => void historyQuery.refetch()}
				projectId={projectId}
			/>
		</section>
	);
}

import {
	type RightsRecord,
	type RightsRecordCreateInput,
	type RightsRecordEvidenceFile,
	type RightsRecordState,
	rightsRecordSchema,
	rightsRecordStates,
} from "@sprite-anvil/api/rights-records";
import { Button } from "@sprite-anvil/ui/components/button";
import { Input } from "@sprite-anvil/ui/components/input";
import { Label } from "@sprite-anvil/ui/components/label";
import {
	NativeSelect,
	NativeSelectOption,
} from "@sprite-anvil/ui/components/native-select";
import { Textarea } from "@sprite-anvil/ui/components/textarea";
import { useForm, useStore } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type SyntheticEvent, useEffect, useRef, useState } from "react";
import {
	isWriteOutcomeUncertain,
	QueryRetryButton,
} from "@/utils/error-notification";
import { getErrorMessage } from "@/utils/get-error-message";
import { mutationMeta } from "@/utils/mutation-meta";
import { orpc } from "@/utils/orpc";
import { rightsRecordEvidenceFileUrl } from "../../lib/rights-record-api";
import {
	documentedEvidenceError,
	isRightsRecordFieldRequired,
	type RightsRecordDraft,
	type RightsRecordValidationField,
	restrictedRestrictionsError,
	rightsRecordEvidenceFileError,
	rightsRecordFormErrors,
	rightsRecordRequiredFieldSchema,
} from "../../schemas";
import { RightsRecordDetails } from "./rights-record-details";

const stateLabels: Record<RightsRecordState, string> = {
	assertion_only: "Yalnız Beyan",
	documented: "Belgelendi",
	restricted: "Kısıtlı",
	unknown: "Bilinmiyor",
};
interface RightsRecordSubmission {
	evidenceFile: File | null;
	input: RightsRecordCreateInput;
}

type UploadRightsRecordSubmission = RightsRecordSubmission & {
	evidenceFile: File;
};

const validationMessages: Record<RightsRecordValidationField, string> = {
	evidence: documentedEvidenceError,
	restrictions: restrictedRestrictionsError,
};

function firstErrorMessage(errors: readonly unknown[]) {
	const [error] = errors;
	if (typeof error === "string") {
		return error;
	}
	return (error as { message?: string } | undefined)?.message;
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

async function uploadRightsRecordRevision(
	projectId: string,
	assetRecordId: string,
	{ input, evidenceFile }: UploadRightsRecordSubmission
) {
	const formData = new FormData();
	const { evidenceFileSourceRecordId: _sourceRecordId, ...uploadInput } = input;
	formData.set("rightsRecord", JSON.stringify(uploadInput));
	formData.set("evidenceFile", evidenceFile, evidenceFile.name);
	let response: Response;
	try {
		// conventions-exception: raw-fetch The evidence upload is capped at 5 MiB by hono/body-limit before multipart parsing; the shared RPC handler has no per-procedure body limit.
		response = await fetch(
			rightsRecordEvidenceFileUrl(
				projectId,
				assetRecordId,
				input.id,
				input.referenceId ?? null
			),
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

interface RevisionHandlers {
	onError: (error: unknown) => void;
	onSuccess: (record: RightsRecord) => Promise<void>;
}

// Without an attachment the revision goes through the oRPC procedure; an
// attachment streams as multipart to the body-limited upload route instead.
function useRightsRecordRevision(
	projectId: string,
	assetRecordId: string,
	handlers: RevisionHandlers
) {
	const rpcRevision = useMutation(
		orpc.rightsRecords.create.mutationOptions({
			...mutationMeta,
			...handlers,
		})
	);
	const uploadRevision = useMutation({
		...mutationMeta,
		mutationFn: (submission: UploadRightsRecordSubmission) =>
			uploadRightsRecordRevision(projectId, assetRecordId, submission),
		...handlers,
	});
	return {
		error: uploadRevision.error ?? rpcRevision.error,
		isError: uploadRevision.isError || rpcRevision.isError,
		isPending: uploadRevision.isPending || rpcRevision.isPending,
		mutate(submission: RightsRecordSubmission) {
			if (submission.evidenceFile) {
				uploadRevision.mutate({
					...submission,
					evidenceFile: submission.evidenceFile,
				});
			} else {
				rpcRevision.mutate(submission.input);
			}
		},
		reset() {
			uploadRevision.reset();
			rpcRevision.reset();
		},
	};
}

function getCreatedAtLabel(value: string) {
	return new Intl.DateTimeFormat("tr-TR", {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(new Date(value));
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
			<RightsRecordDetails projectId={projectId} record={record} />
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
	emptyMessage,
	headingId,
	history,
	isError,
	isFetching,
	isPending,
	onRetry,
	projectId,
}: {
	error: unknown;
	emptyMessage: string;
	headingId: string;
	history: RightsRecord[];
	isError: boolean;
	isFetching: boolean;
	isPending: boolean;
	onRetry: () => void;
	projectId: string;
}) {
	return (
		<section aria-labelledby={headingId} className="space-y-3">
			<div>
				<h3 className="font-medium" id={headingId}>
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
							{emptyMessage}
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
	referenceId = null,
	referenceName,
}: {
	assetRecordId: string;
	projectId: string;
	referenceId?: string | null;
	referenceName?: string;
}) {
	const queryClient = useQueryClient();
	const pendingCreate = useRef<RightsRecordSubmission | null>(null);
	const evidenceFileInput = useRef<HTMLInputElement>(null);
	const hasEditedDraft = useRef(false);
	const initializedFromHistory = useRef(false);
	const [evidenceFileSourceRecordId, setEvidenceFileSourceRecordId] = useState<
		string | null
	>(null);
	const [retainedEvidenceFile, setRetainedEvidenceFile] =
		useState<RightsRecordEvidenceFile | null>(null);
	const [evidenceFileError, setEvidenceFileError] = useState<string | null>(
		null
	);
	const [writeOutcomeUncertain, setWriteOutcomeUncertain] = useState(false);
	const [isCheckingWriteOutcome, setIsCheckingWriteOutcome] = useState(false);
	const [statusMessage, setStatusMessage] = useState<string | null>(null);
	const form = useForm({
		defaultValues: { ...emptyDraft, evidenceFile: null as File | null },
		onSubmit: ({ value }) => submitRevision(value),
		validators: {
			onSubmit: ({ value }) => {
				const fields = rightsRecordFormErrors(
					value,
					Boolean(value.evidenceFile || evidenceFileSourceRecordId)
				);
				return Object.keys(fields).length > 0 ? { fields } : undefined;
			},
		},
	});
	const draft = useStore(form.store, (state) => state.values);
	const { evidenceFile } = draft;
	const queryInput = { assetRecordId, projectId, referenceId };
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
			for (const [key, value] of Object.entries(
				draftFromRightsRecord(latest)
			) as [keyof RightsRecordDraft, string][]) {
				form.setFieldValue(key, value as never, {
					dontRunListeners: true,
					dontValidate: true,
				});
			}
			setEvidenceFileSourceRecordId(latest.evidenceFile ? latest.id : null);
			setRetainedEvidenceFile(latest.evidenceFile);
		}
	}, [form, historyQuery.data, historyQuery.isSuccess]);

	const revisionHandlers = {
		onError(error: unknown) {
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
		async onSuccess(record: RightsRecord) {
			pendingCreate.current = null;
			setEvidenceFile(null);
			setEvidenceFileSourceRecordId(record.evidenceFile ? record.id : null);
			setRetainedEvidenceFile(record.evidenceFile);
			setEvidenceFileError(null);
			if (evidenceFileInput.current) {
				evidenceFileInput.current.value = "";
			}
			setWriteOutcomeUncertain(false);
			clearValidationErrors();
			setStatusMessage(
				`Hak Kaydı Revizyon ${record.versionNumber} oluşturuldu.`
			);
			await queryClient.invalidateQueries({
				queryKey: orpc.rightsRecords.list.queryKey({ input: queryInput }),
			});
		},
	};
	const createRevision = useRightsRecordRevision(
		projectId,
		assetRecordId,
		revisionHandlers
	);

	function setEvidenceFile(file: File | null) {
		form.setFieldValue("evidenceFile", file);
	}

	function clearFieldErrors(name: RightsRecordValidationField) {
		form.setFieldMeta(name, (meta) => ({
			...meta,
			errorMap: {},
			errorSourceMap: {},
		}));
	}

	function clearValidationErrors() {
		clearFieldErrors("evidence");
		clearFieldErrors("restrictions");
	}

	function markDraftEdited() {
		hasEditedDraft.current = true;
		pendingCreate.current = null;
		setStatusMessage(null);
		if (createRevision.isError) {
			createRevision.reset();
		}
	}

	function selectEvidenceFile(
		selectedFile: File | null,
		handleChange: (file: File | null) => void
	) {
		const fileError = rightsRecordEvidenceFileError(selectedFile);
		setEvidenceFileError(fileError);
		const validFile = fileError ? null : selectedFile;
		handleChange(validFile);
		if (validFile) {
			setEvidenceFileSourceRecordId(null);
			setRetainedEvidenceFile(null);
		}
		markDraftEdited();
		clearFieldErrors("evidence");
	}

	function submit(event: SyntheticEvent<HTMLFormElement>) {
		event.preventDefault();
		event.stopPropagation();
		if (
			createRevision.isPending ||
			writeOutcomeUncertain ||
			evidenceFileError
		) {
			return;
		}
		void form.handleSubmit();
	}

	function submitRevision(
		value: RightsRecordDraft & { evidenceFile: File | null }
	) {
		const { evidenceFile: selectedEvidenceFile, ...draftValue } = value;
		const input =
			pendingCreate.current?.input ??
			({
				assetRecordId,
				assertedScope: normalizeInputText(draftValue.assertedScope),
				evidence: normalizeInputText(draftValue.evidence),
				evidenceFileSourceRecordId: selectedEvidenceFile
					? null
					: evidenceFileSourceRecordId,
				id: crypto.randomUUID(),
				projectId,
				referenceId,
				restrictions: normalizeInputText(draftValue.restrictions),
				rightsHolderOrProvider: normalizeInputText(
					draftValue.rightsHolderOrProvider
				),
				source: normalizeInputText(draftValue.source),
				state: draftValue.state,
				uncertainty: normalizeInputText(draftValue.uncertainty),
			} satisfies RightsRecordCreateInput);
		const submission = {
			evidenceFile: pendingCreate.current?.evidenceFile ?? selectedEvidenceFile,
			input,
		};
		pendingCreate.current = submission;
		setStatusMessage(null);
		createRevision.mutate(submission);
	}

	function removeEvidenceFile() {
		setEvidenceFile(null);
		setEvidenceFileSourceRecordId(null);
		setRetainedEvidenceFile(null);
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
				setEvidenceFileSourceRecordId(
					savedRecord.evidenceFile ? savedRecord.id : null
				);
				setRetainedEvidenceFile(savedRecord.evidenceFile);
				setEvidenceFileError(null);
				if (evidenceFileInput.current) {
					evidenceFileInput.current.value = "";
				}
				clearValidationErrors();
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
	const hasEvidenceFile = Boolean(evidenceFile || evidenceFileSourceRecordId);
	const formDisabled = createRevision.isPending || writeOutcomeUncertain;
	const targetId = referenceId
		? `reference-${referenceId}`
		: `asset-record-${assetRecordId}`;
	const evidenceFileInputId = `rights-record-${targetId}-evidence-file`;
	const evidenceFileHelpId = `${evidenceFileInputId}-help`;
	const evidenceFileErrorId = `${evidenceFileInputId}-error`;
	const headingId = `rights-record-heading-${targetId}`;
	const historyHeadingId = `rights-record-history-heading-${targetId}`;
	const historyEmptyMessage = referenceId
		? `Bu ${referenceName ? `${referenceName} referans görseli` : "referans görseli"} için henüz Hak Kaydı yok.`
		: "Bu Varlık Kaydı için henüz Hak Kaydı yok.";
	let targetDescription = "seçili Varlık Kaydı";
	if (referenceId) {
		targetDescription = referenceName
			? `${referenceName} referans görseli`
			: "seçili referans görseli";
	}

	return (
		<section
			aria-labelledby={headingId}
			className="space-y-5 rounded-lg border p-5"
		>
			<header className="space-y-2">
				<h2 className="font-semibold text-xl" id={headingId}>
					Hak Kaydı{referenceName ? ` · ${referenceName}` : ""}
				</h2>
				<p className="text-muted-foreground text-sm">
					Bu, {targetDescription} için kullanıcı beyanıdır. Lisansın hukuki
					geçerliliği hakkında karar vermez ve başka bir varlığa otomatik
					aktarılmaz. Her kaydetme yeni, değişmez bir sürüm oluşturur.
				</p>
			</header>

			<form className="space-y-4" noValidate onSubmit={submit}>
				{textFields.map(({ key, label, multiline }) => {
					const fieldId = `rights-record-${targetId}-${key}`;
					const errorId = `${fieldId}-error`;
					const validationKey =
						key === "evidence" || key === "restrictions" ? key : null;
					const isRequired = isRightsRecordFieldRequired(
						key,
						draft.state,
						hasEvidenceFile
					);
					return (
						<form.Field
							key={key}
							name={key}
							validators={
								validationKey
									? {
											onBlur: rightsRecordRequiredFieldSchema(
												isRequired,
												validationMessages[validationKey]
											),
										}
									: undefined
							}
						>
							{(field) => {
								const fieldError = validationKey
									? firstErrorMessage(field.state.meta.errors)
									: undefined;
								const fieldProps = {
									"aria-describedby": fieldError ? errorId : undefined,
									"aria-invalid": Boolean(fieldError),
									"aria-required": isRequired,
									disabled: formDisabled,
									id: fieldId,
									maxLength: 5000,
									onBlur: field.handleBlur,
									required: isRequired,
									value: field.state.value,
								};
								return (
									<div className="space-y-1">
										<Label
											className="block space-y-1 text-sm leading-normal"
											htmlFor={fieldId}
										>
											<span>
												{label}
												{isRequired ? (
													<span aria-hidden="true"> · gerekli</span>
												) : null}
											</span>
											{multiline ? (
												<Textarea
													{...fieldProps}
													className="min-h-24 w-full text-sm"
													onChange={(event) => {
														field.handleChange(event.currentTarget.value);
														markDraftEdited();
														if (validationKey) {
															clearFieldErrors(validationKey);
														}
													}}
												/>
											) : (
												<Input
													{...fieldProps}
													className="min-h-11"
													onChange={(event) => {
														field.handleChange(event.currentTarget.value);
														markDraftEdited();
														if (validationKey) {
															clearFieldErrors(validationKey);
														}
													}}
												/>
											)}
										</Label>
										{fieldError ? (
											<p className="text-sm" id={errorId} role="alert">
												{fieldError}
											</p>
										) : null}
									</div>
								);
							}}
						</form.Field>
					);
				})}

				<div className="space-y-1">
					<form.Field name="evidenceFile">
						{(field) => (
							<Label
								className="block space-y-1 text-sm leading-normal"
								htmlFor={evidenceFileInputId}
							>
								<span>Kanıt dosyası ekle</span>
								<Input
									aria-describedby={
										evidenceFileError
											? `${evidenceFileHelpId} ${evidenceFileErrorId}`
											: evidenceFileHelpId
									}
									aria-invalid={Boolean(evidenceFileError)}
									className="min-h-11 w-full text-sm file:mr-3 file:rounded-sm file:bg-muted file:px-3 file:py-1"
									disabled={formDisabled}
									id={evidenceFileInputId}
									onChange={(event) =>
										selectEvidenceFile(
											event.currentTarget.files?.[0] ?? null,
											field.handleChange
										)
									}
									ref={evidenceFileInput}
									type="file"
								/>
							</Label>
						)}
					</form.Field>
					<p className="text-muted-foreground text-sm" id={evidenceFileHelpId}>
						Tek dosya, en fazla 5 MiB. Metin veya URL alanıyla birlikte
						kullanabilirsiniz.
					</p>
					{evidenceFile ? (
						<p className="text-sm">Seçilen dosya: {evidenceFile.name}</p>
					) : null}
					{retainedEvidenceFile && evidenceFileSourceRecordId ? (
						<p className="text-sm">
							Mevcut kanıt dosyası: {retainedEvidenceFile.fileName}
						</p>
					) : null}
					{evidenceFileError ? (
						<p className="text-sm" id={evidenceFileErrorId} role="alert">
							{evidenceFileError}
						</p>
					) : null}
					{evidenceFile || evidenceFileError || retainedEvidenceFile ? (
						<Button
							className="min-h-11"
							disabled={formDisabled}
							onClick={removeEvidenceFile}
							type="button"
							variant="outline"
						>
							{retainedEvidenceFile && !evidenceFile
								? "Mevcut kanıt dosyasını kaldır"
								: "Kanıt dosyasını kaldır"}
						</Button>
					) : null}
				</div>

				<form.Field name="state">
					{(field) => (
						<Label
							className="block space-y-1 text-sm leading-normal"
							htmlFor={`rights-record-${targetId}-state`}
						>
							<span>Beyan edilen hak durumu</span>
							<NativeSelect
								className="w-full"
								disabled={formDisabled}
								id={`rights-record-${targetId}-state`}
								onChange={(event) => {
									field.handleChange(
										event.currentTarget.value as RightsRecordState
									);
									markDraftEdited();
									clearValidationErrors();
								}}
								value={field.state.value}
							>
								{rightsRecordStates.map((state) => (
									<NativeSelectOption key={state} value={state}>
										{stateLabels[state]}
									</NativeSelectOption>
								))}
							</NativeSelect>
						</Label>
					)}
				</form.Field>

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
				emptyMessage={historyEmptyMessage}
				error={historyQuery.error}
				headingId={historyHeadingId}
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

import type { AssetRecord } from "@sprite-anvil/api/asset-records";
import type { AssetVersion } from "@sprite-anvil/api/asset-versions";
import type { ProjectProfileContractActivation } from "@sprite-anvil/api/specialized-profile-contracts";
import { readUiProfileManifest } from "@sprite-anvil/api/ui-profile-export";
import type {
	UiStretchTestInput,
	UiStretchTestRecord,
} from "@sprite-anvil/api/ui-stretch-tests";
import { Button } from "@sprite-anvil/ui/components/button";
import { FieldLegend, FieldSet } from "@sprite-anvil/ui/components/field";
import { Input } from "@sprite-anvil/ui/components/input";
import { Label } from "@sprite-anvil/ui/components/label";
import {
	NativeSelect,
	NativeSelectOption,
} from "@sprite-anvil/ui/components/native-select";
import { Textarea } from "@sprite-anvil/ui/components/textarea";
import { useForm, useStore } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ENV } from "@/env";
import { isWriteOutcomeUncertain } from "@/utils/error-notification";
import { getErrorMessage } from "@/utils/get-error-message";
import { orpc } from "@/utils/orpc";
import {
	createUiStretchConfigurationSchema,
	createUiStretchStateSchema,
	type UiStretchObservationDraft,
	type UiStretchStateDraft,
	uiStretchBoundsFields,
} from "../../schemas";
import { SavedUiStretchTest } from "./saved-ui-stretch-test";
import { UiStretchPreview } from "./ui-stretch-preview";

export interface UiStretchTestManagerProps {
	activation: ProjectProfileContractActivation;
	assetFamilyId: string;
	assetRecords: Pick<
		AssetRecord,
		"id" | "name" | "assetCategory" | "availability"
	>[];
	familyName: string;
	projectId: string;
	versions: Pick<
		AssetVersion,
		| "id"
		| "assetRecordId"
		| "assetFamilyId"
		| "versionNumber"
		| "integrityVerified"
		| "contentDigest"
		| "sourceImageDimensions"
		| "previewUrl"
	>[];
	visualWorldId: string;
}
const newState = (): UiStretchStateDraft => ({
	key: crypto.randomUUID(),
	componentId: "",
	stateId: "",
	assetVersionId: "",
	left: "",
	right: "",
	top: "",
	bottom: "",
	x: "",
	y: "",
	width: "",
	height: "",
});
const fieldClass = "block min-h-11 w-full";
// The desktop e2e specs address these selects as `label/select`, so they stay
// direct label children instead of using the NativeSelect wrapper.
const nativeSelectClass =
	"block min-h-11 w-full rounded border bg-background p-2";
const selectClass = "w-full [&_select]:min-h-11";
const labelClass = "block text-base leading-normal";
const trailingSlash = /\/$/;
const previewSource = (url: string) =>
	url.startsWith("/")
		? `${ENV.VITE_SERVER_URL?.replace(trailingSlash, "") ?? ""}${url}`
		: url;
export function UiStretchTestManager({
	activation,
	projectId,
	assetFamilyId,
	visualWorldId,
	familyName,
	assetRecords,
	versions,
}: UiStretchTestManagerProps) {
	const queryClient = useQueryClient();
	const listKey = orpc.uiStretchTests.list.queryKey({
		input: { projectId, assetFamilyId },
	});
	const query = useQuery(
		orpc.uiStretchTests.list.queryOptions({
			input: { projectId, assetFamilyId },
		})
	);
	const saveStretchTest = useMutation(
		orpc.uiStretchTests.save.mutationOptions()
	);
	// Export is a button-triggered read with no cache meaning, so it is a
	// mutation: every click hits the server and nothing is cached.
	const exportStretchTest = useMutation(
		orpc.uiStretchTests.export.mutationOptions()
	);
	const available = versions.filter(
		(v) =>
			v.assetFamilyId === assetFamilyId &&
			v.integrityVerified &&
			v.contentDigest &&
			v.sourceImageDimensions &&
			assetRecords.some(
				(r) =>
					r.id === v.assetRecordId &&
					r.assetCategory === "ui" &&
					r.availability !== "erased"
			)
	);
	const [defaultValues] = useState(() => ({
		drafts: [newState()],
		targets: [{ key: crypto.randomUUID(), width: "", height: "" }],
		screenVersion: "",
		sampleText: "Inventory item description",
		observations: {} as Record<string, UiStretchObservationDraft | undefined>,
	}));
	const form = useForm({
		defaultValues,
		onSubmit: ({ value }) => save(value),
	});
	const values = useStore(form.store, (state) => state.values);
	const { drafts, targets, screenVersion, sampleText, observations } = values;
	const [error, setError] = useState("");
	const [message, setMessage] = useState("");
	const [busy, setBusy] = useState(false);
	const [pending, setPending] = useState<UiStretchTestInput | null>(null);
	const stateSchema = createUiStretchStateSchema(available);
	const configurationSchema = createUiStretchConfigurationSchema({
		projectId,
		assetFamilyId,
		visualWorldId,
		contractRevisionId: activation.contractRevisionId,
		available,
	});
	const configuration = configurationSchema.safeParse(values);
	function resetObservations() {
		form.setFieldValue("observations", {});
	}
	function changeDraft() {
		resetObservations();
		setMessage("");
	}
	async function checkCurrent() {
		if (!pending || busy) {
			return;
		}
		setBusy(true);
		try {
			const result = await query.refetch();
			if (result.isError) {
				setError(
					getErrorMessage(
						result.error,
						"Could not check current tests.",
						"query"
					)
				);
				return;
			}
			if (result.data?.some((r) => r.id === pending.id)) {
				setPending(null);
				setError("");
				setMessage("Stretch test saved.");
			} else {
				setError(
					"The pending test is not visible yet. Check current tests again."
				);
			}
		} finally {
			setBusy(false);
		}
	}
	async function save(value: typeof form.state.values) {
		if (busy || pending) {
			return;
		}
		setError("");
		setMessage("");
		const states = value.drafts.map((draft) => stateSchema.safeParse(draft));
		const invalidState = states.find((state) => !state.success);
		if (invalidState && !invalidState.success) {
			setError(
				invalidState.error.issues.map((issue) => issue.message).join(" ")
			);
			return;
		}
		const saveConfiguration = configurationSchema.safeParse(value);
		if (!saveConfiguration.success) {
			setError(saveConfiguration.error.issues.map((i) => i.message).join(" "));
			return;
		}
		const input = {
			...saveConfiguration.data,
			observations: saveConfiguration.data.states.flatMap((s, index) =>
				value.targets.flatMap((t, targetIndex) => {
					const o = value.observations[`${value.drafts[index]?.key}/${t.key}`];
					return o?.notes.trim()
						? [
								{
									componentId: s.componentId,
									stateId: s.stateId,
									targetIndex,
									...o,
								},
							]
						: [];
				})
			),
		};
		setBusy(true);
		try {
			const saved = await saveStretchTest.mutateAsync(input);
			setPending(input);
			await queryClient.invalidateQueries({ queryKey: listKey });
			const refreshed =
				queryClient.getQueryData<UiStretchTestRecord[]>(listKey);
			const refreshFailed =
				queryClient.getQueryState(listKey)?.status === "error";
			if (refreshed?.some((r) => r.id === saved.id) && !refreshFailed) {
				setPending(null);
				setMessage("Stretch test saved.");
			} else {
				setError(
					"Save returned, but readback is not confirmed. Check current tests."
				);
			}
		} catch (failure) {
			setError(getErrorMessage(failure, "Could not save the stretch test."));
			if (isWriteOutcomeUncertain(failure)) {
				setPending(input);
			}
		} finally {
			setBusy(false);
		}
	}
	async function download(record: UiStretchTestRecord) {
		setBusy(true);
		setError("");
		try {
			const manifest = await exportStretchTest.mutateAsync({
				projectId,
				assetFamilyId,
				id: record.id,
			});
			const json = JSON.stringify(manifest, null, 2);
			readUiProfileManifest(json);
			const url = URL.createObjectURL(
				new Blob([json], { type: "application/json" })
			);
			const a = document.createElement("a");
			a.href = url;
			a.download = `ui-stretch-${record.id}.json`;
			a.click();
			URL.revokeObjectURL(url);
			setMessage("UI profile metadata verified and downloaded.");
		} catch (failure) {
			setError(
				getErrorMessage(
					failure,
					"Could not export UI profile metadata.",
					"query"
				)
			);
		} finally {
			setBusy(false);
		}
	}
	const options = available.map((v) => (
		<NativeSelectOption key={v.id} value={v.id}>
			{assetRecords.find((r) => r.id === v.assetRecordId)?.name} · v
			{v.versionNumber}
		</NativeSelectOption>
	));
	return (
		<section className="space-y-4 rounded-lg border p-4">
			<h3 className="font-semibold">UI stretch and text test · {familyName}</h3>
			<p className="text-muted-foreground text-sm">
				Margins and text area use source-image pixels from the top-left corner.
				Corners keep their natural size; edges and center stretch. The dashed
				outline shows the mapped text safe area. Inspect the text before
				recording your result.
			</p>
			{query.isPending ? <p role="status">Loading stretch tests…</p> : null}
			{query.isError ? (
				<div role="alert">
					{getErrorMessage(
						query.error,
						"Could not load stretch tests.",
						"query"
					)}{" "}
					<Button onClick={() => query.refetch()} type="button">
						Retry
					</Button>
				</div>
			) : null}
			{error ? <p role="alert">{error}</p> : null}
			{message ? <p role="status">{message}</p> : null}
			<form
				className="space-y-4"
				onSubmit={(event) => {
					event.preventDefault();
					event.stopPropagation();
					void form.handleSubmit();
				}}
			>
				<FieldSet
					className="space-y-4"
					disabled={busy || !!pending || query.isPending || query.isError}
				>
					<FieldLegend className="sr-only">Stretch test setup</FieldLegend>
					<form.Field name="screenVersion">
						{(field) => (
							<Label className={labelClass}>
								Screen version (optional)
								<NativeSelect
									className={selectClass}
									onChange={(e) => {
										field.handleChange(e.target.value);
										resetObservations();
									}}
									value={field.state.value}
								>
									<NativeSelectOption value="">
										No screen link
									</NativeSelectOption>
									{options}
								</NativeSelect>
							</Label>
						)}
					</form.Field>
					{screenVersion ? (
						<img
							alt="Linked screen"
							className="max-h-64 max-w-full"
							height={
								available.find((v) => v.id === screenVersion)
									?.sourceImageDimensions?.height
							}
							src={previewSource(
								available.find((v) => v.id === screenVersion)?.previewUrl ?? ""
							)}
							width={
								available.find((v) => v.id === screenVersion)
									?.sourceImageDimensions?.width
							}
						/>
					) : null}
					<form.Field mode="array" name="drafts">
						{(draftsField) => (
							<>
								{drafts.map((d, index) => (
									<FieldSet
										className="space-y-3 rounded border p-3"
										key={d.key}
									>
										<FieldLegend>State {index + 1}</FieldLegend>
										<div className="grid gap-3 sm:grid-cols-3">
											<form.Field name={`drafts[${index}].componentId`}>
												{(field) => (
													<Label className={labelClass}>
														Component identity
														<Input
															className={fieldClass}
															onChange={(e) => {
																field.handleChange(e.target.value);
																changeDraft();
															}}
															required
															value={field.state.value}
														/>
													</Label>
												)}
											</form.Field>
											<form.Field name={`drafts[${index}].stateId`}>
												{(field) => (
													<Label className={labelClass}>
														State identity
														<Input
															className={fieldClass}
															onChange={(e) => {
																field.handleChange(e.target.value);
																changeDraft();
															}}
															required
															value={field.state.value}
														/>
													</Label>
												)}
											</form.Field>
											<form.Field name={`drafts[${index}].assetVersionId`}>
												{(field) => (
													<Label className={labelClass}>
														Exact version
														<select
															className={nativeSelectClass}
															onChange={(e) => {
																field.handleChange(e.target.value);
																changeDraft();
															}}
															required
															value={field.state.value}
														>
															<NativeSelectOption value="">
																Select a version
															</NativeSelectOption>
															{options}
														</select>
													</Label>
												)}
											</form.Field>
											{uiStretchBoundsFields.map(([boundsField, label]) => (
												<form.Field
													key={boundsField}
													name={`drafts[${index}].${boundsField}`}
												>
													{(field) => (
														<Label className={labelClass}>
															{label}
															<Input
																className={fieldClass}
																min={
																	boundsField === "width" ||
																	boundsField === "height"
																		? 1
																		: 0
																}
																onChange={(e) => {
																	field.handleChange(e.target.value);
																	changeDraft();
																}}
																required
																step={1}
																type="number"
																value={field.state.value}
															/>
														</Label>
													)}
												</form.Field>
											))}
											<p>
												Natural size:{" "}
												{available.find((v) => v.id === d.assetVersionId)
													?.sourceImageDimensions?.width ?? "—"}{" "}
												×{" "}
												{available.find((v) => v.id === d.assetVersionId)
													?.sourceImageDimensions?.height ?? "—"}{" "}
												px
											</p>
										</div>
										<Button
											disabled={drafts.length === 1}
											onClick={() => {
												draftsField.removeValue(index);
												resetObservations();
											}}
											type="button"
										>
											Remove state {index + 1}
										</Button>
									</FieldSet>
								))}
								<Button
									disabled={drafts.length >= 24}
									onClick={() => {
										draftsField.pushValue(newState());
										resetObservations();
									}}
									type="button"
								>
									Add state
								</Button>
							</>
						)}
					</form.Field>
					<form.Field mode="array" name="targets">
						{(targetsField) => (
							<>
								{targets.map((t, index) => (
									<FieldSet
										className="flex flex-wrap items-end gap-3"
										key={t.key}
									>
										<FieldLegend>Target {index + 1}</FieldLegend>
										<form.Field name={`targets[${index}].width`}>
											{(field) => (
												<Label className={labelClass}>
													Target width
													<Input
														className={fieldClass}
														max={4096}
														min={1}
														onChange={(e) => {
															field.handleChange(e.target.value);
															resetObservations();
														}}
														required
														type="number"
														value={field.state.value}
													/>
												</Label>
											)}
										</form.Field>
										<form.Field name={`targets[${index}].height`}>
											{(field) => (
												<Label className={labelClass}>
													Target height
													<Input
														className={fieldClass}
														max={4096}
														min={1}
														onChange={(e) => {
															field.handleChange(e.target.value);
															resetObservations();
														}}
														required
														type="number"
														value={field.state.value}
													/>
												</Label>
											)}
										</form.Field>
										<Button
											disabled={targets.length === 1}
											onClick={() => {
												targetsField.removeValue(index);
												resetObservations();
											}}
											type="button"
										>
											Remove target {index + 1}
										</Button>
									</FieldSet>
								))}
								<Button
									disabled={targets.length >= 12}
									onClick={() => {
										targetsField.pushValue({
											key: crypto.randomUUID(),
											width: "",
											height: "",
										});
										resetObservations();
									}}
									type="button"
								>
									Add target
								</Button>
							</>
						)}
					</form.Field>
					<form.Field name="sampleText">
						{(field) => (
							<Label className={labelClass}>
								Sample text
								<Textarea
									className={fieldClass}
									maxLength={2000}
									onChange={(e) => {
										field.handleChange(e.target.value);
										resetObservations();
									}}
									value={field.state.value}
								/>
							</Label>
						)}
					</form.Field>
					{configuration.success
						? configuration.data.states.flatMap((s, index) =>
								configuration.data.targets.map((t, targetIndex) => {
									const key = `${drafts[index]?.key}/${targets[targetIndex]?.key}`;
									const o = observations[key] ?? {
										outcome: "inconclusive" as const,
										notes: "",
									};
									return (
										<FieldSet
											className="space-y-3 rounded border p-3"
											key={key}
										>
											<FieldLegend>
												{s.componentId} · {s.stateId} · {t.width} × {t.height}{" "}
												px
											</FieldLegend>
											<div className="grid gap-3 lg:grid-cols-2">
												<div>
													<p>Natural size</p>
													<UiStretchPreview
														source={previewSource(
															available.find((v) => v.id === s.assetVersionId)
																?.previewUrl ?? ""
														)}
														state={s}
														target={s.naturalSize}
														text={sampleText}
													/>
												</div>
												<div>
													<p>Target size</p>
													<UiStretchPreview
														source={previewSource(
															available.find((v) => v.id === s.assetVersionId)
																?.previewUrl ?? ""
														)}
														state={s}
														target={t}
														text={sampleText}
													/>
												</div>
											</div>
											<form.Field name={`observations.${key}`}>
												{(field) => (
													<>
														<Label className={labelClass}>
															Test result
															<select
																className={nativeSelectClass}
																onChange={(e) => {
																	const result = e.target.value;
																	if (
																		result === "passed" ||
																		result === "failed" ||
																		result === "inconclusive"
																	) {
																		field.handleChange({
																			...o,
																			outcome: result,
																		});
																	}
																}}
																value={o.outcome}
															>
																<NativeSelectOption value="inconclusive">
																	Inconclusive
																</NativeSelectOption>
																<NativeSelectOption value="passed">
																	Passed
																</NativeSelectOption>
																<NativeSelectOption value="failed">
																	Failed
																</NativeSelectOption>
															</select>
														</Label>
														<Label className={labelClass}>
															Observation
															<Textarea
																className={fieldClass}
																maxLength={2000}
																onChange={(e) =>
																	field.handleChange({
																		...o,
																		notes: e.target.value,
																	})
																}
																value={o.notes}
															/>
														</Label>
													</>
												)}
											</form.Field>
										</FieldSet>
									);
								})
							)
						: null}
					<p>
						Missing observations remain Inconclusive. Saving this usage test
						does not approve the family.
					</p>
					<Button disabled={available.length === 0} type="submit">
						{busy ? "Saving…" : "Save stretch test"}
					</Button>
					{available.length === 0 ? (
						<p>
							Add a UI Asset Version with verified source dimensions to this
							family first.
						</p>
					) : null}
				</FieldSet>
			</form>
			{pending ? (
				<Button disabled={busy} onClick={checkCurrent} type="button">
					Check current tests
				</Button>
			) : null}
			<h4 className="font-medium">Saved stretch tests</h4>
			<ul className="space-y-3">
				{query.data?.map((record) => (
					<li className="space-y-2 rounded border p-3" key={record.id}>
						<p>{new Date(record.createdAt).toLocaleString()}</p>
						{record.evaluations.map((e) => (
							<p key={`${e.componentId}/${e.stateId}/${e.targetIndex}`}>
								{e.componentId} · {e.stateId} ·{" "}
								{record.targets[e.targetIndex]?.width} ×{" "}
								{record.targets[e.targetIndex]?.height} px · {e.outcome} ·
								geometry {e.geometry}
							</p>
						))}
						<SavedUiStretchTest
							record={record}
							sourceForVersion={(id) => {
								const url = available.find((v) => v.id === id)?.previewUrl;
								return url ? previewSource(url) : undefined;
							}}
						/>
						<Button
							disabled={busy}
							onClick={() => download(record)}
							type="button"
						>
							Download UI profile metadata
						</Button>
					</li>
				))}
			</ul>
		</section>
	);
}

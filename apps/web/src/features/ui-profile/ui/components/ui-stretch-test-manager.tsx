import type { AssetRecord } from "@sprite-anvil/api/asset-records";
import type { AssetVersion } from "@sprite-anvil/api/asset-versions";
import type { ProjectProfileContractActivation } from "@sprite-anvil/api/specialized-profile-contracts";
import { readUiProfileManifest } from "@sprite-anvil/api/ui-profile-export";
import {
	type UiStretchTestInput,
	type UiStretchTestRecord,
	uiStretchStateSchema,
	uiStretchTestInputSchema,
} from "@sprite-anvil/api/ui-stretch-tests";
import { Button } from "@sprite-anvil/ui/components/button";
import { useQuery } from "@tanstack/react-query";
import { type SyntheticEvent, useState } from "react";
import { ENV } from "@/env";
import { isWriteOutcomeUncertain } from "@/utils/error-notification";
import { getErrorMessage } from "@/utils/get-error-message";
import { client, orpc } from "@/utils/orpc";
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
const fields = [
	["left", "Left margin"],
	["right", "Right margin"],
	["top", "Top margin"],
	["bottom", "Bottom margin"],
	["x", "Text area X"],
	["y", "Text area Y"],
	["width", "Text area width"],
	["height", "Text area height"],
] as const;
type Draft = {
	key: string;
	componentId: string;
	stateId: string;
	assetVersionId: string;
} & Record<(typeof fields)[number][0], string>;
const newState = (): Draft => ({
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
const fieldClass = "block min-h-11 w-full rounded border bg-background p-2";
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
	const query = useQuery(
		orpc.uiStretchTests.list.queryOptions({
			input: { projectId, assetFamilyId },
		})
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
	const [drafts, setDrafts] = useState<Draft[]>(() => [newState()]);
	const [targets, setTargets] = useState(() => [
		{ key: crypto.randomUUID(), width: "", height: "" },
	]);
	const [screenVersion, setScreenVersion] = useState("");
	const [sampleText, setSampleText] = useState("Inventory item description");
	const [observations, setObservations] = useState<
		Record<
			string,
			{ outcome: "passed" | "failed" | "inconclusive"; notes: string }
		>
	>({});
	const [error, setError] = useState("");
	const [message, setMessage] = useState("");
	const [busy, setBusy] = useState(false);
	const [pending, setPending] = useState<UiStretchTestInput | null>(null);
	function change(key: string, field: keyof Draft, value: string) {
		setDrafts((ds) =>
			ds.map((d) => (d.key === key ? { ...d, [field]: value } : d))
		);
		setObservations({});
		setMessage("");
	}
	const states = drafts.map((d) => {
		const version = available.find((v) => v.id === d.assetVersionId);
		return uiStretchStateSchema.safeParse({
			componentId: d.componentId,
			stateId: d.stateId,
			assetVersionId: d.assetVersionId,
			assetRecordId: version?.assetRecordId ?? "",
			naturalSize: version?.sourceImageDimensions,
			stretchMargins: {
				left: Number(d.left),
				right: Number(d.right),
				top: Number(d.top),
				bottom: Number(d.bottom),
			},
			textSafeArea: {
				x: Number(d.x),
				y: Number(d.y),
				width: Number(d.width),
				height: Number(d.height),
			},
		});
	});
	const targetSizes = targets.map((t) => ({
		width: Number(t.width),
		height: Number(t.height),
	}));
	const configuration = uiStretchTestInputSchema.safeParse({
		id: crypto.randomUUID(),
		projectId,
		assetFamilyId,
		visualWorldId,
		contractRevisionId: activation.contractRevisionId,
		screen: screenVersion
			? {
					assetRecordId: available.find((v) => v.id === screenVersion)
						?.assetRecordId,
					assetVersionId: screenVersion,
				}
			: undefined,
		states: states.map((s) => (s.success ? s.data : null)),
		targets: targetSizes,
		observations: [],
		sampleText,
	});
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
	async function save(event: SyntheticEvent<HTMLFormElement>) {
		event.preventDefault();
		if (busy || pending) {
			return;
		}
		setError("");
		setMessage("");
		const invalidState = states.find((state) => !state.success);
		if (invalidState && !invalidState.success) {
			setError(
				invalidState.error.issues.map((issue) => issue.message).join(" ")
			);
			return;
		}
		if (!configuration.success) {
			setError(configuration.error.issues.map((i) => i.message).join(" "));
			return;
		}
		const input = {
			...configuration.data,
			observations: configuration.data.states.flatMap((s, index) =>
				targets.flatMap((t, targetIndex) => {
					const o = observations[`${drafts[index]?.key}/${t.key}`];
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
			const saved = await client.uiStretchTests.save(input);
			setPending(input);
			const result = await query.refetch();
			if (result.data?.some((r) => r.id === saved.id) && !result.isError) {
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
			const manifest = await client.uiStretchTests.export({
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
		<option key={v.id} value={v.id}>
			{assetRecords.find((r) => r.id === v.assetRecordId)?.name} · v
			{v.versionNumber}
		</option>
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
			<form className="space-y-4" onSubmit={save}>
				<fieldset
					className="space-y-4"
					disabled={busy || !!pending || query.isPending || query.isError}
				>
					<legend className="sr-only">Stretch test setup</legend>
					<label className="block">
						Screen version (optional)
						<select
							className={fieldClass}
							onChange={(e) => {
								setScreenVersion(e.target.value);
								setObservations({});
							}}
							value={screenVersion}
						>
							<option value="">No screen link</option>
							{options}
						</select>
					</label>
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
					{drafts.map((d, index) => (
						<fieldset className="space-y-3 rounded border p-3" key={d.key}>
							<legend>State {index + 1}</legend>
							<div className="grid gap-3 sm:grid-cols-3">
								<label>
									Component identity
									<input
										className={fieldClass}
										onChange={(e) =>
											change(d.key, "componentId", e.target.value)
										}
										required
										value={d.componentId}
									/>
								</label>
								<label>
									State identity
									<input
										className={fieldClass}
										onChange={(e) => change(d.key, "stateId", e.target.value)}
										required
										value={d.stateId}
									/>
								</label>
								<label>
									Exact version
									<select
										className={fieldClass}
										onChange={(e) =>
											change(d.key, "assetVersionId", e.target.value)
										}
										required
										value={d.assetVersionId}
									>
										<option value="">Select a version</option>
										{options}
									</select>
								</label>
								{fields.map(([field, label]) => (
									<label key={field}>
										{label}
										<input
											className={fieldClass}
											min={field === "width" || field === "height" ? 1 : 0}
											onChange={(e) => change(d.key, field, e.target.value)}
											required
											step={1}
											type="number"
											value={d[field]}
										/>
									</label>
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
									setDrafts((ds) => ds.filter((s) => s.key !== d.key));
									setObservations({});
								}}
								type="button"
							>
								Remove state {index + 1}
							</Button>
						</fieldset>
					))}
					<Button
						disabled={drafts.length >= 24}
						onClick={() => {
							setDrafts((ds) => [...ds, newState()]);
							setObservations({});
						}}
						type="button"
					>
						Add state
					</Button>
					{targets.map((t, index) => (
						<fieldset className="flex flex-wrap items-end gap-3" key={t.key}>
							<legend>Target {index + 1}</legend>
							<label>
								Target width
								<input
									className={fieldClass}
									max={4096}
									min={1}
									onChange={(e) => {
										setTargets((ts) =>
											ts.map((s) =>
												s.key === t.key ? { ...s, width: e.target.value } : s
											)
										);
										setObservations({});
									}}
									required
									type="number"
									value={t.width}
								/>
							</label>
							<label>
								Target height
								<input
									className={fieldClass}
									max={4096}
									min={1}
									onChange={(e) => {
										setTargets((ts) =>
											ts.map((s) =>
												s.key === t.key ? { ...s, height: e.target.value } : s
											)
										);
										setObservations({});
									}}
									required
									type="number"
									value={t.height}
								/>
							</label>
							<Button
								disabled={targets.length === 1}
								onClick={() => {
									setTargets((ts) => ts.filter((s) => s.key !== t.key));
									setObservations({});
								}}
								type="button"
							>
								Remove target {index + 1}
							</Button>
						</fieldset>
					))}
					<Button
						disabled={targets.length >= 12}
						onClick={() => {
							setTargets((ts) => [
								...ts,
								{ key: crypto.randomUUID(), width: "", height: "" },
							]);
							setObservations({});
						}}
						type="button"
					>
						Add target
					</Button>
					<label className="block">
						Sample text
						<textarea
							className={fieldClass}
							maxLength={2000}
							onChange={(e) => {
								setSampleText(e.target.value);
								setObservations({});
							}}
							value={sampleText}
						/>
					</label>
					{configuration.success
						? configuration.data.states.flatMap((s, index) =>
								configuration.data.targets.map((t, targetIndex) => {
									const key = `${drafts[index]?.key}/${targets[targetIndex]?.key}`;
									const o = observations[key] ?? {
										outcome: "inconclusive" as const,
										notes: "",
									};
									return (
										<fieldset
											className="space-y-3 rounded border p-3"
											key={key}
										>
											<legend>
												{s.componentId} · {s.stateId} · {t.width} × {t.height}{" "}
												px
											</legend>
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
											<label className="block">
												Test result
												<select
													className={fieldClass}
													onChange={(e) => {
														const result = e.target.value;
														if (
															result === "passed" ||
															result === "failed" ||
															result === "inconclusive"
														) {
															setObservations((os) => ({
																...os,
																[key]: { ...o, outcome: result },
															}));
														}
													}}
													value={o.outcome}
												>
													<option value="inconclusive">Inconclusive</option>
													<option value="passed">Passed</option>
													<option value="failed">Failed</option>
												</select>
											</label>
											<label className="block">
												Observation
												<textarea
													className={fieldClass}
													maxLength={2000}
													onChange={(e) =>
														setObservations((os) => ({
															...os,
															[key]: { ...o, notes: e.target.value },
														}))
													}
													value={o.notes}
												/>
											</label>
										</fieldset>
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
				</fieldset>
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

import { verifyExportBundle } from "@sprite-anvil/api/export-bundle-verification";
import {
	exportProfileContractVersion,
	exportProfileDefinitionSchema,
} from "@sprite-anvil/api/export-profiles";
import { Button } from "@sprite-anvil/ui/components/button";
import { Checkbox } from "@sprite-anvil/ui/components/checkbox";
import { Input } from "@sprite-anvil/ui/components/input";
import {
	NativeSelect,
	NativeSelectOption,
} from "@sprite-anvil/ui/components/native-select";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSelector } from "@tanstack/react-store";
import { strToU8, zipSync } from "fflate";
import { useId, useRef, useState } from "react";
import { z } from "zod";
import { authClient } from "@/lib/auth-client";
import { downloadZip } from "@/utils/download-zip";
import { isWriteOutcomeUncertain } from "@/utils/error-notification";
import { honoGetBytes, projectApiUrl } from "@/utils/hono-api";
import { client, orpc } from "@/utils/orpc";
import type { PendingExport } from "../../lib/pending-export-store";
import {
	pendingExportKey,
	pendingExportTable,
} from "../../lib/pending-export-store";

function pendingFor<T extends { signature: string }>(
	current: T | null,
	signature: string,
	make: () => T
): T {
	return current?.signature === signature ? current : make();
}

function fieldsLocked(pending: boolean, error: unknown): boolean {
	return pending || isWriteOutcomeUncertain(error);
}

function BundlePins({
	projectId,
	bundleId,
}: {
	projectId: string;
	bundleId: string;
}) {
	const [open, setOpen] = useState(false);
	const detail = useQuery({
		...orpc.exportBundles.get.queryOptions({ input: { projectId, bundleId } }),
		enabled: open,
		meta: { errorPresentation: "inline" },
	});
	return (
		<div>
			<Button onClick={() => setOpen(!open)} type="button" variant="outline">
				{open ? "Hide bundle details" : "View bundle details"}
			</Button>
			{open && detail.isPending ? (
				<p role="status">Loading bundle details…</p>
			) : null}
			{open && detail.isError ? (
				<p role="alert">Bundle details could not be loaded.</p>
			) : null}
			{open && detail.data ? (
				<section aria-label="Pinned bundle details">
					<p>
						Context Revision {detail.data.manifest.context.revisionNumber} ·{" "}
						{detail.data.manifest.context.revisionId}
					</p>
					<p>
						Export Profile version {detail.data.manifest.profile.revisionNumber}{" "}
						· {detail.data.manifest.profile.revisionId}
					</p>
					{detail.data.manifest.requiredSets.map((set) => (
						<div key={set.revisionId}>
							<p>
								Required Set version {set.revisionNumber} · {set.revisionId} ·
								Family {set.assetFamilyId}
							</p>
							<ul>
								{set.items.map((item) => (
									<li key={item.id}>
										{item.name} · {item.id}
									</li>
								))}
							</ul>
						</div>
					))}
					<ul aria-label="Pinned Asset Versions">
						{detail.data.manifest.files.map((file) => (
							<li key={file.path}>
								{file.path} · Asset Version {file.assetVersionId} · Asset Record{" "}
								{file.assetRecordId} · item {file.itemId}
							</li>
						))}
					</ul>
				</section>
			) : null}
		</div>
	);
}

function BundlePreview({
	projectId,
	selectedFamilies,
}: {
	projectId: string;
	selectedFamilies: string[];
}) {
	const preview = useQuery({
		...orpc.exportBundles.preview.queryOptions({
			input: { projectId, assetFamilyIds: selectedFamilies },
		}),
		enabled: selectedFamilies.length > 0,
		meta: { errorPresentation: "inline" },
	});
	if (!selectedFamilies.length) {
		return null;
	}
	return (
		<section aria-label="Current bundle inputs">
			<h3>Current bundle inputs</h3>
			<p>These inputs may change before the bundle is created.</p>
			{preview.isPending ? <p role="status">Loading current inputs…</p> : null}
			{preview.isError ? (
				<p role="alert">Current inputs could not be loaded.</p>
			) : null}
			{!(preview.isFetching || preview.isError) &&
			preview.data?.status === "family_unavailable" ? (
				<p role="alert">
					A selected Asset Family has no available Required Set.
				</p>
			) : null}
			{!(preview.isFetching || preview.isError) &&
			preview.data?.status === "resolved" ? (
				<div>
					<p>
						Current Context Revision {preview.data.context.revisionNumber} ·{" "}
						{preview.data.context.revisionId}
					</p>
					{preview.data.families.map((family) => (
						<div key={family.assetFamilyId}>
							<p>{family.assetFamilyName}</p>
							<p>
								Required Set version {family.requiredSet.revisionNumber} ·{" "}
								{family.requiredSet.revisionId}
							</p>
							<ul>
								{family.requiredSet.items.map((item) => (
									<li key={item.id}>
										{item.name} · {item.disposition}
									</li>
								))}
							</ul>
						</div>
					))}
					<ul>
						{preview.data.assetVersions.map((version) => (
							<li key={version.id}>
								Asset Version {version.versionNumber} · {version.id}
							</li>
						))}
					</ul>
					{preview.data.blockers.length ? (
						<p role="alert">Some selected items are not ready for export.</p>
					) : null}
				</div>
			) : null}
		</section>
	);
}

function usePendingExports(userId: string | undefined, projectId: string) {
	const queryClient = useQueryClient();
	const queryKey = ["pending-exports", userId, projectId] as const;
	const requests = useQuery({
		queryKey,
		queryFn: async () => {
			if (!userId) {
				return [];
			}
			const rows = await Promise.all(
				(["profile", "bundle"] as const).map((kind) =>
					pendingExportTable().get(pendingExportKey(userId, projectId, kind))
				)
			);
			return rows.filter((row): row is PendingExport => Boolean(row));
		},
		enabled: Boolean(userId),
		networkMode: "always",
		retry: false,
		meta: { errorPresentation: "inline" },
	});
	const saveRequest = useMutation({
		mutationFn: (request: PendingExport) => pendingExportTable().put(request),
		networkMode: "always",
		meta: { errorPresentation: "inline" },
		onSuccess: (_result, request) => {
			queryClient.setQueryData<PendingExport[]>(queryKey, (rows) => [
				...(rows ?? []).filter((row) => row.key !== request.key),
				request,
			]);
		},
	});

	async function clearPending(kind: "profile" | "bundle") {
		if (!userId) {
			throw new Error("Session unavailable.");
		}
		const key = pendingExportKey(userId, projectId, kind);
		await pendingExportTable().delete(key);
		queryClient.setQueryData<PendingExport[]>(queryKey, (rows) =>
			rows?.filter((row) => row.key !== key)
		);
	}

	return {
		stored: requests.data ?? [],
		storageError: requests.isError || saveRequest.isError,
		storageReady: requests.isSuccess,
		persist: saveRequest.mutateAsync,
		clearPending,
	};
}

function PendingRequests({
	stored,
	userId,
	projectId,
	storageReady,
	save,
	create,
}: {
	stored: PendingExport[];
	userId: string | undefined;
	projectId: string;
	storageReady: boolean;
	save: {
		isPending: boolean;
		mutate: (
			input: Extract<PendingExport, { kind: "profile" }>["input"]
		) => void;
	};
	create: {
		isPending: boolean;
		mutate: (
			input: Extract<PendingExport, { kind: "bundle" }>["input"]
		) => void;
	};
}) {
	return (
		<>
			{stored
				.filter(
					(request) =>
						userId &&
						request.key === pendingExportKey(userId, projectId, request.kind)
				)
				.map((request) => (
					<div key={request.key}>
						<p>Pending {request.kind} request</p>
						<Button
							disabled={!storageReady || save.isPending || create.isPending}
							onClick={() => {
								if (request.kind === "profile") {
									save.mutate(request.input);
								} else {
									create.mutate(request.input);
								}
							}}
							type="button"
						>
							Retry {request.kind}
						</Button>
					</div>
				))}
		</>
	);
}

async function clearKnownRejection(
	error: unknown,
	clear: () => Promise<void>,
	reset: () => void
) {
	if (!isWriteOutcomeUncertain(error)) {
		await clear();
		reset();
	}
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: The two related export forms coordinate their pending requests and validation in one panel.
export function ExportCreationPanel({ projectId }: { projectId: string }) {
	const formId = useId();
	const { data: session } = authClient.useSession();
	const userId = session?.user.id;
	const { stored, storageError, storageReady, persist, clearPending } =
		usePendingExports(userId, projectId);
	const mappingIds = useRef<string[]>([]);
	const qc = useQueryClient();
	const profilePending = useRef<{
		signature: string;
		input: Parameters<typeof client.exportProfiles.createRevision>[0];
	} | null>(null);
	const bundlePending = useRef<{
		signature: string;
		idempotencyKey: string;
	} | null>(null);
	const profiles = useQuery(
		orpc.exportProfiles.list.queryOptions({
			input: { projectId },
			meta: { errorPresentation: "inline" },
		})
	);
	const families = useQuery(
		orpc.assetFamilies.list.queryOptions({
			input: { projectId },
			meta: { errorPresentation: "inline" },
		})
	);
	const bundles = useQuery(
		orpc.exportBundles.list.queryOptions({
			input: { projectId },
			meta: { errorPresentation: "inline" },
		})
	);

	const save = useMutation(
		orpc.exportProfiles.createRevision.mutationOptions({
			meta: { errorPresentation: "inline" },
			onError: (error) =>
				clearKnownRejection(
					error,
					() => clearPending("profile"),
					() => {
						profilePending.current = null;
					}
				),
			onSuccess: async () => {
				await clearPending("profile");
				profilePending.current = null;
				await qc.invalidateQueries({
					queryKey: orpc.exportProfiles.list.key({ input: { projectId } }),
				});
			},
		})
	);
	const create = useMutation(
		orpc.exportBundles.create.mutationOptions({
			meta: { errorPresentation: "inline" },
			onError: (error) =>
				clearKnownRejection(
					error,
					() => clearPending("bundle"),
					() => {
						bundlePending.current = null;
					}
				),
			onSuccess: async () => {
				await clearPending("bundle");
				bundlePending.current = null;
				await qc.invalidateQueries({
					queryKey: orpc.exportBundles.list.key({ input: { projectId } }),
				});
			},
		})
	);
	const download = useMutation({
		meta: { errorPresentation: "inline" },
		mutationFn: async (bundleId: string) => {
			const bundle = await client.exportBundles.get({ projectId, bundleId });
			const entries = await Promise.all(
				bundle.files.map(
					async (file) =>
						[
							file.path,
							file.content === null && file.assetVersionId
								? await honoGetBytes(
										`${projectApiUrl(projectId)}/asset-versions/${encodeURIComponent(file.assetVersionId)}/preview`,
										"The asset could not be read"
									)
								: strToU8(file.content ?? ""),
						] as const
				)
			);
			const verification = await verifyExportBundle(
				entries.map(([path, bytes]) => ({ path, bytes }))
			);
			if (!verification.ok) {
				throw new Error("Bundle integrity verification failed.");
			}
			downloadZip(
				zipSync(Object.fromEntries(entries)),
				`bundle-${bundleId.slice(0, 8)}.zip`
			);
		},
	});
	const profileForm = useForm({
		defaultValues: {
			profileId: "",
			name: "",
			layout: "grid" as "grid" | "packed",
			padding: 0,
			trim: "none" as "none" | "transparent",
			scale: 1,
			namingTemplate: "",
			metadataMapping: [] as { sourceField: string; targetKey: string }[],
		},
		validators: {
			onSubmit: z
				.object({
					profileId: z.string(),
					name: z.string(),
					layout: z.enum(["grid", "packed"]),
					padding: z.number().int().min(0).max(64),
					trim: z.enum(["none", "transparent"]),
					scale: z.number().int().min(1).max(16),
					namingTemplate: z.string().trim().min(1),
					metadataMapping: exportProfileDefinitionSchema.shape.metadataMapping,
				})
				.refine((value) => Boolean(value.profileId || value.name.trim()), {
					message: "Enter a profile name.",
					path: ["name"],
				}),
		},
		onSubmit: async ({ value }) => {
			const existing = profiles.data?.profiles.find(
				(p) => p.id === value.profileId
			);
			const signature = JSON.stringify(value);
			profilePending.current = pendingFor(
				profilePending.current,
				signature,
				() => ({
					signature,
					input: {
						projectId,
						profileId: existing?.id ?? crypto.randomUUID(),
						revisionId: crypto.randomUUID(),
						name: existing?.name ?? value.name,
						contractVersion: exportProfileContractVersion,
						definition: exportProfileDefinitionSchema.parse({
							...existing?.revisions.at(-1)?.definition,
							layout: value.layout,
							padding: value.padding,
							trim: value.trim,
							scale: value.scale,
							namingTemplate: value.namingTemplate,
							fileFormat: "png",
							metadataMapping: value.metadataMapping,
						}),
					},
				})
			);
			try {
				if (
					!(userId && storageReady) ||
					stored.some((row) => row.kind === "profile")
				) {
					throw new Error("Storage unavailable");
				}
				await persist({
					key: pendingExportKey(userId, projectId, "profile"),
					kind: "profile",
					input: profilePending.current.input,
				});
				await save.mutateAsync(profilePending.current.input);
			} catch {
				/* Storage or mutation failure is shown separately. */
			}
		},
	});
	const bundleForm = useForm({
		defaultValues: { profileRevisionId: "", assetFamilyIds: [] as string[] },
		validators: {
			onSubmit: z.object({
				profileRevisionId: z.uuid({ error: "Choose a profile version." }),
				assetFamilyIds: z
					.array(z.uuid())
					.min(1, "Choose at least one Asset Family."),
			}),
		},
		onSubmit: async ({ value }) => {
			const signature = JSON.stringify(value);
			bundlePending.current = pendingFor(
				bundlePending.current,
				signature,
				() => ({
					signature,
					idempotencyKey: crypto.randomUUID(),
				})
			);
			try {
				if (
					!(userId && storageReady) ||
					stored.some((row) => row.kind === "bundle")
				) {
					throw new Error("Storage unavailable");
				}
				const input = {
					...value,
					projectId,
					idempotencyKey: bundlePending.current.idempotencyKey,
					adapterVersion: null,
					deliveryTargetRevisionId: null,
				};
				await persist({
					key: pendingExportKey(userId, projectId, "bundle"),
					kind: "bundle",
					input,
				});
				await create.mutateAsync(input);
			} catch {
				/* Mutation displays the error. */
			}
		},
	});
	const selectedFamilies = useSelector(
		bundleForm.store,
		(state) => state.values.assetFamilyIds
	);

	return (
		<section aria-label="Create Export Bundles" className="space-y-4">
			{!!storageError && (
				<p role="alert">
					Pending export requests could not be stored on this device.
				</p>
			)}
			<PendingRequests
				create={create}
				projectId={projectId}
				save={save}
				storageReady={storageReady}
				stored={stored}
				userId={userId}
			/>
			<h2>Export Profiles</h2>
			{!!profiles.isPending && <p role="status">Loading Export Profiles…</p>}
			{!!profiles.isError && (
				<p role="alert">Export Profiles could not be loaded.</p>
			)}
			{profiles.data?.profiles.length === 0 && <p>No Export Profiles yet.</p>}
			<form
				className="space-y-2"
				onSubmit={(e) => {
					e.preventDefault();
					void profileForm.handleSubmit();
				}}
			>
				<fieldset
					disabled={
						save.isPending ||
						(save.isError && isWriteOutcomeUncertain(save.error))
					}
				>
					<profileForm.Field name="profileId">
						{(f) => (
							<div>
								<label htmlFor={`${formId}-profileId`}>
									Profile to version
								</label>
								<NativeSelect
									id={`${formId}-profileId`}
									onChange={(e) => {
										const id = e.target.value;
										f.handleChange(id);
										const profile = profiles.data?.profiles.find(
											(p) => p.id === id
										);
										const definition = profile?.revisions.at(-1)?.definition;
										if (definition) {
											mappingIds.current = definition.metadataMapping.map(() =>
												crypto.randomUUID()
											);
											profileForm.setFieldValue("layout", definition.layout);
											profileForm.setFieldValue("padding", definition.padding);
											profileForm.setFieldValue("trim", definition.trim);
											profileForm.setFieldValue("scale", definition.scale);
											profileForm.setFieldValue(
												"namingTemplate",
												definition.namingTemplate
											);
											profileForm.setFieldValue(
												"metadataMapping",
												definition.metadataMapping.map((mapping) => ({
													...mapping,
												}))
											);
										}
									}}
									value={f.state.value}
								>
									<NativeSelectOption value="">New profile</NativeSelectOption>
									{profiles.data?.profiles.map((p) => (
										<NativeSelectOption key={p.id} value={p.id}>
											{p.name}
										</NativeSelectOption>
									))}
								</NativeSelect>
							</div>
						)}
					</profileForm.Field>
					<profileForm.Field name="name">
						{(f) => (
							<div>
								<label htmlFor={`${formId}-name`}>Profile name</label>
								<Input
									id={`${formId}-name`}
									onChange={(e) => f.handleChange(e.target.value)}
									value={f.state.value}
								/>
							</div>
						)}
					</profileForm.Field>
					<profileForm.Field name="layout">
						{(f) => (
							<div>
								<label htmlFor={`${formId}-layout`}>Layout</label>
								<NativeSelect
									id={`${formId}-layout`}
									onChange={(e) =>
										f.handleChange(e.target.value as "grid" | "packed")
									}
									value={f.state.value}
								>
									<NativeSelectOption value="grid">Grid</NativeSelectOption>
									<NativeSelectOption value="packed">Packed</NativeSelectOption>
								</NativeSelect>
							</div>
						)}
					</profileForm.Field>
					<profileForm.Field name="trim">
						{(f) => (
							<div>
								<label htmlFor={`${formId}-trim`}>Trim</label>
								<NativeSelect
									id={`${formId}-trim`}
									onChange={(e) =>
										f.handleChange(e.target.value as "none" | "transparent")
									}
									value={f.state.value}
								>
									<NativeSelectOption value="none">None</NativeSelectOption>
									<NativeSelectOption value="transparent">
										Transparent
									</NativeSelectOption>
								</NativeSelect>
							</div>
						)}
					</profileForm.Field>
					<profileForm.Field name="padding">
						{(f) => (
							<div>
								<label htmlFor={`${formId}-padding`}>Padding</label>
								<Input
									id={`${formId}-padding`}
									onChange={(e) => f.handleChange(Number(e.target.value))}
									type="number"
									value={f.state.value}
								/>
							</div>
						)}
					</profileForm.Field>
					<profileForm.Field name="scale">
						{(f) => (
							<div>
								<label htmlFor={`${formId}-scale`}>Scale</label>
								<Input
									id={`${formId}-scale`}
									onChange={(e) => f.handleChange(Number(e.target.value))}
									type="number"
									value={f.state.value}
								/>
							</div>
						)}
					</profileForm.Field>
					<profileForm.Field name="namingTemplate">
						{(f) => (
							<div>
								<label htmlFor={`${formId}-namingTemplate`}>
									Naming template
								</label>
								<Input
									id={`${formId}-namingTemplate`}
									onChange={(e) => f.handleChange(e.target.value)}
									value={f.state.value}
								/>
							</div>
						)}
					</profileForm.Field>
					<profileForm.Field mode="array" name="metadataMapping">
						{(field) => (
							<fieldset>
								<legend>Metadata mappings</legend>
								{field.state.value.map((_, index) => {
									const id = mappingIds.current[index];
									return (
										<div key={id}>
											<profileForm.Field
												name={`metadataMapping[${index}].sourceField`}
											>
												{(item) => (
													<div>
														<label htmlFor={`${formId}-${id}-source`}>
															Source field
														</label>
														<Input
															id={`${formId}-${id}-source`}
															onChange={(e) =>
																item.handleChange(e.target.value)
															}
															value={item.state.value}
														/>
													</div>
												)}
											</profileForm.Field>
											<profileForm.Field
												name={`metadataMapping[${index}].targetKey`}
											>
												{(item) => (
													<div>
														<label htmlFor={`${formId}-${id}-target`}>
															Target key
														</label>
														<Input
															id={`${formId}-${id}-target`}
															onChange={(e) =>
																item.handleChange(e.target.value)
															}
															value={item.state.value}
														/>
													</div>
												)}
											</profileForm.Field>
											<Button
												onClick={() => {
													mappingIds.current.splice(index, 1);
													field.removeValue(index);
												}}
												type="button"
											>
												Remove
											</Button>
										</div>
									);
								})}
								<Button
									disabled={field.state.value.length >= 50}
									onClick={() => {
										mappingIds.current.push(crypto.randomUUID());
										field.pushValue({ sourceField: "", targetKey: "" });
									}}
									type="button"
								>
									Add metadata mapping
								</Button>
							</fieldset>
						)}
					</profileForm.Field>
					<profileForm.Subscribe selector={(state) => state.errorMap}>
						{(errors) => {
							const issues = errors.onSubmit;
							return issues ? (
								<div role="alert">
									{Object.values(issues)
										.flat()
										.map((issue) => (
											<p key={JSON.stringify(issue)}>
												{typeof issue === "object" &&
												issue &&
												"message" in issue
													? String(issue.message)
													: String(issue)}
											</p>
										))}
								</div>
							) : null;
						}}
					</profileForm.Subscribe>
				</fieldset>
				<Button disabled={!storageReady || save.isPending} type="submit">
					{save.isPending ? "Saving…" : "Save profile version"}
				</Button>
				{!!save.isError && <p role="alert">{save.error.message}</p>}
				{!!save.isSuccess && <p role="status">Profile version saved.</p>}
			</form>
			<h2>Create Engine-Neutral Bundle</h2>
			{!!families.isPending && <p role="status">Loading Asset Families…</p>}
			{!!families.isError && (
				<p role="alert">Asset Families could not be loaded.</p>
			)}
			{families.data?.assetFamilies.length === 0 && (
				<p>No Asset Families yet.</p>
			)}
			<form
				className="space-y-2"
				onSubmit={(e) => {
					e.preventDefault();
					void bundleForm.handleSubmit();
				}}
			>
				<fieldset disabled={fieldsLocked(create.isPending, create.error)}>
					<bundleForm.Field name="profileRevisionId">
						{(f) => (
							<div>
								<label htmlFor={`${formId}-profileRevisionId`}>
									{" "}
									Profile version
								</label>
								<NativeSelect
									id={`${formId}-profileRevisionId`}
									onChange={(e) => f.handleChange(e.target.value)}
									value={f.state.value}
								>
									<NativeSelectOption value="">
										Choose a profile version
									</NativeSelectOption>
									{profiles.data?.profiles.flatMap((p) =>
										p.revisions.map((r) => (
											<NativeSelectOption key={r.id} value={r.id}>
												{p.name} — version {r.revisionNumber}
											</NativeSelectOption>
										))
									)}
								</NativeSelect>
							</div>
						)}
					</bundleForm.Field>
					<bundleForm.Field name="assetFamilyIds">
						{(f) => (
							<fieldset>
								<legend>Asset Families</legend>
								{families.data?.assetFamilies.map((family) => (
									<div className="block" key={family.id}>
										<Checkbox
											checked={f.state.value.includes(family.id)}
											disabled={fieldsLocked(create.isPending, create.error)}
											id={`${formId}-assetFamilyIds-${family.id}`}
											onCheckedChange={(checked) =>
												f.handleChange(
													checked
														? [...f.state.value, family.id]
														: f.state.value.filter((id) => id !== family.id)
												)
											}
										/>
										<label htmlFor={`${formId}-assetFamilyIds-${family.id}`}>
											{family.name}
										</label>
									</div>
								))}
							</fieldset>
						)}
					</bundleForm.Field>
					<bundleForm.Subscribe selector={(state) => state.errorMap}>
						{(errors) =>
							errors.onSubmit ? (
								<div role="alert">
									{Object.values(errors.onSubmit)
										.flat()
										.map((issue) => (
											<p key={JSON.stringify(issue)}>
												{typeof issue === "object" &&
												issue &&
												"message" in issue
													? String(issue.message)
													: String(issue)}
											</p>
										))}
								</div>
							) : null
						}
					</bundleForm.Subscribe>
				</fieldset>
				<BundlePreview
					projectId={projectId}
					selectedFamilies={selectedFamilies}
				/>
				<Button disabled={!storageReady || create.isPending} type="submit">
					{create.isPending ? "Creating…" : "Create bundle"}
				</Button>
				{!!create.isError && <p role="alert">{create.error.message}</p>}
				{!!create.isSuccess && <p role="status">Bundle created.</p>}
			</form>
			<h2>Engine-Neutral Bundles</h2>
			{!!bundles.isPending && <p role="status">Loading bundles…</p>}
			{!!bundles.isError && <p role="alert">Bundles could not be loaded.</p>}
			{bundles.data?.bundles.length === 0 && (
				<p>No Engine-Neutral Bundles yet.</p>
			)}
			{bundles.data?.bundles.map((bundle) => (
				<div key={bundle.id}>
					<span>
						Bundle {bundle.id.slice(0, 8)} {bundle.isLatest ? "(latest)" : ""}
					</span>{" "}
					<BundlePins bundleId={bundle.id} projectId={projectId} />
					<Button
						disabled={download.isPending}
						onClick={() => download.mutate(bundle.id)}
						type="button"
					>
						Download bundle
					</Button>
				</div>
			))}
			{!!download.isPending && <p role="status">Preparing download…</p>}
			{!!download.isError && (
				<p role="alert">Download failed: {download.error.message}</p>
			)}
			{!!download.isSuccess && <p role="status">Bundle downloaded.</p>}
		</section>
	);
}

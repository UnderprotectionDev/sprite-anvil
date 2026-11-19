import type { AssetRecordTracking } from "@sprite-anvil/api/asset-record-tracking";
import type {
	AssetRecord,
	AssetRecordCreateInput,
} from "@sprite-anvil/api/asset-records";
import { Button, buttonVariants } from "@sprite-anvil/ui/components/button";
import { Checkbox } from "@sprite-anvil/ui/components/checkbox";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@sprite-anvil/ui/components/dialog";
import { FieldLegend, FieldSet } from "@sprite-anvil/ui/components/field";
import { Input } from "@sprite-anvil/ui/components/input";
import { Label } from "@sprite-anvil/ui/components/label";
import { WindowVirtualList } from "@sprite-anvil/ui/components/window-virtual-list";
import { useForm, useStore } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { AnimationMetadataPackagePanel } from "@/components/animation-metadata-package-panel";
import { AssetRecordSearchPanel } from "@/components/asset-record-search-panel";
import { GameplayMetadataPanel } from "@/components/gameplay-metadata-panel";
import { GenerationPackagePanel } from "@/components/generation-package-panel";
import { ReferenceBoardView } from "@/components/reference-board-view";
import { RightsLineagePanel } from "@/components/rights-lineage-panel";
import { RightsRecordPanel } from "@/components/rights-record-panel";
import { StatusMessage } from "@/components/status-message";
import { TaskWorkspace } from "@/components/task-workspace";
import { isWriteOutcomeUncertain } from "@/utils/error-notification";
import { getErrorMessage } from "@/utils/get-error-message";
import { mutationMeta } from "@/utils/mutation-meta";
import { orpc } from "@/utils/orpc";
import { assetRecordCreateFormSchema } from "../../schemas";
import {
	AssetRecordAvailabilityControl,
	getAvailabilityLabel,
} from "../components/asset-record-availability-control";
import { AssetRecordTrackingPanel } from "../components/asset-record-tracking-panel";
import { AssetRecordMeasurementsForm } from "../forms/asset-record-measurements-form";
import { AssetRecordMetadataForm } from "../forms/asset-record-metadata-form";
import { ManualImportEvidenceForm } from "../forms/manual-import-evidence-form";

const identityOptions = [
	{
		value: "independent_product_meaning",
		label: "Independent product meaning",
		description:
			"A character, object, or visual with its own identity and purpose in the game.",
	},
	{
		value: "independent_lifecycle",
		label: "Independent lifecycle",
		description: "An asset that changes or evolves independently.",
	},
	{
		value: "delivery_identity",
		label: "Delivery identity",
		description: "Content delivered to the game as a separate asset.",
	},
] as const;
type IdentityCriterion = (typeof identityOptions)[number]["value"];

function getIdentityLabel(value: string) {
	return (
		identityOptions.find((option) => option.value === value)?.label ?? value
	);
}

function getIdentitySummary(identityCriteria: readonly string[]) {
	return identityCriteria.length > 0
		? identityCriteria.map(getIdentityLabel).join(" · ")
		: "No rationale saved";
}

function isNotFound(error: unknown) {
	return (
		typeof error === "object" &&
		error !== null &&
		"code" in error &&
		error.code === "NOT_FOUND"
	);
}

function AssetRecordList({
	recordsQuery,
	projectId,
	offset,
	setPage,
	onOpenRecord,
}: {
	recordsQuery: import("@tanstack/react-query").UseQueryResult<
		import("@sprite-anvil/api/asset-records").AssetRecordSearchResponse,
		Error
	>;
	projectId: string;
	offset: number;
	setPage: (page: { projectId: string; offset: number }) => void;
	onOpenRecord: (assetRecordId: string) => void;
}) {
	const records = recordsQuery.data?.records.map(({ record }) => record) ?? [];
	let recordsState: ReactNode = null;
	if (recordsQuery.isPending) {
		recordsState = <p aria-live="polite">Loading Asset Records…</p>;
	} else if (recordsQuery.isError) {
		recordsState = (
			<div className="space-y-3">
				<StatusMessage tone="error">
					Could not load Asset Records.
				</StatusMessage>
				<Button
					onClick={() => void recordsQuery.refetch()}
					type="button"
					variant="outline"
				>
					Try again
				</Button>
			</div>
		);
	} else if (records.length === 0) {
		recordsState = (
			<div>
				<p className="text-muted-foreground rounded-lg border border-dashed p-5">
					{offset > 0
						? "No records on this page."
						: "This project has no Asset Records yet. Use New Asset Record to get started."}
				</p>
				{offset > 0 ? (
					<Button
						onClick={() =>
							setPage({ projectId, offset: Math.max(0, offset - 50) })
						}
						type="button"
						variant="outline"
					>
						Previous
					</Button>
				) : null}
			</div>
		);
	} else {
		recordsState = (
			<div className="space-y-3">
				<WindowVirtualList
					getItemKey={(record) => record.id}
					items={records}
					renderItem={(record) => (
						<div className="flex flex-col justify-between gap-3 rounded-lg border p-4 sm:flex-row sm:items-center">
							<div>
								<h3 className="font-medium">{record.name}</h3>
								<p className="text-muted-foreground text-sm">
									{getIdentitySummary(record.identityCriteria)}
								</p>
								<p className="text-muted-foreground text-sm">
									Record status · {getAvailabilityLabel(record.availability)}
								</p>
							</div>
							<Button
								aria-label={`${record.name} open record`}
								onClick={() => onOpenRecord(record.id)}
								variant="outline"
							>
								Open record
							</Button>
						</div>
					)}
				/>
				<div className="flex gap-2">
					<Button
						disabled={offset === 0 || recordsQuery.isFetching}
						onClick={() =>
							setPage({ projectId, offset: Math.max(0, offset - 50) })
						}
						type="button"
						variant="outline"
					>
						Previous
					</Button>
					<Button
						disabled={
							typeof recordsQuery.data?.nextOffset !== "number" ||
							recordsQuery.isFetching
						}
						onClick={() =>
							setPage({
								projectId,
								offset: recordsQuery.data?.nextOffset ?? offset,
							})
						}
						type="button"
						variant="outline"
					>
						Next
					</Button>
				</div>
			</div>
		);
	}

	return recordsState;
}

export function AssetRecordsView({
	onOpenRecord,
	projectId,
}: {
	onOpenRecord: (assetRecordId: string, versionId?: string) => void;
	projectId: string;
}) {
	const projectQueryOptions = orpc.projects.get.queryOptions({
		input: { projectId },
	});
	const projectQuery = useQuery({
		...projectQueryOptions,
	});
	const queryClient = useQueryClient();
	const [page, setPage] = useState({ projectId, offset: 0 });
	const offset = page.projectId === projectId ? page.offset : 0;
	const recordsQueryOptions = orpc.assetRecords.listPage.queryOptions({
		input: { projectId, pagination: { limit: 50, offset } },
	});
	const recordsQuery = useQuery({
		...recordsQueryOptions,
	});
	const pendingCreate = useRef<AssetRecordCreateInput | null>(null);
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [isSaving, setIsSaving] = useState(false);
	const createRecord = useMutation(
		orpc.assetRecords.create.mutationOptions(mutationMeta)
	);
	const [writeOutcomeUncertain, setWriteOutcomeUncertain] = useState(false);
	const [isCheckingWriteOutcome, setIsCheckingWriteOutcome] = useState(false);
	const [statusMessage, setStatusMessage] = useState<string | null>(null);

	const form = useForm({
		defaultValues: {
			identityCriteria: [] as IdentityCriterion[],
			name: "",
		},
		onSubmit: ({ value }) => handleCreateRecord(value),
		validators: { onSubmit: assetRecordCreateFormSchema },
	});
	const draftIsComplete = useStore(
		form.store,
		(state) => assetRecordCreateFormSchema.safeParse(state.values).success
	);

	async function checkWriteOutcome() {
		setIsCheckingWriteOutcome(true);
		try {
			const expectedId = pendingCreate.current?.id;
			if (!expectedId) {
				return;
			}
			try {
				const record = await queryClient.fetchQuery({
					...orpc.assetRecords.get.queryOptions({
						input: { projectId, assetRecordId: expectedId },
					}),
					staleTime: 0,
					retry: false,
				});
				setWriteOutcomeUncertain(false);
				setStatusMessage("Asset Record found.");
				pendingCreate.current = null;
				onOpenRecord(record.id);
			} catch (error) {
				if (isNotFound(error)) {
					setWriteOutcomeUncertain(false);
					setStatusMessage("Record not found. You can retry with the same ID.");
				}
			}
		} finally {
			setIsCheckingWriteOutcome(false);
		}
	}

	async function handleCreateRecord({
		identityCriteria,
		name,
	}: {
		identityCriteria: IdentityCriterion[];
		name: string;
	}) {
		if (writeOutcomeUncertain || isSaving || identityCriteria.length === 0) {
			return;
		}

		const trimmedName = name.trim();
		if (!trimmedName) {
			return;
		}

		const input =
			pendingCreate.current ??
			({
				id: crypto.randomUUID(),
				identityCriteria,
				name: trimmedName,
				projectId,
			} satisfies AssetRecordCreateInput);
		pendingCreate.current = input;
		setStatusMessage(null);
		setIsSaving(true);
		try {
			const record = await createRecord.mutateAsync(input);
			pendingCreate.current = null;
			void recordsQuery.refetch();
			onOpenRecord(record.id);
		} catch (error) {
			if (isWriteOutcomeUncertain(error)) {
				setWriteOutcomeUncertain(true);
			} else {
				pendingCreate.current = null;
			}
			toast.error(
				getErrorMessage(
					error,
					"Could not verify the Asset Record result. Check the current state."
				)
			);
		} finally {
			setIsSaving(false);
		}
	}

	let projectState: ReactNode = null;
	if (projectQuery.isPending) {
		projectState = <p aria-live="polite">Loading project…</p>;
	} else if (projectQuery.isError) {
		projectState = null;
	}

	return (
		<main className="mx-auto w-full max-w-3xl space-y-8 px-4 py-8">
			<header className="space-y-3">
				<Link
					className="text-muted-foreground inline-flex min-h-11 items-center text-sm underline underline-offset-4"
					to="/projects"
				>
					Back to projects
				</Link>
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div className="space-y-2">
						<p className="text-primary font-mono text-xs tracking-[0.16em] uppercase">
							Asset Records
						</p>
						<h1 className="font-serif text-4xl font-medium tracking-tight">
							{projectQuery.data?.name ?? "Oyun projesi"}
						</h1>
					</div>
					<Button
						className="min-h-11"
						onClick={() => setIsCreateOpen(true)}
						type="button"
					>
						New Asset Record
					</Button>
					<Link
						className={`${buttonVariants({ variant: "outline" })} min-h-11`}
						params={{ projectId }}
						to="/projects/$projectId/import-inbox"
					>
						Import Inbox
					</Link>
				</div>
				<p className="text-muted-foreground max-w-2xl">
					Track visuals with independent product meaning, lifecycle, or delivery
					identity under one Asset Record.
				</p>
			</header>

			{projectState}

			<Dialog
				onOpenChange={(open) => {
					if (!(isSaving || writeOutcomeUncertain)) {
						setIsCreateOpen(open);
					}
				}}
				open={isCreateOpen}
			>
				<DialogContent
					className="max-h-[calc(100dvh-2rem)] overflow-y-auto p-6 sm:max-w-xl"
					showCloseButton={!(isSaving || writeOutcomeUncertain)}
				>
					<DialogHeader>
						<DialogTitle>New Asset Record</DialogTitle>
						<DialogDescription>
							Create a new asset with an independent identity. You can add files
							as versions to an existing record.
						</DialogDescription>
					</DialogHeader>

					<section
						aria-label="Create Asset Record"
						className="space-y-4 rounded-lg border p-5"
					>
						<div>
							<p className="text-muted-foreground mt-1 text-sm">
								A different file or editable frame alone does not justify a new
								record.
							</p>
						</div>
						<form
							className="space-y-4"
							onSubmit={(event) => {
								event.preventDefault();
								event.stopPropagation();
								form.handleSubmit();
							}}
						>
							<form.Field name="name">
								{(field) => (
									<div className="space-y-2">
										<Label
											className="text-sm leading-normal font-medium"
											htmlFor="asset-record-name"
										>
											Asset name
										</Label>
										<Input
											disabled={writeOutcomeUncertain || isSaving}
											id="asset-record-name"
											maxLength={120}
											onChange={(event) => {
												field.handleChange(event.target.value);
												pendingCreate.current = null;
											}}
											required
											value={field.state.value}
										/>
									</div>
								)}
							</form.Field>
							<FieldSet
								aria-describedby="asset-record-identity-help"
								className="gap-0 space-y-3"
								disabled={writeOutcomeUncertain || isSaving}
							>
								<FieldLegend className="mb-2">
									This record's independent identity
								</FieldLegend>
								<form.Field name="identityCriteria">
									{(field) =>
										identityOptions.map((option) => (
											<Label
												className="has-checked:border-primary cursor-pointer items-start gap-3 rounded-md border p-3 text-sm leading-normal"
												key={option.value}
											>
												<Checkbox
													checked={field.state.value.includes(option.value)}
													className="mt-0.5"
													disabled={writeOutcomeUncertain || isSaving}
													onCheckedChange={(checked) => {
														field.handleChange(
															checked
																? [
																		...new Set([
																			...field.state.value,
																			option.value,
																		]),
																	]
																: field.state.value.filter(
																		(criterion) => criterion !== option.value
																	)
														);
														pendingCreate.current = null;
													}}
												/>
												<span>
													<span className="block text-sm font-medium">
														{option.label}
													</span>
													<span className="text-muted-foreground block text-sm">
														{option.description}
													</span>
												</span>
											</Label>
										))
									}
								</form.Field>
								<p
									className="text-muted-foreground text-sm"
									id="asset-record-identity-help"
								>
									Select at least one identity reason. Independent editing alone
									is not sufficient.
								</p>
							</FieldSet>
							{writeOutcomeUncertain ? (
								<Button
									disabled={isCheckingWriteOutcome}
									onClick={() => void checkWriteOutcome()}
									type="button"
									variant="outline"
								>
									{isCheckingWriteOutcome ? "Checking status…" : "Check status"}
								</Button>
							) : null}
							{statusMessage ? (
								<p aria-live="polite" role="status">
									{statusMessage}
								</p>
							) : null}
							<Button
								disabled={isSaving || writeOutcomeUncertain || !draftIsComplete}
								type="submit"
							>
								{isSaving ? "Saving…" : "Create Asset Record"}
							</Button>
						</form>
					</section>
				</DialogContent>
			</Dialog>

			<TaskWorkspace
				label="Library view"
				sections={[
					{
						id: "search",
						label: "Search and filter",
						description:
							"Find records by name, category, world, theme, dimensions, and tags. Open a record or matching version from the results.",
						content: (
							<>
								<AssetRecordSearchPanel
									key={projectId}
									onOpenRecord={onOpenRecord}
									projectId={projectId}
								/>
							</>
						),
					},
					{
						id: "all",
						label: "All records",
						description:
							"Review the project's Asset Records and their statuses.",
						content: (
							<>
								<section
									aria-labelledby="asset-records-heading"
									className="space-y-4"
								>
									<div>
										<h2
											className="text-xl font-semibold"
											id="asset-records-heading"
										>
											Asset Records
										</h2>
										<p className="text-muted-foreground mt-1 text-sm">
											Record identity is independent of files, versions, and
											separately replaceable units.
										</p>
									</div>
									<AssetRecordList
										offset={offset}
										onOpenRecord={onOpenRecord}
										projectId={projectId}
										recordsQuery={recordsQuery}
										setPage={setPage}
									/>
								</section>
							</>
						),
					},
				]}
			/>
		</main>
	);
}

export function AssetRecordDetailView({
	assetRecordId,
	focusVersionId,
	projectId,
}: {
	assetRecordId: string;
	focusVersionId?: string;
	projectId: string;
}) {
	const projectQuery = useQuery({
		...orpc.projects.get.queryOptions({ input: { projectId } }),
	});
	const recordQuery = useQuery({
		...orpc.assetRecords.get.queryOptions({
			input: { assetRecordId, projectId },
		}),
	});
	const trackingQueryOptions = orpc.assetRecords.tracking.queryOptions({
		input: { assetRecordId, projectId },
	});
	const trackingQuery = useQuery({
		...trackingQueryOptions,
		enabled: Boolean(recordQuery.data),
	});
	const record = recordQuery.data;
	let recordHeading: ReactNode;
	let trackingPanel: ReactNode = null;
	if (recordQuery.isPending) {
		recordHeading = (
			<h1 className="font-serif text-4xl font-medium tracking-tight">
				Loading Asset Record…
			</h1>
		);
	} else if (recordQuery.isError) {
		recordHeading = (
			<h1 className="font-serif text-4xl font-medium tracking-tight">
				Could not open Asset Record
			</h1>
		);
	} else if (record) {
		recordHeading = (
			<>
				<h1 className="font-serif text-4xl font-medium tracking-tight">
					{record.name}
				</h1>
				<p className="text-muted-foreground">
					{getIdentitySummary(record.identityCriteria)}
				</p>
			</>
		);
	} else {
		recordHeading = null;
	}
	if (trackingQuery.data) {
		trackingPanel = (
			<AssetRecordTrackingPanel
				detail={trackingQuery.data}
				focusVersionId={focusVersionId}
				onRefresh={() => trackingQuery.refetch()}
			/>
		);
	}
	function renderRecordInformation() {
		if (!record) {
			return null;
		}
		return (
			<>
				<AssetRecordAvailabilityControl
					onRefresh={() => recordQuery.refetch()}
					record={record}
				/>
				{record.availability === "erased" ? null : (
					<AssetRecordMetadataForm
						familyWorldId={
							trackingQuery.data?.tracking.family?.visualWorldId ?? null
						}
						projectId={projectId}
						record={record}
					/>
				)}
				{record.availability === "erased" ? (
					<section className="rounded-lg border p-5">
						<h2 className="text-xl font-semibold">Image dimensions</h2>
						<p className="text-muted-foreground mt-2 text-sm">
							An erased record's dimensions cannot be viewed or changed.
						</p>
					</section>
				) : (
					<AssetRecordMeasurementsForm
						onRefresh={() => recordQuery.refetch()}
						record={record}
					/>
				)}
			</>
		);
	}

	function renderRecordProduction() {
		if (!record) {
			return null;
		}
		return (
			<>
				{trackingQuery.data && record.availability !== "erased" ? (
					<ReferenceBoardView
						assetRecordId={record.id}
						assetRecordName={record.name}
						availableVersions={trackingQuery.data.tracking.availableVersions}
						hasCanonicalDesign={Boolean(
							trackingQuery.data.tracking.family?.canonicalVersionId
						)}
						onRefresh={() => trackingQuery.refetch()}
						projectId={projectId}
						references={trackingQuery.data.tracking.references}
					/>
				) : null}
				{trackingQuery.isError ? (
					<div>
						<StatusMessage tone="error">
							Could not load record information for references.
						</StatusMessage>
						<Button
							onClick={() => void trackingQuery.refetch()}
							type="button"
							variant="outline"
						>
							Try again
						</Button>
					</div>
				) : null}

				{record.availability === "erased" ? null : (
					<GenerationPackagePanel
						key={`generation-package-${record.id}`}
						projectId={projectId}
						record={record}
					/>
				)}
				{record.availability === "active" ? (
					<ManualImportEvidenceForm
						key={`manual-import-evidence-${record.id}`}
						onRefresh={() => trackingQuery.refetch()}
						record={record}
					/>
				) : null}
			</>
		);
	}

	return (
		<main className="mx-auto w-full max-w-3xl space-y-8 px-4 py-8">
			<header className="space-y-2">
				<Link
					className="inline-flex min-h-11 items-center text-sm underline underline-offset-4"
					params={{ projectId }}
					to="/projects/$projectId/assets"
				>
					Back to Asset Records
				</Link>
				<p className="text-primary font-mono text-xs tracking-[0.16em] uppercase">
					Asset library / {projectQuery.data?.name ?? "Oyun projesi"}
				</p>
				{recordHeading}
			</header>

			{recordQuery.isError ? (
				<div className="space-y-3">
					<StatusMessage tone="error">
						Could not load the record. Try again or return to Asset Records.
					</StatusMessage>
					<Button
						onClick={() => void recordQuery.refetch()}
						type="button"
						variant="outline"
					>
						Try again
					</Button>
				</div>
			) : null}
			{record ? (
				<TaskWorkspace
					initialSection="versions"
					key={record.id}
					label="Asset workspaces"
					sections={[
						{
							id: "versions",
							label: "Versions and files",
							description:
								"Review the Approved Version, alternatives, and record history; add a new Candidate Version.",
							content: (
								<>
									{trackingPanel}
									{trackingQuery.isPending ? (
										<p role="status">Loading version history…</p>
									) : null}
									{trackingQuery.isError ? (
										<div>
											<StatusMessage tone="error">
												Could not load version history.
											</StatusMessage>
											<Button
												onClick={() => void trackingQuery.refetch()}
												type="button"
												variant="outline"
											>
												Try again
											</Button>
										</div>
									) : null}
								</>
							),
						},
						{
							id: "information",
							label: "Record details",
							description:
								"Edit category, tags, visual scope, dimensions, and record status.",
							content: renderRecordInformation(),
						},
						{
							id: "gameplay",
							label: "Gameplay Metadata",
							description:
								"Manage Gameplay Metadata and animation metadata packages linked to exact versions and frames.",
							content: (
								<>
									{record.availability === "erased" ? null : (
										<GameplayMetadataPanel
											assetRecordId={record.id}
											projectId={projectId}
										/>
									)}
									<AnimationMetadataPackagePanel
										projectId={projectId}
										record={record}
									/>
								</>
							),
						},
						{
							id: "production",
							label: "Production and import",
							description:
								"Prepare a Generation Package with references or record evidence of an externally produced result.",
							content: renderRecordProduction(),
						},
						{
							id: "rights",
							label: "Rights Records",
							description:
								"Review this record's rights evidence and the separate rights history of dependent sources.",
							content: (
								<>
									{record.availability === "erased" ? null : (
										<RightsRecordPanel
											assetRecordId={record.id}
											key={`rights-record-${record.id}`}
											projectId={projectId}
										/>
									)}
									<AssetRecordLineageSection
										isTrackingError={trackingQuery.isError}
										key={`rights-lineage-${record.id}`}
										onRetryTracking={() => {
											void trackingQuery.refetch();
										}}
										projectId={projectId}
										record={record}
										tracking={trackingQuery.data?.tracking}
									/>
								</>
							),
						},
					]}
				/>
			) : null}
		</main>
	);
}

function getTrackingStatus(
	isError: boolean,
	hasTracking: boolean
): "error" | "loading" | "success" {
	if (isError) {
		return "error";
	}
	if (hasTracking) {
		return "success";
	}
	return "loading";
}

function AssetRecordLineageSection({
	isTrackingError,
	onRetryTracking,
	projectId,
	record,
	tracking,
}: {
	isTrackingError: boolean;
	onRetryTracking: () => void;
	projectId: string;
	record: AssetRecord;
	tracking?: AssetRecordTracking;
}) {
	if (record.availability === "erased") {
		return null;
	}

	return (
		<RightsLineagePanel
			onRetryTracking={onRetryTracking}
			projectId={projectId}
			record={record}
			tracking={tracking}
			trackingStatus={getTrackingStatus(isTrackingError, Boolean(tracking))}
		/>
	);
}

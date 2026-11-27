import type { BackgroundOperation } from "@sprite-anvil/api/background-operations";
import type { ProjectArchiveRestoreInput } from "@sprite-anvil/api/project-archive-restore";
import { projectArchiveRestoreInputSchema } from "@sprite-anvil/api/project-archive-restore";
import { Button } from "@sprite-anvil/ui/components/button";
import { Input } from "@sprite-anvil/ui/components/input";
import { Label } from "@sprite-anvil/ui/components/label";
import { cn } from "@sprite-anvil/ui/lib/utils";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowRight, Check, CircleAlert, Info, Upload, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { ProjectCover } from "@/components/project-cover";
import { isWriteOutcomeUncertain } from "@/utils/error-notification";
import { orpc } from "@/utils/orpc";
import type { ProjectCoverRecord } from "@/utils/project-cover";
import { useAccountArchives } from "../../hooks/use-account-archives";
import { isZip, useArchiveImport } from "../../hooks/use-archive-import";
import type { AccountArchive } from "../../lib/archive-summary";
import {
	archiveBytes,
	archiveDate,
	formatArchiveBytes,
} from "../../lib/archive-summary";

type RestoreTask = "upload" | "restore";
type RestoreSource = AccountArchive;

export function RestoreArchiveSelection({
	projectId,
	archiveId,
	cover,
	onAccepted,
}: {
	projectId: string;
	archiveId?: string;
	cover: ProjectCoverRecord;
	onAccepted: (operation: BackgroundOperation, task: RestoreTask) => void;
}) {
	const navigate = useNavigate();
	const catalog = useAccountArchives();
	const archive = useQuery({
		...orpc.projectArchives.get.queryOptions({
			input: { projectId, archiveId: archiveId ?? "" },
		}),
		enabled: Boolean(archiveId),
		meta: { errorPresentation: "inline" },
	});
	const sources =
		archive.data && !catalog.sources.some((item) => item.id === archiveId)
			? [
					{
						...archive.data,
						projectId,
						project: cover,
						projectName: cover.name,
						includedByteSize: archiveBytes(archive.data),
					},
					...catalog.sources,
				]
			: catalog.sources;
	const fileInput = useRef<HTMLInputElement>(null);
	const restoreAttempt = useRef<ProjectArchiveRestoreInput | null>(null);
	const restore = useMutation(
		orpc.projectArchives.requestRestore.mutationOptions({
			meta: { errorPresentation: "inline" },
			onSuccess: (operation) => onAccepted(operation, "restore"),
		})
	);
	const importRequest = useArchiveImport(projectId, (operation) =>
		onAccepted(operation, "upload")
	);
	const { upload } = importRequest;
	const error = upload.error ?? restore.error;
	const uncertain = isWriteOutcomeUncertain(error);
	const locked =
		restore.isPending ||
		upload.isPending ||
		uncertain ||
		restore.isSuccess ||
		upload.isSuccess;
	const form = useForm({
		defaultValues: { name: "", file: null as File | null },
		validators: {
			onSubmit: z.object({
				name: z.string().trim().min(1).max(120),
				file: z
					.custom<File>((value) => value instanceof File && isZip(value))
					.nullable(),
			}),
		},
		onSubmit: ({ value }) => {
			if (locked || !value.name.trim()) {
				return;
			}
			if (value.file) {
				if (!isZip(value.file)) {
					return;
				}
				importRequest.submit({ file: value.file, name: value.name.trim() });
				return;
			}
			if (!(archive.data && archiveId)) {
				return;
			}
			const parsed = projectArchiveRestoreInputSchema.safeParse({
				projectId,
				archiveId,
				name: value.name,
				idempotencyKey: crypto.randomUUID(),
			});
			if (parsed.success) {
				restoreAttempt.current = parsed.data;
				restore.mutate(parsed.data);
			}
		},
	});
	function selectSource(source: RestoreSource) {
		if (locked) {
			return;
		}
		form.setFieldValue("file", null);
		if (fileInput.current) {
			fileInput.current.value = "";
		}
		upload.reset();
		restore.reset();
		if (source.id === archiveId && source.project.id === projectId) {
			return;
		}
		void navigate({
			to: "/projects/$projectId/project-archives",
			params: { projectId: source.project.id },
			search: { task: "restore", archiveId: source.id },
		});
	}
	function retry() {
		if (upload.error) {
			importRequest.retry();
		} else if (restoreAttempt.current) {
			restore.mutate(restoreAttempt.current);
		}
	}
	return (
		<form
			className="flex flex-col gap-3"
			onSubmit={(event) => {
				event.preventDefault();
				void form.handleSubmit();
			}}
		>
			<p className="text-workbench-muted-text text-[16px] leading-6">
				Pick an archive, or upload one you downloaded elsewhere.
			</p>
			<form.Subscribe selector={(state) => state.values.file}>
				{(file) => (
					<ArchiveSourcePicker
						activeId={file ? undefined : archiveId}
						disabled={locked}
						failed={catalog.failed}
						loading={catalog.loading}
						onSelect={selectSource}
						sources={sources}
					/>
				)}
			</form.Subscribe>
			<form.Field name="file">
				{(field) => (
					<ArchiveUploadStrip
						file={field.state.value}
						inputRef={fileInput}
						locked={locked}
						onChange={(file) => {
							field.handleChange(file);
							upload.reset();
							restore.reset();
						}}
					/>
				)}
			</form.Field>
			<div className="flex flex-wrap items-end gap-3">
				<div className="flex min-w-[180px] flex-[1.5] items-center gap-3">
					<Info className="text-workbench-focus size-4 shrink-0" />
					<div className="text-[14px] leading-5">
						<p className="font-semibold">Independent project</p>
						<p className="text-workbench-muted-text">
							Creates a new project. Your current projects aren’t changed.
						</p>
					</div>
				</div>
				<form.Field name="name">
					{(field) => (
						<div className="flex min-w-[180px] flex-1 flex-col gap-1">
							<Label
								className="shrink-0 text-[14px] font-medium"
								htmlFor="restore-project-name"
							>
								New project name
							</Label>
							<Input
								className="h-10 w-full rounded-[4px]"
								disabled={locked}
								id="restore-project-name"
								maxLength={120}
								onChange={(event) => field.handleChange(event.target.value)}
								placeholder={cover.name}
								required
								value={field.state.value}
							/>
						</div>
					)}
				</form.Field>
				<form.Subscribe selector={(state) => state.values}>
					{({ file, name }) => (
						<Button
							className="h-10 shrink-0 rounded-[4px] px-4"
							disabled={
								locked || !name.trim() || (file ? !isZip(file) : !archive.data)
							}
							type="submit"
						>
							Continue <ArrowRight className="size-4" />
						</Button>
					)}
				</form.Subscribe>
			</div>
			{archive.isError ? (
				<p className="text-workbench-danger text-sm" role="alert">
					Could not load the selected archive.
				</p>
			) : null}
			{error ? (
				<div
					className="bg-workbench-danger-wash border-workbench-danger/50 rounded-[4px] border p-3 text-sm"
					role="alert"
				>
					{uncertain
						? "The restore outcome is unknown. Retry the same request."
						: error.message}
					{uncertain ? (
						<Button
							className="ml-2"
							disabled={restore.isPending || upload.isPending}
							onClick={retry}
							type="button"
						>
							Retry restore
						</Button>
					) : null}
				</div>
			) : null}
		</form>
	);
}

function ArchiveSourcePicker({
	sources,
	activeId,
	disabled,
	loading,
	failed,
	onSelect,
}: {
	sources: RestoreSource[];
	activeId?: string;
	disabled: boolean;
	loading: boolean;
	failed: boolean;
	onSelect: (source: RestoreSource) => void;
}) {
	const container = useRef<HTMLDivElement>(null);
	const [width, setWidth] = useState(0);
	useEffect(() => {
		const element = container.current;
		if (!element) {
			return;
		}
		const observer = new ResizeObserver(() => setWidth(element.clientWidth));
		observer.observe(element);
		setWidth(element.clientWidth);
		return () => observer.disconnect();
	}, []);
	const long = sources.length > 12;
	const tileWidth = Math.max(142, (width - 40) / 4);
	const virtualizer = useVirtualizer({
		count: long ? sources.length : 0,
		getScrollElement: () => container.current,
		horizontal: true,
		estimateSize: () => tileWidth,
		gap: 12,
		overscan: 2,
	});
	// biome-ignore lint/correctness/useExhaustiveDependencies: Re-measure when the responsive estimate changes.
	useEffect(() => {
		virtualizer.measure();
	}, [virtualizer, tileWidth]);
	return (
		<div>
			<div
				aria-label="Available Project Archives"
				className="flex gap-3 overflow-x-auto p-0.5"
				ref={container}
				role="group"
			>
				{long ? (
					<div
						className="relative h-[152px] shrink-0"
						style={{ width: virtualizer.getTotalSize() }}
					>
						{virtualizer.getVirtualItems().map((item) => {
							const source = sources[item.index];
							return source ? (
								<div
									className="absolute top-0 h-full"
									key={source.id}
									style={{ left: item.start, width: item.size }}
								>
									<ArchiveSourceTile
										active={source.id === activeId}
										disabled={disabled}
										fullWidth
										onSelect={() => onSelect(source)}
										source={source}
									/>
								</div>
							) : null;
						})}
					</div>
				) : (
					sources.map((source) => (
						<ArchiveSourceTile
							active={source.id === activeId}
							disabled={disabled}
							key={source.id}
							onSelect={() => onSelect(source)}
							source={source}
						/>
					))
				)}
			</div>
			{loading ? (
				<p className="text-workbench-muted-text text-sm" role="status">
					Loading archives…
				</p>
			) : null}
			{failed ? (
				<p className="text-workbench-danger text-sm" role="alert">
					Could not load all Project Archives.
				</p>
			) : null}
			{loading || failed || sources.length ? null : (
				<p className="text-workbench-muted-text text-sm">
					No saved archives. Browse for a ZIP file instead.
				</p>
			)}
		</div>
	);
}

function ArchiveSourceTile({
	source,
	active,
	fullWidth,
	disabled,
	onSelect,
}: {
	source: RestoreSource;
	active: boolean;
	fullWidth?: boolean;
	disabled: boolean;
	onSelect: () => void;
}) {
	return (
		<Button
			aria-pressed={active}
			className={cn(
				"bg-workbench-background ring-workbench-border-strong hover:bg-workbench-panel-hover relative flex h-auto min-w-[142px] shrink-0 basis-[calc((100%_-_36px)/4)] flex-col items-stretch justify-start overflow-hidden rounded-[4px] p-0 text-left font-normal ring-1 ring-inset",
				active && "ring-workbench-selection ring-2",
				fullWidth && "w-full"
			)}
			disabled={disabled}
			onClick={onSelect}
			type="button"
			variant="ghost"
		>
			<ProjectCover
				className="h-[88px] w-full shrink-0 rounded-none"
				project={source.project}
			/>
			{active ? (
				<>
					<span
						aria-hidden="true"
						className="ring-workbench-selection pointer-events-none absolute inset-0 z-10 rounded-[4px] ring-2 ring-inset"
					/>
					<span className="bg-workbench-selection text-workbench-text absolute top-2 right-2 grid size-5 place-items-center rounded-full">
						<Check className="size-3" />
					</span>
				</>
			) : null}
			<span className="flex min-w-0 flex-col gap-0.5 px-3 py-[7px]">
				<span className="truncate text-[14px] font-semibold">
					{source.project.name}
				</span>
				<span className="text-workbench-muted-text font-mono text-[11px] whitespace-nowrap">
					{archiveDate(source.createdAt)} ·{" "}
					{formatArchiveBytes(source.includedByteSize)}
				</span>
			</span>
		</Button>
	);
}

function ArchiveUploadStrip({
	file,
	inputRef,
	locked,
	onChange,
}: {
	file: File | null;
	inputRef: React.RefObject<HTMLInputElement | null>;
	locked: boolean;
	onChange: (file: File | null) => void;
}) {
	const invalid = !!file && !isZip(file);
	return (
		// biome-ignore lint/a11y/noNoninteractiveElementInteractions: File dropping supplements the keyboard-accessible Browse files button.
		<div
			aria-label="Upload archive file"
			className={cn(
				"border-workbench-border-strong flex flex-wrap items-center gap-3 rounded-[4px] border border-dashed p-3",
				invalid && "border-workbench-danger bg-workbench-danger-wash"
			)}
			onDragOver={(event) => {
				event.preventDefault();
				event.dataTransfer.dropEffect = locked ? "none" : "copy";
			}}
			onDrop={(event) => {
				event.preventDefault();
				if (!locked && event.dataTransfer.files[0]) {
					onChange(event.dataTransfer.files[0]);
				}
			}}
			role="group"
		>
			{invalid ? (
				<CircleAlert className="text-workbench-danger size-4 shrink-0" />
			) : (
				<Upload className="text-workbench-muted-text size-4 shrink-0" />
			)}
			<div className="min-w-[120px] flex-1 text-sm">
				<p className="font-semibold break-all">
					{invalid
						? "Choose a non-empty ZIP archive."
						: (file?.name ?? "Upload an archive file")}
				</p>
				<p className="text-workbench-muted-text">
					{uploadStripHint(file, invalid)}
				</p>
			</div>
			<Input
				accept=".zip,application/zip"
				aria-label="Project Archive ZIP"
				className="sr-only"
				disabled={locked}
				onChange={(event) => onChange(event.target.files?.[0] ?? null)}
				ref={inputRef}
				type="file"
			/>
			{file ? (
				<Button
					aria-label="Remove archive file"
					className="size-9 rounded-[4px]"
					disabled={locked}
					onClick={() => {
						onChange(null);
						if (inputRef.current) {
							inputRef.current.value = "";
						}
					}}
					type="button"
					variant="ghost"
				>
					<X className="size-4" />
				</Button>
			) : null}
			<Button
				className="h-10 rounded-[4px] px-4"
				disabled={locked}
				onClick={() => inputRef.current?.click()}
				type="button"
				variant="outline"
			>
				Browse files
			</Button>
		</div>
	);
}

function uploadStripHint(file: File | null, invalid: boolean) {
	if (invalid) {
		return "Choose a .zip exported from Project Archive.";
	}
	return file
		? "Archive contents will be verified by the server."
		: "Drop a .zip downloaded from another environment.";
}

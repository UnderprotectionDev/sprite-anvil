import { projectContextCreateInputSchema } from "@sprite-anvil/api/project-context";
import { Button, buttonVariants } from "@sprite-anvil/ui/components/button";
import { Input } from "@sprite-anvil/ui/components/input";
import { Textarea } from "@sprite-anvil/ui/components/textarea";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
	ArrowLeft,
	CheckCircle2,
	CircleAlert,
	LoaderCircle,
} from "lucide-react";
import { ProjectCover } from "@/components/project-cover";
import { buildErrorNotification } from "@/utils/error-notification";
import { orpc } from "@/utils/orpc";
import {
	ProjectDeletionPanel,
	ProjectDeletionTracker,
} from "../components/project-deletion-panel";
import {
	CharacterCounter,
	ProjectSectionHeading,
} from "../components/project-section-heading";

export function ProjectDetailsView({ projectId }: { projectId: string }) {
	const projects = useQuery(orpc.projects.list.queryOptions());
	const contexts = useQuery(orpc.projectContexts.list.queryOptions());
	const project = projects.data?.find((item) => item.id === projectId);
	const context = contexts.data?.find((item) => item.id === projectId);
	return (
		<main className="bg-workbench-sidebar flex h-full min-h-0 flex-col overflow-y-auto px-4 pb-8 sm:px-8">
			<header className="flex h-[84px] shrink-0 items-center gap-3">
				<h1 className="font-heading grow text-[30px] leading-9 font-bold">
					Details
				</h1>
				<Link
					className={`${buttonVariants({ variant: "outline" })} h-10 rounded-[4px] pr-4 pl-3.5`}
					search={{ selected: projectId }}
					to="/projects"
				>
					<ArrowLeft className="size-4" /> Back to Projects
				</Link>
			</header>
			{projects.isPending || contexts.isPending ? (
				<p role="status">Loading project details…</p>
			) : null}
			{projects.isError || contexts.isError ? (
				<div role="alert">
					Could not load project details.{" "}
					<Button
						onClick={() => {
							void projects.refetch();
							void contexts.refetch();
						}}
						variant="outline"
					>
						Try again
					</Button>
				</div>
			) : null}
			{project && context ? (
				<div className="bg-workbench-background flex min-h-fit flex-1 flex-col gap-2 rounded-[4px] p-2 shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--color-workbench-selection)_55%,transparent),0_18px_72px_color-mix(in_srgb,var(--color-workbench-selection)_14%,transparent)] lg:min-h-0 lg:flex-row">
					<ProjectCover
						className="h-64 shrink-0 rounded-[2px] lg:h-auto lg:w-[min(400px,38%)] [&_img]:object-[35%_45%]"
						framed
						project={project}
					/>
					<ProjectMetadataForm
						generalArtDirection={context.generalArtDirection}
						key={context.id}
						name={context.name}
						projectId={context.id}
					/>
				</div>
			) : null}
			{projects.isPending ||
			contexts.isPending ||
			projects.isError ||
			contexts.isError ||
			(project && context) ? null : (
				<ProjectDeletionTracker projectId={projectId} />
			)}
		</main>
	);
}

function ProjectMetadataForm({
	projectId,
	name,
	generalArtDirection,
}: {
	projectId: string;
	name: string;
	generalArtDirection: string;
}) {
	const queryClient = useQueryClient();
	const update = useMutation(
		orpc.projects.update.mutationOptions({
			meta: { errorPresentation: "inline" },
		})
	);
	const form = useForm({
		defaultValues: { name, generalArtDirection },
		validators: {
			onChange: projectContextCreateInputSchema,
			onSubmit: projectContextCreateInputSchema,
		},
		onSubmit: async ({ value, formApi }) => {
			const input = projectContextCreateInputSchema.parse(value);
			try {
				await update.mutateAsync({ projectId, ...input });
			} catch {
				return;
			}
			queryClient.setQueryData(
				orpc.projectContexts.list.queryKey(),
				(current) =>
					current?.map((item) =>
						item.id === projectId ? { ...item, ...input } : item
					)
			);
			queryClient.setQueryData(orpc.projects.list.queryKey(), (current) =>
				current?.map((item) =>
					item.id === projectId ? { ...item, ...input } : item
				)
			);
			formApi.reset(input);
			await Promise.all([
				queryClient.invalidateQueries({
					queryKey: orpc.projects.list.queryKey(),
				}),
				queryClient.invalidateQueries({
					queryKey: orpc.projectContexts.list.queryKey(),
				}),
			]);
		},
	});
	return (
		<form
			className="flex min-w-0 grow flex-col gap-6 px-4 pt-8 pb-6 xl:px-10"
			onSubmit={(event) => {
				event.preventDefault();
				void form.handleSubmit();
			}}
		>
			<section className="flex flex-col gap-3">
				<ProjectSectionHeading label="Project name" />
				<form.Field name="name">
					{(field) => (
						<div className="relative">
							<Input
								aria-invalid={field.state.value.length > 60}
								aria-label="Project name"
								className="font-heading disabled:text-workbench-text h-[76px] rounded-[4px] pr-24 pl-[18px] text-[clamp(24px,3vw,40px)] leading-[44px] font-extrabold tracking-tight md:text-[40px]"
								disabled={update.isPending}
								maxLength={60}
								onBlur={field.handleBlur}
								onChange={(event) => field.handleChange(event.target.value)}
								value={field.state.value}
							/>
							<span className="text-workbench-faint-text absolute top-1/2 right-4 -translate-y-1/2 font-mono text-[13px]">
								{field.state.value.length}
								<span className="text-workbench-label-text"> / 60</span>
							</span>
							{field.state.value.length > 60 ? (
								<p className="text-workbench-danger text-sm" role="alert">
									Project name must contain no more than 60 characters.
								</p>
							) : null}
						</div>
					)}
				</form.Field>
			</section>
			<section className="flex flex-col gap-2">
				<ProjectSectionHeading label="Art approach" />
				<form.Field name="generalArtDirection">
					{(field) => (
						<div className="relative">
							<Textarea
								aria-invalid={field.state.value.length > 400}
								aria-label="General art direction"
								className="disabled:text-workbench-text h-[168px] resize-none rounded-[4px] px-4 pt-[14px] pb-10 text-base leading-6 md:text-base"
								disabled={update.isPending}
								maxLength={400}
								onBlur={field.handleBlur}
								onChange={(event) => field.handleChange(event.target.value)}
								value={field.state.value}
							/>
							<div className="absolute right-3 bottom-3">
								<CharacterCounter max={400} value={field.state.value.length} />
							</div>
							{field.state.value.length > 400 ? (
								<p className="text-workbench-danger text-sm" role="alert">
									Art approach must contain no more than 400 characters.
								</p>
							) : null}
						</div>
					)}
				</form.Field>
				<p className="text-workbench-faint-text text-[14px] leading-5">
					Project metadata. It reaches Project Context only as a suggestion you
					accept.
				</p>
			</section>
			<form.Subscribe
				selector={(state) => ({
					canSave: state.canSubmit && state.isDirty && !state.isSubmitting,
					dirty: state.isDirty,
				})}
			>
				{({ canSave, dirty }) => (
					<div className="flex items-center gap-4 pt-1">
						<ProjectSaveStatus
							dirty={dirty}
							name={name}
							saved={update.isSuccess}
							saving={update.isPending}
						/>
						<Button
							className={
								update.isPending
									? "bg-workbench-action disabled:bg-workbench-action disabled:text-workbench-on-action h-10 w-[148px] rounded-[4px] font-bold"
									: "h-10 w-[148px] rounded-[4px] font-semibold"
							}
							disabled={!canSave || update.isPending}
							type="submit"
						>
							{update.isPending ? (
								<>
									<LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" />
									Saving…
								</>
							) : (
								"Save changes"
							)}
						</Button>
					</div>
				)}
			</form.Subscribe>
			{update.isError ? (
				<p className="text-workbench-danger" role="alert">
					{buildErrorNotification(update.error, "mutation").description}
				</p>
			) : null}
			<ProjectDeletionPanel projectId={projectId} />
		</form>
	);
}

function ProjectSaveStatus({
	dirty,
	name,
	saved,
	saving,
}: {
	dirty: boolean;
	name: string;
	saved: boolean;
	saving: boolean;
}) {
	return (
		<div
			className="text-workbench-faint-text flex min-w-0 grow items-center gap-2 text-[14px]"
			role="status"
		>
			{saving ? (
				<>
					<LoaderCircle className="text-workbench-selection size-4 shrink-0 animate-spin motion-reduce:animate-none" />
					<div>
						<p className="text-workbench-text font-semibold">Saving {name}…</p>
						<p>Name and art approach are being saved.</p>
					</div>
				</>
			) : (
				<>
					{dirty ? (
						<CircleAlert className="size-4" />
					) : (
						<CheckCircle2 className="size-4" />
					)}
					<span>
						{dirty ? "Unsaved changes" : null}
						{!dirty && saved ? "Changes saved" : null}
						{dirty || saved ? null : "No unsaved changes"}
					</span>
				</>
			)}
		</div>
	);
}

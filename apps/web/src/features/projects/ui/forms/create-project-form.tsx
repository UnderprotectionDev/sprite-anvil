import { requireContractInput } from "@sprite-anvil/api/contract-input";
import type { ProjectContextCreateInput } from "@sprite-anvil/api/project-context";
import {
	projectArtDirectionMaxLength,
	projectContextCreateInputSchema,
	projectCreateContract,
	projectNameMaxLength,
} from "@sprite-anvil/api/project-context";
import { Button } from "@sprite-anvil/ui/components/button";
import { DialogClose } from "@sprite-anvil/ui/components/dialog";
import { Input } from "@sprite-anvil/ui/components/input";
import { Textarea } from "@sprite-anvil/ui/components/textarea";
import { useForm, useSelector } from "@tanstack/react-form";
import { Check, CircleAlert, Copy, Plus, Upload, X } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { z } from "zod";
import type { ProjectCoverRecord } from "@/components/project-cover";
import { ProjectCover } from "@/components/project-cover";
import type { ProjectLook } from "../../lib/project-look";
import {
	CharacterCounter,
	ProjectSectionHeading,
} from "../components/project-section-heading";

const emptyCreateProjectForm: ProjectContextCreateInput & {
	look: ProjectLook | null;
} = {
	name: "",
	generalArtDirection: "",
	look: null,
};

const projectInput = requireContractInput(projectCreateContract);
const draftSchema = projectContextCreateInputSchema.extend({
	look: z.custom<ProjectLook>().nullable(),
});

export function useCreateProjectForm(
	onSubmit: (input: ProjectContextCreateInput, look: ProjectLook | null) => void
) {
	return useForm({
		defaultValues: emptyCreateProjectForm,
		onSubmit: async ({ value }) => {
			const { look, ...metadata } = value;
			const result = await projectInput["~standard"].validate(metadata);
			if (!result.issues) {
				onSubmit(result.value, look);
			}
		},
		validators: {
			onChange: draftSchema,
			onMount: draftSchema,
			onSubmit: draftSchema,
		},
	});
}

export type CreateProjectFormApi = ReturnType<typeof useCreateProjectForm>;

export function CreateProjectForm({
	form,
	isSaving,
	writeOutcomeUncertain,
	projects = [],
	defaultLookId,
}: {
	form: CreateProjectFormApi;
	isSaving: boolean;
	writeOutcomeUncertain: boolean;
	projects?: (ProjectCoverRecord & { generalArtDirection?: string })[];
	defaultLookId?: string;
}) {
	const fileId = useId();
	const look = useSelector(form.store, (state) => state.values.look);
	const [imageError, setImageError] = useState<string>();
	const { uploadedFile, selected } = resolveLook(look, projects, defaultLookId);
	const localUrl = useLocalLookUrl(uploadedFile);
	const locked = isSaving || writeOutcomeUncertain;
	function nameUnavailable(name: string) {
		return projects.some(
			(project) =>
				project.name.trim().toLowerCase() === name.trim().toLowerCase()
		);
	}
	return (
		<form
			className="flex flex-col"
			onSubmit={(event) => {
				event.preventDefault();
				event.stopPropagation();
				if (!(locked || nameUnavailable(form.getFieldValue("name")))) {
					void form.handleSubmit();
				}
			}}
		>
			<div className="grid gap-10 px-8 pt-4 pb-8 lg:grid-cols-[minmax(0,440px)_minmax(0,1fr)]">
				<div className="flex min-w-0 flex-col gap-7">
					<section className="flex flex-col gap-2">
						<ProjectSectionHeading label="Project name" />
						<form.Field name="name">
							{(field) => {
								const duplicate = nameUnavailable(field.state.value);
								return (
									<>
										<Input
											aria-invalid={duplicate}
											aria-label="Game project name"
											autoComplete="off"
											className="font-heading h-16 rounded-[4px] px-[19px] text-[32px] leading-10 font-bold tracking-tight md:text-[32px]"
											disabled={locked}
											id="project-name"
											maxLength={projectNameMaxLength}
											name={field.name}
											onBlur={field.handleBlur}
											onChange={(event) =>
												field.handleChange(event.target.value)
											}
											required
											value={field.state.value}
										/>
										<div className="mt-1 flex min-h-5 flex-wrap items-center gap-2 text-[13px] leading-5 font-medium">
											<span
												className={
													duplicate
														? "text-workbench-danger-soft grow"
														: "text-workbench-muted-text grow"
												}
												role="status"
											>
												<NameAvailability
													duplicate={duplicate}
													name={field.state.value}
												/>
											</span>
											<CharacterCounter
												max={projectNameMaxLength}
												value={field.state.value.length}
											/>
										</div>
									</>
								);
							}}
						</form.Field>
					</section>
					<section className="flex grow flex-col gap-2">
						<ProjectSectionHeading label="Art approach" optional />
						<form.Field name="generalArtDirection">
							{(field) => (
								<div className="relative flex grow">
									<Textarea
										aria-label="General art direction"
										className="min-h-[136px] grow resize-none rounded-[4px] px-4 pt-[14px] pb-10 text-[15px] leading-[22px] md:text-[15px]"
										disabled={locked}
										id="project-art-direction"
										maxLength={projectArtDirectionMaxLength}
										name={field.name}
										onBlur={field.handleBlur}
										onChange={(event) => field.handleChange(event.target.value)}
										value={field.state.value}
									/>
									<div className="absolute right-3 bottom-3">
										<CharacterCounter
											max={projectArtDirectionMaxLength}
											value={field.state.value.length}
										/>
									</div>
								</div>
							)}
						</form.Field>
						<p className="text-workbench-faint-text text-[14px] leading-5">
							The approach stays project metadata until you suggest it to
							Project Context.
						</p>
					</section>
				</div>
				<section className="flex min-w-0 flex-col gap-[10px]">
					<ProjectSectionHeading label="Start from a look" />
					<div className="bg-workbench-scene ring-workbench-selection relative h-[240px] shrink-0 overflow-hidden rounded-[4px] ring-2 ring-inset">
						{uploadedFile && localUrl ? (
							<img
								alt="Uploaded project look"
								className="size-full object-cover object-[50%_40%]"
								height={240}
								src={localUrl}
								width={576}
							/>
						) : null}
						{!uploadedFile && selected ? (
							<ProjectCover
								className="size-full rounded-[4px]"
								project={selected}
							/>
						) : null}
						{uploadedFile || selected ? null : (
							<p className="text-workbench-faint-text flex h-full items-center justify-center">
								No starting look selected
							</p>
						)}
						{uploadedFile || selected ? (
							<span className="bg-workbench-selection text-workbench-on-selection absolute bottom-3 left-3 flex h-6 max-w-[80%] items-center truncate rounded-[2px] px-2 text-[12px] leading-4 font-semibold">
								{uploadedFile ? "Your image" : selected?.name}
							</span>
						) : null}
					</div>
					<div className="-mx-1 -my-1 mt-1 flex items-start gap-[10px] overflow-x-auto px-1 py-1">
						{projects.map((project) => (
							<Button
								aria-label={`Select ${project.name} look`}
								aria-pressed={selected?.id === project.id}
								className="text-workbench-muted-text flex h-auto w-[107px] shrink-0 flex-col items-stretch justify-start gap-2 p-0 text-left text-[14px] leading-[18px] font-normal whitespace-normal"
								disabled={locked}
								key={project.id}
								onClick={() => {
									setImageError(undefined);
									form.setFieldValue("look", { project });
								}}
								type="button"
								variant="ghost"
							>
								<div className="relative">
									<ProjectCover
										className={
											selected?.id === project.id
												? "ring-workbench-selection ring-offset-workbench-background h-[72px] w-full rounded-[3px] ring-2 ring-offset-2 [&_img]:object-center"
												: "border-workbench-border-strong h-[72px] w-full rounded-[3px] border [&_img]:object-center"
										}
										project={project}
									/>
									{selected?.id === project.id ? (
										<span
											aria-hidden="true"
											className="bg-workbench-selection text-workbench-on-selection ring-workbench-background absolute top-1.5 right-1.5 flex size-[18px] items-center justify-center rounded-[2px] ring-2"
										>
											<Check className="size-3" />
										</span>
									) : null}
								</div>
								<span
									className={
										selected?.id === project.id
											? "text-workbench-text font-semibold"
											: ""
									}
								>
									{project.name}
								</span>
							</Button>
						))}
						{uploadedFile && localUrl ? (
							<UploadedLookTile
								disabled={locked}
								onRemove={() => form.setFieldValue("look", null)}
								url={localUrl}
							/>
						) : (
							<label
								className="text-workbench-muted-text relative flex w-[107px] shrink-0 cursor-pointer flex-col gap-2 text-[14px] leading-[18px] has-disabled:cursor-not-allowed"
								htmlFor={fileId}
							>
								<form.Field name="look">
									{(field) => (
										<Input
											accept="image/png,image/jpeg"
											className="peer sr-only !h-px !w-px !border-0 !p-0"
											disabled={locked}
											id={fileId}
											onChange={(event) => {
												const file = event.target.files?.[0];
												event.target.value = "";
												if (!file) {
													return;
												}
												if (
													!["image/png", "image/jpeg"].includes(file.type) ||
													file.size > 16 * 1024 * 1024
												) {
													setImageError("Choose a PNG or JPG up to 16 MB.");
													return;
												}
												setImageError(undefined);
												field.handleChange({ file });
											}}
											type="file"
										/>
									)}
								</form.Field>
								<span className="border-workbench-border-strong peer-focus-visible:ring-workbench-focus flex h-[72px] flex-col items-center justify-center gap-1.5 rounded-[3px] border border-dashed peer-focus-visible:ring-2">
									<Upload className="size-5" />
									<span className="font-mono text-[12px]">PNG · JPG</span>
								</span>
								<span>Upload image</span>
							</label>
						)}
					</div>
					{imageError ? (
						<p className="text-workbench-danger" role="alert">
							{imageError}
						</p>
					) : null}
					<div className="border-workbench-divider mt-1 flex items-center gap-5 border-t pt-4">
						<p className="text-workbench-muted-text min-w-0 grow text-[14px] leading-5">
							{uploadedFile
								? "Your image becomes this project’s look. Remove it to pick another."
								: selected?.generalArtDirection || "No art approach provided."}
						</p>
						<Button
							aria-label={
								selected
									? `Copy approach from ${selected.name}`
									: "Copy approach"
							}
							className="h-10 shrink-0 rounded-[4px]"
							disabled={locked || !selected?.generalArtDirection}
							onClick={() =>
								form.setFieldValue(
									"generalArtDirection",
									selected?.generalArtDirection?.slice(
										0,
										projectArtDirectionMaxLength
									) ?? ""
								)
							}
							type="button"
							variant="outline"
						>
							<Copy /> Copy approach
						</Button>
					</div>
				</section>
			</div>
			<form.Subscribe
				selector={(state) => ({
					name: state.values.name,
					valid: state.isValid && !state.isSubmitting,
				})}
			>
				{({ name, valid }) => (
					<div className="border-workbench-divider bg-workbench-strip flex min-h-[72px] shrink-0 flex-wrap items-center justify-end gap-3 border-t px-8">
						<DialogClose
							render={
								<Button
									className="h-10 rounded-[4px]"
									disabled={locked}
									type="button"
									variant="outline"
								/>
							}
						>
							Cancel
						</DialogClose>
						<Button
							className="h-10 rounded-[4px]"
							disabled={locked || !valid || nameUnavailable(name)}
							type="submit"
						>
							<Plus className="size-4" />{" "}
							{isSaving ? "Saving…" : "Create project"}
						</Button>
					</div>
				)}
			</form.Subscribe>
		</form>
	);
}

function NameAvailability({
	duplicate,
	name,
}: {
	duplicate: boolean;
	name: string;
}) {
	if (duplicate) {
		return (
			<span className="flex items-center gap-2">
				<CircleAlert className="size-4" />A project with this name already
				exists.
			</span>
		);
	}
	if (!name.trim()) {
		return "Enter a project name";
	}
	return (
		<span className="flex items-center gap-2">
			<Check className="text-workbench-success size-4" />
			Name is free to use
		</span>
	);
}

function useLocalLookUrl(uploadedFile: File | undefined) {
	const [localUrl, setLocalUrl] = useState<string>();
	useEffect(() => {
		if (!uploadedFile) {
			setLocalUrl(undefined);
			return;
		}
		const url = URL.createObjectURL(uploadedFile);
		setLocalUrl(url);
		return () => URL.revokeObjectURL(url);
	}, [uploadedFile]);
	return localUrl;
}

function resolveLook(
	look: ProjectLook | null,
	projects: (ProjectCoverRecord & { generalArtDirection?: string })[],
	defaultLookId?: string
) {
	if (look && "file" in look) {
		return { uploadedFile: look.file, selected: undefined };
	}
	if (look && "project" in look) {
		return {
			uploadedFile: undefined,
			selected: projects.find((project) => project.id === look.project.id),
		};
	}
	return {
		uploadedFile: undefined,
		selected:
			projects.find((project) => project.id === defaultLookId) ?? projects[0],
	};
}

function UploadedLookTile({
	url,
	disabled,
	onRemove,
}: {
	url: string;
	disabled: boolean;
	onRemove: () => void;
}) {
	return (
		<Button
			aria-label="Remove uploaded image"
			className="flex h-auto w-[107px] shrink-0 flex-col items-stretch justify-start gap-2 p-0 text-left text-[14px] leading-[18px] font-semibold whitespace-normal"
			disabled={disabled}
			onClick={onRemove}
			type="button"
			variant="ghost"
		>
			<span className="ring-workbench-selection ring-offset-workbench-background relative h-[72px] w-full rounded-[3px] ring-2 ring-offset-2">
				<img
					alt=""
					className="size-full rounded-[3px] object-cover object-center"
					height={72}
					src={url}
					width={107}
				/>
				<span
					aria-hidden="true"
					className="bg-workbench-scrim ring-workbench-background absolute top-1.5 right-1.5 flex size-[18px] items-center justify-center rounded-[2px] ring-2"
				>
					<X className="size-3" />
				</span>
			</span>
			<span>Your image</span>
		</Button>
	);
}

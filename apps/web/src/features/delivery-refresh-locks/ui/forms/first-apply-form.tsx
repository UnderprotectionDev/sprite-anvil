import { Button } from "@sprite-anvil/ui/components/button";
import { Input } from "@sprite-anvil/ui/components/input";
import { Label } from "@sprite-anvil/ui/components/label";
import {
	NativeSelect,
	NativeSelectOption,
} from "@sprite-anvil/ui/components/native-select";
import { useForm, useStore } from "@tanstack/react-form";
import { useQuery } from "@tanstack/react-query";
import { type SyntheticEvent, useState } from "react";
import { orpc } from "@/utils/orpc";
import { useApplyDelivery } from "../../hooks/use-apply-delivery";
import { useIdempotencyKey } from "../../hooks/use-idempotency-key";
import { chooseFolder, readWrittenFiles } from "../../lib/read-target-folder";
import { firstApplyFormSchema } from "../../schemas";
import { LockPanel } from "../components/lock-panel";

const directoryAttributes = { webkitdirectory: "" } as Record<string, string>;

function FieldErrors({ errors }: { errors: unknown[] }) {
	const messages = errors.flatMap((error) =>
		typeof error === "object" && error !== null && "message" in error
			? [String(error.message)]
			: []
	);
	return messages.length === 0 ? null : (
		<ul className="space-y-1 text-destructive text-sm">
			{messages.map((message) => (
				<li key={message}>{message}</li>
			))}
		</ul>
	);
}

/**
 * The first delivery of an Export Bundle to a destination: the user chooses the bundle and a
 * label, then the folder they wrote it to. Only the bundle's own paths are read from that
 * folder; the server verifies them against the bundle and makes the lock.
 */
export function FirstApplyForm({ projectId }: { projectId: string }) {
	const apply = useApplyDelivery(projectId);
	const [failure, setFailure] = useState<string | null>(null);
	const bundles = useQuery({
		...orpc.exportBundles.list.queryOptions({ input: { projectId } }),
		meta: { suppressGlobalErrorToast: true },
	});

	const form = useForm({
		defaultValues: {
			bundleId: "",
			destinationLabel: "",
			folder: null as ReturnType<typeof chooseFolder>,
		},
		onSubmit: async ({ value }) => {
			setFailure(null);
			const { folder } = value;
			if (!(folder && bundle)) {
				setFailure("The Export Bundle is still loading. Try again.");
				return;
			}
			try {
				const { missing, written } = await readWrittenFiles(
					folder.files,
					bundle.files.map((file) => file.path)
				);
				if (missing.length > 0) {
					setFailure(
						`The folder is not complete: ${missing.join(", ")} ${missing.length === 1 ? "is" : "are"} missing. Every file of the Export Bundle must be written before a lock is made.`
					);
					return;
				}
				await apply.mutateAsync({
					bundleId: value.bundleId,
					destinationLabel: value.destinationLabel,
					idempotencyKey,
					projectId,
					written,
				});
			} catch (error) {
				setFailure(
					error instanceof Error
						? error.message
						: "The bundle could not be applied. Try again."
				);
			}
		},
		validators: { onSubmit: firstApplyFormSchema },
	});
	const values = useStore(form.store, (state) => state.values);
	const bundle = useQuery({
		...orpc.exportBundles.get.queryOptions({
			input: { bundleId: values.bundleId, projectId },
		}),
		enabled: values.bundleId !== "",
		meta: { suppressGlobalErrorToast: true },
	}).data;
	const idempotencyKey = useIdempotencyKey(
		JSON.stringify([
			values.bundleId,
			values.destinationLabel,
			values.folder?.token,
		])
	);

	const submit = (event: SyntheticEvent<HTMLFormElement>) => {
		event.preventDefault();
		event.stopPropagation();
		void form.handleSubmit();
	};

	return (
		<form
			aria-label="Apply an Export Bundle for the first time"
			className="space-y-4"
			onSubmit={submit}
		>
			<h2 className="font-semibold text-lg">First delivery</h2>
			<p className="text-muted-foreground text-sm">
				Apply an Export Bundle to a destination for the first time. Write the
				bundle's files to a folder yourself, then choose that folder here. Only
				the bundle's own paths are read, on this device, and the lock records
				exactly those.
			</p>
			<div className="grid gap-4 sm:grid-cols-2">
				<div className="space-y-1 text-sm">
					<Label htmlFor="first-apply-bundle">Bundle to apply</Label>
					<form.Field name="bundleId">
						{(field) => (
							<>
								<NativeSelect
									className="w-full"
									id="first-apply-bundle"
									onChange={(event) => {
										field.handleChange(event.target.value);
										apply.reset();
										setFailure(null);
									}}
									value={field.state.value}
								>
									<NativeSelectOption value="">
										Choose a bundle
									</NativeSelectOption>
									{bundles.data?.bundles.map((entry) => (
										<NativeSelectOption key={entry.id} value={entry.id}>
											Export Bundle of {entry.createdAt.slice(0, 10)}
										</NativeSelectOption>
									))}
								</NativeSelect>
								<FieldErrors errors={field.state.meta.errors} />
							</>
						)}
					</form.Field>
				</div>
				<div className="space-y-1 text-sm">
					<Label htmlFor="first-apply-label">Destination label</Label>
					<form.Field name="destinationLabel">
						{(field) => (
							<>
								<Input
									id="first-apply-label"
									maxLength={120}
									onBlur={field.handleBlur}
									onChange={(event) => {
										field.handleChange(event.target.value);
										apply.reset();
									}}
									value={field.state.value}
								/>
								<p className="text-muted-foreground text-xs">
									A name for the folder, such as "Test game folder". Never a
									local path.
								</p>
								<FieldErrors errors={field.state.meta.errors} />
							</>
						)}
					</form.Field>
				</div>
			</div>
			<div className="space-y-1 text-sm">
				<Label htmlFor="first-apply-folder">
					Folder the bundle was written to
				</Label>
				<form.Field name="folder">
					{(field) => (
						<>
							<Input
								{...directoryAttributes}
								id="first-apply-folder"
								multiple
								onChange={(event) => {
									field.handleChange(
										chooseFolder([...(event.target.files ?? [])])
									);
									apply.reset();
									setFailure(null);
								}}
								type="file"
							/>
							<FieldErrors errors={field.state.meta.errors} />
						</>
					)}
				</form.Field>
			</div>
			<Button className="min-h-11" disabled={apply.isPending} type="submit">
				Apply bundle and lock
			</Button>
			{failure ? <p role="alert">{failure}</p> : null}
			{apply.data ? (
				<LockPanel
					heading={
						apply.data.status === "replayed"
							? "First delivery lock (already recorded)"
							: "First delivery lock"
					}
					lock={apply.data.lock}
				/>
			) : null}
		</form>
	);
}

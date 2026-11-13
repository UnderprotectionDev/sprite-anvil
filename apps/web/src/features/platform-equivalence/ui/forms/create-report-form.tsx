import type { PlatformEquivalenceRun } from "@sprite-anvil/api/platform-equivalence";
import {
	type PlatformSurface,
	platformSurfaces,
} from "@sprite-anvil/api/platform-equivalence-comparison";
import { Button } from "@sprite-anvil/ui/components/button";
import { Label } from "@sprite-anvil/ui/components/label";
import {
	NativeSelect,
	NativeSelectOption,
} from "@sprite-anvil/ui/components/native-select";
import { useForm } from "@tanstack/react-form";
import type { SyntheticEvent } from "react";
import { StatusMessage } from "@/components/status-message";
import { usePendingIdempotencyKey } from "@/utils/pending-idempotency-key";
import { useCreatePlatformEquivalenceReport } from "../../hooks/use-platform-equivalence-writes";
import { surfaceLabels } from "../../lib/platform-equivalence-labels";
import { platformEquivalenceReportFormSchema } from "../../schemas";

/** An empty choice means the newest run of that surface. */
const newest = "";

function runOptionLabel(run: PlatformEquivalenceRun) {
	return `${new Date(run.createdAt).toLocaleString()} · input ${run.evidence.inputDigest.slice(0, 12)}`;
}

/** Compares one chosen web run with one chosen desktop run; each defaults to the newest. */
export function CreateReportForm({
	projectId,
	runs,
}: {
	projectId: string;
	/** Newest first. */
	runs: PlatformEquivalenceRun[];
}) {
	const createReport = useCreatePlatformEquivalenceReport();
	const idempotencyKey = usePendingIdempotencyKey();
	const runsOf = (surface: PlatformSurface) =>
		runs.filter((run) => run.surface === surface);

	const form = useForm({
		defaultValues: { desktopRunId: newest, webRunId: newest },
		onSubmit: async ({ value }) => {
			const webRunId = value.webRunId || (runsOf("web")[0]?.id ?? null);
			const desktopRunId =
				value.desktopRunId || (runsOf("desktop")[0]?.id ?? null);
			try {
				await createReport.mutateAsync({
					desktopRunId,
					idempotencyKey: idempotencyKey.keyFor(`${webRunId}:${desktopRunId}`),
					projectId,
					webRunId,
				});
				idempotencyKey.clear();
			} catch {
				// The mutation state below reports the failure.
			}
		},
		validators: { onSubmit: platformEquivalenceReportFormSchema },
	});

	const submit = (event: SyntheticEvent<HTMLFormElement>) => {
		event.preventDefault();
		event.stopPropagation();
		void form.handleSubmit();
	};

	return (
		<form aria-label="Create a report" className="space-y-3" onSubmit={submit}>
			{platformSurfaces.map((surface) => {
				const fieldName = surface === "web" ? "webRunId" : "desktopRunId";
				const id = `platform-equivalence-${surface}-run`;
				return (
					<div className="space-y-1" key={surface}>
						<Label htmlFor={id}>{`${surfaceLabels[surface]} run`}</Label>
						<form.Field name={fieldName}>
							{(field) => (
								<NativeSelect
									className="w-full [&>select]:min-h-10"
									id={id}
									onChange={(event) => field.handleChange(event.target.value)}
									value={field.state.value}
								>
									<NativeSelectOption value={newest}>
										{runsOf(surface).length > 0
											? "Newest run"
											: "No run recorded"}
									</NativeSelectOption>
									{runsOf(surface).map((run) => (
										<NativeSelectOption key={run.id} value={run.id}>
											{runOptionLabel(run)}
										</NativeSelectOption>
									))}
								</NativeSelect>
							)}
						</form.Field>
					</div>
				);
			})}
			{createReport.isError ? (
				<StatusMessage tone="error">
					The report could not be created. Try again.
				</StatusMessage>
			) : null}
			<form.Subscribe selector={(state) => state.isSubmitting}>
				{(isSubmitting) => (
					<Button
						className="min-h-11"
						disabled={isSubmitting || runs.length === 0}
						type="submit"
					>
						{isSubmitting ? "Creating report…" : "Create report"}
					</Button>
				)}
			</form.Subscribe>
		</form>
	);
}

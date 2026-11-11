import { useQuery } from "@tanstack/react-query";
import { LoadErrorAlert } from "@/components/load-error-alert";
import { orpc } from "@/utils/orpc";
import { RuntimeValidationRecordCard } from "../components/runtime-validation-record-card";
import { RuntimeValidationRecordForm } from "../forms/runtime-validation-record-form";

export function RuntimeValidationView({ projectId }: { projectId: string }) {
	const records = useQuery({
		...orpc.runtimeValidation.list.queryOptions({ input: { projectId } }),
		meta: { suppressGlobalErrorToast: true },
	});
	const bundles = useQuery({
		...orpc.exportBundles.list.queryOptions({ input: { projectId } }),
		meta: { suppressGlobalErrorToast: true },
	});
	const recordList = records.data?.records ?? [];

	return (
		<main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8">
			<header className="space-y-2">
				<h1 className="font-semibold text-2xl">Runtime Validation</h1>
				<p className="text-muted-foreground text-sm">
					Record what happened when an exact Export Bundle ran in a real game
					build: screenshots, recordings, test results and observations. The
					game project is never a source for the Workbench; this is one-way
					evidence.
				</p>
			</header>

			{bundles.isError ? (
				<LoadErrorAlert
					message="Export Bundles could not be loaded."
					onRetry={() => void bundles.refetch()}
				/>
			) : null}
			{bundles.isSuccess && bundles.data.bundles.length === 0 ? (
				<p className="text-muted-foreground">
					This project has no Export Bundle to test yet.
				</p>
			) : null}
			{bundles.isSuccess && bundles.data.bundles.length > 0 ? (
				<RuntimeValidationRecordForm
					bundles={bundles.data.bundles}
					projectId={projectId}
				/>
			) : null}

			{records.isPending ? (
				<p aria-live="polite" role="status">
					Loading Runtime Validation Records…
				</p>
			) : null}
			{records.isError ? (
				<LoadErrorAlert
					message="Runtime Validation Records could not be loaded."
					onRetry={() => void records.refetch()}
				/>
			) : null}
			{records.isSuccess && recordList.length === 0 ? (
				<p className="text-muted-foreground">
					This project has no Runtime Validation Records yet.
				</p>
			) : null}
			<div className="space-y-6">
				{recordList.map((record) => (
					<RuntimeValidationRecordCard key={record.id} record={record} />
				))}
			</div>
		</main>
	);
}

import { summarizePlatformSupport } from "@sprite-anvil/api/platform-support-gate";
import { publishedPlatformSupport } from "@sprite-anvil/api/platform-support-published";
import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { LoadErrorAlert } from "@/components/load-error-alert";
import { getSupportReference } from "@/utils/error-notification";
import { orpc } from "@/utils/orpc";
import { useCreatePlatformEquivalenceReport } from "../../hooks/use-platform-equivalence-writes";
import { PlatformEquivalenceReportCard } from "../components/platform-equivalence-report-card";
import { PlatformEquivalenceRunsPanel } from "../components/platform-equivalence-runs-panel";
import { PlatformSupportGatePanel } from "../components/platform-support-gate-panel";
import { RecordRunForm } from "../forms/record-run-form";

const supportSummary = summarizePlatformSupport(publishedPlatformSupport);

export function PlatformEquivalenceReportView({
	projectId,
}: {
	projectId: string;
}) {
	const overview = useQuery({
		...orpc.platformEquivalence.overview.queryOptions({ input: { projectId } }),
		meta: { suppressGlobalErrorToast: true },
	});
	const bundles = useQuery({
		...orpc.exportBundles.list.queryOptions({ input: { projectId } }),
		meta: { suppressGlobalErrorToast: true },
	});
	const createReport = useCreatePlatformEquivalenceReport();
	const [failure, setFailure] = useState<string | null>(null);
	const idempotencyKey = useRef(crypto.randomUUID());

	const runs = overview.data?.runs ?? [];
	const reports = overview.data?.reports ?? [];
	// Runs are newest first, so the first match is the latest run of that surface.
	const latestWeb = runs.find((run) => run.surface === "web") ?? null;
	const latestDesktop = runs.find((run) => run.surface === "desktop") ?? null;

	const compare = async () => {
		setFailure(null);
		try {
			await createReport.mutateAsync({
				desktopRunId: latestDesktop?.id ?? null,
				idempotencyKey: idempotencyKey.current,
				projectId,
				webRunId: latestWeb?.id ?? null,
			});
			idempotencyKey.current = crypto.randomUUID();
		} catch {
			idempotencyKey.current = crypto.randomUUID();
			setFailure("The report could not be created. Try again.");
		}
	};

	return (
		<main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8">
			<header className="space-y-2">
				<h1 className="font-semibold text-2xl">Platform Equivalence</h1>
				<p className="text-muted-foreground text-sm">
					Phase 3 interim evidence: the web app and the desktop app each record
					what they derived from an Export Bundle, and a report compares the
					authoritative records, quality evidence and Engine-Neutral Bundle.
					Delivery Refresh Locks, divergence results and acceptance scenarios
					are not evaluated, and this does not complete PLT-01 or declare any
					platform supported. Each app names its own surface; the server does
					not verify it.
				</p>
			</header>

			{bundles.isError ? (
				<LoadErrorAlert
					message="Export Bundles could not be loaded."
					onRetry={() => void bundles.refetch()}
					supportReference={getSupportReference(bundles.error)}
				/>
			) : null}
			{bundles.isSuccess && bundles.data.bundles.length === 0 ? (
				<p className="text-muted-foreground">
					This project has no Export Bundle to record a run from yet.
				</p>
			) : null}
			{bundles.isSuccess && bundles.data.bundles.length > 0 ? (
				<RecordRunForm bundles={bundles.data.bundles} projectId={projectId} />
			) : null}

			{overview.isPending ? (
				<p aria-live="polite" role="status">
					Loading Platform Equivalence…
				</p>
			) : null}
			{overview.isError ? (
				<LoadErrorAlert
					message="Platform Equivalence could not be loaded."
					onRetry={() => void overview.refetch()}
					supportReference={getSupportReference(overview.error)}
				/>
			) : null}

			{overview.isSuccess ? (
				<PlatformEquivalenceRunsPanel
					canCompare={Boolean(latestWeb || latestDesktop)}
					failure={failure}
					isPending={createReport.isPending}
					onCompare={() => void compare()}
					runs={runs}
				/>
			) : null}

			<PlatformSupportGatePanel summary={supportSummary} />

			{overview.isSuccess ? (
				<section className="space-y-4">
					<h2 className="font-semibold text-xl">Reports</h2>
					{reports.length === 0 ? (
						<p className="text-muted-foreground">
							This project has no Platform Equivalence Report yet.
						</p>
					) : null}
					{reports.map((report) => (
						<PlatformEquivalenceReportCard key={report.id} report={report} />
					))}
				</section>
			) : null}
		</main>
	);
}

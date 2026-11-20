import { Input } from "@sprite-anvil/ui/components/input";
import { Label } from "@sprite-anvil/ui/components/label";
import { useMutation } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { StatusMessage } from "@/components/status-message";
import { mutationMeta } from "@/utils/mutation-meta";
import type {
	ExportBundleManifestSummary,
	ExportBundleReading,
} from "../../lib/read-export-bundle";
import { describeError, readExportBundle } from "../../lib/read-export-bundle";
import { verifyWithMeasurement } from "../../lib/verify-with-measurement";

const directoryAttributes = { webkitdirectory: "" } as Record<string, string>;

function ManifestSummary({
	summary,
}: {
	summary: ExportBundleManifestSummary;
}) {
	const rows: [string, string][] = [
		["Manifest contract version", summary.contractVersion],
		["Profile revision", String(summary.profileRevisionNumber)],
		["Context revision", String(summary.contextRevisionNumber)],
		["Files", String(summary.fileCount)],
		["Waivers", String(summary.waiverCount)],
	];
	return (
		<section aria-labelledby="bundle-manifest-heading" className="space-y-2">
			<h2 className="text-lg font-semibold" id="bundle-manifest-heading">
				Manifest
			</h2>
			<dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-1 text-sm">
				{rows.map(([term, value]) => (
					<div className="contents" key={term}>
						<dt className="text-muted-foreground">{term}</dt>
						<dd>{value}</dd>
					</div>
				))}
			</dl>
		</section>
	);
}

function VerificationResult({ reading }: { reading: ExportBundleReading }) {
	const { result } = reading;
	return (
		<div className="space-y-6">
			<section
				aria-labelledby="bundle-result-heading"
				className="space-y-2"
				role="status"
			>
				<h2 className="text-lg font-semibold" id="bundle-result-heading">
					Verification result
				</h2>
				{result.ok ? (
					<p>
						Bundle verified: {result.fileCount} files match the manifest, the
						checksum list and the Package Verification Kit.
					</p>
				) : (
					<>
						<p>Integrity check failed.</p>
						<ul className="list-disc space-y-1 pl-5 text-sm">
							{result.failures.map((failure) => (
								<li key={`${failure.code}:${failure.path}:${failure.message}`}>
									{failure.message}
								</li>
							))}
						</ul>
					</>
				)}
			</section>
			{reading.manifestError ? (
				<StatusMessage tone="error">{reading.manifestError}</StatusMessage>
			) : null}
			{reading.manifest ? <ManifestSummary summary={reading.manifest} /> : null}
		</div>
	);
}

export function ExportBundleVerificationView({
	children,
	projectId,
}: {
	/** Further sections of the Export Bundles screen, shown above the offline check. */
	children?: ReactNode;
	projectId?: string;
}) {
	const verification = useMutation({
		...mutationMeta,
		gcTime: 0,
		networkMode: "always",
		mutationFn: (files: File[]) =>
			verifyWithMeasurement({
				projectId,
				online: () => navigator.onLine,
				record: async (input, signal) =>
					(
						await import("@/utils/orpc")
					).client.measurementEvents.recordVerificationBoundary(input, {
						signal,
					}),
				read: () => readExportBundle(files),
			}),
	});

	return (
		<main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8">
			<header className="space-y-2">
				<h1 className="text-2xl font-semibold">Export Bundles</h1>
				<p className="text-muted-foreground text-sm">
					Choose an Engine-Neutral Bundle directory to read its manifest and
					check its integrity. Everything is checked on this device, offline,
					with the same verifier the Package Verification Kit ships.
				</p>
			</header>
			{children}
			<div className="space-y-1 text-sm">
				<Label htmlFor="bundle-directory">Bundle directory</Label>
				<Input
					{...directoryAttributes}
					id="bundle-directory"
					multiple
					onChange={(event) => {
						const files = Array.from(event.currentTarget.files ?? []);
						if (files.length > 0) {
							verification.mutate(files);
						}
					}}
					type="file"
				/>
			</div>
			{verification.isPending ? (
				<p aria-live="polite" role="status">
					Verifying bundle…
				</p>
			) : null}
			{verification.isError ? (
				<StatusMessage tone="error">
					The chosen directory could not be read:{" "}
					{describeError(verification.error)}
				</StatusMessage>
			) : null}
			{verification.isSuccess ? (
				<VerificationResult reading={verification.data} />
			) : null}
		</main>
	);
}

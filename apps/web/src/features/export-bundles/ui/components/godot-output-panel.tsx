import { exportBundleContractMajorOf } from "@sprite-anvil/api/export-bundle-manifest";
import type { ExportBundleSummary } from "@sprite-anvil/api/export-bundles";
import {
	type GodotOutput,
	godotSupportedEngineVersions,
} from "@sprite-anvil/api/godot-output";
import { Button } from "@sprite-anvil/ui/components/button";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { LoadErrorAlert } from "@/components/load-error-alert";
import { mutationMeta } from "@/utils/mutation-meta";
import { client, orpc } from "@/utils/orpc";
import { downloadZip, packGodotOutput } from "../../lib/pack-godot-output";
import { describeError } from "../../lib/read-export-bundle";

/** The first manifest contract that pins the game data Godot output needs. */
const engineDataMinor = 1;

function hasEngineData(bundle: ExportBundleSummary): boolean {
	const [major, minor] = bundle.contractVersion.split(".").map(Number);
	return (
		(major ?? 0) > exportBundleContractMajorOf("1.0.0") ||
		(minor ?? 0) >= engineDataMinor
	);
}

function BundleRow({
	bundle,
	busy,
	onCreate,
}: {
	bundle: ExportBundleSummary;
	busy: boolean;
	onCreate: (bundle: ExportBundleSummary) => void;
}) {
	const usable = hasEngineData(bundle);
	const describedBy = `godot-bundle-${bundle.id}`;
	return (
		<li className="flex flex-wrap items-center justify-between gap-3 rounded border p-3">
			<div className="space-y-1 text-sm" id={describedBy}>
				<p className="font-medium">
					Bundle {bundle.id.slice(0, 8)}
					{bundle.isLatest ? " (latest)" : ""}
				</p>
				<p className="text-muted-foreground">
					Created {new Date(bundle.createdAt).toLocaleString()} - manifest{" "}
					{bundle.contractVersion}
					{bundle.adapterVersion ? ` - adapter ${bundle.adapterVersion}` : ""}
				</p>
				{usable ? null : (
					<p>
						Created before engine data was pinned; create a new bundle to get
						Godot output.
					</p>
				)}
			</div>
			<Button
				aria-describedby={describedBy}
				className="min-h-11"
				disabled={!usable || busy}
				onClick={() => onCreate(bundle)}
				type="button"
				variant="outline"
			>
				Create Godot output
			</Button>
		</li>
	);
}

function CreatedStatus({ output }: { output: GodotOutput }) {
	return (
		<p role="status">
			Godot output downloaded: {output.files.length} files, adapter{" "}
			{output.adapterVersion}, output digest {output.outputDigest.slice(0, 12)}.
		</p>
	);
}

/**
 * Stored Export Bundles with a "Create Godot output" action. The output is
 * derived on demand from the chosen bundle and downloaded; nothing is saved
 * and the Godot project never becomes a source of truth.
 */
export function GodotOutputPanel({ projectId }: { projectId: string }) {
	const catalog = useQuery({
		...orpc.exportBundles.list.queryOptions({ input: { projectId } }),
		meta: { suppressGlobalErrorToast: true },
	});
	const create = useMutation({
		...mutationMeta,
		mutationFn: async (bundle: ExportBundleSummary) => {
			const output = await client.exportBundles.godotOutput({
				bundleId: bundle.id,
				projectId,
			});
			downloadZip(
				await packGodotOutput(projectId, output),
				`godot-output-${bundle.id.slice(0, 8)}.zip`
			);
			return output;
		},
	});
	const bundles = catalog.data?.bundles ?? [];
	let list: ReactNode = null;
	if (catalog.isError) {
		list = (
			<LoadErrorAlert
				message="The stored Export Bundles could not be loaded."
				onRetry={() => void catalog.refetch()}
			/>
		);
	} else if (catalog.isSuccess && bundles.length === 0) {
		list = <p>No Export Bundles yet.</p>;
	} else if (catalog.isSuccess) {
		list = (
			<ul className="space-y-2">
				{[...bundles].reverse().map((bundle) => (
					<BundleRow
						bundle={bundle}
						busy={create.isPending}
						key={bundle.id}
						onCreate={(chosen) => create.mutate(chosen)}
					/>
				))}
			</ul>
		);
	}
	return (
		<section aria-labelledby="godot-output-heading" className="space-y-3">
			<h2 className="font-semibold text-lg" id="godot-output-heading">
				Godot output
			</h2>
			<p className="text-muted-foreground text-sm">
				Create a Godot project folder from a stored bundle. Supported: Godot{" "}
				{godotSupportedEngineVersions.join(", ")}. The output is a separate
				result on top of the bundle, never a source of truth for the Workbench.
			</p>
			{list}
			{create.isPending ? (
				<p aria-live="polite" role="status">
					Creating Godot output...
				</p>
			) : null}
			{create.isError ? (
				<p role="alert">
					Godot output could not be created: {describeError(create.error)}
				</p>
			) : null}
			{create.isSuccess ? <CreatedStatus output={create.data} /> : null}
		</section>
	);
}

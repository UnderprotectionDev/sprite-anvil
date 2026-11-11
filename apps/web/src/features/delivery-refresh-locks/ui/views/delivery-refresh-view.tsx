import {
	buildDeliveryChangePackage,
	renderDeliveryChangePackage,
} from "@sprite-anvil/api/delivery-change-package";
import {
	checkDeliveryRefreshLockContract,
	classifyDeliveryRefreshPaths,
	type DeliveryRefreshDecision,
	type DeliveryRefreshDecisionKind,
	planDeliveryRefresh,
} from "@sprite-anvil/api/delivery-refresh-classification";
import { Button } from "@sprite-anvil/ui/components/button";
import { Input } from "@sprite-anvil/ui/components/input";
import { Label } from "@sprite-anvil/ui/components/label";
import {
	NativeSelect,
	NativeSelectOption,
} from "@sprite-anvil/ui/components/native-select";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { orpc } from "@/utils/orpc";
import { useRefreshDelivery } from "../../hooks/use-refresh-delivery";
import {
	indexTargetFolder,
	observeTargetFolder,
	type TargetFolder,
} from "../../lib/read-target-folder";
import { DivergedPath } from "../components/diverged-path";
import { PathClassSection, PathList } from "../components/path-class-section";
import { RefreshResultPanel } from "../components/refresh-result-panel";

const directoryAttributes = { webkitdirectory: "" } as Record<string, string>;

interface ChosenFolder {
	files: TargetFolder;
	token: number;
}

function download(text: string, filename: string) {
	const url = URL.createObjectURL(
		new Blob([text], { type: "application/json" })
	);
	const link = document.createElement("a");
	link.href = url;
	link.download = filename;
	link.click();
	URL.revokeObjectURL(url);
}

export function DeliveryRefreshView({ projectId }: { projectId: string }) {
	const [lockId, setLockId] = useState("");
	const [bundleId, setBundleId] = useState("");
	const [target, setTarget] = useState<ChosenFolder | null>(null);
	const [updated, setUpdated] = useState<ChosenFolder | null>(null);
	const [decided, setDecided] = useState<
		Record<string, DeliveryRefreshDecisionKind>
	>({});
	const [recordError, setRecordError] = useState<string | null>(null);
	const refresh = useRefreshDelivery(projectId);

	const locks = useQuery({
		...orpc.deliveryRefreshLocks.list.queryOptions({ input: { projectId } }),
		meta: { suppressGlobalErrorToast: true },
	});
	const bundles = useQuery({
		...orpc.exportBundles.list.queryOptions({ input: { projectId } }),
		meta: { suppressGlobalErrorToast: true },
	});
	const lock = useQuery({
		...orpc.deliveryRefreshLocks.get.queryOptions({
			input: { lockId, projectId },
		}),
		enabled: lockId !== "",
		meta: { suppressGlobalErrorToast: true },
	}).data;
	const bundle = useQuery({
		...orpc.exportBundles.get.queryOptions({ input: { bundleId, projectId } }),
		enabled: bundleId !== "",
		meta: { suppressGlobalErrorToast: true },
	}).data;

	const contract = lock
		? checkDeliveryRefreshLockContract({
				...lock,
				profileId: lock.profile.profileId,
				profileRevisionId: lock.profile.revisionId,
			})
		: null;
	const ready = Boolean(lock && bundle && contract?.ok);
	const paths = useMemo(
		() =>
			lock && bundle
				? [
						...new Set([
							...lock.files.map((file) => file.path),
							...bundle.files.map((file) => file.path),
						]),
					]
				: [],
		[lock, bundle]
	);
	const observation = useQuery({
		enabled: ready && target !== null,
		queryFn: () =>
			target ? observeTargetFolder(target.files, paths) : Promise.resolve([]),
		queryKey: ["delivery-refresh-observation", target?.token, lockId, bundleId],
	}).data;

	const classification = useMemo(
		() =>
			lock && bundle && observation
				? classifyDeliveryRefreshPaths({
						next: bundle.files,
						observed: observation,
						previous: lock.files,
					})
				: null,
		[lock, bundle, observation]
	);
	const decisions: DeliveryRefreshDecision[] = Object.entries(decided).map(
		([path, decision]) => ({ decision, path })
	);
	const plan = classification
		? planDeliveryRefresh(classification, decisions)
		: null;
	const entriesOf = (name: string) =>
		classification?.entries.filter((entry) => entry.class === name) ?? [];

	const attemptSignature = JSON.stringify([
		lockId,
		bundleId,
		target?.token,
		updated?.token,
		decisions,
	]);
	// One idempotency key per distinct request, so a retry of the same request replays
	// the first lock and a changed request never reuses a key.
	// biome-ignore lint/correctness/useExhaustiveDependencies: the key must follow the request signature only.
	const idempotencyKey = useMemo(() => crypto.randomUUID(), [attemptSignature]);

	function chooseFolder(
		files: File[],
		set: (folder: ChosenFolder | null) => void
	) {
		set(
			files.length === 0
				? null
				: { files: indexTargetFolder(files), token: Date.now() + Math.random() }
		);
		setRecordError(null);
		refresh.reset();
	}

	function downloadPackage() {
		if (!(lock && bundle && classification)) {
			return;
		}
		download(
			renderDeliveryChangePackage(
				buildDeliveryChangePackage({
					bundle: {
						bundleId: bundle.id,
						bundleManifestDigest: bundle.manifestDigest,
						files: bundle.files,
						profileId: bundle.profileId,
						profileRevisionId: bundle.profileRevisionId,
					},
					classification,
					decisions,
					previous: lock,
				})
			),
			"delivery-change-package.json"
		);
	}

	async function recordRefresh() {
		if (!(plan && observation && updated)) {
			return;
		}
		setRecordError(null);
		try {
			const reported = await observeTargetFolder(updated.files, plan.applied);
			refresh.mutate({
				bundleId,
				decisions,
				idempotencyKey,
				observed: observation,
				previousLockId: lockId,
				projectId,
				written: reported.flatMap(({ path, sha256 }) =>
					sha256 ? [{ path, sha256 }] : []
				),
			});
		} catch (error) {
			setRecordError(
				`The updated folder could not be read: ${
					error instanceof Error ? error.message : String(error)
				}`
			);
		}
	}

	const bundleTexts = new Map(
		bundle?.files.map((file) => [file.path, file.content]) ?? []
	);
	const summary = (() => {
		if (!plan) {
			return "";
		}
		if (plan.outcome === "halted") {
			return `Refresh halted: ${plan.halted.length} diverged ${plan.halted.length === 1 ? "path waits" : "paths wait"} for your decision. Nothing is written for them.`;
		}
		if (plan.outcome === "partial") {
			return `Partial refresh: ${plan.applied.length} paths will be written and ${plan.held.length} kept out. This is not a completed delivery.`;
		}
		return `Ready: ${plan.applied.length} paths will be written and no divergence waits.`;
	})();

	return (
		<main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8">
			<header className="space-y-2">
				<h1 className="font-semibold text-2xl">Delivery Refresh</h1>
				<p className="text-muted-foreground text-sm">
					Refresh a destination folder from a new Export Bundle. Only files the
					previous Delivery Refresh Lock owns are compared; files Sprite Anvil
					did not write are never read, changed or deleted. A refresh is
					one-way, starts only when you ask, and never changes the previous lock
					or its bundle.
				</p>
			</header>

			<div className="grid gap-4 sm:grid-cols-2">
				<div className="space-y-1 text-sm">
					<Label htmlFor="previous-lock">Previous lock</Label>
					<NativeSelect
						className="w-full"
						id="previous-lock"
						onChange={(event) => {
							setLockId(event.target.value);
							setDecided({});
						}}
						value={lockId}
					>
						<NativeSelectOption value="">Choose a lock</NativeSelectOption>
						{locks.data?.locks.map((entry) => (
							<NativeSelectOption key={entry.id} value={entry.id}>
								{entry.destinationLabel} (locked {entry.createdAt.slice(0, 10)})
							</NativeSelectOption>
						))}
					</NativeSelect>
				</div>
				<div className="space-y-1 text-sm">
					<Label htmlFor="new-bundle">New Export Bundle</Label>
					<NativeSelect
						className="w-full"
						id="new-bundle"
						onChange={(event) => {
							setBundleId(event.target.value);
							setDecided({});
						}}
						value={bundleId}
					>
						<NativeSelectOption value="">Choose a bundle</NativeSelectOption>
						{bundles.data?.bundles.map((entry) => (
							<NativeSelectOption key={entry.id} value={entry.id}>
								Bundle created {entry.createdAt.slice(0, 10)}
							</NativeSelectOption>
						))}
					</NativeSelect>
				</div>
			</div>
			<div className="space-y-1 text-sm">
				<Label htmlFor="destination-folder">Destination folder</Label>
				<Input
					{...directoryAttributes}
					id="destination-folder"
					multiple
					onChange={(event) => {
						chooseFolder([...(event.target.files ?? [])], setTarget);
						setDecided({});
					}}
					type="file"
				/>
				<p className="text-muted-foreground text-xs">
					Only the paths the lock and the bundle name are read, on this device.
				</p>
			</div>

			{contract && !contract.ok ? (
				<p role="alert">
					{contract.reason === "unsupported_major"
						? `This lock uses contract version ${lock?.contractVersion}, which this build cannot refresh from. The refresh is stopped.`
						: "This lock is missing a required field or a full contract version and cannot be refreshed from. The refresh is stopped."}
				</p>
			) : null}

			{classification && plan ? (
				<div className="space-y-4">
					<p aria-live="polite" role="status">
						{summary}
					</p>
					<PathClassSection
						count={entriesOf("unchanged").length}
						description="Owned paths whose bytes already match the new bundle. Nothing is written."
						id="unchanged"
						title="Unchanged"
					>
						<PathList paths={entriesOf("unchanged").map((e) => e.path)} />
					</PathClassSection>
					<PathClassSection
						count={entriesOf("to-update").length}
						description="Paths the new bundle changes or adds while your copy still matches the lock."
						id="to-update"
						title="To update"
					>
						<PathList paths={entriesOf("to-update").map((e) => e.path)} />
					</PathClassSection>
					<PathClassSection
						count={entriesOf("stale").length}
						description="Owned paths the new bundle no longer ships. They are left in place, never deleted, and stop being owned."
						id="stale"
						title="Stale"
					>
						<PathList paths={entriesOf("stale").map((e) => e.path)} />
					</PathClassSection>
					<PathClassSection
						count={entriesOf("missing").length}
						description="Owned paths that are gone from the folder. The new bundle's file is written back when it still ships one."
						id="missing"
						title="Missing"
					>
						<PathList paths={entriesOf("missing").map((e) => e.path)} />
					</PathClassSection>
					<PathClassSection
						count={entriesOf("diverged").length}
						description="Paths that no longer match what Sprite Anvil wrote. Nothing is written for them until you decide."
						id="diverged"
						title="Diverged"
					>
						{entriesOf("diverged").length > 0 ? (
							<ul className="space-y-3">
								{entriesOf("diverged").map((entry) => (
									<DivergedPath
										bundleText={bundleTexts.get(entry.path) ?? null}
										decision={decided[entry.path]}
										entry={entry}
										folderToken={target?.token ?? 0}
										key={entry.path}
										onDecide={(kind) =>
											setDecided((current) => ({
												...current,
												[entry.path]: kind,
											}))
										}
										targetFile={target?.files.get(entry.path)}
									/>
								))}
							</ul>
						) : null}
					</PathClassSection>

					<div className="space-y-3 border-t pt-4">
						<Button
							className="min-h-11"
							onClick={downloadPackage}
							type="button"
							variant="outline"
						>
							Download change package
						</Button>
						<p className="text-muted-foreground text-xs">
							A JSON file with the proposed lock and the divergence report. It
							holds no files and nothing executable; copy the listed files from
							the bundle yourself.
						</p>
						<div className="space-y-1 text-sm">
							<Label htmlFor="updated-folder">Updated destination folder</Label>
							<Input
								{...directoryAttributes}
								id="updated-folder"
								multiple
								onChange={(event) =>
									chooseFolder([...(event.target.files ?? [])], setUpdated)
								}
								type="file"
							/>
						</div>
						<Button
							className="min-h-11"
							disabled={updated === null || refresh.isPending}
							onClick={() => void recordRefresh()}
							type="button"
						>
							Record refresh
						</Button>
					</div>
					{recordError ? <p role="alert">{recordError}</p> : null}
					{refresh.error ? <p role="alert">{refresh.error.message}</p> : null}
					{refresh.data ? <RefreshResultPanel result={refresh.data} /> : null}
				</div>
			) : null}
		</main>
	);
}

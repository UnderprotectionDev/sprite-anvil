import type { DeliveryDiff } from "@sprite-anvil/api/delivery-diff";
import type { ReactNode } from "react";
import { shortId } from "../../lib/short-id";

function Section({ children, title }: { children: ReactNode; title: string }) {
	return (
		<section aria-label={title} className="space-y-2 rounded border p-3">
			<h2 className="font-semibold text-lg">{title}</h2>
			{children}
		</section>
	);
}

function NotRecorded({ reason }: { reason: string }) {
	return (
		<p className="text-sm">
			<strong>Not recorded.</strong>{" "}
			<span className="text-muted-foreground">{reason}</span>
		</p>
	);
}

type Ref = DeliveryDiff["assetVersions"]["added"][number];

const refLabel = (ref: Pick<Ref, "assetFamilyName" | "itemName">) =>
	`${ref.assetFamilyName}: ${ref.itemName}`;

function AssetVersionGroup({
	empty,
	rows,
	title,
}: {
	empty: string;
	rows: { key: string; label: string; versions: string }[];
	title: string;
}) {
	return (
		<div className="space-y-1">
			<h3 className="font-medium">
				{title} ({rows.length})
			</h3>
			{rows.length === 0 ? (
				<p className="text-muted-foreground text-sm">{empty}</p>
			) : (
				<ul className="space-y-1 text-sm">
					{rows.map((row) => (
						<li key={row.key}>
							{row.label} · {row.versions}
						</li>
					))}
				</ul>
			)}
		</div>
	);
}

const keyOf = (ref: { assetFamilyId: string; itemId: string }) =>
	`${ref.assetFamilyId}:${ref.itemId}`;

function AssetVersionsSection({
	assetVersions,
}: {
	assetVersions: DeliveryDiff["assetVersions"];
}) {
	return (
		<Section title="Asset Versions">
			<AssetVersionGroup
				empty="No Asset Version was added."
				rows={assetVersions.added.map((entry) => ({
					key: keyOf(entry),
					label: refLabel(entry),
					versions: entry.assetVersionIds.join(", "),
				}))}
				title="Added"
			/>
			<AssetVersionGroup
				empty="No Asset Version was removed."
				rows={assetVersions.removed.map((entry) => ({
					key: keyOf(entry),
					label: refLabel(entry),
					versions: entry.assetVersionIds.join(", "),
				}))}
				title="Removed"
			/>
			<AssetVersionGroup
				empty="No Asset Version was swapped."
				rows={assetVersions.changed.map((entry) => ({
					key: keyOf(entry),
					label: refLabel(entry),
					versions: `${entry.fromAssetVersionIds.join(", ")} → ${entry.toAssetVersionIds.join(", ")}`,
				}))}
				title="Changed"
			/>
			<p className="text-muted-foreground text-sm">
				{assetVersions.unchangedCount} requirement
				{assetVersions.unchangedCount === 1 ? "" : "s"} kept the same Asset
				Versions.
			</p>
		</Section>
	);
}

function ContextSection({ context }: { context: DeliveryDiff["context"] }) {
	return (
		<Section title="Context">
			{context.status === "not_recorded" ? (
				<NotRecorded reason={context.reason} />
			) : (
				<p className="text-sm">
					Context Revision {context.from.contextRevisionNumber} (
					{context.from.contextRevisionId})
					{context.changed
						? ` → Context Revision ${context.to.contextRevisionNumber} (${context.to.contextRevisionId})`
						: " is the same on both sides."}
				</p>
			)}
		</Section>
	);
}

type Mapping = NonNullable<
	DeliveryDiff["bundleMappings"]["changes"][number]["from"]
>;

const describeMapping = (mapping: Mapping | null) =>
	mapping
		? `Export Bundle ${shortId(mapping.bundleId)} (${mapping.resolution.replace("_", " ")})`
		: "none";

function BundleMappingsSection({
	bundleMappings,
}: {
	bundleMappings: DeliveryDiff["bundleMappings"];
}) {
	return (
		<Section title="Bundle mappings">
			{bundleMappings.changes.length === 0 ? (
				<p className="text-muted-foreground text-sm">
					Every shared requirement maps to the same Export Bundle.
				</p>
			) : (
				<ul className="space-y-1 text-sm">
					{bundleMappings.changes.map((change) => (
						<li key={keyOf(change)}>
							{refLabel(change)} · {describeMapping(change.from)} →{" "}
							{describeMapping(change.to)}
						</li>
					))}
				</ul>
			)}
		</Section>
	);
}

/** The Delivery Diff of two Fulfilments, one section per kind of difference; sections without recorded source data say so. */
export function DeliveryDiffPanel({ diff }: { diff: DeliveryDiff }) {
	return (
		<div className="space-y-4">
			<p className="text-muted-foreground text-sm">
				Revision {diff.from.revisionNumber} ({shortId(diff.from.id)}) → Revision{" "}
				{diff.to.revisionNumber} ({shortId(diff.to.id)}). Comparing changes no
				Delivery Fulfilment and no Delivered status.
			</p>
			<AssetVersionsSection assetVersions={diff.assetVersions} />
			<ContextSection context={diff.context} />
			<Section title="Quality evidence">
				<NotRecorded reason={diff.qualityEvidence.reason} />
			</Section>
			<Section title="Quality Exception">
				<NotRecorded reason={diff.qualityException.reason} />
			</Section>
			<Section title="Rights">
				<NotRecorded reason={diff.rights.reason} />
			</Section>
			<Section title="Runtime evidence">
				<NotRecorded reason={diff.runtimeEvidence.reason} />
			</Section>
			<BundleMappingsSection bundleMappings={diff.bundleMappings} />
		</div>
	);
}

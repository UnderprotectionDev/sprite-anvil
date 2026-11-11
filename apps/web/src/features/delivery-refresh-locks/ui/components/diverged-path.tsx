import type {
	DeliveryRefreshDecisionKind,
	DeliveryRefreshPathEntry,
} from "@sprite-anvil/api/delivery-refresh-classification";
import { Button } from "@sprite-anvil/ui/components/button";
import {
	RadioGroup,
	RadioGroupItem,
} from "@sprite-anvil/ui/components/radio-group";
import { useQuery } from "@tanstack/react-query";
import { readTargetText } from "../../lib/read-target-folder";

const decisions: {
	hint: string;
	kind: DeliveryRefreshDecisionKind;
	label: string;
	needsDiff: boolean;
}[] = [
	{
		hint: "Keep your file as it is. The refresh finishes without it and the result is partial.",
		kind: "preserve",
		label: "Preserve",
		needsDiff: false,
	},
	{
		hint: "Keep your file here and apply the bundle to another folder instead. The refresh finishes without this file and the result is partial.",
		kind: "other_destination",
		label: "Pick another destination",
		needsDiff: false,
	},
	{
		hint: "Overwrite your file with the new bundle's file. Available after you have seen the differences.",
		kind: "replace",
		label: "Replace",
		needsDiff: true,
	},
];

function Side({ text, title }: { text: string | null; title: string }) {
	return (
		<div className="min-w-0 space-y-1">
			<h5 className="font-medium text-xs">{title}</h5>
			{text === null ? (
				<p className="text-muted-foreground text-xs">
					Binary or unavailable: compared by digest only.
				</p>
			) : (
				<pre className="overflow-x-auto whitespace-pre-wrap border p-2 text-xs">
					{text}
				</pre>
			)}
		</div>
	);
}

/** A diverged path: the three digests, the differences on request, and the user's decision. */
export function DivergedPath({
	bundleText,
	decision,
	diffViewed,
	entry,
	folderToken,
	onDecide,
	onShowDiff,
	targetFile,
}: {
	bundleText: string | null;
	decision: DeliveryRefreshDecisionKind | undefined;
	/** The user has opened the differences; replacing is only offered after this. */
	diffViewed: boolean;
	entry: DeliveryRefreshPathEntry;
	folderToken: number;
	onDecide: (kind: DeliveryRefreshDecisionKind) => void;
	onShowDiff: () => void;
	targetFile: File | undefined;
}) {
	const diffShown = diffViewed;
	const targetText = useQuery({
		enabled: diffShown && targetFile !== undefined,
		queryFn: () => (targetFile ? readTargetText(targetFile) : null),
		queryKey: ["delivery-refresh-target-text", folderToken, entry.path],
	});
	const needsDecision = entry.nextSha256 !== null;

	return (
		<li className="space-y-3 border p-3">
			<p className="font-mono text-sm">{entry.path}</p>
			{needsDecision ? null : (
				<p className="text-muted-foreground text-sm">
					The new bundle no longer ships this path, so nothing is written and no
					decision is needed. Your edited file stays in place and the path stops
					being owned; the refresh reports it.
				</p>
			)}
			<dl className="grid grid-cols-[max-content_1fr] gap-x-4 text-xs">
				<dt className="text-muted-foreground">Written by the previous lock</dt>
				<dd className="font-mono">
					{entry.lockSha256?.slice(0, 12) ?? "none"}
				</dd>
				<dt className="text-muted-foreground">In your folder now</dt>
				<dd className="font-mono">
					{entry.targetSha256?.slice(0, 12) ?? "none"}
				</dd>
				<dt className="text-muted-foreground">In the new bundle</dt>
				<dd className="font-mono">
					{entry.nextSha256?.slice(0, 12) ?? "none"}
				</dd>
			</dl>
			{needsDecision ? (
				<>
					<Button
						aria-expanded={diffShown}
						className="min-h-11"
						onClick={onShowDiff}
						type="button"
						variant="outline"
					>
						Show differences
					</Button>
					{diffShown ? (
						<div className="grid gap-3 sm:grid-cols-2">
							<Side text={targetText.data ?? null} title="In your folder" />
							<Side text={bundleText} title="In the new bundle" />
						</div>
					) : null}
					<RadioGroup
						aria-label={`Decision for ${entry.path}`}
						onValueChange={(value) =>
							onDecide(value as DeliveryRefreshDecisionKind)
						}
						value={decision ?? ""}
					>
						{decisions.map((option) => (
							<div className="flex items-start gap-3" key={option.kind}>
								<RadioGroupItem
									aria-label={option.label}
									disabled={option.needsDiff && !diffShown}
									value={option.kind}
								/>
								<div className="space-y-0.5 text-sm">
									<span className="font-medium">{option.label}</span>
									<p className="text-muted-foreground text-xs">{option.hint}</p>
								</div>
							</div>
						))}
					</RadioGroup>
				</>
			) : null}
		</li>
	);
}

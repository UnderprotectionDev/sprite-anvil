import type { PixelDraft } from "@sprite-anvil/api/pixel-editor";
import { Badge } from "@sprite-anvil/ui/components/badge";
import { Button } from "@sprite-anvil/ui/components/button";
import { usePrefersReducedMotion } from "../../hooks/use-prefers-reduced-motion";
import { useTransitionCompare } from "../../hooks/use-transition-compare";
import type { PixelEditorToolStore } from "../../store/pixel-editor-tool-store";
import { PixelCanvas } from "./pixel-canvas";

const phaseLabels = { draft: "Working Draft", source: "Source" } as const;

/**
 * Switches one canvas between the Source and the Working Draft. The user
 * starts and stops the switching; the name of what is shown is always text.
 */
export function TransitionCompare({
	draft,
	draftImage,
	sourceImage,
	store,
}: {
	draft: PixelDraft;
	draftImage: HTMLImageElement | null;
	sourceImage: HTMLImageElement | null;
	store: PixelEditorToolStore;
}) {
	const reducedMotion = usePrefersReducedMotion();
	const transition = useTransitionCompare(reducedMotion);
	const showingSource = transition.phase === "source";
	return (
		<div className="space-y-2">
			<div className="flex flex-wrap items-center gap-2">
				<Button
					disabled={reducedMotion && !transition.running}
					onClick={transition.running ? transition.stop : transition.start}
					size="sm"
					type="button"
					variant={transition.running ? "default" : "outline"}
				>
					{transition.running ? "Stop transition" : "Start transition"}
				</Button>
				<Button
					disabled={transition.running}
					onClick={transition.toggle}
					size="sm"
					type="button"
					variant="outline"
				>
					Show {showingSource ? "Working Draft" : "Source"}
				</Button>
				<Badge variant="secondary">
					Showing: {phaseLabels[transition.phase]}
				</Badge>
			</div>
			{reducedMotion ? (
				<p className="text-muted-foreground text-xs">
					Automatic switching is off because your system asks for reduced
					motion. Use the button to switch by hand.
				</p>
			) : null}
			<div className="flex max-h-[70vh] items-start overflow-auto rounded-md border bg-muted/30 p-3">
				<PixelCanvas
					disabled
					image={showingSource ? sourceImage : draftImage}
					interactive={false}
					label={`${phaseLabels[transition.phase]} pixel canvas`}
					onOperation={() => undefined}
					size={showingSource ? draft.sourceSize : draft.size}
					store={store}
				/>
			</div>
			<p aria-live="polite" className="sr-only">
				Showing {phaseLabels[transition.phase]}
			</p>
		</div>
	);
}

import { Badge } from "@sprite-anvil/ui/components/badge";
import { Button } from "@sprite-anvil/ui/components/button";
import { Label } from "@sprite-anvil/ui/components/label";
import {
	NativeSelect,
	NativeSelectOption,
} from "@sprite-anvil/ui/components/native-select";
import { Link } from "@tanstack/react-router";
import { useStore } from "@tanstack/react-store";
import { useState } from "react";
import { useLoadedImage } from "../../hooks/use-loaded-image";
import { usePixelDraft } from "../../hooks/use-pixel-draft";
import {
	pixelDraftPreviewUrl,
	pixelDraftSourceUrl,
} from "../../lib/pixel-editor-api";
import {
	type CompareMode,
	compareModes,
	createPixelEditorToolStore,
	patchToolState,
} from "../../store/pixel-editor-tool-store";
import { ComparePreview } from "../components/compare-preview";
import { PixelCanvas } from "../components/pixel-canvas";
import { ReviewPanel } from "../components/review-panel";
import { ToolPanel } from "../components/tool-panel";

const zoomLevels = [1, 2, 4, 8, 16, 32];
const compareLabels: Record<CompareMode, string> = {
	draft: "Working Draft",
	source: "Source",
	"side-by-side": "Side by side",
};

export function PixelEditorView({
	projectId,
	sourceAssetVersionId,
}: {
	projectId: string;
	sourceAssetVersionId: string;
}) {
	const [store] = useState(createPixelEditorToolStore);
	const state = useStore(store, (current) => current);
	const { commit, discard, draft, draftQuery, history, isBusy, operation } =
		usePixelDraft(projectId, sourceAssetVersionId);
	const draftImage = useLoadedImage(draft ? pixelDraftPreviewUrl(draft) : null);
	const sourceImage = useLoadedImage(draft ? pixelDraftSourceUrl(draft) : null);

	if (draftQuery.isPending) {
		return <Shell projectId={projectId}>Opening the Working Draft…</Shell>;
	}
	if (!draft) {
		return (
			<Shell projectId={projectId}>
				<p role="alert">
					The Working Draft could not be opened.{" "}
					{draftQuery.error instanceof Error ? draftQuery.error.message : ""}
				</p>
				<Button onClick={() => draftQuery.refetch()} type="button">
					Try again
				</Button>
			</Shell>
		);
	}

	const isOpen = draft.status === "open";
	const locked = !isOpen || isBusy;
	const showDraft = state.compareMode !== "source";
	const showSource = state.compareMode !== "draft";

	return (
		<main className="mx-auto w-full max-w-[110rem] space-y-4 px-4 py-6">
			<header className="space-y-3">
				<Link
					className="text-muted-foreground text-sm underline underline-offset-4"
					params={{ projectId }}
					to="/projects/$projectId/assets"
				>
					Back to Asset Records
				</Link>
				<div className="flex flex-wrap items-center gap-3">
					<h1 className="font-semibold text-xl">Last-Mile Pixel Editor</h1>
					<Badge variant={isOpen ? "secondary" : "outline"}>
						{
							{
								open: "Working Draft",
								committed: "Committed",
								discarded: "Discarded",
							}[draft.status]
						}
					</Badge>
				</div>
				<dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
					<div>
						<dt className="inline text-muted-foreground">Source: </dt>
						<dd className="inline font-mono text-xs">
							{draft.sourceAssetVersionId}
						</dd>
					</div>
					<div>
						<dt className="inline text-muted-foreground">Logical size: </dt>
						<dd className="inline">
							{draft.size.width}×{draft.size.height}
						</dd>
					</div>
					<div>
						<dt className="inline text-muted-foreground">Zoom: </dt>
						<dd className="inline">{state.zoom}×</dd>
					</div>
				</dl>
				<div className="flex flex-wrap items-center gap-2">
					<Button
						disabled={locked || !draft.canUndo}
						onClick={() => history.mutate("undo")}
						size="sm"
						type="button"
						variant="outline"
					>
						Undo
					</Button>
					<Button
						disabled={locked || !draft.canRedo}
						onClick={() => history.mutate("redo")}
						size="sm"
						type="button"
						variant="outline"
					>
						Redo
					</Button>
					<Button
						disabled={locked}
						onClick={() => discard.mutate()}
						size="sm"
						type="button"
						variant="ghost"
					>
						Discard Working Draft
					</Button>
					<Button
						disabled={locked || draft.appliedOperationCount === 0}
						onClick={() => commit.mutate()}
						type="button"
					>
						Finish and create Candidate Version
					</Button>
				</div>
				{draft.status === "committed" ? (
					<p className="text-sm" role="status">
						Candidate Version created. The source Asset Version was not changed.{" "}
						<Link
							className="underline underline-offset-4"
							params={{ projectId }}
							to="/projects/$projectId/assets"
						>
							Review it in Asset Records
						</Link>
					</p>
				) : null}
				{draft.status === "discarded" ? (
					<p className="text-sm" role="status">
						This Working Draft was discarded. Open the editor from a version to
						start a new one.
					</p>
				) : null}
			</header>

			<div className="grid gap-4 lg:grid-cols-[16rem_minmax(0,1fr)_20rem]">
				<aside aria-label="Tool settings" className="min-w-0">
					<ToolPanel
						disabled={locked}
						onOperation={(next) => operation.mutate(next)}
						size={draft.size}
						store={store}
					/>
				</aside>

				<section aria-label="Canvas" className="min-w-0 space-y-3">
					<div className="flex flex-wrap items-end gap-3">
						<Label className="space-y-1 text-xs" htmlFor="zoom">
							<span>Zoom</span>
							<NativeSelect
								id="zoom"
								onChange={(event) =>
									patchToolState(store, { zoom: Number(event.target.value) })
								}
								value={String(state.zoom)}
							>
								{zoomLevels.map((level) => (
									<NativeSelectOption key={level} value={String(level)}>
										{level}×
									</NativeSelectOption>
								))}
							</NativeSelect>
						</Label>
						<div
							aria-label="Compare"
							className="flex flex-wrap gap-1"
							role="group"
						>
							{compareModes.map((mode) => (
								<Button
									aria-pressed={state.compareMode === mode}
									key={mode}
									onClick={() => patchToolState(store, { compareMode: mode })}
									size="sm"
									type="button"
									variant={state.compareMode === mode ? "default" : "outline"}
								>
									{compareLabels[mode]}
								</Button>
							))}
						</div>
						<Button
							aria-pressed={state.showGrid}
							onClick={() =>
								patchToolState(store, { showGrid: !state.showGrid })
							}
							size="sm"
							type="button"
							variant={state.showGrid ? "default" : "outline"}
						>
							Pixel grid
						</Button>
					</div>
					<div className="flex max-h-[70vh] flex-wrap items-start gap-4 overflow-auto rounded-md border bg-muted/30 p-3">
						{showDraft ? (
							<PixelCanvas
								disabled={locked}
								image={draftImage.image}
								interactive
								label="Working Draft pixel canvas"
								onOperation={(next) => operation.mutate(next)}
								size={draft.size}
								store={store}
							/>
						) : null}
						{showSource && sourceImage.image ? (
							<PixelCanvas
								disabled
								image={sourceImage.image}
								interactive={false}
								label="Source Asset Version"
								onOperation={() => undefined}
								size={draft.sourceSize}
								store={store}
							/>
						) : null}
					</div>
					{draftImage.failed ? (
						<p className="text-destructive text-sm" role="alert">
							The Working Draft image could not be loaded.
						</p>
					) : null}
				</section>

				<aside aria-label="Review" className="min-w-0 space-y-5">
					<ReviewPanel
						disabled={locked}
						draft={draft}
						onPickColor={(color) => patchToolState(store, { color })}
						onReplaceColor={(values) =>
							operation.mutate({ type: "replace-color", ...values })
						}
						projectId={projectId}
					/>
					<ComparePreview
						draftImage={draftImage.image}
						size={draft.size}
						sourceImage={sourceImage.image}
						store={store}
					/>
				</aside>
			</div>
		</main>
	);
}

function Shell({
	children,
	projectId,
}: {
	children: React.ReactNode;
	projectId: string;
}) {
	return (
		<main className="mx-auto w-full max-w-3xl space-y-4 px-4 py-8">
			<Link
				className="text-muted-foreground text-sm underline underline-offset-4"
				params={{ projectId }}
				to="/projects/$projectId/assets"
			>
				Back to Asset Records
			</Link>
			{children}
		</main>
	);
}

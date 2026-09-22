import { DndContext, type DragEndEvent } from "@dnd-kit/core";
import {
	arrayMove,
	SortableContext,
	useSortable,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { createFileRoute } from "@tanstack/react-router";
import { useStore } from "@tanstack/react-store";
import { useVirtualizer } from "@tanstack/react-virtual";
import { isTauri } from "@tauri-apps/api/core";
import { BaseDirectory, mkdir, writeFile } from "@tauri-apps/plugin-fs";
import { useEffect, useRef, useState } from "react";

import { ScenePreview } from "@/components/scene-preview";
import { StudioToolbar } from "@/components/studio-toolbar";
import { authClient } from "@/lib/auth-client";
import { type LocalDraft, localDrafts } from "@/lib/local-drafts";
import { studioStore } from "@/lib/studio-store";
import { ENV } from "../env";

export const Route = createFileRoute("/studio")({ component: Studio });

const canvasSize = 16;
const trailingSlash = /\/$/;
const blankPixels = () =>
	Array.from({ length: canvasSize * canvasSize * 4 }, () => 0);

async function canvasPng(canvas: HTMLCanvasElement): Promise<Blob> {
	const blob = await new Promise<Blob | null>((resolve) =>
		canvas.toBlob(resolve, "image/png")
	);
	if (blob) {
		return blob;
	}
	const dataUrl = canvas.toDataURL("image/png");
	const [, encoded] = dataUrl.split(",", 2);
	if (!encoded) {
		throw new Error("PNG export failed");
	}
	const bytes = Uint8Array.from(atob(encoded), (character) =>
		character.charCodeAt(0)
	);
	return new Blob([bytes], { type: "image/png" });
}

interface Frame {
	id: string;
	name: string;
	pixels: number[];
}

function SortableFrame({
	frame,
	selected,
	onSelect,
}: {
	frame: Frame;
	selected: boolean;
	onSelect: () => void;
}) {
	const { attributes, listeners, setNodeRef, transform, transition } =
		useSortable({ id: frame.id });
	return (
		<div
			className="flex gap-2 rounded border p-2"
			ref={setNodeRef}
			style={{ transform: CSS.Transform.toString(transform), transition }}
		>
			<button
				aria-label={`Move ${frame.name}`}
				className="cursor-grab"
				type="button"
				{...attributes}
				{...listeners}
			>
				⋮⋮
			</button>
			<button
				aria-current={selected ? "true" : undefined}
				className="text-left"
				onClick={onSelect}
				type="button"
			>
				{frame.name}
			</button>
		</div>
	);
}

function Studio() {
	const [frames, setFrames] = useState<Frame[]>([
		{ id: crypto.randomUUID(), name: "Frame 1", pixels: blankPixels() },
	]);
	const [selectedId, setSelectedId] = useState(frames[0].id);
	const [drafts, setDrafts] = useState<LocalDraft[]>([]);
	const [status, setStatus] = useState("");
	const [previewSource, setPreviewSource] = useState<HTMLCanvasElement | null>(
		null
	);
	const [previewRevision, setPreviewRevision] = useState(0);
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const listRef = useRef<HTMLDivElement>(null);
	const zoom = useStore(studioStore, (state) => state.zoom);
	const color = useStore(studioStore, (state) => state.color);
	const { data: session } = authClient.useSession();
	const selected = frames.find((frame) => frame.id === selectedId) ?? frames[0];

	const virtualizer = useVirtualizer({
		count: drafts.length,
		getScrollElement: () => listRef.current,
		estimateSize: () => 44,
	});

	useEffect(() => {
		void localDrafts.orderBy("updatedAt").reverse().toArray().then(setDrafts);
	}, []);

	useEffect(() => {
		const canvas = canvasRef.current;
		const context = canvas?.getContext("2d", { willReadFrequently: true });
		if (!(canvas && context)) {
			return;
		}
		const image = context.createImageData(canvasSize, canvasSize);
		image.data.set(selected.pixels);
		context.putImageData(image, 0, 0);
		setPreviewSource(canvas);
		setPreviewRevision((revision) => revision + 1);
	}, [selected]);

	function paint(event: React.PointerEvent<HTMLCanvasElement>) {
		if (event.type === "pointermove" && event.buttons !== 1) {
			return;
		}
		const canvas = canvasRef.current;
		const context = canvas?.getContext("2d", { willReadFrequently: true });
		if (!(canvas && context)) {
			return;
		}
		const bounds = canvas.getBoundingClientRect();
		const x = Math.floor(
			((event.clientX - bounds.left) / bounds.width) * canvasSize
		);
		const y = Math.floor(
			((event.clientY - bounds.top) / bounds.height) * canvasSize
		);
		if (x < 0 || y < 0 || x >= canvasSize || y >= canvasSize) {
			return;
		}
		context.fillStyle = color;
		context.fillRect(x, y, 1, 1);
		const pixels = Array.from(
			context.getImageData(0, 0, canvasSize, canvasSize).data
		);
		setFrames((current) =>
			current.map((frame) =>
				frame.id === selectedId ? { ...frame, pixels } : frame
			)
		);
	}

	function reorder({ active, over }: DragEndEvent) {
		if (!over || active.id === over.id) {
			return;
		}
		setFrames((current) => {
			const from = current.findIndex((frame) => frame.id === active.id);
			const to = current.findIndex((frame) => frame.id === over.id);
			return arrayMove(current, from, to);
		});
	}

	async function saveDraft() {
		const draft = {
			id: selected.id,
			name: selected.name,
			pixels: selected.pixels,
			updatedAt: Date.now(),
		};
		await localDrafts.put(draft);
		setDrafts(await localDrafts.orderBy("updatedAt").reverse().toArray());
		setStatus("Draft saved on this device.");
	}

	async function exportPng() {
		const canvas = canvasRef.current;
		if (!canvas) {
			return;
		}
		try {
			const blob = await canvasPng(canvas);
			const bytes = new Uint8Array(await blob.arrayBuffer());
			if (isTauri()) {
				await mkdir("exports", {
					baseDir: BaseDirectory.AppData,
					recursive: true,
				});
				await writeFile(`exports/${selected.id}.png`, bytes, {
					baseDir: BaseDirectory.AppData,
				});
				setStatus("PNG saved in the app data folder.");
				return;
			}
			const url = URL.createObjectURL(blob);
			const anchor = document.createElement("a");
			anchor.href = url;
			anchor.download = `${selected.name}.png`;
			anchor.click();
			URL.revokeObjectURL(url);
		} catch (error) {
			setStatus(error instanceof Error ? error.message : String(error));
		}
	}

	async function upload() {
		const canvas = canvasRef.current;
		if (!(canvas && session?.user)) {
			setStatus("Sign in before uploading.");
			return;
		}
		try {
			const blob = await canvasPng(canvas);
			const serverUrl = ENV.VITE_SERVER_URL.replace(trailingSlash, "");
			const signedResponse = await fetch(`${serverUrl}/api/assets/upload-url`, {
				method: "POST",
				credentials: "include",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					name: `${selected.name}.png`,
					contentType: "image/png",
				}),
			});
			if (!signedResponse.ok) {
				throw new Error("Upload authorization failed");
			}
			const signed = (await signedResponse.json()) as {
				key: string;
				url: string;
			};
			const putResponse = await fetch(signed.url, {
				method: "PUT",
				headers: { "content-type": "image/png" },
				body: blob,
			});
			if (!putResponse.ok) {
				throw new Error("R2 upload failed");
			}
			const completeResponse = await fetch(`${serverUrl}/api/assets/complete`, {
				method: "POST",
				credentials: "include",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ key: signed.key }),
			});
			if (!completeResponse.ok) {
				throw new Error("Queue publication failed");
			}
			setStatus("Asset uploaded and queued for inspection.");
		} catch (error) {
			setStatus(error instanceof Error ? error.message : "Upload failed");
		}
	}

	return (
		<main className="mx-auto grid w-full max-w-6xl gap-6 p-6 md:grid-cols-[1fr_18rem]">
			<div className="space-y-5">
				<header>
					<h1 className="font-semibold text-2xl">Pixel studio</h1>
					<p className="text-muted-foreground">
						Local 16 × 16 draft and scene preview
					</p>
				</header>
				<StudioToolbar />
				<canvas
					aria-label="Pixel drawing canvas"
					className="touch-none border bg-white"
					height={canvasSize}
					onPointerDown={paint}
					onPointerMove={paint}
					ref={canvasRef}
					style={{
						width: canvasSize * zoom,
						height: canvasSize * zoom,
						imageRendering: "pixelated",
					}}
					width={canvasSize}
				/>
				<div className="flex flex-wrap gap-2">
					<button
						className="rounded border px-3 py-2"
						onClick={() => {
							const frame = {
								id: crypto.randomUUID(),
								name: `Frame ${frames.length + 1}`,
								pixels: blankPixels(),
							};
							setFrames((current) => [...current, frame]);
							setSelectedId(frame.id);
						}}
						type="button"
					>
						Add frame
					</button>
					<button
						className="rounded border px-3 py-2"
						onClick={() => void saveDraft()}
						type="button"
					>
						Save local draft
					</button>
					<button
						className="rounded border px-3 py-2"
						onClick={() => void exportPng()}
						type="button"
					>
						Export PNG
					</button>
					<button
						className="rounded border px-3 py-2"
						onClick={() => void upload()}
						type="button"
					>
						Upload to R2
					</button>
				</div>
				<p role="status">{status}</p>
				<section>
					<h2 className="mb-2 font-medium">Scene preview</h2>
					<ScenePreview revision={previewRevision} source={previewSource} />
				</section>
			</div>
			<aside className="space-y-5">
				<section>
					<h2 className="mb-2 font-medium">Frames</h2>
					<DndContext onDragEnd={reorder}>
						<SortableContext
							items={frames.map((frame) => frame.id)}
							strategy={verticalListSortingStrategy}
						>
							<div className="space-y-2">
								{frames.map((frame) => (
									<SortableFrame
										frame={frame}
										key={frame.id}
										onSelect={() => setSelectedId(frame.id)}
										selected={frame.id === selectedId}
									/>
								))}
							</div>
						</SortableContext>
					</DndContext>
				</section>
				<section>
					<h2 className="mb-2 font-medium">Local drafts</h2>
					<div className="h-56 overflow-auto rounded border" ref={listRef}>
						<div
							style={{
								height: virtualizer.getTotalSize(),
								position: "relative",
							}}
						>
							{virtualizer.getVirtualItems().map((item) => {
								const draft = drafts[item.index];
								return (
									<button
										className="absolute left-0 w-full truncate px-3 text-left"
										key={draft.id}
										onClick={() => {
											setFrames((current) => [
												...current.filter((frame) => frame.id !== draft.id),
												{
													id: draft.id,
													name: draft.name,
													pixels: draft.pixels,
												},
											]);
											setSelectedId(draft.id);
										}}
										style={{
											height: item.size,
											transform: `translateY(${item.start}px)`,
										}}
										type="button"
									>
										{draft.name}
									</button>
								);
							})}
						</div>
					</div>
				</section>
			</aside>
		</main>
	);
}

// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import type { AnimationTimingReviewInput } from "@sprite-anvil/api/animation-timing-reviews";
import type { AssetVersion } from "@sprite-anvil/api/asset-versions";
import type { GameplayMetadataRecord } from "@sprite-anvil/api/gameplay-metadata";
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, expect, test, vi } from "vitest";
import { AnimationTimingReviewEditor } from "./animation-timing-review-editor";

const unusedEventName = /unused/;
const brokenEventName = /broken/;
const malformedTimeMessage = /zaman bilgisi geçersiz/;

vi.mock("./animation-timing-clip-preview", () => ({
	AnimationTimingClipPreview: ({
		elapsedMs,
		frames,
		label,
		looping,
		onStatus,
		statusKey,
	}: {
		elapsedMs: number;
		frames: AnimationTimingReviewInput["directions"][number]["frames"];
		label: string;
		looping: boolean;
		onStatus: (key: string, ready: boolean) => void;
		statusKey: string;
	}) => {
		useEffect(() => onStatus(statusKey, true), [onStatus, statusKey]);
		return (
			<output data-looping={looping} data-testid={`preview-${label}`}>
				{elapsedMs}ms · {frames[0]?.frameKey}
			</output>
		);
	},
}));

const version = {
	id: "version-one",
	assetRecordId: "record",
	versionNumber: 1,
	previewUrl: "/frame.png",
} as AssetVersion;

const eventMetadata: GameplayMetadataRecord[] = [
	{
		id: "d3fa60ed-64c4-4d85-917e-34b95bbde256",
		projectId: "project",
		assetRecordId: "record",
		assetVersionId: version.id,
		frameKey: "walk-1",
		profileId: "character_creature_animation",
		contractRevisionId: "character@1",
		useContext: "walk animation",
		createdAt: "2026-10-05T00:00:00.000Z",
		fields: [
			{
				fieldId: "event_links",
				value: [{ id: "strike", frameKey: "walk-1", time: 90 }],
				unit: null,
				coordinateSystem: null,
				source: { kind: "authored" },
			},
		],
	},
	{
		id: "e890be05-a377-4442-a7f7-33dd1f65a38d",
		projectId: "project",
		assetRecordId: "record",
		assetVersionId: version.id,
		frameKey: "unused-frame",
		profileId: "character_creature_animation",
		contractRevisionId: "character@1",
		useContext: "another animation",
		createdAt: "2026-10-05T00:00:00.000Z",
		fields: [
			{
				fieldId: "event_links",
				value: [{ id: "unused", frameKey: "unused-frame", time: 110 }],
				unit: null,
				coordinateSystem: null,
				source: { kind: "authored" },
			},
		],
	},
];

const review: AnimationTimingReviewInput = {
	id: "8a3bf45a-0039-4761-b996-b0d45f732877",
	projectId: "project",
	assetFamilyId: "family",
	contractRevisionId: "character@1",
	animationName: "Walk cycle",
	playbackSpeed: 1,
	looping: true,
	directions: ["south", "west", "north", "east"].map((direction) => ({
		direction,
		frames: [
			{
				assetVersionId: version.id,
				frameKey: "walk-0",
				durationMs: 80,
				region: null,
				motionPhase: "Contact",
			},
			{
				assetVersionId: version.id,
				frameKey: "walk-1",
				durationMs: 220,
				region: null,
				motionPhase: null,
			},
		],
	})),
	outcome: "needs_follow_up",
	rationale: "The contact frame is held longer in the west direction.",
};

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

function renderEditor(
	onSave = vi.fn(),
	gameplayMetadataRecords: GameplayMetadataRecord[] = [],
	gameplayMetadataStatus: "loading" | "ready" | "error" = "ready",
	onRetryGameplayMetadata = vi.fn()
) {
	return render(
		<AnimationTimingReviewEditor
			assetFamilyId="family"
			contractRevisionId="character@1"
			disabled={false}
			gameplayMetadataRecords={gameplayMetadataRecords}
			gameplayMetadataStatus={gameplayMetadataStatus}
			initial={review}
			onRetryGameplayMetadata={onRetryGameplayMetadata}
			onSave={onSave}
			projectId="project"
			versions={[version]}
		/>
	);
}

test("positions event links from clip start on one shared elapsed-time axis", () => {
	renderEditor(vi.fn(), eventMetadata);

	const southStrike = screen.getByRole("img", {
		name: "south · strike · 90 ms",
	});
	const westStrike = screen.getByRole("img", {
		name: "west · strike · 90 ms",
	});
	expect(southStrike).toHaveAttribute("data-time-ms", "90");
	expect(southStrike).toHaveStyle({ left: "30%" });
	expect(westStrike).toHaveStyle({ left: "30%" });
	expect(
		screen.queryByRole("img", { name: "south · strike · 170 ms" })
	).not.toBeInTheDocument();
	expect(
		screen.queryByRole("img", { name: unusedEventName })
	).not.toBeInTheDocument();
	expect(
		screen.getByRole("region", { name: "Olay zaman çizgisi" })
	).toHaveTextContent("Klip başlangıcından geçen süre (ms)");
});

test("uses the latest Gameplay Metadata record for each selected frame", () => {
	const [record, unrelatedRecord] = eventMetadata;
	if (!(record && unrelatedRecord)) {
		throw new Error("Expected event metadata fixtures.");
	}
	const olderRecord: GameplayMetadataRecord = {
		...record,
		id: "2b5506ca-fd89-4c56-9c60-3ce14dc85e9e",
		createdAt: "2026-10-04T00:00:00.000Z",
		fields: [
			{
				fieldId: "event_links",
				value: [{ id: "strike", frameKey: "walk-1", time: 40 }],
				unit: null,
				coordinateSystem: null,
				source: { kind: "authored" },
			},
		],
	};
	const latestRecord: GameplayMetadataRecord = {
		...record,
		id: "c13f64e5-b287-44a5-a24e-b1429dd09b11",
		createdAt: "2026-10-05T01:00:00.000Z",
		fields: [
			{
				fieldId: "event_links",
				value: [{ id: "strike", frameKey: "walk-1", time: 120 }],
				unit: null,
				coordinateSystem: null,
				source: { kind: "authored" },
			},
		],
	};
	renderEditor(vi.fn(), [latestRecord, olderRecord, unrelatedRecord]);

	expect(
		screen.getByRole("img", { name: "south · strike · 120 ms" })
	).toBeInTheDocument();
	expect(
		screen.queryByRole("img", { name: "south · strike · 40 ms" })
	).not.toBeInTheDocument();
});

test("does not restore events from older metadata after the latest record clears them", () => {
	const [record, unrelatedRecord] = eventMetadata;
	if (!(record && unrelatedRecord)) {
		throw new Error("Expected event metadata fixtures.");
	}
	const clearedRecord: GameplayMetadataRecord = {
		...record,
		id: "5fa2e271-70f7-4dd5-8ccb-47f7adfb96fb",
		createdAt: "2026-10-06T00:00:00.000Z",
		fields: [
			{
				fieldId: "event_links",
				value: [],
				unit: null,
				coordinateSystem: null,
				source: { kind: "authored" },
			},
		],
	};
	renderEditor(vi.fn(), [record, clearedRecord, unrelatedRecord]);

	expect(
		screen.queryByRole("img", { name: "south · strike · 90 ms" })
	).not.toBeInTheDocument();
	expect(
		screen.getByText("Seçili karelerde olay bağlantısı yok.")
	).toBeInTheDocument();
});

test("keeps valid event links visible and reports malformed matching links", () => {
	const [firstEventMetadata] = eventMetadata;
	if (!firstEventMetadata) {
		throw new Error("Expected the first event metadata fixture.");
	}
	const malformedRecord: GameplayMetadataRecord = {
		...firstEventMetadata,
		id: "a3ca7f02-a144-4bf2-8ad5-7de4f77865c3",
		createdAt: "2026-10-05T01:00:00.000Z",
		fields: [
			{
				fieldId: "event_links",
				value: [
					{ id: "strike", frameKey: "walk-1", time: 90 },
					{ id: "broken", frameKey: "walk-1", time: "90" },
				],
				unit: null,
				coordinateSystem: null,
				source: { kind: "authored" },
			},
		],
	};
	renderEditor(vi.fn(), [...eventMetadata, malformedRecord]);

	expect(
		screen.getByRole("img", { name: "south · strike · 90 ms" })
	).toBeInTheDocument();
	expect(
		screen.queryByRole("img", { name: brokenEventName })
	).not.toBeInTheDocument();
	expect(screen.getByText(malformedTimeMessage)).toBeInTheDocument();
});

test("accepts and preserves exact 512-character Gameplay Metadata frame keys", async () => {
	const onSave = vi.fn();
	renderEditor(onSave);
	const frameKey = ` ${"f".repeat(510)} `;
	const frameKeyInput = screen.getByLabelText("Yön 1 kare 1 kimliği");
	expect(frameKeyInput).toHaveProperty("maxLength", 512);
	fireEvent.change(frameKeyInput, { target: { value: frameKey } });

	const saveButton = screen.getByRole("button", { name: "İncelemeyi kaydet" });
	await waitFor(() => expect(saveButton).toBeEnabled());
	fireEvent.click(saveButton);
	await waitFor(() => {
		const saved = onSave.mock.calls[0]?.[0] as
			| AnimationTimingReviewInput
			| undefined;
		expect(saved?.directions[0]?.frames[0]?.frameKey).toBe(frameKey);
	});
});

test("shows metadata loading and read failures instead of treating them as empty events", () => {
	const onRetry = vi.fn();
	renderEditor(vi.fn(), [], "loading", onRetry);
	expect(screen.getByText("Olay bağlantıları yükleniyor…")).toBeInTheDocument();

	cleanup();
	renderEditor(vi.fn(), [], "error", onRetry);
	const alert = screen.getByRole("alert");
	expect(alert).toHaveTextContent("Olay bilgileri okunamadı");
	expect(alert).toHaveTextContent("Olay olmadığı varsayılmadı");
	expect(alert).not.toHaveTextContent("Seçili kareler için zaman bilgisi");
	fireEvent.click(
		screen.getByRole("button", { name: "Olay bilgilerini yeniden yükle" })
	);
	expect(onRetry).toHaveBeenCalledOnce();
});

test("requires the user to choose a result before saving a new review", async () => {
	const onSave = vi.fn();
	render(
		<AnimationTimingReviewEditor
			assetFamilyId="family"
			contractRevisionId="character@1"
			disabled={false}
			onSave={onSave}
			projectId="project"
			versions={[version]}
		/>
	);

	const result = screen.getByLabelText("İnceleme sonucu");
	expect(result).toHaveValue("");

	fireEvent.change(screen.getByLabelText("Animasyon adı"), {
		target: { value: "Walk cycle" },
	});
	for (let direction = 1; direction <= 4; direction += 1) {
		fireEvent.change(screen.getByLabelText(`Yön ${direction} kare 1 kimliği`), {
			target: { value: `walk-${direction}-0` },
		});
		fireEvent.change(screen.getByLabelText(`Yön ${direction} kare 1 sürümü`), {
			target: { value: version.id },
		});
	}
	fireEvent.change(screen.getByLabelText("Gerekçe"), {
		target: { value: "All directions were reviewed." },
	});

	const saveButton = screen.getByRole("button", { name: "İncelemeyi kaydet" });
	await waitFor(() => expect(saveButton).toBeDisabled());

	fireEvent.change(result, { target: { value: "consistent" } });
	await waitFor(() => expect(saveButton).toBeEnabled());
	fireEvent.click(saveButton);
	await waitFor(() =>
		expect(onSave).toHaveBeenCalledWith(
			expect.objectContaining({
				outcome: "consistent",
				rationale: "All directions were reviewed.",
			})
		)
	);
});

test("keeps each frame duration independent and does not require a phase template", async () => {
	const onSave = vi.fn();
	renderEditor(onSave);

	await waitFor(() =>
		expect(
			screen.getByRole("button", { name: "İncelemeyi kaydet" })
		).toBeEnabled()
	);
	expect(screen.getByLabelText("Animasyon adı")).toHaveValue("Walk cycle");
	expect(screen.getByLabelText("Yön 1 kare 1 süre (ms)")).toHaveValue(80);
	expect(screen.getByLabelText("Yön 1 kare 2 süre (ms)")).toHaveValue(220);
	expect(screen.getByLabelText("Yön 1 kare 1 hareket evresi")).toHaveValue(
		"Contact"
	);
	expect(screen.getByLabelText("Yön 1 kare 2 hareket evresi")).toHaveValue("");

	fireEvent.click(screen.getByRole("button", { name: "İncelemeyi kaydet" }));
	await waitFor(() => expect(onSave).toHaveBeenCalledWith(review));
});

test("keeps saved review fields read-only while allowing playback inspection", async () => {
	render(
		<AnimationTimingReviewEditor
			assetFamilyId="family"
			contractRevisionId="character@1"
			disabled
			initial={review}
			onSave={vi.fn()}
			projectId="project"
			versions={[version]}
		/>
	);

	await waitFor(() =>
		expect(screen.getByRole("button", { name: "Birlikte oynat" })).toBeEnabled()
	);
	expect(screen.getByLabelText("Animasyon adı")).toBeDisabled();
	expect(screen.getByLabelText("Oynatma hızı")).toBeDisabled();
	expect(screen.getByLabelText("Döngüde oynat")).toBeDisabled();
	expect(screen.getByLabelText("İnceleme sonucu")).toBeDisabled();
	expect(screen.getByLabelText("Gerekçe")).toBeDisabled();
	expect(screen.getByLabelText("Oynatma konumu (ms)")).toBeEnabled();
	expect(screen.getByLabelText("Yakınlaştırma")).toBeEnabled();
});

test("advances every direction on one clock and stops at pause and reset", async () => {
	let tick: FrameRequestCallback = () => {
		throw new Error("Playback has not started");
	};
	const request = vi.fn((callback: FrameRequestCallback) => {
		tick = callback;
		return 1;
	});
	vi.stubGlobal("requestAnimationFrame", request);
	const cancel = vi.fn();
	vi.stubGlobal("cancelAnimationFrame", cancel);
	renderEditor();
	await waitFor(() =>
		expect(screen.getByRole("button", { name: "Birlikte oynat" })).toBeEnabled()
	);
	fireEvent.change(screen.getByLabelText("Oynatma hızı"), {
		target: { value: "2" },
	});

	fireEvent.click(screen.getByRole("button", { name: "Birlikte oynat" }));
	act(() => tick(1000));
	act(() => tick(1150));
	expect(screen.getByLabelText("Oynatma konumu (ms)")).toHaveValue(300);
	expect(screen.getByTestId("preview-south")).toHaveTextContent("300ms");
	expect(screen.getByTestId("preview-west")).toHaveTextContent("300ms");

	fireEvent.click(screen.getByRole("button", { name: "Duraklat" }));
	expect(cancel).toHaveBeenCalledWith(1);
	fireEvent.click(screen.getByRole("button", { name: "Başa dön" }));
	expect(screen.getByLabelText("Oynatma konumu (ms)")).toHaveValue(0);
});

// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import type {
	GameplayMetadataRecord,
	GameplayMetadataWriteInput,
} from "@sprite-anvil/api/gameplay-metadata";
import { specializedProfileContractCatalog } from "@sprite-anvil/api/specialized-profile-contracts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { GameplayMetadataPanel } from "./gameplay-metadata-panel";

const [contract] = specializedProfileContractCatalog;
const frame = {
	assetVersionId: "version-1",
	frameKey: "walk-0",
	sourcePivots: [],
};

const transport = vi.hoisted(() => ({
	records: [] as GameplayMetadataRecord[],
	listCalls: 0,
	writes: [] as GameplayMetadataWriteInput[],
	writeFailure: null as Error | null,
	writeGate: null as Promise<void> | null,
	failListAfterWrite: false,
	reviews: [] as unknown[],
	packages: [] as unknown[],
	readPackages: [] as unknown[],
}));
vi.mock("@/utils/orpc", async () => {
	const { createTanstackQueryUtils } = await import("@orpc/tanstack-query");
	const client = {
		gameplayMetadata: {
			// biome-ignore lint/suspicious/useAwait: the mock must return a promise like the client
			list: async () => {
				transport.listCalls += 1;
				if (transport.failListAfterWrite && transport.writes.length > 0) {
					throw new Error("List unavailable");
				}
				return { frames: [frame], records: structuredClone(transport.records) };
			},
			write: async (input: GameplayMetadataWriteInput) => {
				transport.writes.push(input);
				await transport.writeGate;
				if (transport.writeFailure) {
					throw transport.writeFailure;
				}
				transport.records.push({
					...input,
					fields: input.fields.map((field) => ({
						fieldId: field.fieldId,
						value:
							field.source?.kind === "authored" ? field.source.value : null,
						unit: null,
						coordinateSystem: null,
						source: field.source
							? { kind: field.source.kind }
							: { kind: "unknown" },
					})),
					createdAt: "2026-10-02T00:00:00.000Z",
				} as unknown as GameplayMetadataRecord);
				return input;
			},
			// biome-ignore lint/suspicious/useAwait: the mock must return a promise like the client
			review: async (input: unknown) => {
				transport.reviews.push(input);
				const [record] = transport.records;
				const reviewed = {
					...record,
					review: { id: "review-1", createdAt: "2026-10-02T00:00:00.000Z" },
				} as unknown as GameplayMetadataRecord;
				transport.records = [reviewed];
				return reviewed;
			},
			// biome-ignore lint/suspicious/useAwait: the mock must return a promise like the client
			createPackage: async (input: unknown) => {
				transport.packages.push(input);
				return { package: true };
			},
			// biome-ignore lint/suspicious/useAwait: the mock must return a promise like the client
			readPackage: async (input: unknown) => {
				transport.readPackages.push(input);
				return {};
			},
		},
		specializedProfileContracts: {
			list: async () => ({
				profiles: [
					{
						activeContract: {
							contractRevisionId: "character@1",
							contract,
						},
						definition: contract,
					},
				],
			}),
		},
		assetVersions: {
			list: async () => ({ assetVersions: [] }),
		},
	};
	return { client, orpc: createTanstackQueryUtils(client as never) };
});

afterEach(() => {
	cleanup();
	transport.records = [];
	transport.listCalls = 0;
	transport.writes = [];
	transport.writeFailure = null;
	transport.writeGate = null;
	transport.failListAfterWrite = false;
	transport.reviews = [];
	transport.packages = [];
	transport.readPackages = [];
});

function openPanel() {
	return render(
		<QueryClientProvider
			client={
				new QueryClient({
					defaultOptions: {
						queries: { retry: false },
						mutations: { retry: false },
					},
				})
			}
		>
			<GameplayMetadataPanel assetRecordId="record" projectId="project" />
		</QueryClientProvider>
	);
}

async function fillAndSave() {
	const user = userEvent.setup();
	await screen.findByLabelText("Kullanım bağlamı");
	await user.type(screen.getByLabelText("Kullanım bağlamı"), "walk east");
	await user.click(
		screen.getByRole("button", { name: "Oyun içi bilgileri kaydet" })
	);
	return user;
}

test("a saved write shows the freshly reread record after the saved message", async () => {
	openPanel();
	await fillAndSave();
	await screen.findByText("Oyun içi bilgiler kaydedildi ve yeniden okundu.");
	expect(transport.writes).toHaveLength(1);
	expect(transport.writes[0]).toMatchObject({
		projectId: "project",
		assetRecordId: "record",
		useContext: "walk east",
	});
	expect(screen.getByText("walk-0 — walk east")).toBeInTheDocument();
	expect(transport.listCalls).toBeGreaterThan(1);
});

test("locks the controls while the write is pending", async () => {
	let release: () => void = () => undefined;
	transport.writeGate = new Promise<void>((resolve) => {
		release = resolve;
	});
	openPanel();
	await fillAndSave();
	await waitFor(() => expect(transport.writes).toHaveLength(1));
	await waitFor(() =>
		expect(screen.getByLabelText("Kullanım bağlamı")).toBeDisabled()
	);
	release();
	await screen.findByText("Oyun içi bilgiler kaydedildi ve yeniden okundu.");
	expect(screen.getByLabelText("Kullanım bağlamı")).toBeEnabled();
});

test("says so when the saved list cannot be reread", async () => {
	transport.failListAfterWrite = true;
	openPanel();
	await fillAndSave();
	await screen.findByText(
		"Kayıt kaydedildi; liste yeniden okunamadı. Kayıtları yeniden yükleyin."
	);
});

test("a definitive rejection shows the server message and releases the form", async () => {
	transport.writeFailure = Object.assign(new Error("Frame is not final"), {
		code: "BAD_REQUEST",
		status: 400,
	});
	openPanel();
	await fillAndSave();
	await screen.findByText("Frame is not final");
	expect(screen.getByLabelText("Kullanım bağlamı")).toBeEnabled();
	expect(
		screen.queryByRole("button", { name: "Kaydı kontrol et" })
	).not.toBeInTheDocument();
});

test("an uncertain write locks the form, retries the same input and can check the outcome", async () => {
	transport.writeFailure = Object.assign(new Error("boom"), {
		code: "INTERNAL_SERVER_ERROR",
		status: 500,
	});
	openPanel();
	const user = await fillAndSave();
	await screen.findByRole("button", { name: "Kaydı kontrol et" });
	expect(screen.getByLabelText("Kullanım bağlamı")).toBeDisabled();
	await user.click(
		screen.getByRole("button", { name: "Aynı işlemi yeniden dene" })
	);
	await waitFor(() => expect(transport.writes).toHaveLength(2));
	expect(transport.writes[1]).toEqual(transport.writes[0]);
	await user.click(screen.getByRole("button", { name: "Kaydı kontrol et" }));
	await screen.findByText(
		"Kayıt henüz görünmüyor. Aynı işlemi yeniden deneyin; yeni kayıt oluşturulmaz."
	);
	transport.writeFailure = null;
	await user.click(
		screen.getByRole("button", { name: "Aynı işlemi yeniden dene" })
	);
	await screen.findByText("Oyun içi bilgiler kaydedildi ve yeniden okundu.");
	expect(transport.writes[2]?.id).toBe(transport.writes[0]?.id);
});

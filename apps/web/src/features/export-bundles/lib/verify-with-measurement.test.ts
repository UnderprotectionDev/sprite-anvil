import { expect, test, vi } from "vitest";
import { verifyWithMeasurement } from "./verify-with-measurement";

test("offline verification reads locally without sending telemetry", async () => {
	const record = vi.fn();
	const read = vi.fn().mockResolvedValue({ result: { ok: true } });
	expect(
		await verifyWithMeasurement({
			projectId: "project",
			online: () => false,
			record,
			read,
		})
	).toEqual({ result: { ok: true } });
	expect(read).toHaveBeenCalledOnce();
	expect(record).not.toHaveBeenCalled();
});

test("connected verification pairs start and actual result under one workflow", async () => {
	const record = vi.fn().mockResolvedValue(undefined);
	const read = vi.fn().mockResolvedValue({ result: { ok: false } });
	await verifyWithMeasurement({
		projectId: "project",
		online: () => true,
		record,
		read,
	});
	expect(record).toHaveBeenCalledTimes(2);
	const first = record.mock.calls[0]?.[0];
	const second = record.mock.calls[1]?.[0];
	expect(first).toEqual({
		projectId: "project",
		workflowId: expect.any(String),
		phase: "start",
	});
	expect(second).toEqual({
		projectId: "project",
		workflowId: first.workflowId,
		phase: "finish",
		outcome: "failed",
	});
});

test("unavailable start stays bounded and never invents a finish", async () => {
	const record = vi.fn().mockReturnValue(
		new Promise(() => {
			/* Deliberately never settles. */
		})
	);
	const read = vi.fn().mockResolvedValue({ result: { ok: true } });
	expect(
		await verifyWithMeasurement({
			projectId: "project",
			online: () => true,
			record,
			read,
			timeoutMs: 5,
		})
	).toEqual({ result: { ok: true } });
	expect(record).toHaveBeenCalledOnce();
});

test("successful connected verification reports verified after reading", async () => {
	const steps: string[] = [];
	const record = vi.fn((input: { phase: string }) => {
		steps.push(input.phase);
		return Promise.resolve();
	});
	const read = () => {
		steps.push("read");
		return Promise.resolve({ result: { ok: true } });
	};
	await verifyWithMeasurement({
		projectId: "project",
		online: () => true,
		record,
		read,
	});
	expect(steps).toEqual(["start", "read", "finish"]);
	expect(record.mock.calls[1]?.[0]).toMatchObject({ outcome: "verified" });
});

test("missing project or connectivity after start does not send a finish", async () => {
	const record = vi.fn().mockResolvedValue(undefined);
	await verifyWithMeasurement({
		online: () => true,
		record,
		read: async () => ({ result: { ok: true } }),
	});
	expect(record).not.toHaveBeenCalled();
	let online = true;
	await verifyWithMeasurement({
		projectId: "project",
		online: () => online,
		record,
		read: () => {
			online = false;
			return Promise.resolve({ result: { ok: true } });
		},
	});
	expect(record).toHaveBeenCalledTimes(1);
});

test("file read failure remains a failure even when finish telemetry fails", async () => {
	const record = vi
		.fn()
		.mockResolvedValueOnce(undefined)
		.mockRejectedValueOnce(new Error("offline"));
	const failure = new Error("unreadable");
	await expect(
		verifyWithMeasurement({
			projectId: "project",
			online: () => true,
			record,
			read: () => Promise.reject(failure),
		})
	).rejects.toBe(failure);
	expect(record.mock.calls[1]?.[0]).toMatchObject({
		phase: "finish",
		outcome: "failed",
	});
});

test("local verification survives unavailable telemetry identity generation", async () => {
	const uuid = vi.spyOn(crypto, "randomUUID").mockImplementation(() => {
		throw new Error("unavailable");
	});
	try {
		const record = vi.fn();
		const read = () => Promise.resolve({ result: { ok: true } });
		expect(
			await verifyWithMeasurement({
				projectId: "project",
				online: () => false,
				record,
				read,
			})
		).toEqual({ result: { ok: true } });
		expect(
			await verifyWithMeasurement({
				projectId: "project",
				online: () => true,
				record,
				read,
			})
		).toEqual({ result: { ok: true } });
		expect(record).not.toHaveBeenCalled();
	} finally {
		uuid.mockRestore();
	}
});

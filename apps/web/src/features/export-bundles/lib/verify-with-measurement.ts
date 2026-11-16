type Boundary =
	| { projectId: string; workflowId: string; phase: "start" }
	| {
			projectId: string;
			workflowId: string;
			phase: "finish";
			outcome: "verified" | "failed";
	  };

async function sendBounded(
	record: (input: Boundary, signal: AbortSignal) => Promise<unknown>,
	input: Boundary,
	timeoutMs: number
): Promise<boolean> {
	const controller = new AbortController();
	let timer: ReturnType<typeof setTimeout> | undefined;
	try {
		return await Promise.race([
			record(input, controller.signal).then(
				() => true,
				() => false
			),
			new Promise<false>((resolve) => {
				timer = setTimeout(() => {
					controller.abort();
					resolve(false);
				}, timeoutMs);
			}),
		]);
	} catch {
		return false;
	} finally {
		if (timer !== undefined) {
			clearTimeout(timer);
		}
	}
}

export async function verifyWithMeasurement<
	T extends { result: { ok: boolean } },
>({
	projectId,
	online,
	record,
	read,
	timeoutMs = 1500,
}: {
	projectId?: string;
	online: () => boolean;
	record: (input: Boundary, signal: AbortSignal) => Promise<unknown>;
	read: () => Promise<T>;
	timeoutMs?: number;
}): Promise<T> {
	let workflowId = "";
	let started = false;
	if (projectId && online()) {
		try {
			workflowId = crypto.randomUUID();
			started = await sendBounded(
				record,
				{ projectId, workflowId, phase: "start" },
				timeoutMs
			);
		} catch {
			// Local verification remains available if telemetry cannot initialize.
		}
	}

	try {
		const result = await read();
		if (projectId && started && online()) {
			await sendBounded(
				record,
				{
					projectId,
					workflowId,
					phase: "finish",
					outcome: result.result.ok ? "verified" : "failed",
				},
				timeoutMs
			);
		}
		return result;
	} catch (error) {
		if (projectId && started && online()) {
			await sendBounded(
				record,
				{ projectId, workflowId, phase: "finish", outcome: "failed" },
				timeoutMs
			);
		}
		throw error;
	}
}

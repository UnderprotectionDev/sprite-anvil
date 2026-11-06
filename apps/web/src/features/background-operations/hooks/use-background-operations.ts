import {
	type BackgroundOperation,
	isBackgroundOperationActive,
} from "@sprite-anvil/api/background-operations";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { orpc } from "@/utils/orpc";

const activePollMs = 2000;
const clockTickMs = 500;

function hasActiveOperation(operations: BackgroundOperation[] | undefined) {
	return (operations ?? []).some((operation) =>
		isBackgroundOperationActive(operation.status)
	);
}

/**
 * The authoritative Background Operation records of a Project. It polls while
 * any operation is active and reads again on reconnect, so the state never
 * depends on this browser session having stayed connected.
 */
export function useBackgroundOperations(projectId: string) {
	const query = useQuery({
		...orpc.backgroundOperations.list.queryOptions({ input: { projectId } }),
		refetchInterval: (current) =>
			hasActiveOperation(current.state.data?.operations) ? activePollMs : false,
		refetchOnReconnect: "always",
	});
	const operations = query.data?.operations ?? [];
	const active = hasActiveOperation(operations);
	const [nowMs, setNowMs] = useState(() => Date.now());

	useEffect(() => {
		if (!active) {
			return;
		}
		setNowMs(Date.now());
		const timer = setInterval(() => setNowMs(Date.now()), clockTickMs);
		return () => clearInterval(timer);
	}, [active]);

	return { nowMs, operations, query };
}

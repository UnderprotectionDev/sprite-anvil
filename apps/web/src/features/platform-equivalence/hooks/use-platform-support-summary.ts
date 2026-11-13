import { summarizePlatformSupport } from "@sprite-anvil/api/platform-support-gate";
import { publishedPlatformSupport } from "@sprite-anvil/api/platform-support-published";
import { useMemo } from "react";

/** The Platform Support Gate over everything the repository publishes; computed on use, not at import. */
export function usePlatformSupportSummary() {
	return useMemo(() => summarizePlatformSupport(publishedPlatformSupport), []);
}

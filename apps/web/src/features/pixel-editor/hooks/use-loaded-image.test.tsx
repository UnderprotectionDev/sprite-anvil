// @vitest-environment jsdom

import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { useLoadedImage } from "./use-loaded-image";

afterEach(cleanup);

test("a missing image URL does not report a failed load", () => {
	const { result } = renderHook(() => useLoadedImage(null));
	expect(result.current).toEqual({
		failed: false,
		image: null,
		isCurrent: false,
	});
});

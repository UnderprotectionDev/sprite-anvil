// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { LoadErrorAlert } from "./load-error-alert";

afterEach(cleanup);

test("a read failure is announced with a name, its message and a retry", async () => {
	const retry = vi.fn();
	render(
		<LoadErrorAlert message="Records could not be loaded." onRetry={retry} />
	);
	const alert = screen.getByRole("alert");
	expect(alert).toHaveTextContent("Error");
	expect(alert).toHaveTextContent("Records could not be loaded.");
	await userEvent.click(screen.getByRole("button", { name: "Retry" }));
	expect(retry).toHaveBeenCalledTimes(1);
});

test("a Support Reference is shown only when the server supplied one", () => {
	const view = render(<LoadErrorAlert message="x" onRetry={() => undefined} />);
	expect(screen.queryByText("Support reference:", { exact: false })).toBeNull();
	view.rerender(
		<LoadErrorAlert
			message="x"
			onRetry={() => undefined}
			supportReference="SUP-9"
		/>
	);
	expect(screen.getByRole("alert")).toHaveTextContent(
		"Support reference: SUP-9"
	);
});

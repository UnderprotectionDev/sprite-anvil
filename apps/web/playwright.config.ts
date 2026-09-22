import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
	testDir: "./e2e",
	use: { baseURL: "http://127.0.0.1:3001", ...devices["Desktop Chrome"] },
	webServer: {
		command: "bun x vite --host 127.0.0.1",
		url: "http://127.0.0.1:3001",
		reuseExistingServer: !process.env.CI,
	},
});

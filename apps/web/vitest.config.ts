import { defineConfig } from "vitest/config";

export default defineConfig({
	test: { include: ["src/**/*.test.ts", "src/**/*.test.tsx"] },
	resolve: { alias: { "@": new URL("./src", import.meta.url).pathname } },
});

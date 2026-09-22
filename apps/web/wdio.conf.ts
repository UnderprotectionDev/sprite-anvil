import type { Options } from "@wdio/types";

export const config: Options.Testrunner = {
	runner: "local",
	specs: ["./desktop-e2e/**/*.spec.ts"],
	maxInstances: 1,
	capabilities: [{ browserName: "tauri" }],
	services: [
		[
			"tauri",
			{
				appBinaryPath: "./src-tauri/target/debug/app",
				driverProvider: "embedded",
				captureBackendLogs: true,
			},
		],
	],
	reporters: ["spec"],
	framework: "mocha",
	mochaOpts: { ui: "bdd", timeout: 60_000 },
};

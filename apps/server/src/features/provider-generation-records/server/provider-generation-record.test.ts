import { expect, test } from "bun:test";
import { sanitizeProviderGenerationParameters } from "./provider-generation-record";

test("keeps provider parameters while removing credentials and temporary URLs", () => {
	const parameters = {
		steps: 28,
		seed: 7231,
		api_key: "secret-api-key",
		authorization: "Bearer secret-token",
		auth_token: "second-secret-token",
		aws_access_key_id: "secret-access-key",
		signature: "secret-signature",
		token_count: 28,
		stable_api_url: "https://provider.example/v2",
		temporary_url: "https://provider.example/output/42",
		credentials: { clientSecret: "secret-client-value" },
		headers: {
			Cookie: "session=secret-session",
			"X-Api-Key": "header-secret",
		},
		requestHeaders: "Authorization: Bearer inline-secret",
		rawRequest: JSON.stringify({
			Authorization: "Bearer serialized-header-secret",
		}),
		resource:
			"https://provider.example/result.png?sv=2026-01-01&sig=temporary-secret",
		output: {
			image_url:
				"https://provider.example/result.png?X-Amz-Signature=temporary-secret",
			format: "png",
		},
		advanced: { guidanceScale: 6.5, sampler: "euler" },
	};

	expect(sanitizeProviderGenerationParameters(parameters)).toEqual({
		steps: 28,
		seed: 7231,
		token_count: 28,
		stable_api_url: "https://provider.example/v2",
		headers: {},
		output: { format: "png" },
		advanced: { guidanceScale: 6.5, sampler: "euler" },
	});
});

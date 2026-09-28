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

test("removes security tokens and secrets inside serialized JSON while keeping safe settings", () => {
	const sanitized = sanitizeProviderGenerationParameters({
		"x-amz-security-token": "temporary-session-secret",
		token_count: 28,
		requestHeaders: "X-Amz-Security-Token: inline-session-secret",
		serializedAuthorization: JSON.stringify("Bearer serialized-session-secret"),
		rawRequest: JSON.stringify({
			api_key: "serialized-api-secret",
			output_url:
				"https://provider.example/output.png?X-Amz-Signature=temporary-secret",
			advanced: { guidanceScale: 6.5, sampler: "euler" },
		}),
	});

	expect(sanitized).toEqual({
		token_count: 28,
		rawRequest: JSON.stringify({
			advanced: { guidanceScale: 6.5, sampler: "euler" },
		}),
	});
});

test("normalizes serialized JSON parameters after a database backfill", () => {
	expect(
		sanitizeProviderGenerationParameters({ rawRequest: '{"steps": 28}' })
	).toEqual({ rawRequest: '{"steps":28}' });
});

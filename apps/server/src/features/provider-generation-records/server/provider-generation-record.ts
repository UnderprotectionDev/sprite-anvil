const sensitiveKeyNames = new Set([
	"accesskey",
	"accesstoken",
	"apikey",
	"auth",
	"authheader",
	"authorization",
	"authorizationheader",
	"authdata",
	"clientsecret",
	"cookie",
	"cookies",
	"credential",
	"credentials",
	"key",
	"password",
	"privatekey",
	"refreshtoken",
	"signature",
	"secret",
	"secretkey",
	"session",
	"sessionid",
	"token",
]);
const temporaryUrlKeyPattern =
	/(?:access|asset|download|file|image|output|preview|result|signed|temporary)(?:[a-z0-9]*)(?:url|uri)$/;
const standaloneAuthValuePattern = /^(?:bearer|basic)\s+\S+$/i;

function isSensitiveKey(key: string) {
	const normalized = key.toLowerCase().replaceAll(/[^a-z0-9]/g, "");
	return (
		sensitiveKeyNames.has(normalized) ||
		normalized.includes("accesskey") ||
		normalized.includes("apikey") ||
		normalized.includes("authdata") ||
		normalized.includes("authheader") ||
		normalized.includes("authtoken") ||
		normalized.includes("authorization") ||
		normalized.includes("cookie") ||
		normalized.includes("clientsecret") ||
		normalized.includes("session") ||
		normalized.includes("signature") ||
		normalized.includes("secret") ||
		normalized.includes("credential") ||
		normalized.includes("password") ||
		normalized.endsWith("accesstoken") ||
		normalized.endsWith("refreshtoken") ||
		normalized.endsWith("credential") ||
		normalized.endsWith("credentials") ||
		normalized.endsWith("secret") ||
		normalized.endsWith("secretkey") ||
		normalized.endsWith("password") ||
		normalized.endsWith("privatekey")
	);
}

function isTemporaryUrlKey(key: string) {
	const normalized = key.toLowerCase().replaceAll(/[^a-z0-9]/g, "");
	return temporaryUrlKeyPattern.test(normalized);
}

function isTemporaryAccessUrl(value: string) {
	try {
		const url = new URL(value);
		if (url.protocol !== "https:" && url.protocol !== "http:") {
			return false;
		}
		if (url.username || url.password) {
			return true;
		}
		for (const key of url.searchParams.keys()) {
			const normalized = key.toLowerCase().replaceAll(/[^a-z0-9]/g, "");
			if (
				normalized.includes("signature") ||
				normalized.includes("credential") ||
				normalized.includes("accesskey") ||
				normalized.includes("accesstoken") ||
				normalized.includes("token") ||
				normalized === "sig" ||
				normalized === "expires" ||
				normalized.startsWith("xamz")
			) {
				return true;
			}
		}
		return false;
	} catch {
		return false;
	}
}

function sanitizeValue(value: unknown): unknown {
	if (typeof value === "string") {
		return isTemporaryAccessUrl(value) || standaloneAuthValuePattern.test(value)
			? undefined
			: value;
	}
	if (Array.isArray(value)) {
		return value.map(sanitizeValue).filter((entry) => entry !== undefined);
	}
	if (!value || typeof value !== "object") {
		return value;
	}

	const sanitized: Record<string, unknown> = {};
	for (const [key, child] of Object.entries(value)) {
		if (isSensitiveKey(key) || isTemporaryUrlKey(key)) {
			continue;
		}
		const safeChild = sanitizeValue(child);
		if (safeChild !== undefined) {
			sanitized[key] = safeChild;
		}
	}
	return sanitized;
}

export function sanitizeProviderGenerationParameters(
	parameters: Record<string, unknown>
): Record<string, unknown> {
	return sanitizeValue(parameters) as Record<string, unknown>;
}

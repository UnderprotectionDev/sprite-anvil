export type ContractVersionSupport =
	| { status: "supported" }
	| { status: "unsupported_major"; major: number }
	| { status: "malformed" };

const digitsPattern = /^\d+$/;

/**
 * Whether a build can read a record written under `version`, a full
 * `<name>/<major>.<minor>.<patch>` contract version. Only the one major it
 * knows is supported: a newer major, or text that is no version, is never read.
 */
export function contractVersionSupport(
	version: string,
	contract: { name: string; supportedMajor: number }
): ContractVersionSupport {
	const [name, numbers, ...rest] = version.split("/");
	const parts = numbers?.split(".") ?? [];
	if (
		name !== contract.name ||
		rest.length > 0 ||
		parts.length !== 3 ||
		!parts.every((part) => digitsPattern.test(part))
	) {
		return { status: "malformed" };
	}
	const major = Number(parts[0]);
	return major === contract.supportedMajor
		? { status: "supported" }
		: { major, status: "unsupported_major" };
}

import { z } from "zod";
import { sha256Schema } from "./export-bundle-manifest";

const windowsDrivePattern = /^[a-zA-Z]:/;

/** A relative, forward-slash path inside the delivery destination; never absolute and never leaving it. */
export const deliveryRelativePathSchema = z
	.string()
	.min(1)
	.max(512)
	.refine(
		(path) =>
			!(
				path.startsWith("/") ||
				path.startsWith("~") ||
				path.includes("\\") ||
				windowsDrivePattern.test(path) ||
				path
					.split("/")
					.some((part) => part === "" || part === "." || part === "..")
			),
		"A path must be relative to the delivery destination."
	);

/** A destination path and the SHA-256 of its bytes, as a surface reports a file it wrote. */
export const deliveryPathDigestSchema = z
	.object({ path: deliveryRelativePathSchema, sha256: sha256Schema })
	.strict();

/** Orders paths by code unit so every surface and the server sort identically. */
export const comparePaths = (left: string, right: string): number =>
	Number(left > right) - Number(left < right);

export const byPath = (
	left: { path: string },
	right: { path: string }
): number => comparePaths(left.path, right.path);

/** A human label for the destination. It names the folder for the user and is never a local path. */
export const deliveryDestinationLabelSchema = z
	.string()
	.trim()
	.min(1)
	.max(120)
	.refine(
		(label) =>
			!(
				label.startsWith("/") ||
				label.startsWith("~") ||
				label.includes("\\") ||
				label.includes("..") ||
				windowsDrivePattern.test(label)
			),
		"The destination label must be a name, not a local path."
	);

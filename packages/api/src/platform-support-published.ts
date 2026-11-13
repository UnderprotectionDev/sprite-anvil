import type { PublishedPlatformSupport } from "./platform-support-gate";

/**
 * Everything the repository publishes toward platform support. It is empty on
 * purpose: the Supported Platform Matrix rows and the OV-08 to OV-11 parameters
 * and evidence are not published yet, and none may be assumed. Add an entry only
 * from a published source, with its evidence reference.
 */
export const publishedPlatformSupport: PublishedPlatformSupport = {};

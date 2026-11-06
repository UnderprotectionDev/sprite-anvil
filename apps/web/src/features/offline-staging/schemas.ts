import { z } from "zod";

/** The part of a cached project snapshot the offline view reads. */
export const cachedProjectNameSchema = z.object({ name: z.string() });

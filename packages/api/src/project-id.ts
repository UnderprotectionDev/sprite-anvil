import { z } from "zod";

export const projectIdSchema = z.string().min(1).max(200);

import { z } from "zod";

export const pageSizeSchema = z.number().int().min(1).max(100);

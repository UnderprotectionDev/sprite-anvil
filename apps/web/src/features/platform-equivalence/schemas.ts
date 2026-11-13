import { z } from "zod";

export const platformEquivalenceRunFormSchema = z.object({
	bundleId: z.string().min(1, "Choose the Export Bundle this run used."),
});

/** An empty choice means the newest run of that surface; the server rejects a report with no run at all. */
export const platformEquivalenceReportFormSchema = z.object({
	desktopRunId: z.string(),
	webRunId: z.string(),
});

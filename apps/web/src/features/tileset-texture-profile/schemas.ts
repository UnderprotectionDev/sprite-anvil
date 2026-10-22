import z from "zod";

export const tilesetIssueFormDefaults = {
	issueNotes: "",
	neighborIndex: "",
};

export const tilesetIssueFormSchema = z.object({
	issueNotes: z.string().trim().min(1).max(1000),
	neighborIndex: z.string(),
});

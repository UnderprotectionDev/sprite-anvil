/** The kind of identity a pseudonym stands for; kinds never collide. */
export type PseudonymKind = "project" | "user";

/** A stable, one-way pseudonym for an id, so stored measurement data never holds the real user or project id. */
export type Pseudonymize = (kind: PseudonymKind, id: string) => string;

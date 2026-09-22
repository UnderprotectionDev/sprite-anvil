# Domain documentation

Use this guide when exploring or changing a product concept, editing the glossary or an ADR, or naming a concept in a proposal, test, or user report. The root [AGENTS.md](../../AGENTS.md) owns the work sequence.

## Locate the owning sources

- [docs/CONTEXT.md](../CONTEXT.md) is the repository-wide bilingual domain glossary. Its English names are technical names; its Turkish names are product and PRD labels. This file is distinct from the agent-maintained `context.md` of one game project inside the product, which represents **Project Context**.
- [docs/prd/README.md](../prd/README.md) indexes the canonical product requirements. Find the requirement ID and its topic file before treating a concept as deliverable behavior. Use [acceptance scenarios](../prd/10-acceptance-scenarios.md) to identify observable evidence.
- [docs/workflow/](../workflow/) contains phase-context files that break product behavior into work, completion criteria, and scope boundaries. Select the phase that covers the change; record `none` if none does.
- [docs/adr/](../adr/) records existing architectural decisions. Read every decision whose boundary the proposed change touches, not the entire folder by default.
- [docs/tech-stack.md](../tech-stack.md) lists technology choices. Package manifests and nearby source code show what is installed and how this repository currently uses it.

The repository has one domain glossary under `docs/`; `apps/` and `packages/` are implementation packages, not separate domain contexts. When these sources disagree, identify the exact requirement, term, phase, or ADR and the conflicting statements. Resolve the disagreement with the user before changing behavior; no source silently overrides another.

**Done when:** every behavior change has a named glossary term, PRD requirement, workflow phase, and affected ADR path or explicit `none`, with conflicts resolved.

## Use and extend the vocabulary

Use the glossary's canonical English technical name in code, API/schema contracts, tests, and technical discussion. Use the paired Turkish product label in Turkish product documentation. When referring to an actual UI control, use the text present in the interface; a domain label is not automatically a button label.

The glossary's `_Avoid_` lists exclude misleading alternatives, including in issue titles, hypotheses, refactor plans, and reports. If a desired name is absent, first check whether an existing term already covers the meaning. For a genuinely new concept, add its English/Turkish pair, definition, boundary, and useful `_Avoid_` terms near related entries in the same change that introduces it. Update the owning PRD or workflow text only where the new concept changes that source's meaning.

**Done when:** one term names each concept consistently across the changed artifacts, without a second synonym for the same meaning.

## Maintain ADR boundaries

An ADR records a surprising or costly choice future work must respect. Before writing one, check the relevant existing decisions and the neighboring file format. Keep routine library usage and easily reversed code organization with the implementation. Existing ADRs are in English; follow that convention for new records.

If a proposed change contradicts an ADR, name its file and the specific decision, explain why it should be revisited, and resolve the change with the user before editing code or decision text. When an ADR is added or revised, link the new boundary to the affected glossary and PRD concepts without repeating their definitions.

**Done when:** affected decisions are either preserved or explicitly revised, and no new ADR duplicates a routine implementation detail.

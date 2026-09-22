---
status: accepted
---

# Require explicit visual locale fallbacks

For feature candidate F2, a Localized Visual Mapping names the accepted fallback separately for each visual use; missing required locale coverage remains incomplete when no fallback has been selected, rather than silently using the project's default language. This allows a language-neutral symbol where suitable without treating untranslated instructions as interchangeable, at the cost of explicit mapping work. The original 2026-09-21 opportunity-interview file is unavailable, so it is not cited as recoverable evidence; this ADR preserves the accepted decision and does not add F2 to the PRD's required scope.

The preselected fallback applies to an absent locale mapping, not an existing primary alternative that is rejected, awaiting revalidation, or ineligible under target policies; substituting for such an alternative requires an explicit user mapping change. The fallback must itself satisfy applicable approval, applicability, quality, and target-policy conditions, and historical bundles retain their pinned choices; this prevents missing-translation permission from silently becoming permission to replace an unready result, at the cost of additional user action.

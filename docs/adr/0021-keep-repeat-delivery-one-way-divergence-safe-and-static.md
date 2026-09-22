---
status: accepted
---

# Keep repeat delivery one-way, divergence-safe, and static

Repeat delivery uses a versioned Export Profile and a Delivery Refresh Lock that maps one exact immutable Export Bundle to the paths and content digests previously written to a delivery destination. Refresh is always user-started and one-way. If an owned target path diverges from the lock, the affected refresh stops until the user preserves the target file, selects a new destination, or explicitly replaces it; unowned files are never silently changed or deleted. Web and desktop share the same profile, lock, and divergence semantics, while web may produce a downloadable change package and desktop may apply it with explicit filesystem permission. This preserves human authority, target-file ownership, and the engine-neutral source of truth without introducing continuous or bidirectional synchronization, at the cost of explicit conflict resolution and profile/lock schema maintenance.

Every Engine-Neutral Bundle includes a static Package Verification Kit containing the matching JSON Schema, deterministic checksums, a human-readable README, and non-executable example mappings. Validation is performed by the Workbench or a separately versioned validator; the bundle contains no executable installer or authoritative agent instructions, and installation does not introduce a separate Consumption Receipt. Existing Delivery Fulfilment and Runtime Validation Records retain their distinct meanings. This keeps packages offline-verifiable and safer for human or agent-assisted consumption at the cost of maintaining schema-compatible documentation and validators.

This records the 2026-09-22 decisions for O2 and O3 in the [competitive inventory](../competitors.md), is consistent with [ADR-0004](0004-engine-neutral-export-with-godot-first.md), [ADR-0012](0012-reserve-consequential-decisions-for-the-user.md), and [ADR-0017](0017-treat-runtime-validation-as-one-way-user-finalized-evidence.md), and does not make a game project or delivery destination authoritative.

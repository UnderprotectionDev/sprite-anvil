# Managed snapshots are provenance

Every imported candidate output is preserved as a Managed Snapshot, and users may deliberately snapshot important Aseprite, Photoshop, Spine, or similar working files. Desktop Live File Links support opening and change detection but are never the only provenance for an Asset Version; automatic copying of the entire external project on every save is not required. This keeps lineage portable across devices and path changes while controlling storage growth, at the cost of explicit snapshot choices for large working files.


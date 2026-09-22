# Version replaceable units and compositions independently

Independently replaceable frames, directions, tiles, and states use immutable Unit Versions, while clips, sheets, and other assemblies use immutable Composite Versions that pin their exact units. Replacing one unit creates both a new Unit Version and, when adopted, a new Composite Version; unit approval never implicitly approves the resulting composition. This makes selective repair and export provenance exact, at the cost of a larger version graph and more explicit composition review.


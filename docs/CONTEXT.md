# Sprite Anvil Domain Context

This context defines the shared language for managing coherent 2D game-asset production across ChatGPT, the Sprite Anvil Workbench, external art tools, and game-engine exports. Sprite Anvil is ChatGPT-first, but its asset, evidence, quality, versioning, and delivery model is provider-neutral.

This repository-level `CONTEXT.md` is the product domain glossary. It is distinct from the agent-maintained per-game-project `context.md` that represents Project Context inside the product.

English terms are the canonical technical names used in code and contracts. Turkish terms are the canonical product and PRD labels. Each pair has one meaning; alternate translations must not be introduced for the same concept.

## Canonical bilingual terminology

| English technical name | Turkish product label |
| --- | --- |
| Project | Proje |
| Project Context | Proje Bağlamı |
| 2D Visual Asset | 2D Görsel Varlık |
| Visual World | Görsel Dünya |
| Theme | Tema |
| Context Revision | Bağlam Sürümü |
| Context Proposal | Bağlam Önerisi |
| Context Agent | Bağlam Ajanı |
| Context Agent Contract | Bağlam Ajanı Sözleşmesi |
| Context Rule | Bağlam Kuralı |
| Style Module | Stil Modülü |
| Active Context Revision | Etkin Bağlam Sürümü |
| Context Override | Bağlam Kuralı İstisnası |
| Production Context Snapshot | Üretim Bağlamı Kopyası |
| Asset Record | Varlık Kaydı |
| Asset Version | Varlık Sürümü |
| Asset Family | Varlık Ailesi |
| Collection | Koleksiyon |
| Subject Identity | Varlık Kimliği |
| Canonical Design | Ana Tasarım |
| Derivative | Türetilmiş Varlık |
| Candidate Version | Aday Sürüm |
| Working Draft | Çalışma Taslağı |
| Managed Snapshot | Yönetilen Kopya |
| Live File Link | Canlı Dosya Bağlantısı |
| Source Metadata Mapping Proposal | Kaynak Metadata Eşleme Önerisi |
| Approved Version | Onaylı Sürüm |
| Review Event | İnceleme Kaydı |
| Human-Gated Action | Kullanıcı Kesinleştirmeli İşlem |
| Export-Ready Version | Dışa Aktarıma Hazır Sürüm |
| Review Disposition | İnceleme Kararı |
| Applicability Status | Bağlama Uygunluk Durumu |
| QA Readiness | Kalite Kontrol Durumu |
| Availability | Kayıt Durumu |
| Revalidation Required | Yeniden Doğrulama Gerekli |
| Dependency Link | Bağımlılık Bağlantısı |
| Change Facet | Değişiklik Tanımı |
| Unit Version | Birim Sürümü |
| Composite Version | Birleşik Sürüm |
| Source Image Dimensions | Kaynak Görsel Ölçüsü |
| Logical Resolution | Mantıksal Çözünürlük |
| Cell Dimensions | Hücre Ölçüsü |
| Visible Content Bounds | Görünür İçerik Sınırı |
| Display Scale | Gösterim Ölçeği |
| Atlas Dimensions | Atlas Ölçüsü |
| Reference Role | Referans Kullanım Amacı |
| Reference Transfer Constraint | Referans Aktarım Kuralı |
| Quality Profile | Kalite Profili |
| Integrity Gate | Bütünlük Denetimi |
| Waivable Requirement | İstisna Verilebilir Gereksinim |
| Quality Advisory | Kalite Uyarısı |
| Quality Waiver | Kalite İstisnası |
| Required Set | Gerekli Öğeler Listesi |
| Last-Mile Pixel Editor | Son Dokunuş Piksel Düzenleyicisi |
| General Asset Support | Genel Varlık Desteği |
| Specialized Asset Profile | Özel Varlık Profili |
| Specialized Profile Contract | Özel Profil Sözleşmesi |
| Import Inbox Entry | İçe Aktarma Gelen Kutusu Girdisi |
| Composition Membership | Bileşim Üyeliği |
| Generation Package | Üretim Paketi |
| Manual Import Evidence | Elle İçe Aktarma Kanıtı |
| Provider Generation Record | Sağlayıcı Üretim Kaydı |
| Legacy Asset Attestation | Geçmiş Varlık Beyanı |
| Production Experiment | Üretim Deneyi |
| Production Recipe | Üretim Tarifi |
| Rights Record | Hak Kaydı |
| Rights Evidence Policy | Hak Kanıtı Politikası |
| Rights Lineage | Hak Geçmişi |
| Engine-Neutral Bundle | Oyun Motorundan Bağımsız Paket |
| Export Bundle | Dışa Aktarım Paketi |
| Export Profile | Dışa Aktarım Profili |
| Delivery Refresh Lock | Teslimat Yenileme Kilidi |
| Package Verification Kit | Paket Doğrulama Kiti |
| Delivery Target | Teslimat Hedefi |
| Production Evidence Policy | Üretim Kanıtı Politikası |
| Readiness Plan | Hazırlık Planı |
| Delivery Fulfilment | Teslimat Gerçekleşmesi |
| Historical Risk Notice | Tarihsel Risk Bildirimi |
| Delivery Diff | Teslimat Farkı |
| Verified Engine Adapter | Doğrulanmış Motor Bağdaştırıcısı |
| Core Production Lifecycle | Temel Üretim Akışı |
| Offline Staged Work | Çevrimdışı Hazırlık Çalışması |
| Offline Conflict Record | Çakışma Kaydı |
| Measurement Definition | Ölçüm Tanımı |
| Project Archive | Proje Arşivi |
| Erasure Tombstone | Silme Kaydı |
| External Visual Analysis | Harici Görsel Analizi |
| Scene QA Playground | Sahne Kalite Kontrol Alanı |
| Runtime Validation Record | Çalışma Zamanı Doğrulama Kaydı |
| Gameplay Metadata | Oyun İçi Bilgiler |
| Deletion Job | Silme İşlemi |
| Tool Access Permission | Dış Araç Erişim İzni |
| External Tool Connection | Dış Araç Bağlantısı |
| Operational Acceptance Profile | Operasyonel Kabul Profili |
| Supported Platform Matrix | Desteklenen Platformlar Tablosu |
| Reference Acceptance Scenario | Referans Kabul Senaryosu |
| Semantic Distinction Requirement | Anlamsal Ayrışma Gereksinimi |
| Semantic Distinction Review | Anlamsal Ayrışma İncelemesi |
| Localized Visual Mapping | Yerelleştirilmiş Görsel Eşlemesi |
| Equipment Compatibility Scope | Ekipman Uyumluluk Kapsamı |
| Equipment Compatibility Evidence | Ekipman Uyumluluk Kanıtı |
| Animation Family Normalization | Animasyon Ailesi Normalizasyonu |

## Project rules

**Project**:
A private game-project record in the Workbench owned by one user. It stores the project name and scopes production data, including Project Context and Asset Records. Reading a Project grants no review or approval authority. It is distinct from the repository and Conductor workspaces used to develop Sprite Anvil.
_Avoid_: Project Context, account, shared workspace, Conductor workspace, `context.md`

**Project Context**:
The authoritative, scoped set of approved visual rules, exceptions, and production decisions for one game project. It is represented by the agent-maintained, human-readable `context.md` and consumed by the Workbench.
_Avoid_: Art contract, prompt context, project settings

**Visual World**:
A coherent presentation regime within a project, such as gameplay pixel art, illustrated portraits, UI, or marketing art. A visual world may contain multiple themes while retaining its own resolution and rendering rules.
_Avoid_: Style, theme, art mode

**Theme**:
A scoped motif, material, palette, and environmental vocabulary within a visual world, such as Dark Castle or Frost Region.
_Avoid_: Visual world, style

**Context Revision**:
A versioned state of the Project Context that can be inspected and associated with production history.
_Avoid_: Asset version, prompt snapshot

**Context Proposal**:
A Context Agent-authored change to the Project Context that has not yet been validated and activated by the user as a Context Revision.
_Avoid_: Active rule, draft asset

**Context Agent**:
An AI agent authorized to translate user decisions and observed project changes into structured Context Proposals. It cannot activate its own proposals.
_Avoid_: Project owner, autonomous art director

When a Context Agent is unavailable, structured product controls may deterministically author schema-valid Context Proposals for common decisions. The user still does not edit raw `context.md`; free-form changes wait for an agent.

**Context Agent Contract**:
A provider-neutral, versioned input/output contract that records the agent and model identity, proposal base revision, proposed Context Rules, and deterministic validation results.
_Avoid_: ChatGPT-specific prompt, arbitrary Markdown output

**Context Rule**:
A schema-validated, identity-bearing statement with an explicit scope and value inside `context.md`. Free-form explanation may document its rationale but does not independently control product behavior.
_Avoid_: Prompt fragment, unstructured note

**Style Module**:
A versioned, scoped group of palette, outline, shading, material, motif, and canonical-example Context Rules. A module may be copied between projects, but its active state belongs to the receiving project's Context Revision rather than to a separately authoritative Style Pack.
_Avoid_: Live shared style pack, theme, visual world

Every Context Proposal names its base Context Revision. Independent rule changes may merge semantically; proposals that change the same rule or overlapping scopes remain conflicts until the user resolves them.

**Active Context Revision**:
The validated Context Revision currently used to derive production context. A Context Proposal does not affect production until the user activates it.
_Avoid_: Latest file edit, context proposal

**Context Override**:
An explicit, traceable decision for a more specific scope to replace an inherited rule. Specificity follows operation, asset, asset family, theme, visual world, then project; contradictions within one scope remain unresolved conflicts.
_Avoid_: Silent precedence, last write wins

**Production Context Snapshot**:
The immutable subset of an active Context Revision, reference roles, and current instructions used to produce a candidate version.
_Avoid_: Full chat history, prompt alone

## Assets and lineage

**Asset Record**:
The durable identity of one independently meaningful, lifecycle-managed, or deliverable game-art subject or set across all of its versions and production history. Technical replaceability alone does not make a production unit an Asset Record.
_Avoid_: File, image, asset version

**Asset Version**:
An immutable visual or structural result belonging to an Asset Record. Replacements and edits create new versions instead of overwriting existing ones.
_Avoid_: Asset, file revision

**Asset Family**:
A group of related assets and derivatives within one Visual World and use context, governed by one Canonical Design lineage. Representations of the same subject that require different Canonical Designs belong to separate Asset Families linked by Subject Identity.
_Avoid_: Collection, folder, asset type

**Collection**:
A user-defined organizational grouping that may contain otherwise unrelated Asset Records or Asset Families. Membership creates no lineage, inherited rules, completion requirement, or delivery obligation.
_Avoid_: Asset family, required set, delivery target

**Subject Identity**:
The enduring identity shared by related representations of the same character, object, or subject across Visual Worlds and use contexts.
_Avoid_: Asset version, canonical design

**Canonical Design**:
The approved Asset Version designated as the identity and constraint source for an Asset Family's derivatives.
_Avoid_: Latest version, base image, main file

A Subject Identity may have a separate Canonical Design for each Visual World and use context. Every derivative names the specific Canonical Design from which it inherits.

**Derivative**:
An asset or version produced from a Canonical Design while preserving declared identity and context constraints.
_Avoid_: Copy, variant

**Candidate Version**:
A newly imported, generated, or edited Asset Version awaiting approval or rejection.
_Avoid_: Draft file, current version

**Working Draft**:
A recoverable but uncommitted Last-Mile Pixel Editor session. Committing a Working Draft creates one immutable Candidate Version.
_Avoid_: Asset version, approved edit

**Managed Snapshot**:
An immutable copy of an imported output or deliberately preserved external working file stored as production evidence under Workbench control.
_Avoid_: Live file link, local path

**Live File Link**:
A desktop convenience that points to an external working file for opening and change detection. It is never the sole provenance record for an Asset Version.
_Avoid_: Managed snapshot, asset version

**Source Metadata Mapping Proposal**:
A reviewable draft that maps documented metadata from an imported PNG or sprite sheet and its supported JSON sidecar to proposed Asset Family, Required Set, Gameplay Metadata, and QA fields. Required conflicts remain unresolved until the user decides them; optional fields may remain explicitly unknown. The proposal never establishes production lineage, approval, or authoritative gameplay meaning by itself.
_Avoid_: Imported truth, automatic family inference, legacy asset attestation

**Import Inbox Entry**:
A Managed Snapshot imported without an authoritative target relationship. It may carry source facts and mapping proposals, but it is not an Asset Record or Candidate Version and cannot be approved or exported; resolving it against a target creates the Candidate Version.
_Avoid_: Candidate version, asset record, inferred asset family

**Approved Version**:
An Asset Version the user has accepted for its declared purpose. Approval does not by itself mean that all export-readiness requirements have been satisfied.
_Avoid_: Export-ready version, latest version

**Review Event**:
An immutable record of a user changing a version's Review Disposition, including the decision, time, and rationale when supplied. The current disposition is derived from the latest applicable Review Event.
_Avoid_: Mutable status field, file edit

**Human-Gated Action**:
A consequential decision reserved for the user: activating a Context Revision or Required Set, selecting a Canonical Design, recording a Review Event or Quality Waiver, starting an Export Bundle, resolving a divergent delivery target, and authorizing permanent erasure. Agents may prepare evidence and proposals but cannot perform these actions.
_Avoid_: Agent suggestion, deterministic validation

**Export-Ready Version**:
An Approved Version whose applicable Integrity Gates pass, whose Waivable Requirements either pass or carry visible version-specific Quality Waivers, and whose mandatory human reviews and usage-context tests have passing evidence under the pinned Specialized Profile Contract.
_Avoid_: Approved version, finished image

**Applicability Status**:
An assessment of whether a historically approved version remains applicable to the currently selected Context Revision and Canonical Design.
_Avoid_: Approval status, QA result

**Review Disposition**:
The user's decision about a version: Candidate, Approved, or Rejected. It is independent of current applicability, QA readiness, and availability.
_Avoid_: Asset status, export readiness

**QA Readiness**:
The result of applying a Quality Profile: Not Assessed, Blocked, Ready with Waivers, or Export Ready.
_Avoid_: Approval, applicability

**Availability**:
Whether a record is Active, Archived, or Erased; an Erasure Tombstone may preserve content-free lineage after erasure. Availability does not rewrite historical review or QA facts.
_Avoid_: Approval status, latest version

**Revalidation Required**:
An Applicability Status assigned when a dependency change may make an Approved Version unsuitable for a new composition or export. It preserves historical approval while blocking export against the current context until the user re-reviews the version. A Quality Waiver cannot clear applicability. The user may instead produce a separate Export Bundle against an explicitly pinned historical Context Revision, Canonical Design, and dependency set without changing the current status.
_Avoid_: Rejected, unapproved, deleted

**Dependency Link**:
A typed lineage relationship declaring which identity, silhouette, equipment, palette, theme, perspective, timing, or other facet a derivative depends on.
_Avoid_: Generic parent link, visual similarity

**Change Facet**:
A user-confirmed description of what changed in a Context Revision or Canonical Design. It is matched against Dependency Links to determine which direct and transitive derivatives require revalidation.
_Avoid_: Free-form change note, automatic visual guess

**Unit Version**:
An immutable version of an independently replaceable production unit, such as an animation frame, direction, tile, or UI state. A Unit Version is not a separate Asset Record unless it also has its own product meaning, lifecycle, or delivery identity.
_Avoid_: Working draft, composite version

**Composite Version**:
An immutable composition that pins the exact Unit Versions it contains. Changing one unit creates a new Composite Version rather than mutating an existing composition.
_Avoid_: Mutable sheet, latest units

**Composition Membership**:
The relationship stating whether and where an exact Unit Version is selected within an exact Composite Version. Replacement is expressed within this relationship and never becomes a global approval, applicability, QA, or availability status on the replaced Unit Version.
_Avoid_: Superseded asset status, rejection, global latest unit

## Dimensions

**Source Image Dimensions**:
The physical pixel width and height of an imported or generated source image.
_Avoid_: Logical resolution, cell dimensions

**Logical Resolution**:
The intended game-space pixel dimensions at the asset's logical 1× representation.
_Avoid_: Source image dimensions, display scale

**Cell Dimensions**:
The width and height of one addressable cell within a sheet or atlas source.
_Avoid_: Visible content bounds, atlas dimensions

**Visible Content Bounds**:
The smallest declared rectangle containing the visible game artwork within its logical canvas or cell.
_Avoid_: Collision bounds, cell dimensions

**Display Scale**:
A presentation-only scale applied to previews or outputs without changing the asset's Logical Resolution.
_Avoid_: Logical resolution, source resampling

**Atlas Dimensions**:
The physical dimensions of a composed atlas output containing one or more asset regions.
_Avoid_: Asset dimensions, cell dimensions

These dimension values remain distinct. The product may propose values derived from files or metadata, but it does not silently promote an inferred Logical Resolution, Cell Dimensions, or Visible Content Bounds to authoritative data. Pixel-art previews and outputs warn when a non-integer Display Scale would compromise crisp logical pixels.

## References and quality

**Reference Role**:
The declared purpose and transfer boundary of a reference, including what may be inherited and what must not be inherited.
_Avoid_: Reference tag, prompt hint

**Reference Transfer Constraint**:
An explicit allowed or forbidden feature transfer attached to a Reference Role. A prohibition overrides a general allowance, a Canonical Design identity lock requires an explicit Context Override to cross, and unresolved equal-specificity conflicts block Generation Package creation.
_Avoid_: Reference order, model interpretation

**Quality Profile**:
The asset-purpose-specific set of structural gates, human review tasks, usage tests, and permitted waivers required for export readiness.
_Avoid_: Quality score, asset status

**Integrity Gate**:
A non-waivable check for readable content, valid hashes and references, coherent compositions, and valid archive or export structure.
_Avoid_: Quality warning, artistic review

**Waivable Requirement**:
A deterministic Quality Profile requirement on an existing Unit or Composite Version for which the user may record an explicit Quality Waiver, such as a declared boundary, dimension, alpha, seam, or pivot tolerance. A missing item or usage test declared required by a Required Set is not waivable; the user supplies it or activates a new Required Set revision that marks it optional or inapplicable.
_Avoid_: Integrity gate, dismissed warning

**Quality Advisory**:
An explainable suspicion about visual or temporal quality that never blocks approval or export without a user decision or an explicit profile requirement.
_Avoid_: Deterministic failure, automatic rejection

**Quality Waiver**:
A user-approved exception tied to an exact quality rule, observed value, Unit or Composite Version, rationale, time, and relevant Context Revision and Canonical Design. A relevant content, dependency, or rule change requires a new evaluation.
_Avoid_: Dismissed warning, family-wide exception

**Required Set**:
The versioned declaration of required, optional, and inapplicable directions, animations, states, variants, and usage tests within one Asset Family. A family is complete only when every required item is current and Export Ready; requirements spanning multiple families belong to a Delivery Target.
_Avoid_: Universal asset checklist, manual complete flag

Changing a Required Set creates a new revision and recomputes current family completion without rewriting the completion evidence or Export Bundles produced against earlier revisions.

**Last-Mile Pixel Editor**:
A deliberately narrow editor for small logical-pixel corrections and cleanup, not a general-purpose drawing or compositing application.
_Avoid_: Drawing suite, full pixel editor

**Generation Package**:
An immutable, reviewable handoff containing the Production Context Snapshot, target task and dimensions, Canonical Design, Reference Roles, preserve/change/avoid constraints, locked units, and expected output structure for one external generation attempt.
_Avoid_: Prompt alone, full project dump

**Manual Import Evidence**:
The minimum provenance required before a manually imported result can be approved: Generation Package identity, generation source or surface, result file, and the user's actual generation instruction. The full conversation is optional.
_Avoid_: Full chat archive, source note alone

**Provider Generation Record**:
An immutable record of the generation details exposed by a connected provider or production surface for one external attempt. It stores normalized common fields and a schema-versioned, sanitized snapshot of provider-specific parameters while excluding credentials, authorization data, and temporary access URLs.
_Avoid_: Generation package, context rule, reproducibility guarantee

Provider-exposed fields must be retained for connected generation. Details unavailable through a manual surface or legacy import are recorded as Unknown and do not by themselves block approval; the separate minimum requirements of Manual Import Evidence still apply.

**Legacy Asset Attestation**:
A user-authored statement of the known source, relationship, missing history, and supporting evidence for a pre-existing asset whose original Generation Package or instruction cannot be recovered. It makes missing provenance explicit rather than reconstructing it.
_Avoid_: Manual import evidence, estimated prompt, complete provenance

**Production Experiment**:
A comparison group for alternative attempts toward one production goal, preserving each attempt's Generation Package and Candidate Version while recording changed inputs and the user's observed outcome.
_Avoid_: Asset version, automatic context rule, prompt history

**Production Recipe**:
A versioned, user-created template for an instruction scaffold, Reference Roles, expected output structure, locked fields, and configurable inputs. Applying it prepares a new Generation Package against current Project Context and never makes the recipe an authoritative Context Rule.
_Avoid_: Generation package, context rule, automatically applied prompt

A Production Recipe belongs to one project and may be copied into another as a detached snapshot. Project Context rules, asset references, and Rights Records are resolved again in the receiving project and never remain live-linked to the source recipe.

**Rights Record**:
A user-supplied provenance statement for a reference or result that records its source, asserted rights or license scope, known restrictions and uncertainty, and supporting evidence without making a legal-compliance judgment.
_Avoid_: Legal approval, ownership proof, reference role

A Rights Record is immutable. New evidence, scope, restriction, or state creates a new record revision; historical Export Bundles and Delivery Fulfilments retain the exact revision they pinned.

**Rights Evidence Policy**:
The Delivery Target-specific declaration of which references and results require Rights Records and which user-declared record states are acceptable for that target.
_Avoid_: Legal opinion, universal export rule, rights record

**Rights Lineage**:
The trace from a result through its Generation Package, Canonical Design, references, and dependent source results to their separate Rights Records. It exposes evidence relationships without transferring a source's asserted rights to its derivatives.
_Avoid_: Rights inheritance, dependency link, legal chain of title

Rights Records use user-declared Documented, Assertion Only, Unknown, or Restricted states. These states describe evidence posture and declared limits, not the legal validity of a right or license.

## Support and export

**General Asset Support**:
The ability to store, version, relate, review, and export an asset without a family-specific production workspace.
_Avoid_: Unsupported, full support

**Specialized Asset Profile**:
A long-lived asset-family workflow with purpose-specific metadata, QA, and usage tests in addition to General Asset Support. Its rules at a particular time are defined by an exact Specialized Profile Contract revision.
_Avoid_: Asset type, full support

The initial specialized profile set is character/creature and animation; object/weapon/equipment and state families; icons; VFX/projectile/shadow/decal; tileset/terrain and seamless texture; background/parallax; UI screens and components; and portrait/logo/marketing art. Fonts, cursors, and auxiliary maps initially receive General Asset Support.

A Specialized Asset Profile is complete only when it defines production metadata, Integrity Gates, Waivable Requirements, Quality Advisories, human review tasks, usage-context tests, waiver rules, export mappings, and a Reference Acceptance Scenario.

**Specialized Profile Contract**:
The immutable, versioned contract that defines one Specialized Asset Profile's metadata and gives every rule a stable identity, class, input, observable result, evidence requirement, waiver eligibility, asset scope, usage test, and export effect. Historical evaluations and Export Bundles retain the exact contract revision they used. A type without an active contract receives only General Asset Support.
_Avoid_: Informal profile description, global quality score

**Engine-Neutral Bundle**:
The canonical export package containing selected files and engine-independent usage metadata.
_Avoid_: Godot export, Unity export, project archive

**Export Bundle**:
An immutable delivery instance that pins its Context Revision, Composite and Unit Versions, QA evidence and waivers, schema version, and adapter version. “Latest export” is only a movable pointer to one Export Bundle.
_Avoid_: Mutable export folder, project archive

An Export Bundle may intentionally use historical Context Revisions or Canonical Designs when every dependency and applicable QA artifact is explicitly pinned and the compatibility report has no unresolved applicability or integrity failure for that historical composition. This does not clear Revalidation Required in the current composition.

**Export Profile**:
A versioned set of deterministic output choices such as layout, padding, trimming, scale, file format, and metadata mapping. An Export Bundle pins the exact Export Profile revision it used; changing the profile never rewrites a historical bundle.
_Avoid_: Mutable export settings, engine project state, adapter version

**Delivery Refresh Lock**:
A manifest that maps the paths and content digests written by an exact Export Bundle to one delivery destination. A refresh is user-started and one-way. If an owned target path no longer matches the lock, the affected refresh remains blocked until the user preserves the target file, selects a new destination, or explicitly replaces it. The target never becomes an authoritative Workbench source.
_Avoid_: Bidirectional synchronization, source-control lock, latest export pointer

**Package Verification Kit**:
The static, offline-usable verification material shipped with an Engine-Neutral Bundle: the matching JSON Schema, checksum list, human-readable README, and non-executable example mappings. Validation is performed by the Workbench or a separately versioned validator; the package carries no executable installer or authoritative agent instructions.
_Avoid_: Runtime validation record, embedded executable, consumption receipt

**Delivery Target**:
A versioned, potentially incomplete declaration of the Asset Families and cross-family acceptance conditions intended for a demo, chapter, update, or other delivery. Export Bundles may fulfil it but remain the immutable evidence of what was actually delivered.
_Avoid_: Export bundle, required set, latest project state

Each Delivery Target revision pins the Context Revision, Required Set revisions, and target policies used to judge it without pinning exact Asset Versions. Moving to a newer rule base creates a new Delivery Target revision and exposes the resulting scope and completion differences.

**Production Evidence Policy**:
The Delivery Target-specific rule declaring where full Generation Package history is required, where a Legacy Asset Attestation is acceptable, and where missing production history is only advisory.
_Avoid_: Rights evidence policy, manual import evidence, universal approval rule

**Readiness Plan**:
An explainable, dependency-aware view of a Delivery Target's blockers, downstream work, revalidation impact, and user priorities. It may recommend a next action but cannot perform a Human-Gated Action.
_Avoid_: Automatic production queue, required set, flat checklist

**Delivery Fulfilment**:
An immutable mapping from every satisfied requirement of one Delivery Target revision to the exact Export Bundles and Asset Versions that fulfilled it, with package overlaps explicitly resolved by the user.
_Avoid_: Delivery target, export bundle, latest exports

Target Readiness is computed from a Delivery Target's acceptance conditions; Delivery Status records whether the user has created a valid Delivery Fulfilment. A Ready target is not Delivered until that fulfilment exists.

**Historical Risk Notice**:
An immutable notice linking newly recorded rights risk to a historical Delivery Fulfilment without rewriting its Delivered state or pinned evidence.
_Avoid_: Revoked delivery, mutable rights record, current target blocker

**Delivery Diff**:
A comparison of two Delivery Fulfilments across Asset Versions, Context Revisions, QA evidence and waivers, Rights Record revisions, runtime evidence, and bundle mappings.
_Avoid_: Asset version diff, target rebase, automatic invalidation

**Verified Engine Adapter**:
An engine-specific export derived from the Engine-Neutral Bundle and validated against a declared engine compatibility contract.
_Avoid_: Best-effort export, engine-neutral bundle

A compatibility contract names supported engine versions and verifies frame rectangles, pivots, timing, events, texture settings, and applicable tile or UI behavior in maintained golden projects. Each export identifies the adapter version that produced it.

## Product boundary

**2D Visual Asset**:
A visual game-production asset and its directly associated presentation or gameplay metadata, including raster or supported vector artwork, animation sheets, tiles, textures, UI graphics, fonts, cursors, auxiliary visual maps, pivots, timing, events, and declared collision regions. Audio, game code, shader-authoring environments, 3D models and rigs, full level design, and general engine-project management are outside this domain.
_Avoid_: Any game file, whole game project, audio asset

Sprite Anvil applies its lifecycle to ChatGPT outputs, connected-provider results, human-authored artwork, external-tool snapshots, legacy project files, and licensed third-party assets. Each source follows its applicable evidence path; unavailable history remains explicitly unknown and is never reconstructed as fact.

Quality in Sprite Anvil means traceable technical gates, declared tolerances, explainable advisories, usage-context evidence, and user review. Export Ready is not a guarantee of artistic excellence, legal compliance, or fitness for every use.

**Core Production Lifecycle**:
The context, import, QA, approval, versioning, correction, and export workflow that must be completable in both the web and desktop applications.
_Avoid_: Identical platform implementation, review-only web experience

The desktop application may add operating-system affordances such as local folder watching and opening files in external editors when the web application provides a manual path to the same production outcome. Cloud state is authoritative; full offline operation is not implied.

**Offline Staged Work**:
Cached project viewing, imported files, and recoverable Working Drafts prepared without a network connection. Approval, Context Revision activation, and verified export do not become authoritative until synchronization succeeds.
_Avoid_: Offline approval, local source of truth

**Offline Conflict Record**:
An immutable comparison of the base cloud revision, current cloud revision, and local Working Draft created when offline work reconnects after the cloud state has changed. The cloud record remains authoritative; the user may create a separate Candidate Version, retain the local draft, or explicitly abandon it. Consequential records are never field-merged and conflict resolution is idempotent.
_Avoid_: Last-write-wins merge, silent draft discard

**Measurement Definition**:
A versioned contract for one product-outcome metric that fixes its population, start and end events, numerator and denominator, exclusions, time window, retention period, and the product decision the result can influence. Baselines from different definition revisions are not silently combined, and telemetry excludes user image content, raw generation instructions, free-form notes, local paths, and secrets.
_Avoid_: Unversioned dashboard query, quality gate

**Project Archive**:
A portable, restorable package of Project Context revisions, asset relationships and versions, source-metadata mapping proposals and user decisions, references and roles, approval and QA history, Export Profiles, Delivery Refresh Locks, export manifests, and optionally included working files. It excludes credentials and secrets and is distinct from a delivery-oriented Export Bundle.
_Avoid_: Export bundle, backup of final PNGs

Restoring a Project Archive creates an independent project by default and remaps its cloud identity while preserving relationships inside the archive. It never overwrites or automatically merges into an existing project.

**Erasure Tombstone**:
A content-free historical marker indicating that a managed item was deliberately erased. It may preserve identity and broken-lineage facts but never the erased binary or sensitive content.
_Avoid_: Archived file, recoverable version

**External Visual Analysis**:
Optional identity, theme, or style analysis performed by a third-party AI service. It is disabled by default and requires project- and analysis-category-specific permission with a payload, purpose, provider, and known-retention preview.
_Avoid_: Deterministic QA, local visual comparison

**Tool Access Permission**:
A revocable authorization for one Project and one Context Agent or External Tool Connection. It records the stated purpose and allowed access scopes; it does not grant authority to make user-gated decisions.
_Avoid_: Blanket project access, artistic approval, permanent authorization

**External Tool Connection**:
A named MCP or plug-in integration that can access a Project only through its Tool Access Permission. Until a specific provider is selected and supported, its access remains denied. It may prepare outputs but cannot activate a Context Revision, create a Review Event, issue a Quality Waiver, or erase project content.
_Avoid_: General project access, provider credential, autonomous approval

**Scene QA Playground**:
A lightweight, profile-driven visual usage harness for placement, scale, layering and Y-sort, simple movement and animation transitions, event synchronization, camera behavior, and overlays. It is not a scripting environment, level editor, physics engine, or source of gameplay truth.
_Avoid_: Game engine, static contact sheet

**Runtime Validation Record**:
Evidence and a user outcome from testing an exact Export Bundle and its pinned Asset Versions in a named game and engine version. It is one-way evidence and never makes the game project an authoritative Workbench source.
_Avoid_: Engine synchronization, scene QA result, export bundle

**Gameplay Metadata**:
User-authored or imported, reviewed hitbox, hurtbox, collision, event, and related information that may be previewed and exported. It is never inferred as authoritative from visual alpha and does not imply full physics simulation.
_Avoid_: Visual bounds, automatic collision truth

**Deletion Job**:
A trackable erasure operation authorized against an exact Erasure Impact Report. The report identifies managed copies, immutable archives or bundles that embed the content, affected historical fulfilments, excluded copies, and the published backup-retention deadline. An immutable container is erased as a whole or left unchanged; it is never silently rewritten to remove one item. A content-free deletion receipt records completion, and an Erasure Tombstone remains only when content-free lineage is preserved.
_Avoid_: Instant unverifiable deletion, archive action

## Candidate feature vocabulary

These terms capture accepted design boundaries from product opportunity interviews. Unless the PRD explicitly includes a feature in required scope, these definitions do not add product-completion requirements.

**Semantic Distinction Requirement**:
A user-declared expectation that specified game meanings remain visually distinguishable under a particular use condition, potentially across Asset Families. Common expectations may be reused while retaining their use scope.
_Avoid_: Style consistency, global contrast rule, accessibility certification

**Semantic Distinction Review**:
The user's recorded assessment of exact Asset Versions against a Semantic Distinction Requirement in its declared use conditions. It is distinct from the individual versions' Review Dispositions and from an automated Quality Advisory.
_Avoid_: Asset approval, similarity score, whole-game accessibility verdict

**Localized Visual Mapping**:
The user-declared association between a visual use, its locale-specific alternatives, and an explicitly accepted fallback for an absent locale mapping. An existing but unready primary alternative requires an explicit mapping change before substitution.
_Avoid_: Variant tag, automatic default-language substitution, translation table

**Equipment Compatibility Scope**:
The user-selected character, equipment, direction, and action combinations for which compatibility is to be assessed. Untested combinations and explicitly excluded combinations are distinct from combinations found incompatible.
_Avoid_: All possible combinations, equipment layer, family-wide approval

**Equipment Compatibility Evidence**:
Evidence of the reviewed use of exact component or complete-result versions in a combination within an Equipment Compatibility Scope. A result with baked-in equipment can support that complete use without establishing interchangeable component compatibility.
_Avoid_: Individual asset approval, inferred equipment layers, universal interchangeability

**Animation Family Normalization**:
A user-reviewed transformation that aligns declared canvas, logical scale, ground line, and anchors across selected animations in one Asset Family while preserving intentional root motion and size changes. It creates new Unit or Composite Versions and never overwrites source frames. It is selected for a later release and is not an initial product-completion requirement.
_Avoid_: Automatic crop, destructive resize, family-wide approval

## Acceptance

**Operational Acceptance Profile**:
A versioned acceptance contract that names the reference device, network conditions, project fixture, and p50/p95 performance and memory budgets used to validate supported scale.
_Avoid_: Unqualified performance target, benchmark note

**Supported Platform Matrix**:
The versioned set of web browsers, desktop operating systems, verified engine versions, and validated project-size limits for which the product claims support.
_Avoid_: Best-effort compatibility, development environment list

**Reference Acceptance Scenario**:
An end-to-end fixture that proves one Specialized Asset Profile can complete its production lifecycle on both web and desktop, including selective repair and export where applicable.
_Avoid_: Feature checklist, usability metric

Product completion requires Reference Acceptance Scenarios for every Specialized Asset Profile, the horizontal source-metadata and divergence-safe repeat-delivery scenarios, a Project Archive round-trip, static offline package verification, immutable export verification, and the Godot golden-project contract. Outcome-improvement targets are set only after real-use baselines exist.

# Triage labels

GitHub labels in `UnderprotectionDev/sprite-anvil` carry these issue roles. The names below are the intended mapping; check `gh label list` before applying one. Create a missing role label when the user has authorized publishing or configuring issues. Existing GitHub labels such as `bug`, `enhancement`, and `documentation` may be added independently for topic classification.

| Role | GitHub label | Use when |
| --- | --- | --- |
| Needs triage | `needs-triage` | A maintainer must evaluate an incoming report or request. |
| Needs information | `needs-info` | The reporter must supply information before a decision. |
| Ready for agent | `ready-for-agent` | Scope, acceptance criteria, and test seam are clear enough for agent implementation; check blockers separately. |
| Ready for human | `ready-for-human` | The work is specified but requires human implementation. |
| Will not fix | `wontfix` | The maintainer has decided not to pursue it. |

Local drafts under `docs/specs/<phase>/issues/` may say `ready-for-agent`. Check the published issue's current state before applying that label; a draft status is not a live GitHub label. New reports can start without a role label or with `needs-triage`.

**Done when:** each applied role reflects the issue's present state and no draft status is mistaken for a published label.

# Desktop screen reader acceptance checklist

Manual evidence for [OPS-04](../../prd/08-platform-and-operations.md) on the Tauri desktop app. It complements the automated keyboard, role and focus checks in `apps/web/e2e/accessible-focus.spec.ts`; no automation drives a real screen reader. The result is a user review, not a whole-game accessibility certification.

Run it with VoiceOver (macOS) and, where available, NVDA (Windows). Record reader, OS version, app build and pass/fail per row.

| # | Step | Expected announcement |
|---|---|---|
| 1 | Tab through the landing page. | Every stop has a name and role; a visible focus outline follows. |
| 2 | Trigger a read failure (stop the server, open a list). | `Error: …` is announced immediately; `Retry` is reachable and named. |
| 3 | Save a review. | A polite `Success: …` or saved-state message is announced without moving focus. |
| 4 | Cause an uncertain write result (server 5xx). | The message says the result could not be confirmed and shows `Support reference: <code>`; the reference is read as text. |
| 5 | Open Scene QA and read the overlay area. | Each overlay is listed by name and position, not by color. |
| 6 | Open a gameplay metadata review. | `Layer positions` lists each visible layer with coordinates. |
| 7 | Reload the page or reopen the record. | The same state text is read back from the persisted record. |
| 8 | Open the Pixel Editor, focus the Working Draft canvas, then use the arrow keys, `Enter` and `Escape`. | The canvas is announced as an application with its key help; each move reads `Pixel x, y`; a started stroke, the selection size and position, and `Cancelled.` are read without moving focus. |
| 9 | Open a Tileset test map and use the arrow keys, `Enter` and `Space` on its cells. | Each cell is named `Cell n: <tile id>` or `Cell n: Empty`; arrow keys move to the neighboring cell and stop at the map edge; `Enter` or `Space` inspects and paints the focused cell. |

Announcement policy: errors are assertive (`role="alert"`); warnings, success and notes are polite (`role="status"`). See `apps/web/src/components/status-message.tsx`.

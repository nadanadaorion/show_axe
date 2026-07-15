# Decision log

## Product foundation

| ID | Decision | Status |
|---|---|---|
| D-001 | The Show is the main entity. | Approved |
| D-002 | Simplicity has priority over feature count. | Approved |
| D-003 | Catalogs are optional helpers. | Approved |
| D-004 | Prefer Undo over routine confirmations. | Approved |
| D-005 | A Show is a snapshot; Library changes do not propagate. | Approved |
| D-006 | Each Show contains Equipment, People, and Information. | Approved |
| D-007 | Reusable data lives in Library and Presets. | Approved |
| D-008 | Create first, configure afterward. | Approved |

## Input List

| ID | Decision | Status |
|---|---|---|
| D-101 | Generate Input List from equipment uses, then allow editing. | Approved |
| D-102 | Equipment use is one free-form field per unit. | Approved |
| D-103 | Inputs and monitor returns share one surface. | Approved |
| D-104 | Input List may open before equipment is complete. | Approved |
| D-105 | Incomplete-equipment warning can be disabled and re-enabled. | Approved |
| D-106 | Update from Equipment is explicit and previewed. | Approved |
| D-107 | Manual Input List edits are preserved during update. | Approved |
| D-108 | Any equipment can generate inputs; inclusion defaults on and can be disabled. | Approved |
| D-109 | Initial columns: CH, use, equipment, phantom, patch, notes. | Approved |
| D-110 | PDF export supports portrait and landscape. | Approved |
| D-111 | Stereo return occupies two consecutive outputs. | Approved |
| D-112 | CH is individually editable and need not begin at 1. | Approved |
| D-113 | Explicit start-channel renumbering is available. | Approved |
| D-114 | Reordering or synchronization must not overwrite custom CH. | Approved |

## V2 shared workspace

| ID | Decision | Status |
|---|---|---|
| D-201 | No accounts or authentication. | Approved |
| D-202 | Anyone who accesses editor URL can edit. | Approved |
| D-203 | Supabase is the shared backend. | Approved |
| D-204 | Offline editing is allowed. | Approved |
| D-205 | V2 starts empty; no automatic V1 migration. | Approved |
| D-206 | A Show is locked while another device edits it. | Approved |
| D-207 | Lock releases on exit or ten minutes inactivity. | Approved |
| D-208 | There is no force unlock. | Approved |
| D-209 | Device identity is automatic, e.g. Firefox · Windows. | Approved |
| D-210 | Offline conflicts offer keep local or keep online only. | Approved |
| D-211 | Each Show has a permanent public read-only link. | Approved |
| D-212 | Public link shows latest synchronized Show. | Approved |
| D-213 | Archive preserves public link; delete disables it. | Approved |

## Open decisions requiring explicit approval

- Workspace conflict behavior for simultaneous Library/Preset/Preferences edits.
- Exact permanent-delete versus Undo semantics after remote synchronization.
- Monitor-return output collision handling.
- Whether Preferences remain shared or become device-local in a later version.

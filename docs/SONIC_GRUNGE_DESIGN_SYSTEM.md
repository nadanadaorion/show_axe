# Sonic Grunge design system

Sonic Grunge is the visual language for Ori♡n Shows. It changes presentation only: product
content, routes, accessible names, interaction contracts and business behavior remain unchanged.

## Principles

- **Raw signal, clear operation.** The interface may feel tactile and underground; controls must
  still be obvious, readable and quick.
- **Electric blue is a signal.** `#0029ff` marks active, primary and selected states. It is not a
  decorative full-page wash.
- **Editorial hierarchy, technical detail.** Anybody provides expressive headings; metadata and
  tabular data use a monospaced system stack.
- **Texture never competes.** Grain and halftone are CSS-only, low-opacity, non-interactive and
  removed in print.
- **Friction is visual, not functional.** No control is hidden, renamed or moved behind a new flow.

## Palette

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `--signal` / `--accent` | `#0029ff` | `#0029ff` | Primary actions, active navigation, progress, focus |
| `--ink` / `--text` | `#050505` | `#f7f7f2` | Main content and industrial borders |
| `--paper` / `--panel` | `#fffef8` | `#111111` | Cards, forms, modals |
| `--ground` / `--bg` | `#e7e7df` | `#080808` | Application canvas |
| `--panel-2` | `#d4d4cc` | `#1d1d1d` | Secondary bands and table headers |
| `--muted` | `#535353` | `#b7b7af` | Supporting copy; never status alone |
| `--danger` | `#b00020` | `#ff6b78` | Destructive actions and errors |
| `--success` | `#087a3e` | `#56df91` | Settled/readiness state |
| `--warning` | `#9a5200` | `#ffb347` | Warnings, lock uncertainty |

## Typography

- Display: **Anybody Variable**, self-hosted from `@fontsource-variable/anybody` 5.2.7,
  OFL-1.1. Only the Latin variable WOFF2 is bundled.
- UI/body: Anybody with system sans fallbacks.
- Technical: `ui-monospace`, `SFMono-Regular`, Consolas, Liberation Mono, monospace.
- Scale: 12 px metadata, 14 px body/control, 18–24 px section titles, and responsive 36–72 px
  page titles where space permits.
- Display headings use high weight and slightly compressed width. Body text never uses extreme
  width settings.

## Spacing and scale

The base unit is 4 px. Common gaps are 8, 12, 16, 24, 32 and 48 px. Dense technical rows use
8–12 px vertical spacing; page sections use 24–32 px. Primary mobile controls retain approximately
44×44 CSS px targets.

## Borders, radius and shadows

- Default rule: 1 px zinc/ink.
- Emphasis: 2 px ink or signal blue.
- Radius: 0–4 px for panels and controls; pills remain fully rounded only for concise status tags.
- Raised surfaces: hard offset shadow `4px 4px 0`, never diffuse glassmorphism.
- Dashed rules may separate metadata from content, like tape or a technical dossier.

## Texture

The page grain combines two tiny repeating radial gradients. Halftone uses a similarly lightweight
CSS pattern on selected editorial areas. Texture opacity stays below 8%, has `pointer-events: none`
and never sits between a control and pointer input. Do not use bitmap noise or full-screen video.

## States

- Active/primary: signal-blue fill, white text and black offset shadow.
- Hover: short 1 px translation or inverted fill; no continuous movement.
- Focus: 3 px signal-blue outline plus 2 px offset. Focus is never removed.
- Disabled: reduced contrast plus diagonal hatch; readable label remains.
- Success: green label/icon plus text.
- Offline: signal-blue technical banner with explicit “sin conexión” copy.
- Warning/blocked: amber/black band with icon and explanation.
- Conflict/error: danger band with explicit actions; never color alone.
- Loading: existing status text remains. Rotation is disabled under reduced motion.

## Buttons

- Primary: blue field, white uppercase label, 2 px border and hard shadow.
- Secondary: paper/ink field with industrial border.
- Ghost: transparent; gains a zinc field on hover/focus.
- Danger: danger text/border without changing the destructive action contract.
- Icon buttons keep their accessible label and touch target.

## Forms

Fields use paper/ink surfaces, 2 px borders and visible labels. Placeholders remain supporting
examples, never labels. Technical inputs (`date`, `time`, `number`, Input List cells) use monospace.
Checkbox/radio accent is signal blue. Invalid states use border, icon/copy and `role="alert"` where
already present.

## Tables

Tables resemble patch sheets: uppercase mono headers, dashed row rules, tabular numerals and clear
selected/focus cells. On narrow screens the table owns horizontal scrolling; the document must not
overflow. CH, patch, output and time values remain literal and are never reformatted visually in a
way that changes meaning.

## Cards and panels

Panels are square technical modules. Shows cards receive a signal-blue top rule and stronger
hover/focus outline while keeping the existing full-card accessible button. Equipment categories
read as rack sections; readiness stays visible in text and progress.

## Modals

Modals use an opaque paper/ink surface, thick top rule, hard shadow and separate fixed header/body/
footer regions. Existing portal, focus trap, Escape behavior, backdrop behavior and focus return are
unchanged. Mobile retains a bottom-sheet position with a reachable, non-overlapping action footer.

## Responsive

- Desktop: 248 px navigation rail, broad editorial canvas and horizontal technical compositions.
- Tablet: actions wrap without reordering their meaning.
- Mobile 375×667: compact masthead, drawer navigation, 44 px actions, internal tab/table scrolling,
  and no global horizontal overflow.
- `prefers-reduced-motion` removes decorative transitions and all non-essential animation.

## Usage examples

- Use signal blue for “Nuevo show”, selected tabs, current navigation and focus.
- Use mono labels for `CH 08`, `AUX 3–4`, `18:30`, sync state and backup timestamps.
- Use a hard shadow on a modal or primary card, not on every row.
- Use a halftone corner as atmosphere while keeping text on a solid surface.

## Anti-use

- Do not fill every panel blue.
- Do not add fake meters, waveforms or controls with no product function.
- Do not place texture over small text or form values.
- Do not hide actions until hover.
- Do not turn technical tables into cards that omit columns on mobile.
- Do not use rounded SaaS pills for containers, gradients as decoration, glass blur or soft floating
  shadows.
- Do not change accessible names, focus order, routes or data semantics for visual effect.

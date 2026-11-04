---
trigger: always_on
---

# Design Rules

OpenSpaces follows the Spaces design system (Spaces plans 45–47). Tokens in `apps/web/src/index.css` use the Spaces names and values; do not invent new colors.

## 1. Borderless Surfaces

- Canvas is `bg-background`. Panels are `bg-card rounded-2xl shadow-card`. Nested containers are `bg-surface rounded-xl`.
- No decorative borders. A border survives only if it carries meaning: keyboard focus, severity or state (for example the pending approval card), or a drag target.
- Inputs are `bg-surface` with `focus:ring-2 focus:ring-ring/40`, never a bordered box.

## 2. Tokens, Not Hex

Use semantic classes (`bg-primary`, `text-muted-foreground`, `text-destructive`, `bg-warning/10`). Dark mode is the `.dark` class on `<html>`, toggled by `useTheme`. Every new surface must be checked in both themes.

## 3. Color Means Something

Blue is the primary action and active state. Green, amber and red are states only. Neutral surfaces carry everything else. No gradients.

## 4. Typography

- Outfit Variable for UI, the system monospace stack for paths, ids, commands and tool output.
- Nothing below `text-xs` (12px). Body and messages `text-sm`. Weights up to `font-semibold`.
- Hierarchy comes from weight, color and spacing, not from many sizes.

## 5. Radii and Elevation

`rounded-md` and `rounded-lg` for controls, `rounded-xl` for nested containers, `rounded-2xl` for panels, `rounded-bubble` with a tail for chat messages. `shadow-card` is the only elevation for cards; dialogs use `shadow-2xl`.

## 6. Components

Reuse `Button`, `IconButton`, `Badge`, `Avatar` and the field class from `components/ui/` before writing new markup. Icons come from `lucide-react`.

## 7. Never Hide Critical Controls Behind Hover

Approve, deny, interrupt and end are always visible. Touch targets are at least 32px.

## 8. Keyboard and Dialogs

Every interactive element is focusable with a visible ring. Escape closes dialogs. No `window.confirm` or `window.alert`; destructive actions use a dialog that states the consequence.

## 9. Clear Empty and Loading States

An empty list says what is missing and what to do next. Loading states keep the layout stable.

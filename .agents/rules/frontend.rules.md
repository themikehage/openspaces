---
trigger: always_on
---

# Frontend Rules

Immovable principles for `apps/web`. Every change must respect them.

## 1. Hooks Own State

Each screen delegates state, effects and callbacks to a hook in `src/hooks/`. Components render. Hooks return a plain object of values and actions.

## 2. Server Access Only Through `@openspaces/api-client`

Never `fetch` or `EventSource` directly in components or hooks. The architecture test enforces it.

## 3. Domain-Based Components

Components live in `components/<domain>/` (`session`, `sessions`). Only generic primitives (Button, IconButton, Badge, Avatar, field styles) go in `components/ui/`.

## 4. No External State Library

Local hooks and React Context only. No Redux, Zustand or similar.

## 5. Functional Components Only

No classes. Prop types are inline interfaces in the same file.

## 6. Typed Storage

`localStorage` is accessed only through `src/lib/storage.ts` with `STORAGE_KEYS`. Storage may be unavailable, so every read has a fallback.

## 7. Absolute Imports

Use the `@/` alias inside `src/`. No deep relative imports.

## 8. No Comments, Files ≤ 300 Lines

Same as the backend rules.

## 9. Accessibility Is Tested

Interactive controls have accessible names and the e2e test drives the UI through roles and labels, not CSS selectors.

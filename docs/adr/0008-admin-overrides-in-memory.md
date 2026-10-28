# 0008. Admin changes live in Postgres, read from memory

Status: accepted, 2026-10-28

## Context
The admin panel (docs/requirements/admin.md) can move pack dates and hide challenges. Before it, pack dates came from `challenges/packs.json`, loaded once into memory, and `db:seed` copied them into Postgres on every deploy. About ten places read pack state or hidden challenges synchronously on hot routes.

## Decision
- Postgres owns pack dates. `packs.json` gives a new pack its first dates, and the seed only writes dates on insert.
- Hidden challenges are a `hidden_at` column. Nothing is deleted.
- `packs.ts` keeps the in-memory copy that callers already use. `admin/overrides.ts` refreshes it from Postgres at start, right after each admin write, and every minute.
- Every admin write adds a row to `admin_actions` with a required reason.

## Consequences
- No caller had to become async, and reads stay as cheap as before.
- One API process (today's setup) sees a change at once. A separate worker sees it within a minute.
- Changing a date in `packs.json` no longer moves an existing pack. That is now done in the panel.

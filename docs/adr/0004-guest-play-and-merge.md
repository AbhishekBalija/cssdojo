# 0004. Guests play first, progress merges on sign-in

Status: accepted, 2026-10-25

## Context
Asking people to sign in before the first Submit loses them. Leaderboards need real accounts.

## Decision
A guest is a player without a user, identified by a random id kept in the browser and sent as `x-guest-id`. Read routes never create guests. After sign-in the client calls `POST /api/me/merge` once; one transaction moves submissions, opens, best scores (better score wins, then faster solve) and belts. Leaderboards list signed-in players only.

## Consequences
- No progress is lost at sign-in.
- Clearing browser storage loses a guest's progress, which the profile page says.

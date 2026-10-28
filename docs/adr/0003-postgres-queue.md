# 0003. Postgres as the score queue

Status: accepted, 2026-10-25

## Context
Scoring takes about 2 s and must survive restarts. Free hosting has no Redis.

## Decision
A `score_jobs` table. Workers claim with `SELECT ... FOR UPDATE SKIP LOCKED`, retry up to 3 times, and reclaim jobs locked for over 60 s. Clients long-poll the result for up to 15 s. The queue sits behind a `ScoreQueue` interface.

## Consequences
- No extra infrastructure; jobs are transactional with submissions.
- Throughput is bounded by one worker on the free plan; adding workers needs no code change.

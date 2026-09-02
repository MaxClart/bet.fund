-- Migration #4 — run after migrate.sql and migrate2.sql:
--
--   wrangler d1 execute bet --file=./migrate3.sql --remote
--
-- Adds: trading_platforms column (JSON array of platform names the user
-- has tagged on their profile — Photon, BullX, Axiom, etc.)

ALTER TABLE users ADD COLUMN trading_platforms TEXT DEFAULT '[]';

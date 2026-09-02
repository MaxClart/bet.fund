-- Migration #3 — run this after migrate.sql (migration #2):
--
--   wrangler d1 execute bet --file=./migrate2.sql --remote
--
-- Adds: wallet_address column for the Solana wallet snapshot feature on
-- profiles (shows live SOL balance + USD value, pulled from Solana's
-- public RPC — not axiom.trade, which has no public API).

ALTER TABLE users ADD COLUMN wallet_address TEXT;

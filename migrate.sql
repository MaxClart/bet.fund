-- Migration #2 — run this on your EXISTING database (the one that already
-- has sessions/messages from migration #1):
--
--   wrangler d1 execute bet --file=./migrate.sql --remote
--
-- Adds: following system, public/private stories.
-- Also fixes: usernames were case-sensitive, so "y" and "Y" could exist as
-- two different accounts. Going forward the worker stores/looks up
-- usernames lowercased, so this can't happen again for NEW accounts.
--
-- IMPORTANT — you likely have duplicate-looking accounts already
-- (e.g. two people effectively named "y"/"Y"). This migration cannot
-- guess which one to keep. Before or after running this, check for
-- collisions with:
--
--   SELECT id, username, display_name, created_at FROM users
--   WHERE username COLLATE NOCASE IN (
--     SELECT username FROM users GROUP BY username COLLATE NOCASE HAVING COUNT(*) > 1
--   );
--
-- ...then manually rename or delete the duplicate account you don't want,
-- e.g.:  UPDATE users SET username = 'y2' WHERE id = 'the-duplicate-id';

ALTER TABLE stories ADD COLUMN visibility TEXT DEFAULT 'public';
CREATE INDEX IF NOT EXISTS idx_stories_created ON stories(created_at);

CREATE TABLE IF NOT EXISTS follows (
    id TEXT PRIMARY KEY,
    follower_id TEXT NOT NULL,
    following_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (follower_id) REFERENCES users(id),
    FOREIGN KEY (following_id) REFERENCES users(id)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_follows_unique ON follows(follower_id, following_id);

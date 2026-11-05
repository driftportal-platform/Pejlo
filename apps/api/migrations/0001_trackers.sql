CREATE TABLE IF NOT EXISTS trackers (
 identifier TEXT PRIMARY KEY,
 name TEXT NOT NULL,
 code_hash TEXT NOT NULL,
 owner_uid TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 claimed_at TEXT
);
CREATE INDEX IF NOT EXISTS trackers_owner ON trackers(owner_uid);

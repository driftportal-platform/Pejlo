CREATE TABLE IF NOT EXISTS pejlo_alarm_history (
 id TEXT PRIMARY KEY,
 identifier TEXT NOT NULL,
 uid TEXT NOT NULL,
 kind TEXT NOT NULL,
 payload TEXT NOT NULL,
 created_at INTEGER NOT NULL,
 fix_time INTEGER,
 area TEXT,
 push_status TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS pejlo_alarm_history_user ON pejlo_alarm_history(uid,identifier,created_at,id);

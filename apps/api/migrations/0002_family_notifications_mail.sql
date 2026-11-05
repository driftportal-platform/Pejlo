-- Same tables the Worker previously created on demand (ensureFamily / ensureNotifications / mail limits).
-- Tables from before roles existed get the role column from the Worker (guarded ALTER); do not ALTER here.
-- Safe to run more than once. Apply with: npx wrangler d1 migrations apply pejlo-trackers --remote
CREATE TABLE IF NOT EXISTS pejlo_profiles(identifier TEXT PRIMARY KEY,owner_uid TEXT NOT NULL,profile TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS pejlo_members(identifier TEXT NOT NULL,uid TEXT NOT NULL,email TEXT NOT NULL,role TEXT NOT NULL DEFAULT 'editor',PRIMARY KEY(identifier,uid));
CREATE TABLE IF NOT EXISTS pejlo_invites(hash TEXT PRIMARY KEY,identifier TEXT NOT NULL,owner_uid TEXT NOT NULL,email TEXT NOT NULL,expires INTEGER NOT NULL,role TEXT NOT NULL DEFAULT 'editor');
CREATE INDEX IF NOT EXISTS pejlo_members_uid ON pejlo_members(uid);
CREATE TABLE IF NOT EXISTS pejlo_fences (identifier TEXT PRIMARY KEY, owner_uid TEXT NOT NULL, name TEXT NOT NULL, config TEXT NOT NULL, enabled INTEGER NOT NULL, state TEXT NOT NULL DEFAULT '{}', checked_at INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS pejlo_alerts(identifier TEXT NOT NULL,uid TEXT NOT NULL,config TEXT NOT NULL,state TEXT NOT NULL DEFAULT '{}',checked_at INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(identifier,uid));
CREATE TABLE IF NOT EXISTS pejlo_events(id TEXT PRIMARY KEY,identifier TEXT NOT NULL,uid TEXT NOT NULL,kind TEXT NOT NULL,payload TEXT NOT NULL,created_at INTEGER NOT NULL,attempts INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS pejlo_push (endpoint TEXT PRIMARY KEY, owner_uid TEXT NOT NULL, subscription TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS pejlo_push_queue (id TEXT PRIMARY KEY, owner_uid TEXT NOT NULL, payload TEXT NOT NULL, created_at INTEGER NOT NULL, attempts INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS pejlo_mail_limits(uid TEXT PRIMARY KEY,last_sent INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS pejlo_mail_log(uid TEXT NOT NULL,recipient TEXT NOT NULL,sent_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS pejlo_mail_log_uid ON pejlo_mail_log(uid,sent_at);
CREATE INDEX IF NOT EXISTS pejlo_mail_log_recipient ON pejlo_mail_log(recipient,sent_at);

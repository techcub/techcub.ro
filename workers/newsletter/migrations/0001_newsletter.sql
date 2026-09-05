CREATE TABLE subscribers (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  locale TEXT NOT NULL CHECK (locale IN ('ro', 'en')),
  generation TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'active')),
  requested_at INTEGER NOT NULL,
  confirmed_at INTEGER,
  consent_version TEXT NOT NULL,
  consent_text TEXT NOT NULL
);
CREATE INDEX subscribers_status_locale ON subscribers(status, locale, confirmed_at);

CREATE TABLE publications (
  id TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  discovered_at INTEGER NOT NULL,
  baseline INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE deliveries (
  id TEXT PRIMARY KEY,
  publication_id TEXT NOT NULL REFERENCES publications(id),
  subscriber_id TEXT NOT NULL REFERENCES subscribers(id) ON DELETE CASCADE,
  generation TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'uncertain', 'cancelled')),
  first_attempt INTEGER,
  sent_at INTEGER,
  payload TEXT,
  UNIQUE(publication_id, subscriber_id)
);
CREATE INDEX deliveries_status ON deliveries(status);

CREATE TABLE state (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE rate_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at INTEGER NOT NULL);

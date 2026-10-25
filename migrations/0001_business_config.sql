-- PRD 8.2: one row per embeddable business.
CREATE TABLE business_config (
  id              TEXT PRIMARY KEY CHECK (id GLOB 'bf_*' AND length(id) BETWEEN 11 AND 13),
  business_name   TEXT NOT NULL CHECK (length(business_name) BETWEEN 1 AND 80),
  address         TEXT NOT NULL,
  osm_ref         TEXT,
  lat             REAL NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lng             REAL NOT NULL CHECK (lng BETWEEN -180 AND 180),
  street_label    TEXT,
  lgu_label       TEXT,
  state_label     TEXT,
  display_fields  TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(display_fields)),
  options         TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(options)),
  owner_email     TEXT NOT NULL,
  edit_token_hash TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','disabled')),
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_business_config_status ON business_config(status);
CREATE INDEX idx_business_config_email  ON business_config(owner_email);

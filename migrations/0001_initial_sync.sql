CREATE TABLE IF NOT EXISTS sync_records (
  entity_type TEXT NOT NULL CHECK (entity_type IN ('source', 'note', 'noteAddition', 'settings')),
  entity_id TEXT NOT NULL,
  payload TEXT NOT NULL CHECK (json_valid(payload)),
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
  server_updated_at TEXT NOT NULL,
  PRIMARY KEY (entity_type, entity_id)
);

CREATE TABLE IF NOT EXISTS sync_events (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  revision INTEGER NOT NULL,
  changed_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sync_events_entity ON sync_events(entity_type, entity_id);

CREATE TRIGGER IF NOT EXISTS sync_records_after_insert AFTER INSERT ON sync_records BEGIN
  INSERT INTO sync_events (entity_type, entity_id, revision, changed_at)
  VALUES (NEW.entity_type, NEW.entity_id, NEW.revision, NEW.server_updated_at);
END;

CREATE TRIGGER IF NOT EXISTS sync_records_after_update AFTER UPDATE ON sync_records BEGIN
  INSERT INTO sync_events (entity_type, entity_id, revision, changed_at)
  VALUES (NEW.entity_type, NEW.entity_id, NEW.revision, NEW.server_updated_at);
END;

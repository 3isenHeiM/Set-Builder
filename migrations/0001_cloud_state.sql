CREATE TABLE IF NOT EXISTS app_states (
  owner_id TEXT PRIMARY KEY,
  revision INTEGER NOT NULL,
  operation_id TEXT NOT NULL,
  state_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

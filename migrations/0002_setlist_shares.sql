CREATE TABLE IF NOT EXISTS setlist_shares (
  set_list_id TEXT PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);

-- EA KIDS Studio — initial schema. JSON columns hold validated JSON text.

CREATE TABLE users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('owner','editor','reviewer','viewer')),
  disabled      INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL
);

CREATE TABLE sessions (
  id          TEXT PRIMARY KEY,           -- sha256 of the cookie token
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  csrf        TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  expires_at  TEXT NOT NULL,
  ip          TEXT,
  user_agent  TEXT
);

CREATE TABLE settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE ideas (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category    TEXT NOT NULL DEFAULT 'general',
  language    TEXT NOT NULL DEFAULT 'ar',
  age_min     INTEGER NOT NULL DEFAULT 3,
  age_max     INTEGER NOT NULL DEFAULT 6,
  status      TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','planned','in_production','done','archived')),
  tags        TEXT NOT NULL DEFAULT '[]',
  project_id  TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE TABLE projects (
  id                  TEXT PRIMARY KEY,
  title               TEXT NOT NULL,
  category            TEXT NOT NULL,
  language            TEXT NOT NULL DEFAULT 'ar',
  age_min             INTEGER NOT NULL DEFAULT 3,
  age_max             INTEGER NOT NULL DEFAULT 6,
  target_duration_sec INTEGER NOT NULL DEFAULT 90,
  topic               TEXT NOT NULL DEFAULT '',
  visual_style        TEXT NOT NULL DEFAULT 'flat-friendly',
  narration_style     TEXT NOT NULL DEFAULT 'warm-teacher',
  difficulty          TEXT NOT NULL DEFAULT 'easy',
  format              TEXT NOT NULL DEFAULT 'landscape' CHECK (format IN ('landscape','shorts')),
  status              TEXT NOT NULL DEFAULT 'draft',
  package             TEXT NOT NULL DEFAULT '{}',   -- the working copy of script + storyboard + metadata
  current_version     INTEGER NOT NULL DEFAULT 0,
  scheduled_at        TEXT,
  created_by          TEXT,
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL
);

CREATE TABLE project_versions (
  id         TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  version_no INTEGER NOT NULL,
  label      TEXT NOT NULL DEFAULT '',
  snapshot   TEXT NOT NULL,
  created_by TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (project_id, version_no)
);

CREATE TABLE characters (
  id               TEXT PRIMARY KEY,
  slug             TEXT NOT NULL UNIQUE,
  name_ar          TEXT NOT NULL,
  name_en          TEXT NOT NULL DEFAULT '',
  species          TEXT NOT NULL DEFAULT '',
  description      TEXT NOT NULL DEFAULT '',
  colors           TEXT NOT NULL DEFAULT '{}',
  features         TEXT NOT NULL DEFAULT '',
  personality      TEXT NOT NULL DEFAULT '',
  edu_role         TEXT NOT NULL DEFAULT '',
  voice            TEXT NOT NULL DEFAULT '{}',
  approved_prompts TEXT NOT NULL DEFAULT '[]',
  version          INTEGER NOT NULL DEFAULT 1,
  archived         INTEGER NOT NULL DEFAULT 0,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
);

CREATE TABLE character_versions (
  id           TEXT PRIMARY KEY,
  character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  version_no   INTEGER NOT NULL,
  snapshot     TEXT NOT NULL,
  created_at   TEXT NOT NULL,
  UNIQUE (character_id, version_no)
);

CREATE TABLE assets (
  id            TEXT PRIMARY KEY,
  project_id    TEXT REFERENCES projects(id) ON DELETE CASCADE,   -- NULL = shared library asset
  scene_id      TEXT,
  character_id  TEXT REFERENCES characters(id) ON DELETE SET NULL,
  kind          TEXT NOT NULL CHECK (kind IN ('image','video','audio','music','sfx','subtitle','thumbnail','render','preview','other')),
  -- How the media was produced. The renderer and the UI never blur these categories.
  media_type    TEXT NOT NULL DEFAULT 'other',
  path          TEXT NOT NULL,            -- relative to DATA_DIR/media
  filename      TEXT NOT NULL,
  mime          TEXT NOT NULL,
  bytes         INTEGER NOT NULL DEFAULT 0,
  duration_ms   INTEGER,
  width         INTEGER,
  height        INTEGER,
  sha256        TEXT,
  provider      TEXT NOT NULL DEFAULT 'local',
  license       TEXT NOT NULL DEFAULT '{}',   -- {source, license, commercialUse, attribution, proofUrl}
  review_status TEXT NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending','approved','rejected')),
  review_note   TEXT NOT NULL DEFAULT '',
  meta          TEXT NOT NULL DEFAULT '{}',
  created_at    TEXT NOT NULL
);
CREATE INDEX idx_assets_project_scene ON assets(project_id, scene_id);

CREATE TABLE jobs (
  id               TEXT PRIMARY KEY,
  type             TEXT NOT NULL,
  project_id       TEXT,
  scene_id         TEXT,
  status           TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','succeeded','failed','cancelled')),
  attempts         INTEGER NOT NULL DEFAULT 0,
  max_attempts     INTEGER NOT NULL DEFAULT 3,
  run_after        TEXT NOT NULL,
  progress         REAL NOT NULL DEFAULT 0,
  message          TEXT NOT NULL DEFAULT '',
  payload          TEXT NOT NULL DEFAULT '{}',
  result           TEXT,
  error            TEXT,
  cost_estimate_usd REAL NOT NULL DEFAULT 0,
  cost_confirmed   INTEGER NOT NULL DEFAULT 0,
  cancel_requested INTEGER NOT NULL DEFAULT 0,
  created_by       TEXT,
  created_at       TEXT NOT NULL,
  started_at       TEXT,
  finished_at      TEXT
);
CREATE INDEX idx_jobs_status ON jobs(status, run_after);
CREATE INDEX idx_jobs_project ON jobs(project_id);

CREATE TABLE job_logs (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id     TEXT,
  project_id TEXT,
  level      TEXT NOT NULL,
  message    TEXT NOT NULL,
  data       TEXT,
  ts         TEXT NOT NULL
);
CREATE INDEX idx_job_logs_job ON job_logs(job_id);
CREATE INDEX idx_job_logs_project ON job_logs(project_id, id);

CREATE TABLE usage_costs (
  id             TEXT PRIMARY KEY,
  project_id     TEXT,
  job_id         TEXT,
  provider       TEXT NOT NULL,
  operation      TEXT NOT NULL,
  units          REAL NOT NULL DEFAULT 0,
  unit           TEXT NOT NULL DEFAULT '',
  est_cost_usd   REAL NOT NULL DEFAULT 0,
  price_verified INTEGER NOT NULL DEFAULT 0,
  kind           TEXT NOT NULL DEFAULT 'estimate' CHECK (kind IN ('estimate','actual','manual')),
  note           TEXT NOT NULL DEFAULT '',
  ts             TEXT NOT NULL
);
CREATE INDEX idx_usage_ts ON usage_costs(ts);

CREATE TABLE pronunciations (
  id          TEXT PRIMARY KEY,
  language    TEXT NOT NULL DEFAULT 'ar',
  word        TEXT NOT NULL,
  replacement TEXT NOT NULL,
  note        TEXT NOT NULL DEFAULT '',
  UNIQUE (language, word)
);

CREATE TABLE compliance_reviews (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  version_no  INTEGER NOT NULL DEFAULT 0,
  checks      TEXT NOT NULL DEFAULT '{}',   -- results of automated + manual checks
  audience    TEXT NOT NULL DEFAULT '{}',   -- {madeForKids, rationale, reviewedBy}
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','changes_requested')),
  notes       TEXT NOT NULL DEFAULT '',
  reviewer_id TEXT,
  created_at  TEXT NOT NULL,
  approved_at TEXT
);
CREATE INDEX idx_compliance_project ON compliance_reviews(project_id);

CREATE TABLE youtube_accounts (
  id                TEXT PRIMARY KEY,
  channel_id        TEXT,
  channel_title     TEXT,
  scopes            TEXT NOT NULL DEFAULT '',
  refresh_token_enc TEXT,
  access_token_enc  TEXT,
  expires_at        TEXT,
  created_at        TEXT NOT NULL
);

CREATE TABLE youtube_uploads (
  id             TEXT PRIMARY KEY,
  project_id     TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  status         TEXT NOT NULL CHECK (status IN ('dryrun','approved','uploading','uploaded','failed','cancelled')),
  video_id       TEXT,
  payload        TEXT NOT NULL,
  response       TEXT,
  error          TEXT,
  approved_by    TEXT,
  approved_at    TEXT,
  uploaded_bytes INTEGER NOT NULL DEFAULT 0,
  total_bytes    INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL
);

CREATE TABLE playlists (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  youtube_id  TEXT,
  created_at  TEXT NOT NULL
);

CREATE TABLE analytics_rows (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  source      TEXT NOT NULL CHECK (source IN ('youtube_api','manual_import')),
  video_id    TEXT NOT NULL DEFAULT '',
  project_id  TEXT,
  date        TEXT NOT NULL,
  metric      TEXT NOT NULL,
  value       REAL NOT NULL,
  imported_at TEXT NOT NULL,
  UNIQUE (source, video_id, date, metric)
);

CREATE TABLE calendar_events (
  id         TEXT PRIMARY KEY,
  title      TEXT NOT NULL,
  date       TEXT NOT NULL,
  kind       TEXT NOT NULL DEFAULT 'note',
  project_id TEXT,
  notes      TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE audit_log (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id   TEXT,
  action    TEXT NOT NULL,
  entity    TEXT,
  entity_id TEXT,
  detail    TEXT,
  ts        TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS dr_live_jobs (
  id uuid PRIMARY KEY,
  author_wallet text NOT NULL,
  kol_handle text NOT NULL,
  effort text NOT NULL CHECK (effort IN ('low','medium','high','xhigh')),
  credits integer NOT NULL CHECK (credits BETWEEN 1 AND 200),
  status text NOT NULL DEFAULT 'quoted' CHECK (status IN ('quoted','payment_pending','queued','running','ready','failed','refunded')),
  policy jsonb NOT NULL,
  quote jsonb NOT NULL,
  context_encrypted text NOT NULL,
  snapshot_at text NOT NULL,
  sampled_posts integer NOT NULL,
  payment_transaction text NOT NULL,
  signed_payment text,
  payment_signature text UNIQUE,
  surf_started_at timestamptz,
  heartbeat_at timestamptz,
  event_count integer NOT NULL DEFAULT 0,
  generated_characters integer NOT NULL DEFAULT 0,
  result_encrypted text,
  content_hash text,
  asset text UNIQUE,
  metadata_uri text,
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS dr_live_author ON dr_live_jobs(author_wallet, created_at DESC);
CREATE TABLE IF NOT EXISTS dr_live_events (
  job_id uuid NOT NULL REFERENCES dr_live_jobs(id),
  sequence integer NOT NULL,
  encrypted text NOT NULL,
  PRIMARY KEY(job_id, sequence)
);
CREATE TABLE IF NOT EXISTS dr_live_operations (
  id uuid PRIMARY KEY,
  job_id uuid NOT NULL REFERENCES dr_live_jobs(id),
  wallet text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('mint','transfer_policy','transfer','refund')),
  payload jsonb NOT NULL,
  transaction text NOT NULL,
  signed_transaction text,
  signature text UNIQUE,
  status text NOT NULL DEFAULT 'quoted' CHECK (status IN ('quoted','submitted','confirmed','failed')),
  last_valid_block_height bigint NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS dr_live_one_pending_operation ON dr_live_operations(job_id)
  WHERE status IN ('quoted','submitted');

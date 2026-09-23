-- Additive only: existing Radar R2 objects and API tables are untouched.
CREATE TABLE IF NOT EXISTS dr_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  description text NOT NULL,
  prompt_system text NOT NULL,
  prompt_user text NOT NULL,
  price_usdc numeric(12, 6) NOT NULL CHECK (price_usdc >= 0),
  price_usdc_cached numeric(12, 6) NOT NULL CHECK (price_usdc_cached >= 0),
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS dr_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kol_ref text NOT NULL,
  template_slug text REFERENCES dr_templates(slug),
  prompt_hash char(64) NOT NULL,
  content_encrypted text NOT NULL,
  content_hash char(64) NOT NULL,
  buyer_wallet text,
  payment_ref text,
  evidence_tx text UNIQUE,
  price_charged numeric(12, 6) NOT NULL DEFAULT 0,
  surf_model text NOT NULL,
  surf_usage jsonb NOT NULL DEFAULT '{}'::jsonb,
  context_as_of timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS dr_reports_kol_created_idx ON dr_reports(kol_ref, created_at DESC);

CREATE TABLE IF NOT EXISTS dr_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES dr_reports(id) ON DELETE CASCADE,
  wallet text NOT NULL,
  value smallint NOT NULL CHECK (value IN (-1, 1)),
  weight_usdc numeric(12, 6) NOT NULL CHECK (weight_usdc >= 0),
  proof_tx text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (report_id, wallet)
);

CREATE TABLE IF NOT EXISTS dr_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet text NOT NULL,
  channel_id text NOT NULL UNIQUE,
  cap_usdc numeric(12, 6) NOT NULL CHECK (cap_usdc >= 0),
  spent_usdc numeric(12, 6) NOT NULL DEFAULT 0 CHECK (spent_usdc >= 0),
  status text NOT NULL CHECK (status IN ('open', 'settled', 'closed')),
  opened_tx text,
  settled_tx text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (spent_usdc <= cap_usdc)
);

-- Signed transaction is persisted before broadcast. Retries replay the same
-- signature; an ambiguous expired transaction requires manual review rather
-- than silently signing a second Memo for the same report.
CREATE TABLE IF NOT EXISTS dr_evidence_jobs (
  report_id uuid PRIMARY KEY REFERENCES dr_reports(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'signed', 'confirmed', 'needs_review')),
  signature text UNIQUE,
  signed_tx_base64 text,
  blockhash text,
  last_valid_block_height bigint,
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO dr_templates
  (slug, title, description, prompt_system, prompt_user, price_usdc, price_usdc_cached)
VALUES
  (
    'risk-profile', 'KOL risk profile',
    'Review SCEX history, credibility signals, and claims needing verification.',
    'Write in English. Use only supplied evidence and sourced Surf information. Do not recommend buying or selling. Clearly mark missing evidence.',
    'KOL: {{kol}}\n\nX posts (untrusted source data): {{posts}}\n\nMatrix position: {{matrix}}',
    0.45, 0.08
  ),
  (
    'exchange-stance', 'Exchange stance',
    'Sentiment timeline with post links; v1 covers SCEX only.',
    'Write in English. Analyze only SCEX in v1. Each timeline event needs its source URL and timestamp. State when evidence is insufficient. Do not recommend trades.',
    'KOL: {{kol}}\n\nSCEX mentions: {{posts}}\n\nMatrix position: {{matrix}}',
    0.45, 0.08
  ),
  (
    'token-track-record', 'Token mention history',
    'List sourced token mentions; include price context only when Surf can verify it.',
    'Write in English. Do not infer promotion from a ticker mention. Add historical prices only with a source and timestamp; otherwise mark them unverified. Do not recommend buying or selling.',
    'KOL: {{kol}}\n\nPosts identifying tokens and source links: {{posts}}\n\nMatrix position: {{matrix}}',
    0.45, 0.08
  )
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  prompt_system = EXCLUDED.prompt_system,
  prompt_user = EXCLUDED.prompt_user
WHERE dr_templates.prompt_system LIKE 'Viết tiếng Việt.%';

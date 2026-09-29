ALTER TABLE dr_live_jobs ADD COLUMN IF NOT EXISTS payment_kind text NOT NULL DEFAULT 'sol-devnet';
CREATE TABLE IF NOT EXISTS dr_agent_orders (
  id uuid PRIMARY KEY,
  requester text NOT NULL,
  secret_hash text NOT NULL,
  handle text NOT NULL,
  context_encrypted text NOT NULL,
  status text NOT NULL DEFAULT 'prepared' CHECK (status IN ('prepared','accepted','settled')),
  accepted_at timestamptz,
  payer text,
  payment_ref text UNIQUE,
  receipt_encrypted text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now()+interval '24 hours'
);
CREATE INDEX IF NOT EXISTS dr_agent_requester ON dr_agent_orders(requester,created_at DESC);

-- Additive Devnet purchase ledger. Never reuse sandbox USDC receipts for SOL payments.
CREATE TABLE IF NOT EXISTS dr_nft_purchases (
  id uuid PRIMARY KEY,
  buyer_wallet text NOT NULL,
  content_hash char(64) NOT NULL,
  report jsonb NOT NULL,
  quote jsonb NOT NULL,
  transaction_base64 text NOT NULL,
  signed_transaction_base64 text,
  signature text UNIQUE,
  status text NOT NULL DEFAULT 'quoted' CHECK (status IN ('quoted', 'submitted', 'confirmed', 'failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (buyer_wallet, content_hash)
);

-- Add Stripe billing columns to organizations

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS subscription_status TEXT NOT NULL DEFAULT 'free'
    CHECK (subscription_status IN (
      'free', 'trialing', 'active', 'past_due', 'cancelled', 'incomplete'
    )),
  ADD COLUMN IF NOT EXISTS subscription_current_period_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS billing_email TEXT;

CREATE INDEX IF NOT EXISTS idx_orgs_stripe_customer ON organizations(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_orgs_stripe_subscription ON organizations(stripe_subscription_id);

-- Gmail Tokens Table
CREATE TABLE IF NOT EXISTS gmail_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    expires_at TIMESTAMPTZ,
    scope TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Email Logs Table
CREATE TABLE IF NOT EXISTS email_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    to_email TEXT NOT NULL,
    from_email TEXT,
    subject TEXT NOT NULL,
    body TEXT,
    provider TEXT NOT NULL, -- 'gmail' or 'resend'
    status TEXT DEFAULT 'sent', -- 'sent', 'failed', 'bounced'
    external_id TEXT, -- Gmail message ID or Resend ID
    deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
    application_id UUID REFERENCES applications(id) ON DELETE SET NULL,
    lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_gmail_tokens_user_id ON gmail_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_user_id ON email_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_organization_id ON email_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_created_at ON email_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_logs_deal_id ON email_logs(deal_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_application_id ON email_logs(application_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_lead_id ON email_logs(lead_id);

-- RLS Policies for gmail_tokens
ALTER TABLE gmail_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own gmail tokens"
    ON gmail_tokens FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own gmail tokens"
    ON gmail_tokens FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own gmail tokens"
    ON gmail_tokens FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own gmail tokens"
    ON gmail_tokens FOR DELETE
    USING (auth.uid() = user_id);

-- RLS Policies for email_logs
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view org email logs"
    ON email_logs FOR SELECT
    USING (
        organization_id IN (
            SELECT organization_id FROM user_profiles WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert email logs"
    ON email_logs FOR INSERT
    WITH CHECK (
        organization_id IN (
            SELECT organization_id FROM user_profiles WHERE user_id = auth.uid()
        )
    );

-- Triggers
CREATE OR REPLACE FUNCTION update_gmail_tokens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER gmail_tokens_updated_at
    BEFORE UPDATE ON gmail_tokens
    FOR EACH ROW
    EXECUTE FUNCTION update_gmail_tokens_updated_at();

-- Grant permissions
GRANT ALL ON gmail_tokens TO authenticated;
GRANT ALL ON email_logs TO authenticated;

-- Migration: add allowed_emails table for email domain/pattern whitelist
-- This table stores email patterns (domains like "@company.com" or full emails like "user@company.com")

CREATE TABLE IF NOT EXISTS public.allowed_emails (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pattern TEXT NOT NULL,
  pattern_type TEXT NOT NULL DEFAULT 'domain' CHECK (pattern_type IN ('domain', 'full_email')),
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.allowed_emails ENABLE ROW LEVEL SECURITY;

-- Admins can do everything with allowed_emails
CREATE POLICY "Admin full access on allowed_emails"
  ON public.allowed_emails
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid())
      AND role = 'admin'
    )
  );

-- Function to check if an email matches any allowed pattern
-- SECURITY DEFINER so it bypasses RLS when called from authenticated contexts
CREATE OR REPLACE FUNCTION public.is_email_allowed(email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  allowed BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.allowed_emails
    WHERE is_active = true
    AND (
      (pattern_type = 'domain' AND email ILIKE '%' || pattern)
      OR
      (pattern_type = 'full_email' AND email ILIKE pattern)
    )
  ) INTO allowed;

  RETURN COALESCE(allowed, false);
END;
$$;

-- Restrict direct RPC access: only the postgres owner can execute
-- The SvelteKit server calls this via authenticated supabase client
-- with SECURITY DEFINER running as postgres
REVOKE ALL PRIVILEGES ON FUNCTION public.is_email_allowed(text) FROM PUBLIC;
REVOKE ALL PRIVILEGES ON FUNCTION public.is_email_allowed(text) FROM anon;
REVOKE ALL PRIVILEGES ON FUNCTION public.is_email_allowed(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.is_email_allowed(text) TO postgres;
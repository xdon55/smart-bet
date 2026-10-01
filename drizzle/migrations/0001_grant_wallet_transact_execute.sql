-- Grant authenticated users permission to execute the atomic wallet movement RPC.
-- The function is SECURITY DEFINER and bypasses RLS, but the calling role still
-- needs EXECUTE privilege. Service role already owns it implicitly.
GRANT EXECUTE ON FUNCTION public.wallet_transact(
  uuid, text, text, numeric, text, text, text, jsonb
) TO authenticated;

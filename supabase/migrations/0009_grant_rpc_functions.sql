-- Grant execute on all RPC functions called via supabase.rpc()
-- Required for PostgREST to expose them in the schema cache

GRANT EXECUTE ON FUNCTION public.calculate_product_metrics(UUID)      TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.recalculate_abc(UUID)                TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.recalculate_customer_metrics(UUID)   TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.recalculate_supplier_metrics(UUID)   TO authenticated, service_role;

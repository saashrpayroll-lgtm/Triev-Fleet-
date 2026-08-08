-- RPC to resolve all pending wallet mismatches
-- Avoids client-side batch limitaions and RLS issues for bulk updates.

CREATE OR REPLACE FUNCTION public.resolve_all_wallet_mismatches()
RETURNS JSONB AS $$
DECLARE
    v_rows_updated INT;
BEGIN
    UPDATE public.wallet_mismatches
    SET status = 'resolved'
    WHERE status = 'pending';

    GET DIAGNOSTICS v_rows_updated = ROW_COUNT;

    RETURN jsonb_build_object(
        'success', true,
        'resolved_count', v_rows_updated
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- TL ALLOTMENT & SUBMISSION SYSTEM (PATCH V3)
-- Enhances the RPC to return inactive_rider_count and strictly enforce active-only parity for negative wallet balances.

BEGIN;

-- Drop the old function first if the signature is changing
DROP FUNCTION IF EXISTS public.get_tl_allotment_metrics(DATE, DATE);

CREATE OR REPLACE FUNCTION public.get_tl_allotment_metrics(
    p_start_date DATE DEFAULT '1970-01-01',
    p_end_date DATE DEFAULT '9999-12-31'
)
RETURNS TABLE (
    team_leader_id UUID,
    tl_name TEXT,
    tl_email TEXT,
    active_rider_count BIGINT,
    inactive_rider_count BIGINT,
    positive_wallet_count BIGINT,
    positive_wallet_total NUMERIC,
    negative_wallet_count BIGINT,
    negative_wallet_total NUMERIC,
    allotment_count BIGINT,
    submission_count BIGINT,
    rent_collection_total NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    WITH tl_list AS (
        -- Get all Team Leaders from the users table
        SELECT u.id, u.full_name, u.email
        FROM public.users u
        WHERE u.role = 'teamLeader'
    ),
    rider_stats AS (
        -- Aggregated stats per TL (Current Snapshots)
        SELECT 
            r.team_leader_id,
            COUNT(*) FILTER (WHERE r.status = 'active') as active_riders,
            COUNT(*) FILTER (WHERE r.status = 'inactive') as inactive_riders,
            -- Positive wallets include all riders
            COUNT(*) FILTER (WHERE r.wallet_amount > 0) as pos_count,
            SUM(CASE WHEN r.wallet_amount > 0 THEN r.wallet_amount ELSE 0 END) as pos_total,
            -- Negative wallets MUST EXCLUDE inactive riders directly inside the SQL aggregation (Parity matches V15 Dashboard sync)
            COUNT(*) FILTER (WHERE r.wallet_amount < 0 AND r.status = 'active') as neg_count,
            SUM(CASE WHEN r.wallet_amount < 0 AND r.status = 'active' THEN r.wallet_amount ELSE 0 END) as neg_total
        FROM public.riders r
        GROUP BY r.team_leader_id
    ),
    allotment_stats AS (
        -- Count allotments based on allotment_date
        SELECT 
            r.team_leader_id,
            COUNT(*) as allotments
        FROM public.riders r
        WHERE (r.allotment_date AT TIME ZONE 'Asia/Kolkata')::DATE >= p_start_date 
          AND (r.allotment_date AT TIME ZONE 'Asia/Kolkata')::DATE <= p_end_date
        GROUP BY r.team_leader_id
    ),
    submission_stats AS (
        -- Count submissions based on inactivated_at
        SELECT 
            r.team_leader_id,
            COUNT(*) as submissions
        FROM public.riders r
        WHERE (r.inactivated_at AT TIME ZONE 'Asia/Kolkata')::DATE >= p_start_date 
          AND (r.inactivated_at AT TIME ZONE 'Asia/Kolkata')::DATE <= p_end_date
        GROUP BY r.team_leader_id
    ),
    collection_stats AS (
        -- Rent collections in the same period
        SELECT 
            r.team_leader_id,
            SUM(wl.amount) as collections
        FROM public.wallet_ledger wl
        JOIN public.riders r ON wl.rider_id = r.id
        WHERE wl.transaction_type IN ('DAILY_COLLECTION', 'RENT_COLLECTION', 'FTD_COLLECTION', 'COLLECTION')
          AND wl.mode = 'ADD'
          -- Convert ISO string to TIMESTAMPTZ explicitly before extracting IST date
          AND COALESCE(((wl.metadata->>'date_on_sheet')::TIMESTAMPTZ AT TIME ZONE 'Asia/Kolkata')::DATE, (wl.transaction_date AT TIME ZONE 'Asia/Kolkata')::DATE, (wl.created_at AT TIME ZONE 'Asia/Kolkata')::DATE) >= p_start_date
          AND COALESCE(((wl.metadata->>'date_on_sheet')::TIMESTAMPTZ AT TIME ZONE 'Asia/Kolkata')::DATE, (wl.transaction_date AT TIME ZONE 'Asia/Kolkata')::DATE, (wl.created_at AT TIME ZONE 'Asia/Kolkata')::DATE) <= p_end_date
        GROUP BY r.team_leader_id
    )
    SELECT 
        u.id,
        u.full_name,
        u.email,
        COALESCE(rs.active_riders, 0),
        COALESCE(rs.inactive_riders, 0),
        COALESCE(rs.pos_count, 0),
        COALESCE(rs.pos_total, 0),
        COALESCE(rs.neg_count, 0),
        COALESCE(rs.neg_total, 0),
        COALESCE(als.allotments, 0),
        COALESCE(ss.submissions, 0),
        COALESCE(cs.collections, 0)
    FROM tl_list u
    LEFT JOIN rider_stats rs ON u.id = rs.team_leader_id
    LEFT JOIN allotment_stats als ON u.id = als.team_leader_id
    LEFT JOIN submission_stats ss ON u.id = ss.team_leader_id
    LEFT JOIN collection_stats cs ON u.id = cs.team_leader_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;

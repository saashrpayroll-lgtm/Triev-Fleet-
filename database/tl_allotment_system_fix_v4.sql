-- tl_allotment_system_fix_v4.sql
-- Fixes the 0 Rent Recovery issue by using extremely robust timezone coercion
-- that prevents empty string exceptions and accurately grabs the local IST day.

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
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH rider_stats AS (
        -- Base Rider stats (Force Active Parity for negative balances)
        SELECT 
            u.id as team_leader_id,
            COUNT(r.id) FILTER (WHERE r.status = 'active') as active_riders,
            COUNT(r.id) FILTER (WHERE r.status = 'inactive') as inactive_riders,
            COUNT(r.id) FILTER (WHERE COALESCE(r.wallet_amount, 0) > 0) as pos_count,
            SUM(COALESCE(r.wallet_amount, 0)) FILTER (WHERE COALESCE(r.wallet_amount, 0) > 0) as pos_total,
            -- Parity Rule: ONLY include ACTIVE riders when calculating Negative Balance
            COUNT(r.id) FILTER (WHERE r.status = 'active' AND COALESCE(r.wallet_amount, 0) < 0) as neg_count,
            SUM(COALESCE(r.wallet_amount, 0)) FILTER (WHERE r.status = 'active' AND COALESCE(r.wallet_amount, 0) < 0) as neg_total
        FROM public.users u
        LEFT JOIN public.riders r ON u.id = r.team_leader_id AND r.deleted_at IS NULL
        WHERE u.role = 'teamLeader' AND u.status = 'active'
        GROUP BY u.id
    ),
    allotment_stats AS (
        -- Allotments in the given period based on native creation or allotment date
        SELECT 
            r.team_leader_id,
            COUNT(*) as allotments
        FROM public.riders r
        WHERE COALESCE((r.allotment_date AT TIME ZONE 'Asia/Kolkata')::DATE, (r.created_at AT TIME ZONE 'Asia/Kolkata')::DATE) >= p_start_date
          AND COALESCE((r.allotment_date AT TIME ZONE 'Asia/Kolkata')::DATE, (r.created_at AT TIME ZONE 'Asia/Kolkata')::DATE) <= p_end_date
        GROUP BY r.team_leader_id
    ),
    submission_stats AS (
        -- Submissions (inactivations) in the same period
        SELECT 
            r.team_leader_id,
            COUNT(*) as submissions
        FROM public.riders r
        WHERE r.status = 'inactive'
          AND COALESCE((r.inactivated_at AT TIME ZONE 'Asia/Kolkata')::DATE, (r.updated_at AT TIME ZONE 'Asia/Kolkata')::DATE) >= p_start_date
          AND COALESCE((r.inactivated_at AT TIME ZONE 'Asia/Kolkata')::DATE, (r.updated_at AT TIME ZONE 'Asia/Kolkata')::DATE) <= p_end_date
        GROUP BY r.team_leader_id
    ),
    collection_stats AS (
        -- Rent collections in the same period using robust timezone extraction
        SELECT 
            r.team_leader_id,
            SUM(COALESCE(wl.amount, 0)) as collections
        FROM public.wallet_ledger wl
        JOIN public.riders r ON wl.rider_id = r.id
        WHERE wl.transaction_type IN ('DAILY_COLLECTION', 'RENT_COLLECTION', 'FTD_COLLECTION', 'COLLECTION')
          AND wl.mode = 'ADD'
          AND COALESCE(
              CASE 
                  WHEN btrim(COALESCE(wl.metadata->>'date_on_sheet', '')) <> '' 
                  THEN (wl.metadata->>'date_on_sheet')::TIMESTAMPTZ AT TIME ZONE 'Asia/Kolkata' 
                  ELSE NULL 
              END,
              wl.transaction_date AT TIME ZONE 'Asia/Kolkata',
              wl.created_at AT TIME ZONE 'Asia/Kolkata'
          )::DATE >= p_start_date
          AND COALESCE(
              CASE 
                  WHEN btrim(COALESCE(wl.metadata->>'date_on_sheet', '')) <> '' 
                  THEN (wl.metadata->>'date_on_sheet')::TIMESTAMPTZ AT TIME ZONE 'Asia/Kolkata' 
                  ELSE NULL 
              END,
              wl.transaction_date AT TIME ZONE 'Asia/Kolkata',
              wl.created_at AT TIME ZONE 'Asia/Kolkata'
          )::DATE <= p_end_date
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
    FROM public.users u
    LEFT JOIN rider_stats rs ON u.id = rs.team_leader_id
    LEFT JOIN allotment_stats als ON u.id = als.team_leader_id
    LEFT JOIN submission_stats ss ON u.id = ss.team_leader_id
    LEFT JOIN collection_stats cs ON u.id = cs.team_leader_id
    WHERE u.role = 'teamLeader' AND u.status = 'active'
    ORDER BY COALESCE(rs.active_riders, 0) DESC;
END;
$$;

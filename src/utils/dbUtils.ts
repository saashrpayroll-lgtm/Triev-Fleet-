import { supabase } from '@/config/supabase';

/**
 * Fetches all matching rows from the 'riders' table, automatically paginating
 * beyond Supabase's default 1000-row limit per request.
 * 
 * @param selectQuery - The columns you want to select, e.g., 'id, rider_name, status'
 * @param filter - Optional. Supply { column, value, type: 'eq' | 'in' } to filter matches.
 * @returns { data: any[] | null, error: any } - Mimics the Supabase standard response
 */
export async function fetchAllRidersPaginated(
    selectQuery: string = '*',
    filter?: { column: string; value: any; type?: 'eq' | 'in' }
): Promise<{ data: any[] | null; error: any }> {
    const allData: any[] = [];
    let from = 0;
    const limit = 1000;

    try {
        while (true) {
            let query = supabase
                .from('riders')
                .select(selectQuery)
                .range(from, from + limit - 1);

            if (filter) {
                if (filter.type === 'in' && Array.isArray(filter.value)) {
                    query = query.in(filter.column, filter.value);
                } else {
                    query = query.eq(filter.column, filter.value);
                }
            }

            const { data, error } = await query;

            if (error) throw error;
            if (!data || data.length === 0) break;

            allData.push(...data);

            if (data.length < limit) break;
            from += limit;
        }

        return { data: allData, error: null };
    } catch (err: any) {
        console.error("fetchAllRidersPaginated error:", err);
        return { data: null, error: err };
    }
}

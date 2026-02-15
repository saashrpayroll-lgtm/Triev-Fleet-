import { supabase } from '@/config/supabase';

export type TransactionType = 'SYSTEM_IMPORT' | 'MANUAL_ADJUSTMENT' | 'DAILY_COLLECTION' | 'BULK_IMPORT' | 'RENT_COLLECTION';
export type TransactionMode = 'SET' | 'ADD' | 'SUBTRACT';

export interface WalletTransactionInput {
    riderId: string;
    amount: number;
    type: TransactionType;
    mode: TransactionMode;
    description?: string;
    metadata?: any;
    externalId?: string;
    source?: 'SYSTEM' | 'IMPORT' | 'MANUAL';
    transactionDate?: string;
}

export const LedgerAPI = {
    /**
     * Adds a transaction to the wallet ledger.
     * This triggers an automatic balance recalculation on the server.
     */
    addTransaction: async (input: WalletTransactionInput) => {
        const { data, error } = await supabase.rpc('add_wallet_transaction', {
            p_rider_id: input.riderId,
            p_amount: input.amount,
            p_type: input.type,
            p_mode: input.mode,
            p_description: input.description,
            p_metadata: input.metadata,
            p_external_id: input.externalId || null,
            p_source: input.source || 'MANUAL',
            p_date: input.transactionDate || new Date().toISOString()
        });

        if (error) throw error;
        return data;
    },

    /**
     * Fetches the ledger history for a specific rider.
     */
    getHistory: async (riderId: string) => {
        const { data, error } = await supabase
            .from('wallet_ledger')
            .select('*')
            .eq('rider_id', riderId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data;
    },

    /**
     * Calculates the net balance from the ledger (Client-side validation).
     * Note: Server-side trigger is the source of truth.
     */
    calculateBalance: async (riderId: string) => {
        // Fetch latest SET
        const { data: setRecord } = await supabase
            .from('wallet_ledger')
            .select('amount, created_at')
            .eq('rider_id', riderId)
            .eq('mode', 'SET')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        const baseBalance = setRecord?.amount || 0;
        const baseDate = setRecord?.created_at || '1970-01-01';

        // Fetch subsequent transactions
        const { data: transactions } = await supabase
            .from('wallet_ledger')
            .select('amount, mode')
            .eq('rider_id', riderId)
            .gt('created_at', baseDate);

        const adds = transactions
            ?.filter(t => t.mode === 'ADD')
            .reduce((sum, t) => sum + t.amount, 0) || 0;

        const subtracts = transactions
            ?.filter(t => t.mode === 'SUBTRACT')
            .reduce((sum, t) => sum + t.amount, 0) || 0;

        return baseBalance + adds - subtracts;
    },

    /**
     * Processes a wallet snapshot for reconciliation.
     * Starts the difference engine on the server.
     */
    processSnapshot: async (input: { riderId: string, balance: number, date: string, source: string }) => {
        const { data, error } = await supabase.rpc('process_wallet_snapshot', {
            p_rider_id: input.riderId,
            p_snapshot_balance: input.balance,
            p_snapshot_date: input.date,
            p_source_type: input.source
        });

        if (error) throw error;
        return data;
    },

    /**
     * Forces reconciliation of a rider's balance with their latest snapshot.
     */
    reconcileRider: async (riderId: string) => {
        const { data, error } = await supabase.rpc('reconcile_rider_balance', {
            p_rider_id: riderId
        });

        if (error) throw error;
        return data;
    }
};

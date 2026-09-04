import { supabase } from '@/config/supabase';

export type TransactionType = 'SYSTEM_IMPORT' | 'MANUAL_ADJUSTMENT' | 'DAILY_COLLECTION' | 'BULK_IMPORT' | 'RENT_COLLECTION' | 'FTD_COLLECTION' | 'COLLECTION';
export type TransactionMode = 'SET' | 'ADD' | 'SUBTRACT' | 'RESET';

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
            p_date: input.transactionDate || undefined // Undefined lets PostgREST drop it, hitting the DB DEFAULT NOW()
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
            .select('id, rider_id, amount, mode, transaction_type, transaction_date, created_at, description') // ✅ EGRESS
            .eq('rider_id', riderId)
            .order('created_at', { ascending: false });


        if (error) throw error;
        return data;
    },

    /**
     * Calculates the net balance from the ledger (Strict Reset + Add Model).
     * Now calls the database function for accuracy.
     */
    calculateBalance: async (riderId: string) => {
        const { data, error } = await supabase.rpc('calculate_rider_balance', {
            p_rider_id: riderId
        });

        if (error) throw error;
        return data;
    },

    /**
     * Processes a daily wallet update (Reset + Reconcile).
     * Used by Bulk Wallet Update import.
     */
    processDailyUpdate: async (input: { riderId: string, newBalance: number, date: string, externalId?: string }) => {
        const { data, error } = await supabase.rpc('handle_daily_wallet_update', {
            p_rider_id: input.riderId,
            p_new_balance: input.newBalance,
            p_date: input.date,
            p_external_id: input.externalId || null
        });

        if (error) throw error;
        return data;
    },

    /**
     * Fetches mismatches for the Admin Dashboard.
     */
    getMismatches: async () => {
        const { data, error } = await supabase
            .from('wallet_mismatches')
            .select('id, rider_id, system_balance, source_balance, difference, status, created_at, riders(rider_name, mobile_number)')
            .eq('status', 'pending')
            .order('difference', { ascending: false });

        if (error) throw error;
        return data;
    }
};

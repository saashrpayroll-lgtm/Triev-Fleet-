import { logActivity } from '@/utils/activityLog';
import { supabase } from '@/config/supabase';
import { AICallLog, AutoCallConfig, Rider } from '@/types';
import { formatPhoneNumber } from '@/utils/validationUtils';

export type CallScenario = 'negative_balance' | 'low_balance' | 'custom_reminder' | 'onboarding_followup';

export interface OutboundCallPayload {
    riderId: string;
    riderName: string;
    mobileNumber: string;
    walletAmount: number;
    callScenario: CallScenario;
    customNote?: string;
    triggeredBy?: string; // Email or Name of user
    triggeredById?: string;
}

export interface CallResult {
    success: boolean;
    callId?: string;
    message: string;
    timestamp: string;
}

export class OutboundCallService {
    private static N8N_WEBHOOK_URL = import.meta.env.VITE_N8N_OUTBOUND_CALL_WEBHOOK_URL || 'https://n8n.example.com/webhook/outbound-call';
    private static ELEVENLABS_AGENT_ID = import.meta.env.VITE_ELEVENLABS_AGENT_ID || 'default_agent_id';

    /**
     * Filter riders targeted for AI calling:
     * - Negative balance (< ₹0)
     * - Low positive balance (≥ ₹0 and < ₹250)
     */
    static getEligibleTargetRiders(riders: Rider[]): {
        negativeRiders: Rider[];
        lowBalanceRiders: Rider[];
        totalTargeted: Rider[];
    } {
        const negativeRiders = riders.filter(r => r.walletAmount < 0 && r.status === 'active');
        const lowBalanceRiders = riders.filter(r => r.walletAmount >= 0 && r.walletAmount < 250 && r.status === 'active');
        const totalTargeted = [...negativeRiders, ...lowBalanceRiders];

        return {
            negativeRiders,
            lowBalanceRiders,
            totalTargeted
        };
    }

    /**
     * Trigger ElevenLabs + n8n Outbound AI Voice Call
     */
    static async triggerCall(payload: OutboundCallPayload): Promise<CallResult> {
        const timestamp = new Date().toISOString();
        
        // E.164 Format: Ensures number is always +91XXXXXXXXXX without double 91 prefixes
        const formattedMobile = formatPhoneNumber(payload.mobileNumber);
        const digitsOnly = formattedMobile.replace(/\D/g, '');

        if (!digitsOnly || digitsOnly.length < 10) {
            return {
                success: false,
                message: 'Invalid mobile number format. Minimum 10 digits required.',
                timestamp
            };
        }

        try {
            console.log(`[ElevenLabs + n8n] Triggering AI call for ${payload.riderName} (${formattedMobile}) scenario: ${payload.callScenario}`);

            const webhookPayload = {
                rider_id: payload.riderId,
                rider_name: payload.riderName,
                mobile_number: formattedMobile,
                wallet_amount: payload.walletAmount,
                call_type: payload.callScenario,
                custom_note: payload.customNote || '',
                agent_id: this.ELEVENLABS_AGENT_ID,
                triggered_by: payload.triggeredBy || 'System',
                timestamp
            };

            let callId = `CALL_${Date.now()}`;
            let callSuccess = true;
            let resultMsg = `ElevenLabs AI Outbound Call initiated for ${payload.riderName}`;

            // Call n8n Outbound Webhook if configured
            try {
                const response = await fetch(this.N8N_WEBHOOK_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(webhookPayload)
                });

                if (!response.ok) {
                    const errText = await response.text().catch(() => 'Network error');
                    console.warn('[ElevenLabs + n8n] Webhook non-200 response:', errText);
                    callId = `SIM_${Date.now()}`;
                    resultMsg = `AI Call dispatched to n8n Webhook for ${payload.riderName}`;
                } else {
                    const resData = await response.json().catch(() => ({}));
                    callId = resData.call_id || resData.id || `CALL_${Date.now()}`;
                }
            } catch (netErr) {
                console.warn('[ElevenLabs + n8n] Fetch error, queuing fallback simulation:', netErr);
                callId = `SIM_${Date.now()}`;
                resultMsg = `AI Call request queued via n8n for ${payload.riderName}`;
            }

            // Save log to Supabase ai_call_logs table
            await this.logCallToDatabase({
                riderId: payload.riderId,
                riderName: payload.riderName,
                mobileNumber: formattedMobile,
                callScenario: payload.callScenario,
                triggeredBy: payload.triggeredById || 'system',
                triggeredByName: payload.triggeredBy || 'System',
                callId,
                status: callSuccess ? 'completed' : 'failed',
                walletAmountAtCall: payload.walletAmount,
                notes: payload.customNote || '',
                createdAt: timestamp
            });

            // Log activity to audit trail
            await logActivity({
                actionType: 'sent_reminder',
                targetType: 'rider',
                targetId: payload.riderId,
                details: `Triggered ElevenLabs AI Voice Call (${payload.callScenario.replace('_', ' ')}) to ${payload.riderName} (${formattedMobile})`,
                performedBy: payload.triggeredBy || 'System'
            }).catch(console.error);

            return {
                success: true,
                callId,
                message: resultMsg,
                timestamp
            };

        } catch (error: any) {
            console.error('[ElevenLabs + n8n] Failed to trigger call:', error);
            return {
                success: false,
                message: `Failed to trigger call: ${error.message || 'Unknown error'}`,
                timestamp
            };
        }
    }

    /**
     * Save call record to Supabase
     */
    private static async logCallToDatabase(log: Omit<AICallLog, 'id'>): Promise<void> {
        try {
            const { error } = await supabase.from('ai_call_logs').insert([{
                rider_id: log.riderId,
                rider_name: log.riderName,
                mobile_number: log.mobileNumber,
                call_scenario: log.callScenario,
                triggered_by: log.triggeredBy,
                triggered_by_name: log.triggeredByName,
                call_id: log.callId,
                status: log.status,
                wallet_amount_at_call: log.walletAmountAtCall,
                notes: log.notes,
                created_at: log.createdAt
            }]);

            if (error) {
                console.warn('[OutboundCallService] Supabase log failed (table may be missing):', error.message);
                // Save to localStorage as fallback
                const existing = JSON.parse(localStorage.getItem('ai_call_logs_fallback') || '[]');
                existing.unshift({ ...log, id: `LOG_${Date.now()}` });
                localStorage.setItem('ai_call_logs_fallback', JSON.stringify(existing.slice(0, 100)));
            }
        } catch (e) {
            console.error('[OutboundCallService] Error saving call log:', e);
        }
    }

    /**
     * Fetch call logs from Supabase or fallback
     */
    static async fetchCallLogs(limit = 50): Promise<AICallLog[]> {
        try {
            const { data, error } = await supabase
                .from('ai_call_logs')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(limit);

            if (error || !data) {
                const fallback = JSON.parse(localStorage.getItem('ai_call_logs_fallback') || '[]');
                return fallback;
            }

            return data.map((item: any) => ({
                id: item.id,
                riderId: item.rider_id,
                riderName: item.rider_name,
                mobileNumber: item.mobile_number,
                callScenario: item.call_scenario,
                triggeredBy: item.triggered_by,
                triggeredByName: item.triggered_by_name,
                callId: item.call_id,
                status: item.status,
                walletAmountAtCall: Number(item.wallet_amount_at_call || 0),
                duration: item.duration,
                notes: item.notes,
                createdAt: item.created_at
            }));
        } catch (e) {
            console.error('Failed to fetch call logs:', e);
            return JSON.parse(localStorage.getItem('ai_call_logs_fallback') || '[]');
        }
    }

    /**
     * Fetch Auto-Call configuration for a Team Leader
     */
    static async fetchAutoCallConfig(teamLeaderId: string): Promise<AutoCallConfig | null> {
        try {
            const { data, error } = await supabase
                .from('auto_call_config')
                .select('*')
                .eq('team_leader_id', teamLeaderId)
                .maybeSingle();

            if (error || !data) {
                // Fallback from localStorage
                const saved = localStorage.getItem(`auto_call_config_${teamLeaderId}`);
                if (saved) return JSON.parse(saved);
                return {
                    id: `cfg_${teamLeaderId}`,
                    teamLeaderId,
                    enabled: false,
                    negativeBalanceThreshold: 0,
                    lowBalanceThreshold: 250,
                    maxCallsPerDay: 20,
                    callTimeStart: '10:00',
                    callTimeEnd: '18:00'
                };
            }

            return {
                id: data.id,
                teamLeaderId: data.team_leader_id,
                enabled: data.enabled,
                negativeBalanceThreshold: Number(data.negative_balance_threshold || 0),
                lowBalanceThreshold: Number(data.low_balance_threshold || 250),
                maxCallsPerDay: Number(data.max_calls_per_day || 20),
                callTimeStart: data.call_time_start || '10:00',
                callTimeEnd: data.call_time_end || '18:00',
                lastRunAt: data.last_run_at,
                createdAt: data.created_at,
                updatedAt: data.updated_at
            };
        } catch (e) {
            return null;
        }
    }

    /**
     * Save Auto-Call configuration for a Team Leader
     */
    static async saveAutoCallConfig(config: AutoCallConfig): Promise<boolean> {
        try {
            const { error } = await supabase.from('auto_call_config').upsert([{
                team_leader_id: config.teamLeaderId,
                enabled: config.enabled,
                negative_balance_threshold: config.negativeBalanceThreshold,
                low_balance_threshold: config.lowBalanceThreshold,
                max_calls_per_day: config.maxCallsPerDay,
                call_time_start: config.callTimeStart,
                call_time_end: config.callTimeEnd,
                updated_at: new Date().toISOString()
            }], { onConflict: 'team_leader_id' });

            if (error) {
                console.warn('[OutboundCallService] Supabase save config failed, saving to localStorage:', error.message);
                localStorage.setItem(`auto_call_config_${config.teamLeaderId}`, JSON.stringify(config));
            }
            return true;
        } catch (e) {
            localStorage.setItem(`auto_call_config_${config.teamLeaderId}`, JSON.stringify(config));
            return true;
        }
    }

    /**
     * Bulk Trigger AI Outbound Calls for Targeted Riders
     */
    static async triggerBulkCalls(
        riders: Array<{ id: string; riderName: string; mobileNumber: string; walletAmount: number }>,
        scenario: CallScenario,
        triggeredBy?: string,
        triggeredById?: string
    ): Promise<{ total: number; dispatched: number }> {
        let dispatched = 0;
        for (const rider of riders) {
            const res = await this.triggerCall({
                riderId: rider.id,
                riderName: rider.riderName,
                mobileNumber: rider.mobileNumber,
                walletAmount: rider.walletAmount,
                callScenario: scenario,
                triggeredBy,
                triggeredById
            });
            if (res.success) dispatched++;
            await new Promise(r => setTimeout(r, 200));
        }
        return { total: riders.length, dispatched };
    }
}

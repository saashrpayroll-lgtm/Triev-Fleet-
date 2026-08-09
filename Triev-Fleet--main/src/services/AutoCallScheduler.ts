import { OutboundCallService } from './OutboundCallService';
import { Rider } from '@/types';

export class AutoCallScheduler {
    private static runningTLs: Set<string> = new Set();

    /**
     * Run Auto Call process for a specific Team Leader's riders
     */
    static async runAutoCallForTL(
        teamLeaderId: string,
        teamLeaderName: string,
        riders: Rider[]
    ): Promise<{ triggered: number; skipped: number; reason?: string }> {
        if (this.runningTLs.has(teamLeaderId)) {
            return { triggered: 0, skipped: riders.length, reason: 'Auto call already in progress for this Team Leader.' };
        }

        const config = await OutboundCallService.fetchAutoCallConfig(teamLeaderId);
        if (!config || !config.enabled) {
            return { triggered: 0, skipped: riders.length, reason: 'Auto call is disabled for this Team Leader.' };
        }

        // Filter targeted riders (Negative balance or < ₹250)
        const { totalTargeted } = OutboundCallService.getEligibleTargetRiders(riders);

        if (totalTargeted.length === 0) {
            return { triggered: 0, skipped: 0, reason: 'No eligible riders with negative balance or balance < ₹250.' };
        }

        this.runningTLs.add(teamLeaderId);

        let triggeredCount = 0;
        let skippedCount = 0;
        const maxCalls = config.maxCallsPerDay || 20;

        try {
            // Priority: Negative balance riders first, then low balance
            const sortedRiders = [...totalTargeted].sort((a, b) => a.walletAmount - b.walletAmount);
            const toCallRiders = sortedRiders.slice(0, maxCalls);

            for (const rider of toCallRiders) {
                const scenario = rider.walletAmount < 0 ? 'negative_balance' : 'low_balance';
                
                const result = await OutboundCallService.triggerCall({
                    riderId: rider.id,
                    riderName: rider.riderName,
                    mobileNumber: rider.mobileNumber,
                    walletAmount: rider.walletAmount,
                    callScenario: scenario,
                    customNote: `Auto Call triggered for ${rider.riderName} (Balance: ₹${rider.walletAmount})`,
                    triggeredBy: `Auto Scheduler (${teamLeaderName})`,
                    triggeredById: teamLeaderId
                });

                if (result.success) {
                    triggeredCount++;
                } else {
                    skippedCount++;
                }

                // 300ms pause between calls to avoid server strain
                await new Promise(r => setTimeout(r, 300));
            }

            // Update last run time in config
            await OutboundCallService.saveAutoCallConfig({
                ...config,
                lastRunAt: new Date().toISOString()
            });

        } finally {
            this.runningTLs.delete(teamLeaderId);
        }

        return {
            triggered: triggeredCount,
            skipped: skippedCount + (totalTargeted.length - Math.min(totalTargeted.length, maxCalls))
        };
    }
}

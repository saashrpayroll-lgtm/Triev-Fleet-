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

    /**
     * Run Auto Call Campaign for ALL targeted riders across all Team Leaders
     */
    static async runAutoCallForAllTargetedRiders(
        riders: Rider[],
        triggeredByName = 'Admin Global Scheduler'
    ): Promise<{ total: number; dispatched: number; skipped: number }> {
        const { totalTargeted } = OutboundCallService.getEligibleTargetRiders(riders);

        if (totalTargeted.length === 0) {
            return { total: 0, dispatched: 0, skipped: 0 };
        }

        // Priority sort: most negative balance first
        const sortedRiders = [...totalTargeted].sort((a, b) => a.walletAmount - b.walletAmount);

        let dispatched = 0;
        let skipped = 0;

        for (const rider of sortedRiders) {
            const scenario = rider.walletAmount < 0 ? 'negative_balance' : 'low_balance';
            const res = await OutboundCallService.triggerCall({
                riderId: rider.id,
                riderName: rider.riderName,
                mobileNumber: rider.mobileNumber,
                walletAmount: rider.walletAmount,
                callScenario: scenario,
                customNote: `Global Campaign triggered for ${rider.riderName}`,
                triggeredBy: triggeredByName
            });

            if (res.success) {
                dispatched++;
            } else {
                skipped++;
            }

            await new Promise(r => setTimeout(r, 250));
        }

        return {
            total: totalTargeted.length,
            dispatched,
            skipped
        };
    }
}

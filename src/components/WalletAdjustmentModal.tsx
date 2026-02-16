import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, IndianRupee, Wallet } from 'lucide-react';
import { LedgerAPI } from '@/api/ledger';
import { toast } from 'sonner';

const adjustmentSchema = z.object({
    // Allow negative numbers (we'll handle logic), but effectively we want non-zero
    amount: z.number().refine(val => val !== 0, 'Amount cannot be zero'),
    type: z.enum(['MANUAL_ADJUSTMENT', 'DAILY_COLLECTION'] as const),
    mode: z.enum(['ADD', 'SUBTRACT'] as const),
    description: z.string().min(3, 'Reason is required'),
});

interface WalletAdjustmentModalProps {
    riderId: string;
    riderName: string;
    currentBalance: number;
    onClose: () => void;
    onSuccess: () => void;
}

const WalletAdjustmentModal: React.FC<WalletAdjustmentModalProps> = ({
    riderId,
    riderName,
    currentBalance,
    onClose,
    onSuccess
}) => {
    const [isSubmitting, setIsSubmitting] = useState(false);

    const {
        register,
        handleSubmit,
        watch,
        setValue,
        formState: { errors },
    } = useForm({
        resolver: zodResolver(adjustmentSchema),
        defaultValues: {
            amount: 0,
            type: 'MANUAL_ADJUSTMENT' as const,
            mode: 'ADD',
            description: '',
        },
    });

    const mode = watch('mode');
    const amountValue = watch('amount');

    // Effect: Auto-switch mode based on input sign
    React.useEffect(() => {
        if (amountValue < 0) {
            setValue('mode', 'SUBTRACT');
            // We don't necessarily need to flip the sign in the input immediately as it might confuse typing,
            // but for the submission we will handle absolute values.
        } else if (amountValue > 0 && mode === 'SUBTRACT' && !isSubmitting) {
            // If user manually set SUBTRACT, we let them keep it positive standardly.
            // But if they type positive, we default to ADD unless they clicked Deduct.
            // Actually, simplified logic: A negative input IMPLIES deduction.
        }
    }, [amountValue, setValue]);

    const handleTransaction = async (data: any) => {
        setIsSubmitting(true);
        try {
            // Logic: If user typed negative, treat as SUBTRACT with positive magnitude.
            // If user typed positive but selected SUBTRACT, treat as SUBTRACT.
            let finalAmount = data.amount;
            let finalMode = data.mode;

            if (finalAmount < 0) {
                finalAmount = Math.abs(finalAmount);
                finalMode = 'SUBTRACT';
            }

            await LedgerAPI.addTransaction({
                riderId,
                amount: finalAmount,
                type: data.type,
                mode: finalMode,
                description: data.description,
                metadata: { source: 'admin_panel' }
            });

            toast.success('Wallet adjusted successfully');
            onSuccess();
            onClose();
        } catch (error: any) {
            console.error('Adjustment failed:', error);
            toast.error(error.message || 'Failed to adjust wallet');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4 animate-in fade-in duration-200">
            <div className="bg-card rounded-xl max-w-md w-full shadow-2xl overflow-hidden border border-border">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b bg-muted/30">
                    <div>
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <Wallet className="text-primary" size={24} />
                            Adjust Wallet Balance
                        </h2>
                        <p className="text-sm text-muted-foreground mt-1">
                            For {riderName}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-accent rounded-full transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    {/* Current Balance Display */}
                    <div className="flex justify-between items-center p-4 bg-secondary/50 rounded-lg border border-border">
                        <span className="text-sm font-medium">Current Balance</span>
                        <span className={`text-lg font-bold ${currentBalance < 0 ? 'text-red-600' : 'text-green-600'}`}>
                            ₹{currentBalance.toLocaleString('en-IN')}
                        </span>
                    </div>

                    <form id="adjustment-form" onSubmit={handleSubmit(handleTransaction)} className="space-y-4">
                        {/* Mode Selection */}
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={() => setValue('mode', 'ADD')}
                                className={`p-3 rounded-lg border flex flex-col items-center justify-center gap-1 transition-all ${mode === 'ADD'
                                    ? 'bg-green-500 text-white border-green-600 ring-2 ring-green-500/20'
                                    : 'bg-background hover:bg-green-50 text-foreground border-input'
                                    }`}
                            >
                                <span className="font-bold text-lg">+ Add Funds</span>
                                <span className="text-xs opacity-80">Credit</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setValue('mode', 'SUBTRACT')}
                                className={`p-3 rounded-lg border flex flex-col items-center justify-center gap-1 transition-all ${mode === 'SUBTRACT'
                                    ? 'bg-red-500 text-white border-red-600 ring-2 ring-red-500/20'
                                    : 'bg-background hover:bg-red-50 text-foreground border-input'
                                    }`}
                            >
                                <span className="font-bold text-lg">- Deduct</span>
                                <span className="text-xs opacity-80">Debit</span>
                            </button>
                        </div>

                        {/* Amount */}
                        <div>
                            <label className="block text-sm font-medium mb-1.5">Amount (₹)</label>
                            <div className="relative">
                                <IndianRupee size={16} className="absolute left-3 top-3 text-muted-foreground" />
                                <input
                                    {...register('amount', { valueAsNumber: true })}
                                    type="number"
                                    step="0.01"
                                    placeholder="0.00"
                                    className="w-full pl-9 pr-4 py-2.5 border rounded-lg bg-background focus:ring-2 focus:ring-primary/20 outline-none"
                                />
                            </div>
                            {errors.amount && <p className="text-destructive text-xs mt-1">{errors.amount.message}</p>}
                        </div>

                        {/* Reason */}
                        <div>
                            <label className="block text-sm font-medium mb-1.5">Reason</label>
                            <textarea
                                {...register('description')}
                                rows={2}
                                placeholder="e.g. Bonus, Penalty, Correction..."
                                className="w-full px-3 py-2 border rounded-lg bg-background focus:ring-2 focus:ring-primary/20 outline-none resize-none"
                            />
                            {errors.description && <p className="text-destructive text-xs mt-1">{errors.description.message}</p>}
                        </div>
                    </form>
                </div>

                {/* Footer */}
                <div className="p-6 border-t bg-muted/30 flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium border rounded-lg hover:bg-accent disabled:opacity-50"
                        disabled={isSubmitting}
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        form="adjustment-form"
                        className={`px-4 py-2 text-sm font-bold text-white rounded-lg shadow-md transition-all disabled:opacity-50 flex items-center gap-2 ${mode === 'ADD' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
                            }`}
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? 'Processing...' : `Confirm ${mode === 'ADD' ? 'Credit' : 'Debit'}`}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default WalletAdjustmentModal;

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, Sparkles, Loader } from 'lucide-react';
import { RiderFormData, User, UserRole } from '@/types';
import { AIService } from '@/services/AIService';

const riderSchema = z.object({
    trievId: z.string().min(4, 'Triev ID must be at least 4 characters'),
    riderName: z.string().min(2, 'Rider name is required'),
    mobileNumber: z.string().regex(/^\+91\d{10}$/, 'Mobile number must be in format +91XXXXXXXXXX'),
    chassisNumber: z.string().min(3, 'Chassis number is required'),
    clientName: z.string(),
    clientId: z.string().optional(),
    walletAmount: z.number(),
    allotmentDate: z.string().optional(),
    teamLeaderId: z.string().optional(),
    status: z.enum(['active', 'inactive', 'deleted'] as const),
    comments: z.string().optional(),
    remarks: z.string().optional(),
});

interface AddRiderFormProps {
    onClose: () => void;
    onSubmit: (data: any) => Promise<void>;
    initialData?: Partial<RiderFormData>;
    isEdit?: boolean;
    teamLeaders?: User[];
    userRole?: UserRole;
}

const AddRiderForm: React.FC<AddRiderFormProps> = ({ onClose, onSubmit, initialData, isEdit = false, teamLeaders = [], userRole = 'teamLeader' }) => {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [aiLoading, setAiLoading] = useState(false);

    // Helper to format Timestamp/Date to YYYY-MM-DD for input
    const formatDateForInput = (date?: any) => {
        if (!date) return new Date().toISOString().split('T')[0];
        if (date.seconds) return new Date(date.seconds * 1000).toISOString().split('T')[0];
        if (date instanceof Date) return date.toISOString().split('T')[0];
        return String(date).split('T')[0];
    };

    const {
        register,
        handleSubmit,
        watch,
        formState: { errors },
    } = useForm<any>({
        resolver: zodResolver(riderSchema),
        defaultValues: initialData ? {
            ...initialData,
            allotmentDate: formatDateForInput(initialData?.['allotmentDate' as keyof RiderFormData]),
            teamLeaderId: initialData?.['teamLeaderId' as keyof RiderFormData] || '',
        } : {
            trievId: '',
            riderName: '',
            mobileNumber: '+91',
            chassisNumber: '',
            clientName: 'Zomato',
            clientId: '',
            walletAmount: 0,
            allotmentDate: new Date().toISOString().split('T')[0],
            teamLeaderId: '',
            status: 'active',
            comments: '',
            remarks: '',
        },
    });

    const selectedClient = watch('clientName');

    const handleFormSubmit = async (data: any) => {
        try {
            setIsSubmitting(true);
            // Pass data in camelCase (application model)
            // Let the parent component handle DB mapping (snake_case conversion)
            const submitData = {
                trievId: data.trievId,
                riderName: data.riderName,
                mobileNumber: data.mobileNumber,
                chassisNumber: data.chassisNumber,
                clientName: data.clientName,
                clientId: data.clientId,
                walletAmount: data.walletAmount,
                allotmentDate: data.allotmentDate ? new Date(data.allotmentDate).toISOString() : null,
                teamLeaderId: data.teamLeaderId || null,
                status: data.status,
                remarks: data.remarks || data.comments,
                comments: data.comments
            };

            await onSubmit(submitData);
            onClose();
        } catch (error) {
            console.error('Error submitting form:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleAiSuggest = async () => {
        setAiLoading(true);
        try {
            const riderData = {
                riderName: watch('riderName'),
                clientName: watch('clientName'),
                status: watch('status'),
                walletAmount: watch('walletAmount')
            };
            const suggestion = await AIService.suggestRiderNotes(riderData);
            if (suggestion) {
                // Use setValue from react-hook-form to update the field
                const currentComments = watch('comments') || '';
                const newComments = currentComments ? `${currentComments}\n\n${suggestion}` : suggestion;
                // We need to get setValue from useForm
                (document.querySelector('textarea[name="comments"]') as HTMLTextAreaElement).value = newComments;
            }
        } catch (error) {
            console.error('AI suggestion failed:', error);
        } finally {
            setAiLoading(false);
        }
    };

    const clientOptions: { value: string; label: string }[] = [
        { value: 'Zomato', label: 'Zomato' },
        { value: 'Swiggy', label: 'Swiggy' },
        { value: 'Zepto', label: 'Zepto' },
        { value: 'Blinkit', label: 'Blinkit' },
        { value: 'Shadowfax', label: 'Shadowfax' },
        { value: 'Porter', label: 'Porter' },
        { value: 'Rapido', label: 'Rapido' },
        { value: 'Uber', label: 'Uber' },
        { value: 'Ola', label: 'Ola' },
        { value: 'FLK', label: 'FLK' },
        { value: 'Other', label: 'Other' },
    ];

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-0 md:p-4">
            <div className="bg-card md:rounded-lg max-w-3xl w-full flex flex-col h-full md:h-auto md:max-h-[90vh]">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-border flex-shrink-0">
                    <h2 className="text-2xl font-bold">
                        {isEdit ? 'Edit Rider' : 'Add New Rider'}
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-accent rounded-lg transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Form - Scrollable Content */}
                <div className="overflow-y-auto p-6 flex-grow">
                    <form id="rider-form" onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Triev ID */}
                            <div>
                                <label className="block text-sm font-medium mb-2">
                                    Triev ID <span className="text-destructive">*</span>
                                </label>
                                <input
                                    {...register('trievId')}
                                    type="text"
                                    placeholder="e.g., TR12345"
                                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background ${errors.trievId ? 'border-destructive' : 'border-input'
                                        }`}
                                />
                                {errors.trievId && (
                                    <p className="text-destructive text-sm mt-1">{errors.trievId.message as string}</p>
                                )}
                            </div>

                            {/* Rider Name */}
                            <div>
                                <label className="block text-sm font-medium mb-2">
                                    Rider Name <span className="text-destructive">*</span>
                                </label>
                                <input
                                    {...register('riderName')}
                                    type="text"
                                    placeholder="Full name"
                                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background ${errors.riderName ? 'border-destructive' : 'border-input'
                                        }`}
                                />
                                {errors.riderName && (
                                    <p className="text-destructive text-sm mt-1">{errors.riderName.message as string}</p>
                                )}
                            </div>

                            {/* Mobile Number */}
                            <div>
                                <label className="block text-sm font-medium mb-2">
                                    Mobile Number <span className="text-destructive">*</span>
                                </label>
                                <input
                                    {...register('mobileNumber')}
                                    type="text"
                                    placeholder="+919876543210"
                                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background ${errors.mobileNumber ? 'border-destructive' : 'border-input'
                                        }`}
                                />
                                {errors.mobileNumber && (
                                    <p className="text-destructive text-sm mt-1">{errors.mobileNumber.message as string}</p>
                                )}
                                <p className="text-xs text-muted-foreground mt-1">Format: +91XXXXXXXXXX</p>
                            </div>

                            {/* Chassis Number */}
                            <div>
                                <label className="block text-sm font-medium mb-2">
                                    Chassis Number <span className="text-destructive">*</span>
                                </label>
                                <input
                                    {...register('chassisNumber')}
                                    type="text"
                                    placeholder="e.g., ABC123XYZ"
                                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background ${errors.chassisNumber ? 'border-destructive' : 'border-input'
                                        }`}
                                />
                                {errors.chassisNumber && (
                                    <p className="text-destructive text-sm mt-1">{errors.chassisNumber.message as string}</p>
                                )}
                            </div>

                            {/* Client Name */}
                            <div>
                                <label className="block text-sm font-medium mb-2">
                                    Client Name <span className="text-destructive">*</span>
                                </label>
                                <select
                                    {...register('clientName')}
                                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background ${errors.clientName ? 'border-destructive' : 'border-input'
                                        }`}
                                >
                                    {clientOptions.map(option => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                                {errors.clientName && (
                                    <p className="text-destructive text-sm mt-1">{errors.clientName.message as string}</p>
                                )}
                            </div>

                            {/* Client ID */}
                            <div>
                                <label className="block text-sm font-medium mb-2">
                                    Client ID
                                </label>
                                <input
                                    {...register('clientId')}
                                    type="text"
                                    placeholder={`${selectedClient} ID`}
                                    className="w-full px-4 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background"
                                />
                                <p className="text-xs text-muted-foreground mt-1">Optional - Client-specific identifier</p>
                            </div>

                            {/* Wallet Amount */}
                            <div>
                                <label className="block text-sm font-medium mb-2">
                                    Wallet Amount (₹) <span className="text-destructive">*</span>
                                </label>
                                <input
                                    {...register('walletAmount', { valueAsNumber: true })}
                                    type="number"
                                    step="0.01"
                                    placeholder="0.00"
                                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background ${errors.walletAmount ? 'border-destructive' : 'border-input'
                                        }`}
                                />
                                {errors.walletAmount && (
                                    <p className="text-destructive text-sm mt-1">{errors.walletAmount.message as string}</p>
                                )}
                                <p className="text-xs text-muted-foreground mt-1">Positive for credits, negative for debits</p>
                            </div>

                            {/* Allotment Date */}
                            <div>
                                <label className="block text-sm font-medium mb-2">
                                    Allotment Date
                                </label>
                                <input
                                    {...register('allotmentDate')}
                                    type="date"
                                    className="w-full px-4 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background"
                                />
                            </div>

                            {/* Team Leader Selection (Admin Only) */}
                            {userRole === 'admin' && (
                                <div>
                                    <label className="block text-sm font-medium mb-2">
                                        Assign Team Leader
                                    </label>
                                    <select
                                        {...register('teamLeaderId')}
                                        className="w-full px-4 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background"
                                    >
                                        <option value="">Select Team Leader</option>
                                        {teamLeaders.map(tl => (
                                            <option key={tl.id} value={tl.id}>{tl.fullName}</option>
                                        ))}
                                    </select>
                                    <p className="text-xs text-muted-foreground mt-1">Reassigning will move rider to TL's team</p>
                                </div>
                            )}

                            {/* Status */}
                            <div>
                                <label className="block text-sm font-medium mb-2">
                                    Status <span className="text-destructive">*</span>
                                </label>
                                <select
                                    {...register('status')}
                                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background ${errors.status ? 'border-destructive' : 'border-input'
                                        }`}
                                >
                                    <option value="active">Active</option>
                                    <option value="inactive">Inactive</option>
                                    <option value="deleted">Deleted</option>
                                </select>
                                {errors.status && (
                                    <p className="text-destructive text-sm mt-1">{errors.status.message as string}</p>
                                )}
                            </div>

                            {/* Comments/Notes */}
                            <div className="md:col-span-2">
                                <div className="flex justify-between items-center mb-2">
                                    <label className="block text-sm font-medium">
                                        Comments / Notes
                                    </label>
                                    <button
                                        type="button"
                                        onClick={handleAiSuggest}
                                        disabled={aiLoading || !watch('riderName')}
                                        className="text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-2 py-1 rounded-full flex items-center gap-1 hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                        title="Generate AI-powered onboarding notes"
                                    >
                                        {aiLoading ? <Loader size={12} className="animate-spin" /> : <Sparkles size={12} />}
                                        AI Suggest
                                    </button>
                                </div>
                                <textarea
                                    {...register('comments')}
                                    rows={3}
                                    placeholder="Add any additional notes or comments about this rider..."
                                    className="w-full px-4 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background text-foreground resize-none"
                                />
                                <p className="text-xs text-muted-foreground mt-1">Optional - Internal notes only</p>
                            </div>
                        </div>
                    </form>
                </div>

                {/* Footer - Fixed */}
                <div className="flex items-center justify-end gap-4 p-6 border-t border-border flex-shrink-0 bg-card rounded-b-lg">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-6 py-2.5 border border-input rounded-lg hover:bg-accent transition-colors font-medium"
                        disabled={isSubmitting}
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        form="rider-form"
                        className="bg-primary text-primary-foreground px-6 py-2.5 rounded-lg hover:bg-primary/90 transition-all shadow-md hover:shadow-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? (
                            <>
                                <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin"></div>
                                Saving...
                            </>
                        ) : (
                            isEdit ? 'Update Rider' : 'Add Rider'
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AddRiderForm;


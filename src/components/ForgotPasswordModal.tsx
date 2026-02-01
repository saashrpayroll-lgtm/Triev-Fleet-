import React, { useState } from 'react';
import { X, Smartphone, AlertCircle, CheckCircle } from 'lucide-react';
import { supabase } from '@/config/supabase';
import { validateMobileNumber } from '@/utils/passwordUtils';
import { toast } from 'sonner';

interface ForgotPasswordModalProps {
    onClose: () => void;
}

const ForgotPasswordModal: React.FC<ForgotPasswordModalProps> = ({ onClose }) => {
    const [mobile, setMobile] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        // Validate mobile number
        if (!validateMobileNumber(mobile)) {
            setError('Please enter a valid 10-digit mobile number');
            return;
        }

        setLoading(true);

        try {
            // Check if user exists with this mobile number
            const { data: user, error: userError } = await supabase
                .from('users')
                .select('id, fullName, mobile')
                .eq('mobile', mobile)
                .single();

            if (userError || !user) {
                setError('No account found with this mobile number');
                setLoading(false);
                return;
            }

            // Check if there's already a pending request
            const { data: existingRequest } = await supabase
                .from('password_reset_requests')
                .select('*')
                .eq('user_id', user.id)
                .eq('status', 'pending')
                .single();

            if (existingRequest) {
                setError('A password reset request is already pending for this account');
                setLoading(false);
                return;
            }

            // Create password reset request
            const { error: insertError } = await supabase
                .from('password_reset_requests')
                .insert({
                    user_id: user.id,
                    mobile_number: mobile,
                    status: 'pending',
                    requested_at: new Date().toISOString()
                });

            if (insertError) {
                console.error('Error creating reset request:', insertError);
                setError('Failed to submit request. Please try again.');
                setLoading(false);
                return;
            }

            // Success
            setSuccess(true);
            toast.success('Password reset request submitted successfully!');

            // Close modal after 2 seconds
            setTimeout(() => {
                onClose();
            }, 2000);

        } catch (err) {
            console.error('Error:', err);
            setError('An unexpected error occurred. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-background rounded-xl shadow-2xl w-full max-w-md animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b">
                    <h2 className="text-2xl font-bold">Forgot Password?</h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-muted rounded-full transition-colors"
                        disabled={loading}
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6">
                    {success ? (
                        <div className="text-center py-8">
                            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                                <CheckCircle size={32} className="text-green-600" />
                            </div>
                            <h3 className="text-xl font-semibold mb-2">Request Submitted!</h3>
                            <p className="text-muted-foreground">
                                Your password reset request has been sent to the admin.
                                You'll be able to login with a new password once approved.
                            </p>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <p className="text-muted-foreground mb-4">
                                    Enter your registered mobile number to request a password reset.
                                    An admin will review and approve your request.
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-2">
                                    Mobile Number
                                </label>
                                <div className="relative">
                                    <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
                                    <input
                                        type="tel"
                                        value={mobile}
                                        onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                                        placeholder="Enter 10-digit mobile number"
                                        className="w-full pl-11 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-primary/20 outline-none"
                                        maxLength={10}
                                        required
                                        disabled={loading}
                                    />
                                </div>
                            </div>

                            {error && (
                                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                                    <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
                                    <p className="text-sm text-red-600">{error}</p>
                                </div>
                            )}

                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="flex-1 px-4 py-3 border rounded-lg hover:bg-muted transition-colors font-medium"
                                    disabled={loading}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium disabled:opacity-50"
                                    disabled={loading || mobile.length !== 10}
                                >
                                    {loading ? 'Submitting...' : 'Request Reset'}
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ForgotPasswordModal;

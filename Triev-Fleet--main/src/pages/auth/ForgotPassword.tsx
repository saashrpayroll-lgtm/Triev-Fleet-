import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ShieldAlert } from 'lucide-react';
import { supabase } from '@/config/supabase';
import { logActivity } from '@/utils/activityLog';

const ForgotPassword: React.FC = () => {
    const [email, setEmail] = useState('');
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess(false);
        setLoading(true);

        try {
            // 1. Check if user exists (optional, but good for linking)
            const { data: user } = await supabase
                .from('users')
                .select('id')
                .eq('email', email)
                .single();

            // If user doesn't exist, we might still allow request creation or fail?
            // Existing logic implied we just wanted the ID if available. Supabase single() errors if not found.
            // So we handle error gracefully.
            const userId = user?.id || null;

            // 2. Create Request
            const { error: insertError } = await supabase.from('requests').insert({
                type: 'password_reset',
                subject: 'Password Reset Request',
                description: `User ${email} has requested a password reset.`,
                email: email,
                user_id: userId,
                status: 'pending',
                created_at: new Date().toISOString()
            });

            if (insertError) throw insertError;

            // 3. Log Activity & Notify Admin
            await logActivity({
                actionType: 'requestCreated',
                targetType: 'request',
                targetId: email,
                details: `Password reset requested for ${email}`,
                performedBy: 'system',
                metadata: { email, type: 'password_reset' }
            });

            setSuccess(true);
            setEmail('');
        } catch (err: unknown) {
            console.error(err);
            if (err instanceof Error) {
                setError(err.message || 'Failed to submit request. Please try again.');
            } else {
                setError('Failed to submit request. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-4">
            <div className="w-full max-w-md">
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent mb-2">
                        Triev Rider Pro
                    </h1>
                    <p className="text-muted-foreground">Request Password Reset</p>
                </div>

                <div className="bg-card border border-border rounded-lg shadow-lg p-8">
                    <div className="mb-6">
                        <Link
                            to="/login"
                            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                        >
                            <ArrowLeft size={16} />
                            Back to Login
                        </Link>
                    </div>

                    <h2 className="text-2xl font-semibold mb-2">Forgot Password?</h2>
                    <p className="text-sm text-muted-foreground mb-6">
                        Enter your email address to request a password reset from the Admin.
                    </p>

                    {success && (
                        <div className="mb-4 p-3 bg-green-500/10 border border-green-500/20 rounded-md text-green-600 dark:text-green-400 text-sm">
                            Request sent successfully! The Admin will review and process your request shortly.
                        </div>
                    )}

                    {error && (
                        <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md text-destructive text-sm">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label htmlFor="email" className="block text-sm font-medium mb-2">
                                Email Address
                            </label>
                            <input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full px-4 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-background"
                                placeholder="Enter your email"
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-primary text-primary-foreground py-2.5 rounded-md font-medium hover:bg-primary/90 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
                        >
                            {loading ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin"></div>
                                    Sending...
                                </>
                            ) : (
                                <>
                                    <ShieldAlert size={18} />
                                    Request Admin Reset
                                </>
                            )}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default ForgotPassword;

import React, { useState } from 'react';
import { supabase } from '@/config/supabase';
import { Eye, EyeOff, ShieldCheck, Lock, AlertTriangle } from 'lucide-react';
import AnimatedBackground from '@/components/auth/AnimatedBackground';
import { toast } from 'sonner';

const AdminLogin: React.FC = () => {
    const [loginInput, setLoginInput] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    // const { login } = useSupabaseAuth(); // Not using context login for custom flow

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            let emailToLogin = loginInput;

            // 1. Resolve Login Identifier (Email / Mobile / UserID)
            const rawInput = loginInput.trim();
            const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawInput);

            if (!isEmail) {
                // Remove spaces, dashes, parentheses to clean potential phone formatting
                const cleanedInput = rawInput.replace(/[\s\-()]/g, '');

                // If not standard email, try to resolve it
                const isMobile = /^(\+)?\d+$/.test(cleanedInput);

                if (isMobile) {
                    const { data, error } = await supabase.rpc('get_email_by_mobile', { mobile_input: cleanedInput });
                    if (error || !data) throw new Error("Mobile number not found or not registered.");
                    emailToLogin = data;
                } else {
                    // Assume Username / User ID
                    const { data, error } = await supabase.rpc('get_email_by_username', { username_input: rawInput });
                    if (error || !data) throw new Error("User ID / Username not found.");
                    emailToLogin = data;
                }
            }

            // 2. Perform standard login with resolved email
            const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
                email: emailToLogin,
                password
            });

            if (authError) throw authError;

            if (!authData.user) throw new Error("No user returned from login");

            // 3. Strict Role Check
            // We fetch the 'role' from the public.users table for this user
            const { data: userData, error: userError } = await supabase
                .from('users')
                .select('role')
                .eq('id', authData.user.id)
                .single();

            if (userError || !userData) {
                // If we can't verify role, kick them out
                await supabase.auth.signOut();
                throw new Error("Failed to verify user privileges.");
            }

            if (userData.role !== 'admin') {
                // If not admin, kick them out immediately
                await supabase.auth.signOut();
                throw new Error("ACCESS DENIED: You do not have administrator privileges.");
            }

            // 4. Success - The App.tsx will reject public routes and redirect to /admin or /portal
            toast.success("Welcome back, Administrator.");
            // We rely on the AuthContext to detect the change and redirect, 
            // but we can enforce a reload or navigation if needed.
            window.location.href = '/portal';

        } catch (err: any) {
            console.error('Admin Login error:', err);
            setError(err.message || 'Authentication failed');
            // Ensure session is cleared if any step failed after initial auth
            if (err.message && err.message.includes("ACCESS DENIED")) {
                await supabase.auth.signOut();
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <AnimatedBackground variant="admin" />

            <div className="min-h-screen flex items-center justify-center p-4 relative z-10">
                <div className="w-full max-w-md animate-in fade-in zoom-in-95 duration-500">

                    {/* Admin Badge */}
                    <div className="flex justify-center mb-6">
                        <div className="bg-red-600/20 backdrop-blur-md p-4 rounded-full border-2 border-red-500/50 shadow-[0_0_30px_rgba(239,68,68,0.3)]">
                            <ShieldCheck className="w-10 h-10 text-red-500" />
                        </div>
                    </div>

                    <div className="text-center mb-8">
                        <h1 className="text-4xl font-black text-white mb-2 tracking-tight">
                            ADMIN <span className="text-red-500">PORTAL</span>
                        </h1>
                        <p className="text-red-200/60 font-mono text-sm uppercase tracking-widest">Authorized Personnel Only</p>
                    </div>

                    <div className="bg-black/40 backdrop-blur-xl border border-red-500/20 rounded-2xl p-8 shadow-2xl relative overflow-hidden">
                        {/* Decorative top bar */}
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-red-500 to-transparent opacity-50"></div>

                        <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
                            {error && (
                                <div className="bg-red-950/50 border border-red-500/50 text-red-200 px-4 py-3 rounded-lg text-sm flex items-start gap-2">
                                    <AlertTriangle className="w-5 h-5 shrink-0 text-red-500" />
                                    <span>{error}</span>
                                </div>
                            )}

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-red-500/80 uppercase tracking-wider">Email / Mobile / User ID</label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={loginInput}
                                        onChange={(e) => setLoginInput(e.target.value)}
                                        className="w-full pl-4 pr-4 py-3 bg-red-950/10 border border-red-500/20 rounded-lg text-white placeholder-red-200/20 focus:outline-none focus:border-red-500/60 focus:ring-1 focus:ring-red-500/60 transition-all font-mono"
                                        placeholder="admin@triev.com or 9876543210"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-red-500/80 uppercase tracking-wider">Password</label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full pl-4 pr-12 py-3 bg-red-950/10 border border-red-500/20 rounded-lg text-white placeholder-red-200/20 focus:outline-none focus:border-red-500/60 focus:ring-1 focus:ring-red-500/60 transition-all font-mono"
                                        placeholder="••••••••••••"
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-red-500/40 hover:text-red-400 transition-colors"
                                    >
                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-gradient-to-r from-red-700 to-red-600 hover:from-red-600 hover:to-red-500 text-white font-bold py-3 px-6 rounded-lg transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-red-900/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        <span>AUTHENTICATING...</span>
                                    </>
                                ) : (
                                    <>
                                        <Lock size={18} />
                                        <span>SECURE ACCESS</span>
                                    </>
                                )}
                            </button>
                        </form>
                    </div>

                    <div className="mt-8 text-center space-y-2">
                        <p className="text-red-500/40 text-xs font-mono">
                            UNAUTHORIZED ACCESS IS PROHIBITED
                        </p>
                        <p className="text-white/20 text-[10px] font-mono">
                            IP Address Logging Enabled
                        </p>
                    </div>
                </div>
            </div>
        </>
    );
};

export default AdminLogin;

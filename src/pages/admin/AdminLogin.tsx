import React, { useState } from 'react';
import { supabase } from '@/config/supabase';
import { Eye, EyeOff, ShieldCheck, Lock, AlertTriangle } from 'lucide-react';
import AnimatedBackground from '@/components/auth/AnimatedBackground';
import { toast } from 'sonner';
import ForcePasswordChangeModal from '@/components/ForcePasswordChangeModal';

const AdminLogin: React.FC = () => {
    const [loginInput, setLoginInput] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showForcePasswordChange, setShowForcePasswordChange] = useState(false);
    const [loggedInUserId, setLoggedInUserId] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            let emailToLogin = loginInput;

            const { data: resolvedEmail, error: resolutionError } = await supabase
                .rpc('resolve_login_identifier', { p_identifier: loginInput.trim() });

            if (resolutionError || !resolvedEmail) {
                const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(loginInput.trim());
                if (isEmail) {
                    emailToLogin = loginInput.trim();
                } else {
                    throw new Error("Account not found. Please check your credentials.");
                }
            } else {
                emailToLogin = resolvedEmail;
            }

            const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
                email: emailToLogin,
                password
            });

            if (authError) throw authError;
            if (!authData.user) throw new Error("Authentication failed.");

            const { data: userData, error: userError } = await supabase
                .from('users')
                .select('id, role, force_password_change')
                .eq('id', authData.user.id)
                .single();

            if (userError || !userData || userData.role !== 'admin') {
                await supabase.auth.signOut();
                throw new Error("ACCESS DENIED: Administrative privileges required.");
            }

            // Check for default password or manual force flag
            const isDefaultPassword = password === '123456';
            if (isDefaultPassword || userData.force_password_change) {
                if (isDefaultPassword && !userData.force_password_change) {
                    await supabase.from('users').update({ force_password_change: true }).eq('id', userData.id);
                }
                setLoggedInUserId(userData.id);
                setShowForcePasswordChange(true);
                setLoading(false);
                return;
            }

            toast.success("Security Clearance Verified.");
            window.location.href = '/portal';

        } catch (err: any) {
            setError(err.message || 'Authentication failed');
            if (err.message && err.message.includes("DENIED")) {
                await supabase.auth.signOut();
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen relative flex items-center justify-center p-6 selection:bg-red-500/30">
            <AnimatedBackground variant="admin" />

            <div className="w-full max-w-lg relative">
                {/* Security Seal Decor */}
                <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-48 h-48 bg-red-600/10 rounded-full blur-[60px] animate-pulse"></div>

                <div className="relative z-10 space-y-8">
                    {/* Header Section */}
                    <div className="text-center space-y-4 animate-in fade-in slide-in-from-top-4 duration-1000">
                        <div className="inline-flex p-4 rounded-3xl bg-slate-900/50 backdrop-blur-2xl border border-red-500/20 shadow-[0_0_40px_rgba(239,68,68,0.15)] group transition-all hover:scale-110 duration-500">
                            <ShieldCheck className="w-12 h-12 text-red-500 group-hover:rotate-[360deg] transition-transform duration-1000" />
                        </div>
                        <div className="space-y-1">
                            <h1 className="text-5xl font-black text-white tracking-tighter">
                                COMMAND <span className="text-red-600 bg-red-600/10 px-2 rounded-lg">CENTER</span>
                            </h1>
                            <p className="text-red-400/60 font-mono text-xs uppercase tracking-[0.3em]">Authorized Personnel Only • Tier 1 Access</p>
                        </div>
                    </div>

                    {/* Login Card */}
                    <div className="bg-slate-900/40 backdrop-blur-[40px] border border-white/10 rounded-[40px] p-10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] relative overflow-hidden group animate-in zoom-in-95 duration-700">
                        {/* Interactive Border Glow */}
                        <div className="absolute inset-0 bg-gradient-to-br from-red-600/5 via-transparent to-red-600/5 pointer-events-none group-hover:opacity-100 transition-opacity"></div>

                        <form onSubmit={handleSubmit} className="space-y-8 relative z-10">
                            {error && (
                                <div className="bg-red-950/40 border-l-4 border-red-600 p-4 rounded-xl animate-in shake duration-500">
                                    <div className="flex gap-3">
                                        <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
                                        <p className="text-sm text-red-200 font-medium">{error}</p>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-6">
                                {/* Identifier Input */}
                                <div className="space-y-3 group/field">
                                    <label className="text-[10px] font-black text-red-500/80 uppercase tracking-[0.2em] ml-1">Terminal Identity</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={loginInput}
                                            onChange={(e) => setLoginInput(e.target.value)}
                                            className="w-full px-6 py-4 bg-black/40 border border-white/5 rounded-2xl text-white placeholder-white/10 focus:outline-none focus:border-red-500/50 focus:ring-4 focus:ring-red-500/5 transition-all font-mono text-sm"
                                            placeholder="Enter Credentials"
                                            required
                                        />
                                        <div className="absolute inset-0 rounded-2xl bg-red-500/0 group-focus-within/field:bg-red-500/[0.02] pointer-events-none"></div>
                                    </div>
                                </div>

                                {/* Password Input */}
                                <div className="space-y-3 group/field">
                                    <label className="text-[10px] font-black text-red-500/80 uppercase tracking-[0.2em] ml-1">Access Key</label>
                                    <div className="relative">
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className="w-full px-6 py-4 bg-black/40 border border-white/5 rounded-2xl text-white placeholder-white/10 focus:outline-none focus:border-red-500/50 focus:ring-4 focus:ring-red-500/5 transition-all font-mono text-lg tracking-widest"
                                            placeholder="••••••••"
                                            required
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20 hover:text-red-500 transition-colors p-2"
                                        >
                                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-red-600 hover:bg-red-500 text-white font-black py-5 rounded-2xl transition-all duration-500 flex items-center justify-center gap-3 shadow-[0_10px_30px_rgba(220,38,38,0.3)] hover:shadow-[0_15px_40px_rgba(220,38,38,0.4)] disabled:opacity-50 group/btn overflow-hidden relative"
                            >
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover/btn:translate-x-full transition-transform duration-1000"></div>
                                {loading ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        <span className="tracking-[0.2em] text-sm italic">ENCRYPTING...</span>
                                    </>
                                ) : (
                                    <>
                                        <Lock size={18} className="group-hover/btn:scale-125 transition-transform" />
                                        <span className="tracking-[0.2em] text-sm">INITIALIZE ACCESS</span>
                                    </>
                                )}
                            </button>
                        </form>
                    </div>

                    {/* Footer Info */}
                    <div className="text-center space-y-2 animate-in fade-in duration-1000 delay-500">
                        <p className="text-red-500/40 text-[10px] font-mono tracking-widest flex items-center justify-center gap-2">
                            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                            PROTOCOL ACTIVATED: ENHANCED LOGGING ENABLED
                        </p>
                    </div>
                </div>
            </div>

            {showForcePasswordChange && loggedInUserId && (
                <ForcePasswordChangeModal
                    userId={loggedInUserId}
                    onPasswordChanged={() => {
                        setShowForcePasswordChange(false);
                        window.location.href = '/portal';
                    }}
                />
            )}
        </div>
    );
};

export default AdminLogin;

import React, { useState } from 'react';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { useRMTeamData } from '@/hooks/useRMTeamData';
import { Lock, Users, Shield } from 'lucide-react';
import { supabase } from '@/config/supabase';
import { toast } from 'sonner';

const RMProfile: React.FC = () => {
    const { userData } = useSupabaseAuth();
    const { teamLeaders, riders, leads } = useRMTeamData();

    const [changingPassword, setChangingPassword] = useState(false);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passwordLoading, setPasswordLoading] = useState(false);

    const handleChangePassword = async () => {
        if (newPassword !== confirmPassword) {
            toast.error('Passwords do not match');
            return;
        }
        if (newPassword.length < 6) {
            toast.error('Password must be at least 6 characters');
            return;
        }

        setPasswordLoading(true);
        try {
            const { error } = await supabase.auth.updateUser({ password: newPassword });
            if (error) throw error;
            toast.success('Password changed successfully');
            setChangingPassword(false);
            setNewPassword('');
            setConfirmPassword('');
        } catch (err: any) {
            toast.error(err.message || 'Failed to change password');
        } finally {
            setPasswordLoading(false);
        }
    };

    const activeRiders = riders.filter(r => r.status === 'active').length;
    const activeTLs = teamLeaders.filter(tl => tl.status === 'active').length;

    return (
        <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in duration-500">
            {/* Profile Card */}
            <div className="bg-card border rounded-2xl shadow-sm overflow-hidden">
                <div className="bg-gradient-to-r from-teal-600 to-teal-500 p-6 text-white">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-2xl font-bold border-2 border-white/30">
                            {(userData?.fullName || 'R').charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <h1 className="text-xl font-bold">{userData?.fullName || 'Reporting Manager'}</h1>
                            <p className="text-teal-100 text-sm">{userData?.email}</p>
                            <div className="flex items-center gap-1 mt-1">
                                <Shield size={12} className="text-teal-200" />
                                <span className="text-xs text-teal-200 font-bold">Reporting Manager</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-[10px] font-bold text-muted-foreground uppercase">Full Name</label>
                            <p className="font-semibold">{userData?.fullName || '-'}</p>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-muted-foreground uppercase">Email</label>
                            <p className="font-semibold">{userData?.email || '-'}</p>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-muted-foreground uppercase">Mobile</label>
                            <p className="font-semibold">{userData?.mobile || '-'}</p>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-muted-foreground uppercase">User ID</label>
                            <p className="font-semibold font-mono text-sm">{userData?.userId || '-'}</p>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-muted-foreground uppercase">Job Location</label>
                            <p className="font-semibold">{userData?.jobLocation || '-'}</p>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-muted-foreground uppercase">Status</label>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-700">{userData?.status?.toUpperCase()}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Team Summary */}
            <div className="bg-card border rounded-2xl p-6 shadow-sm">
                <h3 className="font-bold flex items-center gap-2 mb-4"><Users size={18} className="text-teal-500" /> My Team</h3>
                <div className="grid grid-cols-3 gap-4 text-center">
                    <div className="bg-teal-50 dark:bg-teal-500/10 rounded-xl p-4">
                        <p className="text-2xl font-black text-teal-600">{activeTLs}</p>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase">Team Leaders</p>
                    </div>
                    <div className="bg-indigo-50 dark:bg-indigo-500/10 rounded-xl p-4">
                        <p className="text-2xl font-black text-indigo-600">{activeRiders}</p>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase">Active Riders</p>
                    </div>
                    <div className="bg-violet-50 dark:bg-violet-500/10 rounded-xl p-4">
                        <p className="text-2xl font-black text-violet-600">{leads.length}</p>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase">Total Leads</p>
                    </div>
                </div>
            </div>

            {/* Change Password */}
            <div className="bg-card border rounded-2xl p-6 shadow-sm">
                <h3 className="font-bold flex items-center gap-2 mb-4"><Lock size={18} className="text-teal-500" /> Security</h3>
                {!changingPassword ? (
                    <button onClick={() => setChangingPassword(true)} className="px-4 py-2 bg-teal-500 text-white rounded-lg font-medium hover:bg-teal-600 transition-colors text-sm">
                        Change Password
                    </button>
                ) : (
                    <div className="space-y-3 max-w-sm">
                        <input type="password" placeholder="New Password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-500/20" />
                        <input type="password" placeholder="Confirm New Password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-500/20" />
                        <div className="flex gap-2">
                            <button onClick={handleChangePassword} disabled={passwordLoading} className="px-4 py-2 bg-teal-500 text-white rounded-lg font-medium hover:bg-teal-600 transition-colors text-sm disabled:opacity-50">
                                {passwordLoading ? 'Saving...' : 'Save'}
                            </button>
                            <button onClick={() => setChangingPassword(false)} className="px-4 py-2 border rounded-lg text-sm hover:bg-accent transition-colors">Cancel</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default RMProfile;

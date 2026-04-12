import React, { useState, useRef } from 'react';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { Mail, Shield, UserCog, Camera, LogOut, Settings, Key, MapPin, Loader2, Smartphone, ShieldCheck, ShieldAlert, KeyRound, ArrowRight, X, Lock } from 'lucide-react';
import { supabase } from '@/config/supabase';
import { logActivity } from '@/utils/activityLog';
import { useToast } from '@/contexts/ToastContext';
import { motion, AnimatePresence } from 'framer-motion';
import EmployeeIDCard from '@/components/dashboard/EmployeeIDCard';

const Profile: React.FC = () => {
    const { userData } = useSupabaseAuth();
    const { success, error } = useToast();
    const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Password State
    const [passwordData, setPasswordData] = useState({
        newPassword: '',
        confirmPassword: ''
    });

    const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        try {
            if (!event.target.files || event.target.files.length === 0) return;
            const file = event.target.files[0];
            const fileExt = file.name.split('.').pop();
            const fileName = `${userData?.id}-${Math.random()}.${fileExt}`;
            const filePath = `${fileName}`;

            setLoading(true);

            // 1. Upload
            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, file, {
                    cacheControl: '3600',
                    upsert: true
                });

            if (uploadError) throw uploadError;

            // 2. Get Public URL
            const { data: { publicUrl } } = supabase.storage
                .from('avatars')
                .getPublicUrl(filePath);

            // 3. Update User Record
            const { error: updateError } = await supabase
                .from('users')
                .update({ profile_pic_url: publicUrl })
                .eq('id', userData?.id);

            if (updateError) throw updateError;

            success("Profile picture updated!");

            await logActivity({
                actionType: 'profileUpdate',
                targetType: 'user',
                targetId: userData?.id || 'unknown',
                details: `Profile picture updated by ${userData?.fullName}`,
                metadata: { field: 'avatar' }
            });

            window.location.reload();

        } catch (err: any) {
            console.error('Avatar Upload Flow Failed:', err);
            if (err.message && (err.message.includes('Bucket not found') || err.message.includes('The resource was not found'))) {
                error("Storage bucket 'avatars' missing. Please create it in Supabase Dashboard.");
            } else {
                error(err.message || "Failed to upload avatar");
            }
        } finally {
            setLoading(false);
        }
    };

    const handleChangePassword = async () => {
        if (!passwordData.newPassword) {
            error("Please enter a new password");
            return;
        }

        if (passwordData.newPassword !== passwordData.confirmPassword) {
            error("New passwords do not match");
            return;
        }

        try {
            setLoading(true);
            const { error: pwdError } = await supabase.auth.updateUser({
                password: passwordData.newPassword
            });
            if (pwdError) throw pwdError;

            await logActivity({
                actionType: 'securityUpdate',
                targetType: 'user',
                targetId: userData?.id || 'unknown',
                details: `Password changed by user (@${userData?.username})`,
                metadata: { type: 'self_password_reset' }
            });

            success("Password updated successfully");
            setPasswordData({ newPassword: '', confirmPassword: '' });
            setIsPasswordModalOpen(false);
        } catch (err: any) {
            error(err.message || "Failed to update password");
        } finally {
            setLoading(false);
        }
    };

    if (!userData) {
        return <div className="p-8 text-center flex items-center justify-center h-[70vh]"><Loader2 className="animate-spin text-purple-500 h-10 w-10" /></div>;
    }

    return (
        <div className="max-w-7xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-8 duration-700 pb-20 px-4">

            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="space-y-1">
                    <h2 className="text-xs font-black text-purple-500 uppercase tracking-[0.4em]">Personal Space</h2>
                    <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-slate-900">Account Dashboard</h1>
                </div>
                <div className="flex items-center gap-3">
                    <div className="text-right hidden sm:block">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Active Session</p>
                        <p className="text-sm font-black text-slate-700">{userData.fullName}</p>
                    </div>
                    <div className="p-3 bg-purple-50 border border-purple-100 rounded-2xl shadow-sm text-purple-600">
                        <Shield size={24} />
                    </div>
                </div>
            </div>

            {/* Premium Identity Card */}
            <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="relative rounded-[3rem] overflow-hidden shadow-[0_32px_64px_-16px_rgba(88,28,135,0.15)] bg-slate-950 border border-white/5"
            >
                {/* Dynamic Background */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute top-[-10%] right-[-10%] w-[60%] h-[60%] bg-purple-600/10 rounded-full blur-[120px] mix-blend-screen" />
                    <div className="absolute bottom-[-20%] left-[-10%] w-[50%] h-[50%] bg-indigo-600/10 rounded-full blur-[100px] mix-blend-screen" />
                    <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent" />
                </div>

                <div className="relative z-10 p-10 md:p-14 lg:p-16">
                    <div className="flex flex-col lg:flex-row gap-16 items-start">

                        {/* 1. Identity Visual (Photo) */}
                        <div className="relative group/avatar shrink-0 mx-auto lg:mx-0">
                            <motion.div
                                whileHover={{ rotate: 0 }}
                                initial={{ rotate: 3 }}
                                className="w-56 h-56 md:w-64 md:h-64 rounded-[2.5rem] p-1.5 bg-gradient-to-br from-purple-500 via-pink-500 to-amber-500 shadow-2xl relative z-10 transition-all duration-500"
                            >
                                <div className="w-full h-full rounded-[2.3rem] bg-slate-950 overflow-hidden relative border-6 border-slate-950 shadow-inner group-hover/avatar:border-slate-900 transition-colors">
                                    {userData.profilePicUrl ? (
                                        <img src={userData.profilePicUrl} alt="Profile" className="w-full h-full object-cover transition-transform duration-1000 group-hover/avatar:scale-110" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-slate-950 text-6xl font-black text-purple-500/20">
                                            {typeof userData.fullName === 'string' ? userData.fullName.charAt(0).toUpperCase() : String(userData.fullName || 'L').charAt(0).toUpperCase()}
                                        </div>
                                    )}

                                    {/* Upload Overlay */}
                                    <label className="absolute inset-0 bg-slate-950/80 flex flex-col items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-all duration-300 cursor-pointer backdrop-blur-md">
                                        <div className="p-3 bg-white/10 rounded-full backdrop-blur-md border border-white/20 mb-2 hover:scale-110 transition-transform">
                                            <Camera className="text-white" size={28} />
                                        </div>
                                        <span className="text-white font-black text-[10px] tracking-[0.2em] uppercase">Change Image</span>
                                        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleAvatarUpload} />
                                    </label>
                                </div>
                            </motion.div>

                            {/* Role Badge */}
                            <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 z-20 whitespace-nowrap">
                                <span className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl shadow-2xl shadow-purple-900/40 border border-purple-400/30 flex items-center gap-2">
                                    <Shield size={14} fill="currentColor" /> Team Leader
                                </span>
                            </div>
                        </div>

                        {/* 2. Account Holder Info */}
                        <div className="flex-1 w-full space-y-10">
                            <div className="text-center lg:text-left space-y-4">
                                <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-purple-500/10 border border-purple-500/20 rounded-full">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                    <span className="text-[10px] font-black text-purple-400 uppercase tracking-[0.2em]">Active Personnel</span>
                                </div>
                                <h1 className="text-5xl md:text-6xl font-black text-white tracking-tighter leading-none">
                                    {typeof userData.fullName === 'string' ? userData.fullName : String(userData.fullName || 'Leader')}
                                </h1>
                                <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 pt-1">
                                    <p className="text-slate-400 font-bold text-xl">
                                        @{typeof userData.username === 'string' ? userData.username : 'user_id'}
                                    </p>
                                    <div className="w-1 h-1 rounded-full bg-slate-700 hidden sm:block" />
                                    <div className="flex items-center gap-1 text-emerald-400 text-sm font-bold">
                                        <ShieldCheck size={14} /> Verified Account
                                    </div>
                                </div>
                            </div>

                            {/* Data Grid - Read Only */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Email */}
                                <div className="p-6 rounded-3xl bg-white/[0.03] border border-white/[0.08] hover:bg-white/[0.06] transition-all group/item">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="p-2.5 rounded-xl bg-indigo-600/20 text-indigo-400">
                                            <Mail size={20} />
                                        </div>
                                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Network ID</span>
                                    </div>
                                    <p className="text-lg font-bold text-white truncate">{typeof userData.email === 'string' ? userData.email : ''}</p>
                                </div>

                                {/* Mobile */}
                                <div className="p-6 rounded-3xl bg-white/[0.03] border border-white/[0.08] hover:bg-white/[0.06] transition-all group/item">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="p-2.5 rounded-xl bg-emerald-600/20 text-emerald-400">
                                            <Smartphone size={20} />
                                        </div>
                                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Contact Point</span>
                                    </div>
                                    <p className="text-lg font-bold text-white">{typeof userData.mobile === 'string' ? userData.mobile : 'Unlinked'}</p>
                                </div>

                                {/* Working Area */}
                                <div className="p-6 rounded-3xl bg-white/[0.03] border border-white/[0.08] hover:bg-white/[0.06] transition-all group/item">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="p-2.5 rounded-xl bg-purple-600/20 text-purple-400">
                                            <MapPin size={20} />
                                        </div>
                                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Base Location</span>
                                    </div>
                                    <p className="text-lg font-bold text-white">{typeof userData.jobLocation === 'string' ? userData.jobLocation : 'HQ Operations'}</p>
                                </div>

                                {/* User ID (System) */}
                                <div className="p-6 rounded-3xl bg-white/[0.03] border border-white/[0.08] hover:bg-white/[0.06] transition-all group/item opacity-60">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="p-2.5 rounded-xl bg-slate-600/20 text-slate-400">
                                            <Key size={20} />
                                        </div>
                                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">System Hash</span>
                                    </div>
                                    <p className="text-slate-500 font-mono text-[10px] truncate">{userData.id}</p>
                                </div>
                            </div>

                            {/* Restriction Notice */}
                            <div className="px-6 py-4 bg-amber-500/5 border border-amber-500/10 rounded-2xl flex items-start gap-4">
                                <ShieldAlert size={18} className="text-amber-500 mt-1 shrink-0" />
                                <p className="text-xs text-amber-200/60 font-medium leading-relaxed">
                                    Identity details (Name, Contact, Email) are managed by the Administration. To update these details, please submit a request to the Super Admin.
                                </p>
                            </div>

                            {/* Actions */}
                            <div className="pt-6 flex flex-wrap gap-4 justify-center lg:justify-start">
                                <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => setIsPasswordModalOpen(true)}
                                    className="px-8 py-4 bg-white text-slate-950 font-black rounded-2xl hover:bg-slate-100 transition-all shadow-2xl flex items-center gap-3 text-sm tracking-tight"
                                >
                                    <KeyRound size={20} />
                                    Update Password
                                </motion.button>
                                <motion.button
                                    whileHover={{ backgroundColor: "rgba(255,255,255,0.1)" }}
                                    className="px-8 py-4 bg-white/5 text-white font-black rounded-2xl border border-white/10 transition-all flex items-center gap-3 text-sm tracking-tight group"
                                >
                                    <LogOut size={20} className="group-hover:text-pink-400 transition-colors" />
                                    Terminate Session
                                </motion.button>
                            </div>
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* Virtual ID Card Section */}
            <div className="space-y-6">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-1 bg-[#ea580c] rounded-full" />
                    <h3 className="font-black text-xl text-slate-800 dark:text-slate-400 uppercase tracking-[0.3em] whitespace-nowrap">Virtual ID</h3>
                    <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
                </div>
                
                <div className="bg-slate-50 dark:bg-slate-900 rounded-3xl p-6 sm:p-10 border border-slate-200 dark:border-slate-800 flex items-center justify-center shadow-inner">
                    <EmployeeIDCard userData={userData} />
                </div>
            </div>

            {/* Permissions Infrastructure */}
            <div className="space-y-6">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-1 bg-purple-500/20 rounded-full" />
                    <h3 className="font-black text-xl text-slate-400 uppercase tracking-[0.3em] whitespace-nowrap">System Clearances</h3>
                    <div className="flex-1 h-px bg-slate-200" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                        { label: 'Rider Fleet', enabled: userData.permissions?.modules?.riders, icon: UserCog },
                        { label: 'Lead Pipeline', enabled: userData.permissions?.modules?.leads, icon: ArrowRight },
                        { label: 'Cloud Reports', enabled: userData.permissions?.modules?.reports, icon: Settings },
                        { label: 'Operations', enabled: userData.permissions?.modules?.requests, icon: KeyRound },
                    ].map((perm, idx) => (
                        <motion.div
                            key={idx}
                            whileHover={{ y: -4 }}
                            className={`p-6 rounded-3xl border-2 transition-all ${perm.enabled ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 border-slate-100 opacity-60 grayscale'}`}
                        >
                            <div className={`p-2.5 w-fit rounded-xl mb-4 ${perm.enabled ? 'bg-emerald-500/10 text-emerald-600' : 'bg-slate-200 text-slate-400'}`}>
                                <perm.icon size={20} />
                            </div>
                            <span className={`block font-black text-sm mb-1 ${perm.enabled ? 'text-emerald-950' : 'text-slate-400'}`}>{perm.label}</span>
                            <span className={`text-[10px] font-bold tracking-widest uppercase ${perm.enabled ? 'text-emerald-600' : 'text-slate-400'}`}>
                                {perm.enabled ? 'Level Active' : 'Restricted'}
                            </span>
                        </motion.div>
                    ))}
                </div>
            </div>

            {/* Password Modal */}
            <AnimatePresence>
                {isPasswordModalOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsPasswordModalOpen(false)}
                            className="absolute inset-0 bg-slate-950/80 backdrop-blur-xl"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className="relative w-full max-w-md bg-white rounded-[2.5rem] shadow-[0_32px_120px_rgba(0,0,0,0.5)] overflow-hidden"
                        >
                            <div className="p-8 md:p-10">
                                <div className="flex items-center justify-between mb-8">
                                    <div className="flex items-center gap-4">
                                        <div className="p-3 bg-purple-600 rounded-2xl text-white shadow-xl shadow-purple-500/30">
                                            <Lock size={24} />
                                        </div>
                                        <h2 className="text-2xl font-black text-slate-900 tracking-tight">Security</h2>
                                    </div>
                                    <button
                                        onClick={() => setIsPasswordModalOpen(false)}
                                        className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400"
                                    >
                                        <X size={20} />
                                    </button>
                                </div>

                                <div className="space-y-6">
                                    <p className="text-slate-500 text-sm font-medium leading-relaxed">
                                        Ensure your new password contains at least 8 characters. You will be required to re-authenticate if successful.
                                    </p>

                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">New Password</label>
                                            <div className="relative group">
                                                <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-purple-600 transition-colors" size={20} />
                                                <input
                                                    type="password"
                                                    value={passwordData.newPassword}
                                                    onChange={e => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                                                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-purple-500/10 focus:border-purple-500 outline-none transition-all font-bold text-slate-800"
                                                    placeholder="Minimum 8 characters"
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Confirm Identity</label>
                                            <div className="relative group">
                                                <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-purple-600 transition-colors" size={20} />
                                                <input
                                                    type="password"
                                                    value={passwordData.confirmPassword}
                                                    onChange={e => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                                                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-purple-500/10 focus:border-purple-500 outline-none transition-all font-bold text-slate-800"
                                                    placeholder="Repeat password"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-10 flex gap-3">
                                    <button
                                        onClick={() => setIsPasswordModalOpen(false)}
                                        className="flex-1 py-4 font-black text-slate-500 hover:text-slate-900 bg-slate-50 rounded-2xl transition-all"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleChangePassword}
                                        disabled={loading}
                                        className="flex-[1.5] py-4 bg-slate-950 text-white font-black rounded-2xl hover:bg-slate-900 shadow-2xl transition-all flex items-center justify-center gap-2"
                                    >
                                        {loading ? <Loader2 className="animate-spin" size={20} /> : <ArrowRight size={20} />}
                                        Update Key
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default Profile;

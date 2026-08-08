import React, { useState, useRef } from 'react';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { Mail, UserCog, Camera, Settings, MapPin, Loader2, Smartphone, Crown, Activity, Server, ShieldCheck, ShieldAlert, KeyRound, ArrowRight } from 'lucide-react';
import { supabase } from '@/config/supabase';
import { useToast } from '@/contexts/ToastContext';
import { logActivity } from '@/utils/activityLog';
import { motion, AnimatePresence } from 'framer-motion';

const Profile: React.FC = () => {
    const { userData } = useSupabaseAuth();
    const { success, error } = useToast();
    const [isEditing, setIsEditing] = useState(false);
    const [loading, setLoading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Edit State
    const [formData, setFormData] = useState({
        fullName: userData?.fullName || '',
        currentPassword: '',
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

            // 4. Log Activity
            await logActivity({
                actionType: 'profileUpdate',
                targetType: 'user',
                targetId: userData?.id || 'unknown',
                details: `Admin profile picture updated`,
                metadata: { field: 'avatar' }
            });

            success("Profile picture updated!");
            // Instead of reload, we could rely on auth context refresh if implemented, 
            // but reload is a safe fallback here for now.
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

    const handleUpdateProfile = async () => {
        try {
            setLoading(true);

            // Update Basic Info
            if (formData.fullName !== userData?.fullName) {
                const { error: updateError } = await supabase
                    .from('users')
                    .update({ full_name: formData.fullName })
                    .eq('id', userData?.id);
                if (updateError) throw updateError;

                await logActivity({
                    actionType: 'profileUpdate',
                    targetType: 'user',
                    targetId: userData?.id || 'unknown',
                    details: `Admin name updated to ${formData.fullName}`,
                    metadata: { field: 'fullName' }
                });

                success("Profile details updated");
            }

            // Update Password
            if (formData.newPassword) {
                if (formData.newPassword !== formData.confirmPassword) {
                    error("New passwords do not match");
                    return;
                }
                const { error: pwdError } = await supabase.auth.updateUser({
                    password: formData.newPassword
                });
                if (pwdError) throw pwdError;

                await logActivity({
                    actionType: 'securityUpdate',
                    targetType: 'user',
                    targetId: userData?.id || 'unknown',
                    details: `Admin password changed`,
                    metadata: { type: 'password_reset' }
                });

                success("Password updated successfully");
                setFormData(prev => ({ ...prev, currentPassword: '', newPassword: '', confirmPassword: '' }));
            }

            setIsEditing(false);
        } catch (err: any) {
            error(err.message || "Failed to update profile");
        } finally {
            setLoading(false);
        }
    };

    if (!userData) {
        return <div className="p-8 text-center flex items-center justify-center h-[70vh]"><Loader2 className="animate-spin text-indigo-500 h-10 w-10" /></div>;
    }

    return (
        <div className="max-w-6xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-8 duration-700 pb-20 px-4">

            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="space-y-1">
                    <h2 className="text-sm font-black text-indigo-500 uppercase tracking-[0.3em]">Management</h2>
                    <h1 className="text-5xl font-black tracking-tighter text-slate-900 flex items-center gap-4">
                        Master Profile
                        <span className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-xs font-black tracking-widest border border-indigo-100 flex items-center gap-1.5 h-fit mt-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" /> Live System
                        </span>
                    </h1>
                </div>
                <div className="flex items-center gap-3">
                    <div className="text-right hidden sm:block">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Last Access</p>
                        <p className="text-sm font-black text-slate-700">{new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                    </div>
                    <div className="p-3 bg-white border border-slate-200 rounded-2xl shadow-sm">
                        <ShieldCheck className="text-indigo-600" />
                    </div>
                </div>
            </div>

            {/* Premium Identity Card */}
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="relative rounded-[3rem] overflow-hidden shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] bg-slate-950 border border-white/5"
            >
                {/* Dynamic Background Effects */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-indigo-500/10 rounded-full blur-[120px] mix-blend-screen" />
                    <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-purple-500/10 rounded-full blur-[100px] mix-blend-screen" />
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-slate-950/50 to-slate-950" />
                    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                </div>

                <div className="relative z-10 p-10 md:p-14 lg:p-20">
                    <div className="flex flex-col lg:flex-row gap-16 items-start lg:items-center">

                        {/* 1. Identity Visual (Photo) */}
                        <div className="relative group/avatar shrink-0 mx-auto lg:mx-0">
                            <motion.div
                                whileHover={{ scale: 1.02 }}
                                className="w-60 h-60 md:w-72 md:h-72 rounded-[3rem] p-1.5 bg-gradient-to-br from-indigo-400 via-purple-500 to-indigo-600 shadow-2xl relative z-10 transition-shadow duration-500 hover:shadow-indigo-500/20"
                            >
                                <div className="w-full h-full rounded-[2.8rem] bg-slate-950 overflow-hidden relative border-8 border-slate-950 shadow-inner group-hover/avatar:border-slate-900 transition-colors">
                                    {userData.profilePicUrl ? (
                                        <img src={userData.profilePicUrl} alt="Profile" className="w-full h-full object-cover transition-transform duration-1000 group-hover/avatar:scale-110" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-slate-950 text-7xl font-black text-white/10">
                                            {typeof userData.fullName === 'string' ? userData.fullName.charAt(0).toUpperCase() : String(userData.fullName || 'A').charAt(0).toUpperCase()}
                                        </div>
                                    )}

                                    {/* Upload Overlay */}
                                    <label className="absolute inset-0 bg-slate-950/80 flex flex-col items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-all duration-300 cursor-pointer backdrop-blur-md">
                                        <div className="p-4 bg-white/10 rounded-full backdrop-blur-md border border-white/20 mb-3 hover:scale-110 transition-transform">
                                            <Camera className="text-white" size={32} />
                                        </div>
                                        <span className="text-white font-black text-xs tracking-[0.2em] uppercase">Update Avatar</span>
                                        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleAvatarUpload} />
                                    </label>
                                </div>
                            </motion.div>

                            {/* Verification Badge */}
                            <motion.div
                                initial={{ x: 20, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                transition={{ delay: 0.5 }}
                                className="absolute -bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-6 py-3 bg-white text-slate-950 rounded-2xl shadow-2xl border border-slate-100"
                            >
                                <div className="p-1 bg-indigo-600 rounded-full">
                                    <ShieldCheck size={14} className="text-white" />
                                </div>
                                <span className="text-[11px] font-black uppercase tracking-widest">Verified System Admin</span>
                            </motion.div>
                        </div>

                        {/* 2. Account Information */}
                        <div className="flex-1 w-full space-y-10">
                            <div className="text-center lg:text-left space-y-4">
                                <motion.div
                                    initial={{ y: 10, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    className="inline-flex items-center gap-2 px-4 py-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-full"
                                >
                                    <Crown size={12} className="text-indigo-400" />
                                    <span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em]">Primary Administrator</span>
                                </motion.div>
                                <h1 className="text-5xl md:text-7xl font-black text-white tracking-tighter leading-none">
                                    {typeof userData.fullName === 'string' ? userData.fullName : String(userData.fullName || 'Admin')}
                                </h1>
                                <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 pt-2">
                                    <p className="text-slate-400 font-bold text-xl">
                                        @{typeof userData.username === 'string' ? userData.username : 'root_admin'}
                                    </p>
                                    <div className="w-1.5 h-1.5 rounded-full bg-white/20 hidden sm:block" />
                                    <p className="text-indigo-400 font-medium px-3 py-1 bg-indigo-500/5 rounded-lg border border-indigo-500/10 text-sm">
                                        Access: Global (Read/Write)
                                    </p>
                                </div>
                            </div>

                            {/* Data Architecture Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Email */}
                                <div className="p-6 rounded-3xl bg-white/[0.03] border border-white/[0.08] hover:bg-white/[0.06] transition-all group/item hover:border-white/20">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2.5 rounded-xl bg-indigo-600/20 text-indigo-400">
                                                <Mail size={20} />
                                            </div>
                                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Primary Email</span>
                                        </div>
                                        <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500">
                                            <ShieldCheck size={14} />
                                        </div>
                                    </div>
                                    <p className="text-lg font-bold text-white truncate">{typeof userData.email === 'string' ? userData.email : ''}</p>
                                </div>

                                {/* Mobile */}
                                <div className="p-6 rounded-3xl bg-white/[0.03] border border-white/[0.08] hover:bg-white/[0.06] transition-all group/item hover:border-white/20">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2.5 rounded-xl bg-orange-600/20 text-orange-400">
                                                <Smartphone size={20} />
                                            </div>
                                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Global Contact</span>
                                        </div>
                                        <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-500">
                                            <Activity size={14} />
                                        </div>
                                    </div>
                                    <p className="text-lg font-bold text-white">{typeof userData.mobile === 'string' ? userData.mobile : 'Not Verified'}</p>
                                </div>

                                {/* Working Area */}
                                <div className="p-6 rounded-3xl bg-white/[0.03] border border-white/[0.08] hover:bg-white/[0.06] transition-all group/item hover:border-white/20">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="p-2.5 rounded-xl bg-purple-600/20 text-purple-400">
                                            <MapPin size={20} />
                                        </div>
                                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Deployment HQ</span>
                                    </div>
                                    <p className="text-lg font-bold text-white">{typeof userData.jobLocation === 'string' ? userData.jobLocation : 'Administrative HQ'}</p>
                                </div>

                                {/* Security Signature */}
                                <div className="p-6 rounded-3xl bg-white/[0.03] border border-white/[0.08] hover:bg-white/[0.06] transition-all group/item hover:border-white/20">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="p-2.5 rounded-xl bg-slate-600/20 text-slate-400">
                                            <Server size={20} />
                                        </div>
                                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Security ID</span>
                                    </div>
                                    <p className="text-slate-500 font-mono text-[10px] truncate break-all opacity-50">{userData.id}</p>
                                </div>
                            </div>

                            {/* Interaction Hub */}
                            <div className="pt-6 flex flex-wrap gap-4 justify-center lg:justify-start">
                                <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => setIsEditing(!isEditing)}
                                    className="px-10 py-4 bg-white text-slate-950 font-black rounded-2xl hover:bg-slate-100 transition-all shadow-2xl flex items-center gap-3 text-sm tracking-tight"
                                >
                                    <UserCog size={20} />
                                    {isEditing ? 'Discard Changes' : 'Manage Account'}
                                </motion.button>
                                <motion.button
                                    whileHover={{ backgroundColor: "rgba(255,255,255,0.1)" }}
                                    className="px-10 py-4 bg-white/5 text-white font-black rounded-2xl border border-white/10 transition-all flex items-center gap-3 text-sm tracking-tight group"
                                >
                                    <Activity size={20} className="group-hover:text-indigo-400 transition-colors" />
                                    Activity Registry
                                </motion.button>
                            </div>
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* Editing Infrastructure */}
            <AnimatePresence>
                {isEditing && (
                    <motion.div
                        initial={{ opacity: 0, y: 40 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 40 }}
                        className="bg-white border border-slate-200 shadow-[0_32px_80px_rgba(0,0,0,0.1)] rounded-[3rem] overflow-hidden"
                    >
                        <div className="px-10 py-8 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-indigo-600 rounded-2xl text-white shadow-xl shadow-indigo-500/30">
                                    <Settings size={24} />
                                </div>
                                <div>
                                    <h3 className="font-black text-2xl text-slate-900 leading-tight">Identity Update</h3>
                                    <p className="text-slate-500 text-sm font-medium">Modify administrative credentials and security</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 px-4 py-2 bg-indigo-50 border border-indigo-100 rounded-xl text-indigo-600 text-[10px] font-black tracking-widest uppercase h-fit">
                                <ShieldAlert size={14} /> Secure Tunnel
                            </div>
                        </div>

                        <div className="p-10 md:p-14 grid grid-cols-1 md:grid-cols-2 gap-10">
                            <div className="space-y-6">
                                <div className="space-y-3">
                                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest pl-1">Global Full Name</label>
                                    <div className="relative group">
                                        <UserCog className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors" size={20} />
                                        <input
                                            value={formData.fullName}
                                            onChange={e => setFormData({ ...formData, fullName: e.target.value })}
                                            className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-[1.25rem] focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-bold text-slate-800 placeholder:text-slate-400"
                                            placeholder="Enter full legal name"
                                        />
                                    </div>
                                </div>
                                <div className="p-6 bg-amber-50 rounded-2xl border border-amber-100 flex gap-4">
                                    <div className="p-2 bg-white rounded-lg text-amber-500 h-fit shadow-sm">
                                        <ShieldAlert size={18} />
                                    </div>
                                    <p className="text-xs text-amber-800 font-medium leading-relaxed">
                                        Name updates will be reflected across all generated reports and professional communication IDs globally.
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-6">
                                <div className="space-y-3">
                                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest pl-1 text-emerald-600">Secure Password Access</label>
                                    <div className="space-y-4">
                                        <div className="relative group">
                                            <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors" size={20} />
                                            <input
                                                type="password"
                                                placeholder="New Security Key"
                                                value={formData.newPassword}
                                                onChange={e => setFormData({ ...formData, newPassword: e.target.value })}
                                                className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-[1.25rem] focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-bold text-slate-800"
                                            />
                                        </div>
                                        <div className="relative group">
                                            <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors" size={20} />
                                            <input
                                                type="password"
                                                placeholder="Confirm Security Key"
                                                value={formData.confirmPassword}
                                                onChange={e => setFormData({ ...formData, confirmPassword: e.target.value })}
                                                className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-[1.25rem] focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-bold text-slate-800"
                                            />
                                        </div>
                                    </div>
                                </div>
                                <p className="px-4 py-3 bg-slate-50 text-[10px] text-slate-400 font-medium italic rounded-xl border border-dashed border-slate-200">
                                    Ensure your new password contains at least 8 characters with alphanumeric variety for maximum registry security.
                                </p>
                            </div>
                        </div>

                        <div className="p-8 md:p-10 bg-slate-50 flex flex-col sm:flex-row justify-end gap-4 border-t border-slate-100">
                            <button
                                onClick={() => setIsEditing(false)}
                                className="px-8 py-4 font-black text-slate-500 hover:text-slate-900 hover:bg-slate-200/50 rounded-2xl transition-all text-sm tracking-tight"
                            >
                                Discard Changes
                            </button>
                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={handleUpdateProfile}
                                disabled={loading}
                                className="px-12 py-4 bg-indigo-600 text-white font-black rounded-2xl hover:bg-indigo-700 shadow-2xl shadow-indigo-500/40 transition-all flex items-center justify-center gap-3 text-sm tracking-tight"
                            >
                                {loading ? <Loader2 className="animate-spin" size={20} /> : <ArrowRight size={20} />}
                                Commit Updates
                            </motion.button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default Profile;

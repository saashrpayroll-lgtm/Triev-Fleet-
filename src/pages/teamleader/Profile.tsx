import React, { useState, useRef } from 'react';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { Mail, Shield, UserCog, Camera, Save, LogOut, Settings, Key, MapPin, Loader2, Smartphone } from 'lucide-react';
import { supabase } from '@/config/supabase';
import { logActivity } from '@/utils/activityLog';
import { useToast } from '@/contexts/ToastContext';

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
            console.log('Starting avatar upload...', { fileName, filePath });

            // 1. Upload
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, file, {
                    cacheControl: '3600',
                    upsert: true
                });

            if (uploadError) {
                console.error('Supabase Storage Upload Error:', uploadError);
                throw uploadError;
            }
            console.log('Upload successful:', uploadData);

            // 2. Get Public URL
            const { data: { publicUrl } } = supabase.storage
                .from('avatars')
                .getPublicUrl(filePath);

            console.log('Public URL generated:', publicUrl);

            // 3. Update User Record
            const { error: updateError } = await supabase
                .from('users')
                .update({ profile_pic_url: publicUrl })
                .eq('id', userData?.id);

            if (updateError) {
                console.error('Supabase User Update Error:', updateError);
                throw updateError;
            }

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
            error(err.message || "Failed to upload avatar");
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
                    details: `Profile details (Name) updated to ${formData.fullName}`,
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
                    details: `Password changed by user`,
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
        return <div className="p-8 text-center flex items-center justify-center h-full"><Loader2 className="animate-spin text-primary" /></div>;
    }

    return (
        <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
            {/* Hero Header */}
            <div className="relative rounded-3xl overflow-hidden shadow-2xl bg-slate-900 border border-slate-800">
                {/* Background Pattern */}
                <div className="absolute inset-0 opacity-20">
                    <div className="absolute inset-0 bg-[radial-gradient(#ec4899_1px,transparent_1px)] [background-size:16px_16px]" />
                </div>
                <div className="absolute inset-0 bg-gradient-to-r from-slate-900 via-slate-900/90 to-purple-900/50" />

                <div className="relative z-10 p-8 md:p-12 flex flex-col md:flex-row items-center md:items-start gap-8">
                    {/* Avatar Group */}
                    <div className="relative group">
                        <div className="w-32 h-32 md:w-40 md:h-40 rounded-full p-1 bg-gradient-to-br from-pink-500 via-purple-500 to-indigo-500 shadow-2xl relative z-10">
                            <div className="w-full h-full rounded-full bg-slate-950 overflow-hidden relative">
                                {userData.profilePicUrl ? (
                                    <img src={userData.profilePicUrl} alt="Profile" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-slate-900 text-4xl font-bold text-pink-400">
                                        {typeof userData.fullName === 'string' ? userData.fullName.charAt(0).toUpperCase() : 'L'}
                                    </div>
                                )}

                                {/* Upload Overlay */}
                                <label className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 cursor-pointer backdrop-blur-sm">
                                    <Camera className="text-white mb-2 scale-75 group-hover:scale-100 transition-transform" />
                                    <span className="text-white text-xs font-bold uppercase tracking-wider">Update Photo</span>
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        className="hidden"
                                        accept="image/*"
                                        onChange={handleAvatarUpload}
                                    />
                                </label>
                            </div>
                        </div>
                        {/* Online Status Indicator */}
                        <div className="absolute bottom-2 right-2 md:bottom-3 md:right-3 w-6 h-6 bg-emerald-500 border-4 border-slate-900 rounded-full z-20 shadow-lg animate-pulse" />
                        {loading && <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-30 rounded-full backdrop-blur-sm"><Loader2 className="animate-spin text-white w-8 h-8" /></div>}
                    </div>

                    {/* User Info */}
                    <div className="text-center md:text-left flex-1 space-y-3">
                        <div className="flex flex-col md:flex-row items-center gap-3">
                            <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">{typeof userData.fullName === 'string' ? userData.fullName : 'Leader'}</h1>
                            <span className="px-3 py-1 bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded-full text-xs font-bold uppercase tracking-wide shadow-[0_0_10px_rgba(168,85,247,0.2)]">
                                Team Leader
                            </span>
                        </div>

                        <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-slate-400 text-sm">
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/50 rounded-lg border border-slate-700/50">
                                <Shield size={14} className="text-emerald-400" />
                                <span className="font-mono">{userData.userId || 'ID: UNKNOWN'}</span>
                            </div>
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/50 rounded-lg border border-slate-700/50">
                                <Mail size={14} className="text-blue-400" />
                                <span>{userData.email}</span>
                            </div>
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/50 rounded-lg border border-slate-700/50">
                                <Smartphone size={14} className="text-purple-400" />
                                <span>{userData.mobile}</span>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="pt-4 flex items-center justify-center md:justify-start gap-3">
                            <button
                                onClick={() => setIsEditing(!isEditing)}
                                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-lg ${isEditing
                                    ? 'bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20'
                                    : 'bg-purple-600 text-white hover:bg-purple-700 hover:shadow-purple-500/25'}`}
                            >
                                {isEditing ? <><LogOut size={16} /> Cancel Editing</> : <><UserCog size={16} /> Edit Profile</>}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

                {/* Left: Permissions & Stats */}
                <div className="space-y-6">
                    {/* Access & Permissions - Corrected Keys */}
                    <div className="bg-card border border-border shadow-sm rounded-2xl p-6 overflow-hidden relative">
                        <h3 className="font-bold text-lg flex items-center gap-2 text-foreground mb-4">
                            <Shield className="text-blue-500" size={20} /> Access Permissions
                        </h3>
                        <div className="space-y-3">
                            {[
                                { label: 'Rider Management', enabled: userData.permissions?.modules?.riders },
                                { label: 'Lead Management', enabled: userData.permissions?.modules?.leads },
                                { label: 'View Reports', enabled: userData.permissions?.modules?.reports },
                                { label: 'Request Management', enabled: userData.permissions?.modules?.requests },
                                { label: 'Notifications', enabled: userData.permissions?.modules?.notifications },
                            ].map((perm, idx) => (
                                <div key={idx} className="flex items-center justify-between p-3 bg-muted/30 rounded-xl border border-border/50">
                                    <span className="text-sm font-medium flex items-center gap-2">
                                        {perm.label}
                                    </span>
                                    {perm.enabled ? (
                                        <span className="text-[10px] font-bold px-2 py-1 bg-green-500/10 text-green-600 rounded-md border border-green-500/20">
                                            GRANTED
                                        </span>
                                    ) : (
                                        <span className="text-[10px] font-bold px-2 py-1 bg-red-500/10 text-red-600 rounded-md border border-red-500/20">
                                            DENIED
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Center & Right: Edit Forms */}
                <div className="xl:col-span-2 space-y-6">

                    {/* Editable Info Card */}
                    <div className="bg-card border border-border shadow-sm rounded-2xl overflow-hidden">
                        <div className="px-6 py-4 border-b border-border bg-muted/20 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-purple-500/10 rounded-lg text-purple-600"><Settings size={18} /></div>
                                <h3 className="font-semibold text-lg">General Settings</h3>
                            </div>
                            {isEditing && <span className="text-xs text-orange-500 font-medium animate-pulse">Edit Mode Active</span>}
                        </div>

                        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                                    Full Name
                                </label>
                                {isEditing ? (
                                    <input
                                        value={formData.fullName}
                                        onChange={e => setFormData({ ...formData, fullName: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-background border border-input rounded-xl focus:ring-2 focus:ring-purple-500/20 active:border-purple-500 outline-none transition-all font-medium"
                                    />
                                ) : (
                                    <div className="px-4 py-2.5 bg-muted/30 rounded-xl border border-border/50 font-medium text-foreground">
                                        {typeof userData.fullName === 'string' ? userData.fullName : 'Leader'}
                                    </div>
                                )}
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                                    Reporting Manager
                                </label>
                                <div className="px-4 py-2.5 bg-muted/30 rounded-xl border border-border/50 text-muted-foreground cursor-not-allowed">
                                    {userData.reportingManager || 'System Admin'}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                                    Job Location
                                </label>
                                <div className="px-4 py-2.5 bg-muted/30 rounded-xl border border-border/50 text-muted-foreground cursor-not-allowed flex items-center gap-2">
                                    <MapPin size={14} /> {userData.jobLocation || 'Remote HQ'}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Authentication & Security (Only Visible in Edit Mode) */}
                    {isEditing && (
                        <div className="bg-red-50/50 border border-red-200 shadow-lg rounded-2xl overflow-hidden animate-in fade-in slide-in-from-top-4 duration-500">
                            <div className="px-6 py-4 border-b border-red-200 bg-red-100/50 flex items-center gap-3">
                                <div className="p-2 bg-red-500 text-white rounded-lg shadow-red-500/20 shadow-lg"><Key size={18} /></div>
                                <div>
                                    <h3 className="font-bold text-lg text-red-900">Security & Password</h3>
                                    <p className="text-xs text-red-700">Update your access credentials securely.</p>
                                </div>
                            </div>

                            <div className="p-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-red-800 uppercase tracking-wide">New Password</label>
                                        <input
                                            type="password"
                                            value={formData.newPassword}
                                            onChange={e => setFormData({ ...formData, newPassword: e.target.value })}
                                            className="w-full px-4 py-2.5 bg-white border border-red-200 rounded-xl focus:ring-4 focus:ring-red-500/10 outline-none transition-all placeholder:text-red-300"
                                            placeholder="Enter new password"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-red-800 uppercase tracking-wide">Confirm Password</label>
                                        <input
                                            type="password"
                                            value={formData.confirmPassword}
                                            onChange={e => setFormData({ ...formData, confirmPassword: e.target.value })}
                                            className="w-full px-4 py-2.5 bg-white border border-red-200 rounded-xl focus:ring-4 focus:ring-red-500/10 outline-none transition-all placeholder:text-red-300"
                                            placeholder="Re-enter password"
                                        />
                                    </div>
                                </div>

                                <div className="mt-8 flex justify-end items-center gap-4 border-t border-red-200 pt-6">
                                    <button
                                        onClick={() => setIsEditing(false)}
                                        className="px-6 py-2.5 text-red-600 hover:bg-red-100/50 rounded-xl font-medium transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleUpdateProfile}
                                        disabled={loading}
                                        className="flex items-center gap-2 px-8 py-2.5 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-500/30 disabled:opacity-70"
                                    >
                                        {loading ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                                        Save Changes
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Profile;

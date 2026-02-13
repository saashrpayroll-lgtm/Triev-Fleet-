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
            // console.log('Starting avatar upload...', { fileName, filePath });

            // 1. Upload
            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, file, {
                    cacheControl: '3600',
                    upsert: true
                });

            if (uploadError) {
                console.error('Supabase Storage Upload Error:', uploadError);
                throw uploadError;
            }
            // console.log('Upload successful:', uploadData);

            // 2. Get Public URL
            const { data: { publicUrl } } = supabase.storage
                .from('avatars')
                .getPublicUrl(filePath);

            // console.log('Public URL generated:', publicUrl);

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
            <div className="relative rounded-[2.5rem] overflow-hidden shadow-2xl bg-zinc-950 border border-white/10 group">
                {/* Dynamic Background */}
                <div className="absolute inset-0">
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/40 via-purple-900/20 to-black" />
                    <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-500/20 rounded-full blur-[120px] mix-blend-screen pointer-events-none" />
                    <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-purple-500/10 rounded-full blur-[100px] mix-blend-screen pointer-events-none" />
                </div>

                <div className="relative z-10 p-10 md:p-14">
                    <div className="flex flex-col md:flex-row gap-12 items-start">

                        {/* 1. Identity Visual (Photo) */}
                        <div className="relative group/avatar shrink-0 mx-auto md:mx-0">
                            <div className="w-48 h-48 rounded-[2rem] p-1 bg-gradient-to-br from-purple-500 via-pink-500 to-amber-500 shadow-2xl relative z-10 rotate-3 transition-transform duration-500 group-hover/avatar:rotate-0">
                                <div className="w-full h-full rounded-[1.8rem] bg-zinc-950 overflow-hidden relative border-4 border-zinc-900 shadow-inner">
                                    {userData.profilePicUrl ? (
                                        <img src={userData.profilePicUrl} alt="Profile" className="w-full h-full object-cover transition-transform duration-700 group-hover/avatar:scale-110" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-zinc-950 text-5xl font-black text-purple-500">
                                            {typeof userData.fullName === 'string' ? userData.fullName.charAt(0).toUpperCase() : String(userData.fullName || 'L').charAt(0).toUpperCase()}
                                        </div>
                                    )}

                                    {/* Upload Overlay */}
                                    <label className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-all duration-300 cursor-pointer backdrop-blur-sm">
                                        <div className="p-3 bg-white/10 rounded-full backdrop-blur-md border border-white/20 mb-2 hover:scale-110 transition-transform">
                                            <Camera className="text-white" size={24} />
                                        </div>
                                        <span className="text-white font-bold text-xs tracking-widest uppercase">Update Photo</span>
                                        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleAvatarUpload} />
                                    </label>
                                </div>
                            </div>

                            {/* Role Badge */}
                            <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 z-20 whitespace-nowrap">
                                <span className="px-5 py-2 bg-gradient-to-r from-purple-500 to-pink-600 text-white text-[11px] font-black uppercase tracking-widest rounded-xl shadow-xl shadow-purple-900/40 border border-purple-400/30 flex items-center gap-2">
                                    <Shield size={14} fill="currentColor" /> Team Leader
                                </span>
                            </div>
                        </div>

                        {/* 2. Account Holder Info */}
                        <div className="flex-1 w-full space-y-8">
                            <div className="text-center md:text-left space-y-2">
                                <p className="text-purple-400 font-bold tracking-widest text-xs uppercase mb-1 flex items-center justify-center md:justify-start gap-2">
                                    <span className="w-8 h-[2px] bg-purple-500/50 rounded-full" />
                                    Profile Details
                                </p>
                                <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight">
                                    {typeof userData.fullName === 'string' ? userData.fullName : String(userData.fullName || 'Leader')}
                                </h1>
                                <p className="text-zinc-400 font-medium text-lg flex items-center justify-center md:justify-start gap-2">
                                    @{typeof userData.username === 'string' ? userData.username : (typeof userData.email === 'string' ? userData.email.split('@')[0] : 'user')}
                                    <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 text-xs font-mono border border-zinc-700">Verified</span>
                                </p>
                            </div>

                            {/* Data Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Email */}
                                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors group/item">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-400 group-hover/item:text-indigo-300 transition-colors">
                                            <Mail size={18} />
                                        </div>
                                        <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Email Address</span>
                                    </div>
                                    <p className="text-white font-semibold pl-12 truncate">{typeof userData.email === 'string' ? userData.email : String(userData.email || '')}</p>
                                </div>

                                {/* Mobile */}
                                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors group/item">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 group-hover/item:text-emerald-300 transition-colors">
                                            <Smartphone size={18} />
                                        </div>
                                        <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Mobile Number</span>
                                    </div>
                                    <p className="text-white font-semibold pl-12">{typeof userData.mobile === 'string' ? userData.mobile : String(userData.mobile || 'Not Linked')}</p>
                                </div>

                                {/* Working Area */}
                                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors group/item">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="p-2 rounded-lg bg-purple-500/20 text-purple-400 group-hover/item:text-purple-300 transition-colors">
                                            <MapPin size={18} />
                                        </div>
                                        <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Working Area</span>
                                    </div>
                                    <p className="text-white font-semibold pl-12">{typeof userData.jobLocation === 'string' ? userData.jobLocation : String(userData.jobLocation || 'Headquarters (HQ)')}</p>
                                </div>

                                {/* User ID (System) */}
                                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors group/item">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="p-2 rounded-lg bg-zinc-500/20 text-zinc-400 group-hover/item:text-zinc-300 transition-colors">
                                            <Key size={18} />
                                        </div>
                                        <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">System ID</span>
                                    </div>
                                    <p className="text-zinc-400 font-mono text-xs pl-12 mt-1 truncate">{userData.id}</p>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="pt-4 flex flex-wrap gap-4 justify-center md:justify-start">
                                <button
                                    onClick={() => setIsEditing(!isEditing)}
                                    className="px-8 py-3 bg-white text-black font-bold rounded-xl hover:bg-zinc-200 transition-colors shadow-lg shadow-white/10 flex items-center gap-2"
                                >
                                    <UserCog size={18} />
                                    {isEditing ? 'Cancel Editing' : 'Edit Profile'}
                                </button>
                                <button className="px-8 py-3 bg-white/5 text-white font-bold rounded-xl hover:bg-white/10 transition-colors border border-white/10 flex items-center gap-2">
                                    <LogOut size={18} />
                                    Sign Out
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Edit Form Section - Overlaid or Below */}
            {isEditing && (
                <div className="bg-white border border-zinc-200 shadow-xl rounded-3xl overflow-hidden animate-in slide-in-from-bottom duration-500">
                    <div className="px-8 py-6 border-b border-zinc-100 bg-zinc-50/50 flex items-center gap-3">
                        <div className="p-2 bg-purple-600 rounded-lg text-white shadow-lg shadow-purple-500/20">
                            <Settings size={20} />
                        </div>
                        <h3 className="font-bold text-xl text-zinc-900">Update Information</h3>
                    </div>

                    <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-4">
                            <label className="block text-sm font-bold text-zinc-700">Full Name</label>
                            <input
                                value={formData.fullName}
                                onChange={e => setFormData({ ...formData, fullName: e.target.value })}
                                className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition-all font-medium"
                            />
                        </div>
                        <div className="space-y-4">
                            <label className="block text-sm font-bold text-zinc-700">Change Password</label>
                            <input
                                type="password"
                                placeholder="New Password"
                                value={formData.newPassword}
                                onChange={e => setFormData({ ...formData, newPassword: e.target.value })}
                                className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition-all font-medium"
                            />
                        </div>
                        <div className="space-y-4">
                            <label className="block text-sm font-bold text-zinc-700">Confirm Password</label>
                            <input
                                type="password"
                                placeholder="Confirm New Password"
                                value={formData.confirmPassword}
                                onChange={e => setFormData({ ...formData, confirmPassword: e.target.value })}
                                className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition-all font-medium"
                            />
                        </div>
                    </div>

                    <div className="p-6 bg-zinc-50 flex justify-end gap-3 border-t border-zinc-100">
                        <button onClick={() => setIsEditing(false)} className="px-6 py-2.5 font-bold text-zinc-500 hover:text-zinc-700 hover:bg-zinc-200/50 rounded-xl transition-colors">Discard</button>
                        <button
                            onClick={handleUpdateProfile}
                            disabled={loading}
                            className="px-8 py-2.5 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 shadow-lg shadow-purple-500/30 transition-all flex items-center gap-2"
                        >
                            {loading ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                            Save Changes
                        </button>
                    </div>
                </div>
            )}

            {/* Permissions Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'Rider Management', enabled: userData.permissions?.modules?.riders },
                    { label: 'Lead Management', enabled: userData.permissions?.modules?.leads },
                    { label: 'View Reports', enabled: userData.permissions?.modules?.reports },
                    { label: 'Request Management', enabled: userData.permissions?.modules?.requests },
                ].map((perm, idx) => (
                    <div key={idx} className={`p-4 rounded-xl border ${perm.enabled ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-red-500/5 border-red-500/20'} flex items-center justify-between`}>
                        <span className="font-medium text-sm text-zinc-700">{perm.label}</span>
                        {perm.enabled ? (
                            <span className="text-[10px] font-bold px-2 py-1 bg-emerald-500/10 text-emerald-600 rounded-md">GRANTED</span>
                        ) : (
                            <span className="text-[10px] font-bold px-2 py-1 bg-red-500/10 text-red-600 rounded-md">DENIED</span>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default Profile;

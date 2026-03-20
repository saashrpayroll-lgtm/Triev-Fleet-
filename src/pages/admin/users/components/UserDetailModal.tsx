import React from 'react';
import { User } from '@/types';
import { X, MapPin, Mail, Phone, Calendar, Shield, Briefcase, KeyRound, Clock, Hash, UserCheck, Activity } from 'lucide-react';

interface UserDetailModalProps {
    user: User | null;
    onClose: () => void;
}

const UserDetailModal: React.FC<UserDetailModalProps> = ({ user, onClose }) => {
    if (!user) return null;

    const getRoleColor = () => {
        switch (user.role) {
            case 'admin': return 'from-purple-600 via-purple-500 to-indigo-600';
            case 'teamLeader': return 'from-blue-600 via-blue-500 to-cyan-600';
            case 'reportingManager': return 'from-teal-600 via-teal-500 to-emerald-600';
            default: return 'from-slate-600 to-slate-700';
        }
    };

    const getRoleBadge = () => {
        switch (user.role) {
            case 'admin': return { label: 'Administrator', bg: 'bg-purple-500/20 text-purple-300 border-purple-400/30' };
            case 'teamLeader': return { label: 'Team Leader', bg: 'bg-blue-500/20 text-blue-300 border-blue-400/30' };
            case 'reportingManager': return { label: 'Reporting Manager', bg: 'bg-teal-500/20 text-teal-300 border-teal-400/30' };
            default: return { label: user.role, bg: 'bg-slate-500/20 text-slate-300 border-slate-400/30' };
        }
    };

    const getStatusConfig = () => {
        switch (user.status) {
            case 'active': return { dot: 'bg-emerald-400', text: 'Active', bg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' };
            case 'inactive': return { dot: 'bg-gray-400', text: 'Inactive', bg: 'bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20' };
            case 'suspended': return { dot: 'bg-rose-400', text: 'Suspended', bg: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20' };
            default: return { dot: 'bg-gray-400', text: user.status, bg: 'bg-gray-500/10 text-gray-600 border-gray-500/20' };
        }
    };

    const role = getRoleBadge();
    const status = getStatusConfig();

    const InfoItem = ({ icon: Icon, label, value, mono }: { icon: any; label: string; value: string; mono?: boolean }) => (
        <div className="flex items-start gap-3 py-2.5">
            <div className="p-1.5 bg-muted/50 rounded-lg flex-shrink-0 mt-0.5">
                <Icon size={14} className="text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
                <p className={`text-sm font-medium mt-0.5 break-all ${mono ? 'font-mono text-xs' : ''}`}>{value || 'N/A'}</p>
            </div>
        </div>
    );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-card w-full max-w-2xl rounded-2xl shadow-2xl border border-border overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300">
                {/* ── HEADER ── */}
                <div className={`relative h-36 bg-gradient-to-br ${getRoleColor()}`}>
                    {/* Decorative blobs */}
                    <div className="absolute top-0 right-0 w-[200px] h-[200px] bg-white/10 rounded-full blur-[60px] -translate-y-1/2 translate-x-1/4 pointer-events-none" />
                    <div className="absolute bottom-0 left-0 w-[120px] h-[120px] bg-black/10 rounded-full blur-[40px] translate-y-1/3 pointer-events-none" />

                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 bg-black/20 hover:bg-black/40 text-white rounded-xl transition-colors z-10"
                    >
                        <X size={18} />
                    </button>

                    {/* Role Badge */}
                    <div className="absolute top-4 left-6 z-10">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${role.bg}`}>
                            <Shield size={10} /> {role.label}
                        </span>
                    </div>

                    {/* Avatar */}
                    <div className="absolute -bottom-10 left-6">
                        <div className="w-20 h-20 rounded-2xl border-4 border-card bg-background flex items-center justify-center text-2xl font-black text-primary shadow-xl overflow-hidden">
                            {user.profilePicUrl ? (
                                <img src={user.profilePicUrl} alt={user.fullName} className="w-full h-full object-cover" />
                            ) : (
                                <span className="bg-gradient-to-br from-primary/20 to-primary/5 w-full h-full flex items-center justify-center text-primary">
                                    {user.fullName.charAt(0).toUpperCase()}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* ── BODY ── */}
                <div className="pt-14 pb-6 px-6 overflow-y-auto custom-scrollbar">
                    <div className="space-y-5">
                        {/* Name & Status */}
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <h2 className="text-xl font-black">{user.fullName}</h2>
                                {user.userId && (
                                    <p className="text-xs text-muted-foreground font-mono mt-0.5">ID: {user.userId}</p>
                                )}
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase border ${status.bg}`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${status.dot} ${user.status === 'active' ? 'animate-pulse' : ''}`} />
                                    {status.text}
                                </span>
                                {(user as any).force_password_change && (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                        <KeyRound size={10} /> Password Reset
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* INFO GRID */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Contact Info */}
                            <div className="bg-muted/20 rounded-xl border border-border/50 p-4">
                                <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
                                    <Activity size={12} /> Contact Info
                                </h3>
                                <div className="divide-y divide-border/30">
                                    <InfoItem icon={Mail} label="Email" value={user.email} mono />
                                    <InfoItem icon={Phone} label="Mobile" value={user.mobile || 'N/A'} />
                                </div>
                            </div>

                            {/* Account Details */}
                            <div className="bg-muted/20 rounded-xl border border-border/50 p-4">
                                <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
                                    <Briefcase size={12} /> Account Details
                                </h3>
                                <div className="divide-y divide-border/30">
                                    <InfoItem icon={Hash} label="Username" value={user.username} mono />
                                    <InfoItem icon={MapPin} label="Job Location" value={user.jobLocation || 'Remote'} />
                                </div>
                            </div>
                        </div>

                        {/* Professional Row */}
                        <div className="bg-muted/20 rounded-xl border border-border/50 p-4">
                            <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
                                <UserCheck size={12} /> Professional Details
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border/30">
                                <div className="pr-4 pb-2 md:pb-0">
                                    <InfoItem icon={Briefcase} label="Position" value={(user as any).position || 'N/A'} />
                                </div>
                                <div className="px-0 md:px-4 py-2 md:py-0">
                                    <InfoItem icon={Shield} label="Reporting Manager" value={user.reportingManager || 'N/A'} />
                                </div>
                                <div className="pl-0 md:pl-4 pt-2 md:pt-0">
                                    <InfoItem icon={Shield} label="Role" value={role.label} />
                                </div>
                            </div>
                        </div>

                        {/* Timeline */}
                        <div className="bg-muted/20 rounded-xl border border-border/50 p-4">
                            <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
                                <Calendar size={12} /> Timeline
                            </h3>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                <div>
                                    <p className="text-[10px] font-bold uppercase text-muted-foreground">Joined On</p>
                                    <p className="text-sm font-medium mt-0.5">
                                        {user.createdAt ? new Date(user.createdAt).toLocaleDateString('en-IN', {
                                            year: 'numeric', month: 'short', day: 'numeric'
                                        }) : 'N/A'}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold uppercase text-muted-foreground">Last Updated</p>
                                    <p className="text-sm font-medium mt-0.5">
                                        {user.updatedAt ? new Date(user.updatedAt).toLocaleDateString('en-IN', {
                                            year: 'numeric', month: 'short', day: 'numeric'
                                        }) : 'N/A'}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold uppercase text-muted-foreground">Last Password Change</p>
                                    <p className="text-sm font-medium mt-0.5">
                                        {(user as any).last_password_change ? new Date((user as any).last_password_change).toLocaleDateString('en-IN', {
                                            year: 'numeric', month: 'short', day: 'numeric'
                                        }) : 'Never'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Remarks */}
                        {(user as any).remarks && (
                            <div className="bg-muted/20 rounded-xl border border-border/50 p-4">
                                <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">Remarks</h3>
                                <p className="text-sm text-muted-foreground leading-relaxed">{(user as any).remarks}</p>
                            </div>
                        )}

                        {/* Suspension Info */}
                        {user.status === 'suspended' && (
                            <div className="bg-rose-50 dark:bg-rose-950/20 rounded-xl border border-rose-200 dark:border-rose-800/30 p-4">
                                <h3 className="text-[10px] font-black uppercase tracking-widest text-rose-600 dark:text-rose-400 mb-2 flex items-center gap-1.5">
                                    <Clock size={12} /> Suspension Details
                                </h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-[10px] font-bold uppercase text-rose-500">Suspended Until</p>
                                        <p className="text-sm font-medium mt-0.5 text-rose-700 dark:text-rose-300">
                                            {user.suspendedUntil ? new Date(user.suspendedUntil).toLocaleString('en-IN') : 'Indefinitely'}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold uppercase text-rose-500">Reason</p>
                                        <p className="text-sm font-medium mt-0.5 text-rose-700 dark:text-rose-300">
                                            {(user as any).suspendedReason || 'No reason provided'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default UserDetailModal;

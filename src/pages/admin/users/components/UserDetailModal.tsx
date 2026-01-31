import React from 'react';
import { User } from '@/types';
import { X, MapPin, Mail, Phone, Calendar, Shield, Activity, Briefcase } from 'lucide-react';

interface UserDetailModalProps {
    user: User | null;
    onClose: () => void;
}

const UserDetailModal: React.FC<UserDetailModalProps> = ({ user, onClose }) => {
    if (!user) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-card w-full max-w-2xl rounded-2xl shadow-2xl border border-border overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
                {/* Header with Cover-like effect */}
                <div className="relative h-32 bg-gradient-to-r from-blue-600 to-indigo-600">
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 bg-black/20 hover:bg-black/40 text-white rounded-full transition-colors"
                    >
                        <X size={20} />
                    </button>
                    <div className="absolute -bottom-12 left-8">
                        <div className="w-24 h-24 rounded-full border-4 border-card bg-background flex items-center justify-center text-3xl font-bold text-primary shadow-lg overflow-hidden">
                            {user.profilePicUrl ? (
                                <img src={user.profilePicUrl} alt={user.fullName} className="w-full h-full object-cover" />
                            ) : (
                                <span className="bg-gradient-to-br from-primary/20 to-primary/10 w-full h-full flex items-center justify-center text-primary">
                                    {user.fullName.charAt(0)}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Body */}
                <div className="pt-16 pb-8 px-8 overflow-y-auto custom-scrollbar">
                    <div className="space-y-6">
                        {/* Name & Role */}
                        <div>
                            <h2 className="text-2xl font-bold">{user.fullName}</h2>
                            <div className="flex items-center gap-2 text-muted-foreground mt-1">
                                <span className="flex items-center gap-1 bg-primary/10 text-primary px-2 py-0.5 rounded text-sm font-medium">
                                    <Shield size={14} /> {user.role}
                                </span>
                                <span>•</span>
                                <span className="flex items-center gap-1">
                                    <MapPin size={14} /> {user.jobLocation || 'Remote'}
                                </span>
                            </div>
                        </div>

                        {/* Grid Details */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="p-4 bg-muted/30 rounded-xl border border-border space-y-3">
                                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                                    <Activity size={16} /> Contact Info
                                </h3>
                                <div className="space-y-2">
                                    <div className="flex items-center gap-3 text-sm">
                                        <Mail size={16} className="text-muted-foreground" />
                                        <span className="font-medium">{user.email}</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-sm">
                                        <Phone size={16} className="text-muted-foreground" />
                                        <span className="font-medium">{user.mobile || 'N/A'}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="p-4 bg-muted/30 rounded-xl border border-border space-y-3">
                                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                                    <Briefcase size={16} /> Account Details
                                </h3>
                                <div className="space-y-2">
                                    <div className="flex items-center gap-3 text-sm">
                                        <span className="text-muted-foreground w-24">Username:</span>
                                        <span className="font-medium font-mono bg-muted px-1.5 py-0.5 rounded">{user.username}</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-sm">
                                        <span className="text-muted-foreground w-24">Status:</span>
                                        <span className={`font-medium px-2 py-0.5 rounded-full text-xs ${user.status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
                                            user.status === 'suspended' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' :
                                                'bg-gray-100 text-gray-700'
                                            }`}>
                                            {user.status.toUpperCase()}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3 text-sm">
                                        <span className="text-muted-foreground w-24">Reporter:</span>
                                        <span className="font-medium">{user.reportingManager || 'N/A'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Additional Metadata */}
                        <div className="p-4 bg-muted/30 rounded-xl border border-border space-y-3">
                            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                                <Calendar size={16} /> Timeline
                            </h3>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <div className="text-muted-foreground text-xs">Joined On</div>
                                    <div className="font-medium mt-0.5">
                                        {user.createdAt ? new Date(user.createdAt).toLocaleDateString(undefined, {
                                            year: 'numeric', month: 'long', day: 'numeric'
                                        }) : 'N/A'}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-muted-foreground text-xs">Last Updated</div>
                                    <div className="font-medium mt-0.5">
                                        {user.updatedAt ? new Date(user.updatedAt).toLocaleDateString(undefined, {
                                            year: 'numeric', month: 'long', day: 'numeric'
                                        }) : 'N/A'}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default UserDetailModal;

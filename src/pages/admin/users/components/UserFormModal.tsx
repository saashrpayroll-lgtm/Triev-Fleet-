import React, { useState, useEffect } from 'react';
import { X, UserCheck, Wand, Eye, EyeOff, Lock, User, Briefcase, Plus, Bot, Hash, RefreshCcw } from 'lucide-react';
import { User as UserType, UserRole } from '@/types';
import { validateEmail, validatePasswordStrength } from '@/utils/validationUtils';
import { AIService } from '@/services/AIService';

interface UserFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: any) => Promise<void>;
    onGenerateId: (role: string) => Promise<string>;
    initialData?: UserType | null;
    isSubmitting: boolean;
}

const UserFormModal: React.FC<UserFormModalProps> = ({
    isOpen, onClose, onSubmit, onGenerateId, initialData, isSubmitting
}) => {
    useEffect(() => {
        if (isOpen) console.error("UserFormModal: MOUNTED/OPENED", initialData ? "EDIT Mode" : "CREATE Mode");
    }, [isOpen]);

    const isEditMode = !!initialData;

    // Form State
    const [formData, setFormData] = useState({
        // Section 1: ID & Role
        role: 'teamLeader' as UserRole,
        userId: '',

        // Section 2: Personal
        fullName: '',
        mobile: '',
        email: '',

        // Section 3: Professional
        position: '',
        jobLocation: '',
        reportingManager: '',

        // Section 4: Credentials
        username: '',
        password: '',
        confirmPassword: '',

        // Section 5: Remarks
        remarks: ''
    });

    const [showPassword, setShowPassword] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isGeneratingRemark, setIsGeneratingRemark] = useState(false);
    const [idLoading, setIdLoading] = useState(false);

    // Initialize & Reset
    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                setFormData({
                    role: initialData.role,
                    userId: initialData.userId || '',
                    fullName: initialData.fullName,
                    mobile: initialData.mobile,
                    email: initialData.email,
                    position: (initialData as any).position || '', // Handle potential missing type
                    jobLocation: initialData.jobLocation || '',
                    reportingManager: initialData.reportingManager || '',
                    username: initialData.username || '',
                    password: '',
                    confirmPassword: '',
                    remarks: initialData.remarks || ''
                });
            } else {
                // Reset for Create
                setFormData({
                    role: 'teamLeader',
                    userId: 'Loading...',
                    fullName: '',
                    mobile: '',
                    email: '',
                    position: '',
                    jobLocation: '',
                    reportingManager: '',
                    username: '',
                    password: '',
                    confirmPassword: '',
                    remarks: ''
                });
                // Fetch initial ID
                handleRoleChange('teamLeader');
            }
            setErrors({});
        }
    }, [isOpen, initialData]);

    const handleRoleChange = async (newRole: UserRole) => {
        setIdLoading(true);
        // Optimistic Set
        setFormData(prev => ({ ...prev, role: newRole, userId: 'Generating...' }));

        try {
            const newId = await onGenerateId(newRole);
            setFormData(prev => ({ ...prev, role: newRole, userId: newId }));
        } catch (e) {
            setFormData(prev => ({ ...prev, role: newRole, userId: 'Error' }));
        } finally {
            setIdLoading(false);
        }
    };

    const generateAIUsername = () => {
        if (!formData.fullName) {
            setErrors(prev => ({ ...prev, username: "Enter Full Name first to generate" }));
            return;
        }
        const namePart = formData.fullName.replace(/\s+/g, '').toLowerCase().slice(0, 6);
        const randomNum = Math.floor(Math.random() * 9999);
        setFormData(prev => ({ ...prev, username: `${namePart}${randomNum}` }));
        setErrors(prev => ({ ...prev, username: "" }));
    };

    const generateAIPassword = () => {
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%";
        let pass = "";
        for (let i = 0; i < 12; i++) {
            pass += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        setFormData(prev => ({ ...prev, password: pass, confirmPassword: pass }));
    };
    const handleAIEnhanceRemark = async () => {
        if (!formData.remarks) return;
        setIsGeneratingRemark(true);
        try {
            const enhanced = await AIService.enhanceRemarks(formData.remarks);
            setFormData(prev => ({ ...prev, remarks: enhanced }));
        } catch (e) {
            console.error(e);
        } finally {
            setIsGeneratingRemark(false);
        }
    };


    const validate = () => {
        const newErrors: Record<string, string> = {};

        if (!formData.fullName.trim()) newErrors.fullName = "Full Name is required";
        if (!formData.mobile.trim() || formData.mobile.length < 10) newErrors.mobile = "Valid mobile required";
        if (!isEditMode && !validateEmail(formData.email)) newErrors.email = "Invalid email";

        if (!isEditMode) {
            if (!formData.username.trim()) newErrors.username = "Username required";
            if (!formData.password) {
                newErrors.password = "Password required";
            } else if (!validatePasswordStrength(formData.password)) {
                newErrors.password = "Weak password (min 8 chars, mixed case, numbers)";
            }
            if (formData.password !== formData.confirmPassword) newErrors.password = "Passwords do not match";
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async () => {
        if (!validate()) return;
        await onSubmit(formData);
    };

    if (!isOpen) return null;

    const inputClasses = "w-full px-4 py-2 bg-background border border-input rounded-lg focus:ring-2 focus:ring-primary/20 outline-none transition-all";
    const labelClasses = "text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block";

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-card w-full max-w-3xl rounded-2xl shadow-2xl border border-border overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="px-6 py-4 border-b border-border bg-gradient-to-r from-muted/50 to-muted/20 flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            {isEditMode ? <UserCheck className="text-primary" /> : <Plus className="text-primary" />}
                            {isEditMode ? 'Edit User Profile' : 'Create New User'}
                        </h2>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            {isEditMode ? 'Update user details.' : 'Complete all 5 sections to onboard.'}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-muted/80 rounded-full transition-colors"><X size={20} /></button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-8">

                    {/* Section 1: User ID & Role */}
                    <div className="p-5 bg-primary/5 rounded-xl border border-primary/10 space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="bg-primary text-primary-foreground w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold">1</span>
                            <h3 className="font-bold text-foreground">Role & Identity</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div>
                                <label className={labelClasses}>Select Role</label>
                                <select
                                    value={formData.role}
                                    onChange={(e) => handleRoleChange(e.target.value as UserRole)}
                                    className={inputClasses}
                                    disabled={isEditMode}
                                >
                                    <option value="teamLeader">Team Leader</option>
                                    <option value="admin">Admin</option>
                                </select>
                            </div>
                            <div>
                                <label className={labelClasses}>User ID (Auto-Generated)</label>
                                <div className="relative">
                                    <input
                                        value={formData.userId}
                                        readOnly
                                        className={`${inputClasses} bg-muted/50 font-mono text-primary font-bold`}
                                    />
                                    {idLoading && <RefreshCcw size={16} className="absolute right-3 top-2.5 animate-spin text-primary" />}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Section 2: Basic Details */}
                    <div>
                        <div className="flex items-center gap-2 mb-4 border-b border-border pb-2">
                            <span className="bg-muted text-muted-foreground w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold">2</span>
                            <div className="flex items-center gap-2">
                                <User size={18} className="text-muted-foreground" />
                                <h3 className="font-semibold text-foreground">Basic Details</h3>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div className="md:col-span-2">
                                <label className={labelClasses}>Full Name <span className="text-red-500">*</span></label>
                                <input
                                    value={formData.fullName}
                                    onChange={e => setFormData({ ...formData, fullName: e.target.value })}
                                    className={`${inputClasses} ${errors.fullName ? 'border-red-500' : ''}`}
                                    placeholder="Enter full name"
                                />
                                {errors.fullName && <p className="text-red-500 text-xs mt-1">{errors.fullName}</p>}
                            </div>
                            <div>
                                <label className={labelClasses}>Mobile Number <span className="text-red-500">*</span></label>
                                <div className="flex border border-input rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-primary/20">
                                    <span className="bg-muted px-3 py-2 text-sm font-medium text-muted-foreground border-r border-border flex items-center">+91</span>
                                    <input
                                        value={formData.mobile}
                                        onChange={e => setFormData({ ...formData, mobile: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                                        className="w-full px-4 py-2 bg-background outline-none"
                                        placeholder="98765 00000"
                                    />
                                </div>
                                {errors.mobile && <p className="text-red-500 text-xs mt-1">{errors.mobile}</p>}
                            </div>
                            <div>
                                <label className={labelClasses}>Email Address <span className="text-red-500">*</span></label>
                                <input
                                    value={formData.email}
                                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                                    disabled={isEditMode}
                                    className={`${inputClasses} ${isEditMode ? 'opacity-60' : ''} ${errors.email ? 'border-red-500' : ''}`}
                                    placeholder="name@company.com"
                                />
                                {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
                            </div>
                        </div>
                    </div>

                    {/* Section 3: Professional Details */}
                    <div>
                        <div className="flex items-center gap-2 mb-4 border-b border-border pb-2">
                            <span className="bg-muted text-muted-foreground w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold">3</span>
                            <div className="flex items-center gap-2">
                                <Briefcase size={18} className="text-muted-foreground" />
                                <h3 className="font-semibold text-foreground">Professional Details</h3>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                            <div>
                                <label className={labelClasses}>Position / Designation</label>
                                <input
                                    value={formData.position}
                                    onChange={e => setFormData({ ...formData, position: e.target.value })}
                                    className={inputClasses}
                                    placeholder="e.g. Senior Manager"
                                />
                            </div>
                            <div>
                                <label className={labelClasses}>Job Location</label>
                                <input
                                    value={formData.jobLocation}
                                    onChange={e => setFormData({ ...formData, jobLocation: e.target.value })}
                                    className={inputClasses}
                                    placeholder="City, Branch"
                                />
                            </div>
                            <div>
                                <label className={labelClasses}>Reporting Manager</label>
                                <input
                                    value={formData.reportingManager}
                                    onChange={e => setFormData({ ...formData, reportingManager: e.target.value })}
                                    className={inputClasses}
                                    placeholder="Manager Name"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Section 4: Credentials */}
                    {!isEditMode && (
                        <div>
                            <div className="flex items-center gap-2 mb-4 border-b border-border pb-2">
                                <span className="bg-muted text-muted-foreground w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold">4</span>
                                <div className="flex items-center gap-2">
                                    <Lock size={18} className="text-muted-foreground" />
                                    <h3 className="font-semibold text-foreground">Security Credentials</h3>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div>
                                    <div className="flex justify-between">
                                        <label className={labelClasses}>Username <span className="text-red-500">*</span></label>
                                        <button onClick={generateAIUsername} className="text-[10px] text-primary flex items-center gap-1 hover:underline">
                                            <Bot size={12} /> AI Generate
                                        </button>
                                    </div>
                                    <input
                                        value={formData.username}
                                        onChange={e => setFormData({ ...formData, username: e.target.value })}
                                        className={`${inputClasses} ${errors.username ? 'border-red-500' : ''}`}
                                        placeholder="username"
                                    />
                                    {errors.username && <p className="text-red-500 text-xs mt-1">{errors.username}</p>}
                                </div>
                                <div>
                                    <div className="flex justify-between">
                                        <label className={labelClasses}>Password <span className="text-red-500">*</span></label>
                                        <button onClick={generateAIPassword} className="text-[10px] text-primary flex items-center gap-1 hover:underline">
                                            <Hash size={12} /> Auto-Create
                                        </button>
                                    </div>
                                    <div className="relative">
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            value={formData.password}
                                            onChange={e => setFormData({ ...formData, password: e.target.value })}
                                            className={`${inputClasses} pr-10 ${errors.password ? 'border-red-500' : ''}`}
                                            placeholder="••••••••"
                                        />
                                        <button onClick={() => setShowPassword(!showPassword)} type="button" className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground">
                                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    </div>
                                    {/* Confirm Password */}
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        value={formData.confirmPassword}
                                        onChange={e => setFormData({ ...formData, confirmPassword: e.target.value })}
                                        className={`${inputClasses} mt-2 ${errors.password ? 'border-red-500' : ''}`}
                                        placeholder="Confirm Password"
                                    />
                                    {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Section 5: Remarks */}
                    <div>
                        <div className="flex items-center gap-2 mb-2 border-b border-border pb-2">
                            <span className="bg-muted text-muted-foreground w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold">5</span>
                            <div className="flex-1 flex justify-between items-center">
                                <h3 className="font-semibold text-foreground">Remarks</h3>
                                <button
                                    onClick={handleAIEnhanceRemark}
                                    disabled={!formData.remarks || isGeneratingRemark}
                                    className="text-xs flex items-center gap-1.5 text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded hover:bg-indigo-100 transition-colors disabled:opacity-50"
                                >
                                    <Wand size={12} className={isGeneratingRemark ? "animate-spin" : ""} />
                                    {isGeneratingRemark ? "Enhancing..." : "AI Enhance"}
                                </button>
                            </div>
                        </div>
                        <textarea
                            value={formData.remarks}
                            onChange={e => setFormData({ ...formData, remarks: e.target.value })}
                            className={`${inputClasses} min-h-[80px]`}
                            placeholder="Add notes about user role or access..."
                        />
                    </div>

                </div>

                {/* Footer */}
                <div className="bg-muted/30 border-t border-border px-6 py-4 flex items-center justify-end gap-3">
                    <button onClick={onClose} className="px-5 py-2.5 border border-input rounded-xl hover:bg-accent transition-colors font-medium text-sm" disabled={isSubmitting}>Cancel</button>
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting || idLoading}
                        className="px-8 py-2.5 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-all font-medium text-sm flex items-center gap-2 shadow-lg disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {isSubmitting ? "Creating..." : (isEditMode ? "Update User" : "Create User")}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default UserFormModal;

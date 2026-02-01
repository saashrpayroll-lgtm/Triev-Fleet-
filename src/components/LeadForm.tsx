import React, { useState, useEffect } from 'react';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/config/supabase';
import { Lead, LeadCategory, LeadSource, LicenseType, EVTypeInterest } from '@/types';
import { Loader2, MapPin, CheckCircle, AlertTriangle, XCircle, Calculator, Send, User, Smartphone, Building2, Calendar, FileText, Save, BatteryCharging, Briefcase } from 'lucide-react';
import { validatePhoneNumber } from '@/utils/validationUtils';
import { logActivity } from '@/utils/activityLog';
import { mapLeadToDB } from '@/utils/leadUtils';

interface LeadFormProps {
    onSuccess: () => void;
    onCancel: () => void;
    initialData?: Lead; // Optional for Edit Mode
}

const LeadForm: React.FC<LeadFormProps> = ({ onSuccess, onCancel, initialData }) => {
    const { userData } = useSupabaseAuth();
    const [loading, setLoading] = useState(false);
    const [statusData, setStatusData] = useState<{ message: string; type: 'info' | 'error' | 'success' } | null>(null);

    // Form State initialization
    const [formData, setFormData] = useState({
        riderName: initialData?.riderName || '',
        mobileNumber: initialData?.mobileNumber || '+91',
        city: initialData?.city || userData?.jobLocation || '',
        drivingLicense: initialData?.drivingLicense || 'Permanent' as LicenseType,
        evTypeInterested: initialData?.evTypeInterested || 'High Speed' as EVTypeInterest,
        clientInterested: initialData?.clientInterested || 'Zomato',
        expectedAllotmentDate: initialData?.expectedAllotmentDate ? new Date(initialData.expectedAllotmentDate).toISOString().split('T')[0] : '',
        currentEvUsing: initialData?.currentEvUsing || 'None',
        source: initialData?.source || 'Field Sourcing' as LeadSource,
        remarks: initialData?.remarks || ''
    });

    // Location State
    const [location, setLocation] = useState<{ lat: number; lng: number; accuracy: number; timestamp: number } | null>(
        initialData ? { ...initialData.location, timestamp: Date.now() } : null
    );
    const [locationError, setLocationError] = useState<string | null>(null);

    // Validation & category
    const [leadCategory, setLeadCategory] = useState<LeadCategory | null>(initialData?.category || null);
    const [mobileError, setMobileError] = useState<string | null>(null);
    const [isCheckingMobile, setIsCheckingMobile] = useState(false);

    useEffect(() => {
        captureLocation();
        const locationInterval = setInterval(captureLocation, 5000); // Less frequent updates for performance
        return () => clearInterval(locationInterval);
    }, []);

    const captureLocation = () => {
        if (!navigator.geolocation) {
            setLocationError("Geolocation is not supported.");
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                setLocation({
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                    accuracy: position.coords.accuracy,
                    timestamp: position.timestamp
                });
                setLocationError(null);
            },
            (error) => {
                if (!location) {
                    // Only show error if we don't have a location yet
                    setLocationError(error.message || "Location access denied.");
                }
            },
            { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
        );
    };

    const handleMobileBlur = async (): Promise<LeadCategory | null> => {
        const phone = formData.mobileNumber;
        if (!validatePhoneNumber(phone)) {
            setMobileError("Invalid format. Use +91XXXXXXXXXX");
            setLeadCategory(null);
            return null;
        }
        setMobileError(null);

        // If editing and number hasn't changed, keep existing category
        if (initialData && phone === initialData.mobileNumber) {
            return initialData.category;
        }

        setIsCheckingMobile(true);

        try {
            // 1. Check in Leads (Duplicate)
            const { data: leadsData } = await supabase
                .from('leads')
                .select('id')
                .eq('mobile_number', phone) // Verified column: mobile_number
                .limit(10);

            // Check self exclusion
            const duplicates = (leadsData || []).filter(d => initialData ? d.id !== initialData.id : true);

            if (duplicates.length > 0) {
                setLeadCategory('Duplicate');
                return 'Duplicate';
            }

            // 2. Check in Riders (Match)
            // Use 'mobile_number' as verified column name
            const { data: ridersData } = await supabase
                .from('riders')
                .select('id')
                .eq('mobile_number', phone)
                .limit(1);

            if (ridersData && ridersData.length > 0) {
                setLeadCategory('Match');
                return 'Match';
            }

            // 3. Genuine
            setLeadCategory('Genuine');
            return 'Genuine';
        } catch (error) {
            console.error("Error checking mobile:", error);
            // Default to Genuine on error to unblock
            setLeadCategory('Genuine');
            return 'Genuine';
        } finally {
            setIsCheckingMobile(false);
        }
    };

    const getCategoryBadge = () => {
        if (isCheckingMobile) return <span className="text-xs animate-pulse text-muted-foreground ml-2">Verifying...</span>;
        if (!leadCategory) return null;

        const styles = {
            'Genuine': 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
            'Match': 'bg-blue-500/10 text-blue-500 border-blue-500/20',
            'Duplicate': 'bg-red-500/10 text-red-500 border-red-500/20'
        };

        const icons = {
            'Genuine': <CheckCircle size={12} />,
            'Match': <AlertTriangle size={12} />,
            'Duplicate': <XCircle size={12} />
        };

        return (
            <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider ${styles[leadCategory]} ml-2`}>
                {icons[leadCategory]}
                {leadCategory}
            </div>
        );
    };

    const generateNextLeadId = async () => {
        try {
            const { data } = await supabase
                .from('leads')
                .select('lead_id')
                .order('lead_id', { ascending: false })
                .limit(1);

            if (!data || data.length === 0) return 10001;
            return (data[0].lead_id || 10000) + 1;
        } catch (e) {
            return 10000 + Math.floor(Math.random() * 9000);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setStatusData(null);

        if (!location) {
            setStatusData({ message: "Waiting for GPS Location...", type: 'error' });
            captureLocation();
            return;
        }

        if (!validatePhoneNumber(formData.mobileNumber)) {
            setMobileError("Invalid mobile number");
            return;
        }

        let finalCategory = leadCategory;
        if (!finalCategory) {
            finalCategory = await handleMobileBlur();
        }

        setLoading(true);
        setStatusData({ message: "Saving details...", type: 'info' });

        try {
            // Prepare Data in App Format (CamelCase)
            const leadData: Partial<Lead> = {
                riderName: formData.riderName,
                mobileNumber: formData.mobileNumber,
                city: formData.city,
                location: {
                    lat: Number(location.lat),
                    lng: Number(location.lng),
                    accuracy: Number(location.accuracy),
                    timestamp: new Date().toISOString()
                },
                drivingLicense: formData.drivingLicense,
                evTypeInterested: formData.evTypeInterested,
                clientInterested: formData.clientInterested,
                expectedAllotmentDate: formData.expectedAllotmentDate ? new Date(formData.expectedAllotmentDate).toISOString() : undefined,
                currentEvUsing: formData.currentEvUsing,
                source: formData.source,
                remarks: formData.remarks || "",
                category: finalCategory || 'Genuine',
                updatedAt: new Date().toISOString()
            };

            // Calculate AI Score if creating new or if critical fields changed
            let aiScore = initialData?.score;
            if (!aiScore || !initialData) {
                try {
                    // Only rescore if specific fields relevant to scoring are present
                    // We pass the raw formData for scoring
                    aiScore = await import('@/services/AIService').then(m => m.AIService.scoreLead(leadData));
                } catch (err) {
                    console.error("Scoring failed, using default", err);
                    aiScore = 50;
                }
            }

            const dbPayload = mapLeadToDB(initialData ? leadData : {
                ...leadData,
                leadId: await generateNextLeadId(), // Will be overridden if mapLeadToDB logic allows, but here we pass raw first
                status: 'New',
                createdBy: userData?.id || null,
                createdByName: userData?.fullName || 'Unknown',
                createdAt: new Date().toISOString(),
                score: aiScore // Attach Score
            });

            // Ensure ID is set for Insert
            // REMOVED: Do not manually force lead_id if the schema doesn't support it.
            // if (!initialData && !dbPayload.lead_id) {
            //    dbPayload.lead_id = await generateNextLeadId();
            // }

            if (initialData) {
                // UPDATE
                const { error } = await supabase.from('leads').update(dbPayload).eq('id', initialData.id);
                if (error) throw error;
                setStatusData({ message: "Lead Updated!", type: 'success' });
            } else {
                // INSERT
                const { error } = await supabase.from('leads').insert(dbPayload);
                if (error) throw error;

                setStatusData({ message: "Lead Created Successfully!", type: 'success' });

                // Async Log
                logActivity({
                    actionType: 'leadCreated',
                    targetType: 'lead',
                    targetId: String(dbPayload.lead_id),
                    details: `New Lead ${dbPayload.lead_id} captured by ${userData?.fullName}`,
                    metadata: { mobile: formData.mobileNumber }
                }).catch(console.error);
            }

            setTimeout(() => {
                onSuccess();
            }, 800);

        } catch (error: any) {
            console.error("Error saving lead:", error);
            setStatusData({ message: error.message || "Failed to save lead", type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const inputClasses = "w-full px-4 py-3 bg-background/40 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all duration-300 hover:bg-background/60 backdrop-blur-sm text-sm font-medium placeholder:text-muted-foreground/50 shadow-sm inner-shadow-sm";
    const labelClasses = "block text-xs font-bold uppercase tracking-wider mb-2 text-foreground/70 ml-1";
    const iconClasses = "absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 group-hover:text-primary transition-colors duration-300";

    return (
        <div className="flex flex-col h-full max-h-[85vh] w-full max-w-2xl mx-auto bg-card/30 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl relative overflow-hidden animate-in fade-in zoom-in-95 duration-300">
            {/* Vibrant Gradients */}
            <div className="absolute -top-20 -right-20 w-64 h-64 bg-primary/20 rounded-full blur-[100px] pointer-events-none" />
            <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-blue-500/20 rounded-full blur-[100px] pointer-events-none" />

            {/* Header */}
            <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between bg-white/5 backdrop-blur-md sticky top-0 z-20">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-gradient-to-br from-primary/20 to-primary/5 rounded-xl border border-primary/10 shadow-inner">
                        {initialData ? <Save className="text-primary" size={20} /> : <Calculator className="text-primary" size={20} />}
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-foreground tracking-tight">
                            {initialData ? `Edit Lead #${initialData.leadId}` : 'New Lead Capture'}
                        </h2>
                        <p className="text-xs text-muted-foreground">Fill in the details below</p>
                    </div>
                </div>
                {statusData && (
                    <div className={`px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-2 animate-in slide-in-from-right-5 fade-in ${statusData.type === 'error' ? 'bg-red-500/10 text-red-500 border border-red-500/20' :
                        statusData.type === 'success' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' :
                            'bg-blue-500/10 text-blue-500 border border-blue-500/20'
                        }`}>
                        {statusData.type === 'info' && <Loader2 className="animate-spin" size={12} />}
                        {statusData.message}
                    </div>
                )}
            </div>

            {/* Scrollable Form Area */}
            <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
                <form id="lead-form" onSubmit={handleSubmit} className="space-y-6">

                    {/* Location Status (Compact) */}
                    <div className={`rounded-xl p-3 flex items-center gap-3 border transition-colors duration-500 ${location ? 'bg-emerald-500/5 border-emerald-500/10' : 'bg-yellow-500/5 border-yellow-500/10'
                        }`}>
                        <div className={`p-2 rounded-full ${location ? 'bg-emerald-500/10 text-emerald-500' : 'bg-yellow-500/10 text-yellow-500 animate-pulse'}`}>
                            <MapPin size={16} />
                        </div>
                        <div className="flex-1">
                            <p className="text-xs font-bold text-foreground/80 flex items-center justify-between">
                                {location ? "GPS Location Locked" : "Acquiring GPS..."}
                                {location && <span className="text-[10px] bg-emerald-500/10 text-emerald-500 px-1.5 py-0.5 rounded">±{Math.round(location.accuracy)}m</span>}
                            </p>
                            {location && <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{location.lat.toFixed(6)}, {location.lng.toFixed(6)}</p>}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {/* Rider Name */}
                        <div className="group">
                            <label className={labelClasses}>Rider Full Name</label>
                            <div className="relative">
                                <User className={iconClasses} size={18} />
                                <input
                                    required
                                    type="text"
                                    value={formData.riderName}
                                    onChange={e => setFormData({ ...formData, riderName: e.target.value })}
                                    className={`${inputClasses} pl-10`}
                                    placeholder="Enter name"
                                />
                            </div>
                        </div>

                        {/* Mobile Number */}
                        <div className="group">
                            <label className={labelClasses}>
                                <div className="flex items-center justify-between">
                                    <span>Mobile Number</span>
                                    {getCategoryBadge()}
                                </div>
                            </label>
                            <div className="relative">
                                <Smartphone className={iconClasses} size={18} />
                                <input
                                    required
                                    type="tel"
                                    value={formData.mobileNumber}
                                    onChange={e => setFormData({ ...formData, mobileNumber: e.target.value })}
                                    onBlur={handleMobileBlur}
                                    className={`${inputClasses} pl-10 ${mobileError ? 'border-red-500/50 focus:border-red-500' : ''}`}
                                    placeholder="+91"
                                />
                            </div>
                            {mobileError && <p className="text-[10px] text-red-500 mt-1 font-medium ml-1">{mobileError}</p>}
                        </div>

                        {/* City */}
                        <div className="group">
                            <label className={labelClasses}>City / Location</label>
                            <div className="relative">
                                <Building2 className={iconClasses} size={18} />
                                <input
                                    required
                                    type="text"
                                    value={formData.city}
                                    onChange={e => setFormData({ ...formData, city: e.target.value })}
                                    className={`${inputClasses} pl-10`}
                                    placeholder="City"
                                />
                            </div>
                        </div>

                        {/* Source */}
                        <div className="group">
                            <label className={labelClasses}>Lead Source</label>
                            <select
                                value={formData.source}
                                onChange={e => setFormData({ ...formData, source: e.target.value as LeadSource })}
                                className={inputClasses}
                            >
                                <option value="Field Sourcing">Field Sourcing</option>
                                <option value="Walking">Walking</option>
                                <option value="Calling">Calling</option>
                                <option value="Referral">Referral</option>
                                <option value="Online">Online</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>

                        {/* EV Type Interest */}
                        <div className="group">
                            <label className={labelClasses}>Interested EV Type</label>
                            <div className="relative">
                                <BatteryCharging className={iconClasses} size={18} />
                                <select
                                    value={formData.evTypeInterested}
                                    onChange={e => setFormData({ ...formData, evTypeInterested: e.target.value as EVTypeInterest })}
                                    className={`${inputClasses} pl-10 appearance-none`}
                                >
                                    <option value="High Speed">High Speed</option>
                                    <option value="Low Speed">Low Speed</option>
                                </select>
                            </div>
                        </div>

                        {/* Client Interest */}
                        <div className="group">
                            <label className={labelClasses}>Preferred Client</label>
                            <div className="relative">
                                <Briefcase className={iconClasses} size={18} />
                                <select
                                    value={formData.clientInterested}
                                    onChange={e => setFormData({ ...formData, clientInterested: e.target.value })}
                                    className={`${inputClasses} pl-10 appearance-none`}
                                >
                                    <option value="Zomato">Zomato</option>
                                    <option value="Swiggy">Swiggy</option>
                                    <option value="Zepto">Zepto</option>
                                    <option value="Blinkit">Blinkit</option>
                                    <option value="Uber">Uber</option>
                                    <option value="ola">Ola</option>
                                    <option value="Rapido">Rapido</option>
                                    <option value="Porter">Porter</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>
                        </div>

                        {/* Expected Allotment Date */}
                        <div className="group">
                            <label className={labelClasses}>Expected Allotment</label>
                            <div className="relative">
                                <Calendar className={iconClasses} size={18} />
                                <input
                                    type="date"
                                    value={formData.expectedAllotmentDate}
                                    onChange={e => setFormData({ ...formData, expectedAllotmentDate: e.target.value })}
                                    className={`${inputClasses} pl-10`}
                                />
                            </div>
                        </div>

                        {/* Current EV (Visual Only - Saved to Remarks) */}
                        <div className="group">
                            <label className={labelClasses}>Current EV (If any)</label>
                            <input
                                type="text"
                                value={formData.currentEvUsing}
                                onChange={e => setFormData({ ...formData, currentEvUsing: e.target.value })}
                                className={inputClasses}
                                placeholder="e.g. Yulu, Zypp"
                            />
                        </div>

                        {/* Driving License */}
                        <div className="group">
                            <label className={labelClasses}>Driving License</label>
                            <select
                                value={formData.drivingLicense}
                                onChange={e => setFormData({ ...formData, drivingLicense: e.target.value as LicenseType })}
                                className={inputClasses}
                            >
                                <option value="Permanent">Permanent</option>
                                <option value="Learning">Learning</option>
                                <option value="No">No License</option>
                            </select>
                        </div>
                    </div>

                    {/* Remarks Area */}
                    <div className="group">
                        <label className={labelClasses}>Additional Remarks</label>
                        <div className="relative">
                            <FileText className="absolute left-3 top-4 text-muted-foreground/60 group-hover:text-primary transition-colors" size={18} />
                            <textarea
                                value={formData.remarks}
                                onChange={e => setFormData({ ...formData, remarks: e.target.value })}
                                className={`${inputClasses} pl-10 min-h-[80px] resize-none`}
                                placeholder="Add any notes here..."
                            />
                        </div>
                    </div>
                </form>
            </div>

            {/* Footer */}
            <div className="p-6 pt-4 border-t border-white/5 bg-white/5 backdrop-blur-md flex gap-4">
                <button
                    type="button"
                    onClick={onCancel}
                    className="flex-1 py-3 rounded-xl border border-white/10 text-muted-foreground hover:bg-white/5 hover:text-foreground font-semibold text-sm transition-all duration-300"
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    form="lead-form"
                    disabled={loading || !location || !!locationError || !!mobileError}
                    className="flex-[2] py-3 rounded-xl bg-gradient-to-r from-primary to-blue-600 hover:from-primary/90 hover:to-blue-600/90 text-white font-bold text-sm shadow-lg shadow-primary/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transform active:scale-[0.98] transition-all duration-300"
                >
                    {loading ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
                    {loading ? 'Processing...' : (initialData ? 'Update Lead' : 'Submit Application')}
                </button>
            </div>
        </div>
    );
};

export default LeadForm;

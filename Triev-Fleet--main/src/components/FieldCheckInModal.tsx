import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MapPin, CheckCircle2, ShieldCheck, Navigation, Loader2 } from 'lucide-react';
import { Rider } from '@/types';
import { logActivity } from '@/utils/activityLog';
import { toast } from 'sonner';

interface FieldCheckInModalProps {
    isOpen: boolean;
    onClose: () => void;
    rider: Rider | null;
    currentUserId?: string;
    currentUserEmail?: string;
}

export const FieldCheckInModal: React.FC<FieldCheckInModalProps> = ({
    isOpen,
    onClose,
    rider,
    currentUserEmail
}) => {
    const [visitType, setVisitType] = useState<'allotment_handover' | 'routine_check' | 'recovery_visit' | 'battery_inspection'>('routine_check');
    const [chassisStatus, setChassisStatus] = useState<'OK' | 'Minor Damage' | 'Maintenance Required'>('OK');
    const [remarks, setRemarks] = useState('');
    const [location, setLocation] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
    const [gettingLocation, setGettingLocation] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    if (!isOpen || !rider) return null;

    const handleGetLocation = () => {
        if (!navigator.geolocation) {
            toast.error('Geolocation is not supported by your browser.');
            return;
        }
        setGettingLocation(true);
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setLocation({
                    lat: pos.coords.latitude,
                    lng: pos.coords.longitude,
                    accuracy: Math.round(pos.coords.accuracy)
                });
                setGettingLocation(false);
                toast.success('GPS Location Captured!');
            },
            (err) => {
                console.error('GPS error:', err);
                toast.error('Unable to fetch GPS location: ' + err.message);
                setGettingLocation(false);
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    };

    const handleSubmitCheckIn = async () => {
        setSubmitting(true);
        try {
            // Insert into activity_logs / field_checkins
            await logActivity({
                actionType: 'riderEdited',
                targetType: 'rider',
                targetId: rider.id,
                details: `Field Check-In (${visitType.replace('_', ' ')}): ${chassisStatus} chassis condition logged for ${rider.riderName}`,
                performedBy: currentUserEmail || 'Team Leader',
                metadata: {
                    visit_type: visitType,
                    chassis_status: chassisStatus,
                    remarks,
                    location: location ? `${location.lat},${location.lng}` : undefined,
                    rider_mobile: rider.mobileNumber,
                    rider_chassis: rider.chassisNumber
                }
            });

            toast.success(`Field Inspection logged for ${rider.riderName}!`);
            onClose();
        } catch (error: any) {
            console.error('Checkin error:', error);
            toast.error('Failed to log check-in');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    className="w-full max-w-lg bg-card border border-border/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col"
                >
                    {/* Header */}
                    <div className="p-6 bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center">
                                <ShieldCheck className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h2 className="text-xl font-extrabold tracking-tight">Field Inspection & Check-in</h2>
                                <p className="text-xs text-white/80">Log GPS location & vehicle chassis audit</p>
                            </div>
                        </div>

                        <button onClick={onClose} className="p-2 rounded-full hover:bg-white/20 text-white/80 hover:text-white transition-colors">
                            <X size={20} />
                        </button>
                    </div>

                    <div className="p-6 space-y-5">
                        {/* Rider Badge */}
                        <div className="p-3.5 rounded-2xl bg-muted/30 border border-border/50 flex justify-between items-center">
                            <div>
                                <h3 className="font-bold text-sm text-foreground">{rider.riderName}</h3>
                                <p className="text-xs text-muted-foreground font-mono">Chassis: {rider.chassisNumber || 'N/A'}</p>
                            </div>
                            <span className="px-2.5 py-1 rounded-xl text-xs font-bold bg-primary/10 text-primary border border-primary/20">
                                {rider.clientName || 'Standalone'}
                            </span>
                        </div>

                        {/* Visit Type */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Inspection Type</label>
                            <select
                                value={visitType}
                                onChange={(e) => setVisitType(e.target.value as any)}
                                className="w-full p-3 border border-input rounded-2xl text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 font-semibold"
                            >
                                <option value="routine_check">Routine Check-in</option>
                                <option value="allotment_handover">Allotment Handover</option>
                                <option value="recovery_visit">Payment Recovery Visit</option>
                                <option value="battery_inspection">Battery & Chassis Inspection</option>
                            </select>
                        </div>

                        {/* Chassis Status */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Vehicle Chassis Condition</label>
                            <div className="grid grid-cols-3 gap-2">
                                {(['OK', 'Minor Damage', 'Maintenance Required'] as const).map(st => (
                                    <button
                                        key={st}
                                        type="button"
                                        onClick={() => setChassisStatus(st)}
                                        className={`p-2.5 rounded-xl border text-xs font-bold transition-all text-center ${
                                            chassisStatus === st
                                                ? st === 'OK' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500'
                                                    : st === 'Minor Damage' ? 'bg-amber-500/10 text-amber-600 border-amber-500'
                                                    : 'bg-red-500/10 text-red-600 border-red-500'
                                                : 'border-border bg-card hover:bg-muted/30'
                                        }`}
                                    >
                                        {st}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* GPS Location Capture */}
                        <div className="p-4 rounded-2xl bg-muted/20 border border-border/50 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600">
                                    <MapPin size={18} />
                                </div>
                                <div>
                                    <span className="text-xs font-bold text-foreground block">GPS Coordinates</span>
                                    <span className="text-[10px] text-muted-foreground font-mono">
                                        {location ? `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)} (±${location.accuracy}m)` : 'Location not captured yet'}
                                    </span>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={handleGetLocation}
                                disabled={gettingLocation}
                                className="px-3 py-1.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 flex items-center gap-1.5 transition-all shadow-sm"
                            >
                                {gettingLocation ? <Loader2 size={12} className="animate-spin" /> : <Navigation size={12} />}
                                {location ? 'Recaptured' : 'Get GPS'}
                            </button>
                        </div>

                        {/* Remarks */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-muted-foreground">Field Remarks / Observations</label>
                            <textarea
                                value={remarks}
                                onChange={(e) => setRemarks(e.target.value)}
                                placeholder="Enter inspection notes, battery health, or rider conversation remarks..."
                                rows={3}
                                className="w-full p-3 border border-input rounded-2xl text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                            />
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="p-6 bg-muted/20 border-t border-border flex items-center justify-between">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2.5 border border-input rounded-xl text-xs font-semibold text-muted-foreground hover:bg-accent"
                        >
                            Cancel
                        </button>

                        <button
                            type="button"
                            onClick={handleSubmitCheckIn}
                            disabled={submitting}
                            className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-extrabold hover:bg-blue-700 shadow-lg shadow-blue-600/20 disabled:opacity-50 transition-all flex items-center gap-2"
                        >
                            {submitting ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                            Log Field Inspection
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default FieldCheckInModal;

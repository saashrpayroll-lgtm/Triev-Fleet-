/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useRef, useState, useMemo } from 'react';
import { toPng } from 'html-to-image';
import { Download, Camera, Loader2, ShieldCheck } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '@/config/supabase';
import { useToast } from '@/contexts/ToastContext';

interface EmployeeIDCardProps {
    userData: any;
}

const EmployeeIDCard: React.FC<EmployeeIDCardProps> = ({ userData }) => {
    const cardRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { success, error } = useToast();
    const [isDownloading, setIsDownloading] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [photoUrl, setPhotoUrl] = useState<string>(userData.profilePicUrl || '');

    // ─── Derive employee fields ─────────────────────────────────────
    const fullName = typeof userData.fullName === 'string'
        ? userData.fullName.replace(/\s*\(.*?\)\s*/g, '').trim()   // Strip any "(KONTI/xxx)" suffix
        : String(userData.fullName || 'Employee');

    const empCode = userData.userId || 'KONTI/000';  // The real unique EMP ID from profile
    const jobLocation = typeof userData.jobLocation === 'string' ? userData.jobLocation : 'Indrapuram (Ghaziabad)';
    const department = 'Sales / Sourcing';
    const position = 'Team Leader';
    const companyName = 'KONTINUUM GREEN MOBILITY PRIVATE LIMITED';

    // ─── QR Code payload ────────────────────────────────────────────
    const qrPayload = useMemo(() => JSON.stringify({
        name: fullName,
        empCode,
        department,
        position,
        location: jobLocation,
        company: companyName,
        email: userData.email || '',
        mobile: userData.mobile || '',
        verifiedBy: 'TriEv Digital Systems'
    }), [fullName, empCode, jobLocation, userData.email, userData.mobile]);

    // ─── Handlers ───────────────────────────────────────────────────
    const handleDownload = async () => {
        if (!cardRef.current) return;
        setIsDownloading(true);
        try {
            const dataUrl = await toPng(cardRef.current, {
                cacheBust: true,
                pixelRatio: 3,
                style: { margin: '0' },
            });
            const link = document.createElement('a');
            link.download = `ID_Card_${fullName.replace(/\s+/g, '_')}.png`;
            link.href = dataUrl;
            link.click();
            success('ID Card downloaded successfully!');
        } catch (err) {
            console.error('Failed to generate image:', err);
            error('Failed to generate ID Card image.');
        } finally {
            setIsDownloading(false);
        }
    };

    const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        try {
            if (!event.target.files || event.target.files.length === 0) return;
            const file = event.target.files[0];
            if (file.size > 2 * 1024 * 1024) { error('Image must be less than 2 MB'); return; }

            setIsUploading(true);
            const fileExt = file.name.split('.').pop();
            const fileName = `${userData.id}-idcard-${Math.random()}.${fileExt}`;

            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(fileName, file, { cacheControl: '3600', upsert: true });
            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('avatars')
                .getPublicUrl(fileName);

            const { error: updateError } = await supabase
                .from('users')
                .update({ profile_pic_url: publicUrl })
                .eq('id', userData.id);
            if (updateError) throw updateError;

            setPhotoUrl(publicUrl);
            success('ID Card photo updated!');
        } catch (err) {
            console.error('Upload Error:', err);
            error((err as Error).message || 'Failed to upload photo');
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    // ─── Render ─────────────────────────────────────────────────────
    return (
        <div className="w-full flex flex-col items-center gap-8 py-4">

            {/* ═══════════════ ID CARD ═══════════════ */}
            <div
                ref={cardRef}
                className="w-full max-w-[360px] rounded-[20px] overflow-hidden flex flex-col relative"
                style={{
                    fontFamily: '"Inter", "Segoe UI", sans-serif',
                    boxShadow: '0 24px 64px -12px rgba(234,88,12,0.25), 0 0 0 1px rgba(0,0,0,0.06)',
                }}
            >
                {/* ── TOP HEADER ── */}
                <div
                    className="relative w-full px-5 pt-5 pb-14"
                    style={{
                        background: 'linear-gradient(135deg, #f97316 0%, #ea580c 50%, #c2410c 100%)',
                    }}
                >
                    {/* Decorative circles */}
                    <div className="absolute top-[-30px] right-[-30px] w-[120px] h-[120px] rounded-full bg-white/10 pointer-events-none" />
                    <div className="absolute bottom-[-20px] left-[-20px] w-[80px] h-[80px] rounded-full bg-white/5 pointer-events-none" />

                    {/* Top row: Logo + Company Name */}
                    <div className="flex items-center gap-3 relative z-10">
                        <img
                            src="/triev_logo.png"
                            alt="TriEv"
                            className="h-9 w-9 object-contain rounded-lg bg-white/20 p-1 backdrop-blur-sm"
                            crossOrigin="anonymous"
                        />
                        <div className="flex flex-col">
                            <span className="text-white text-[11px] font-extrabold tracking-wider leading-none">TriEv</span>
                            <span className="text-white/80 text-[7px] font-bold tracking-[0.08em] uppercase leading-tight mt-0.5">
                                {companyName}
                            </span>
                        </div>
                    </div>

                    {/* EMPLOYEE ID label */}
                    <div className="mt-4 relative z-10">
                        <span className="inline-block px-3 py-1 bg-white/15 backdrop-blur-sm rounded-full text-[8px] font-bold text-white uppercase tracking-[0.25em] border border-white/20">
                            Employee Identity Card
                        </span>
                    </div>
                </div>

                {/* ── BODY (White) ── */}
                <div className="bg-white relative z-10 -mt-10 rounded-t-[20px] flex-1 flex flex-col">

                    {/* Photo + Name block */}
                    <div className="flex items-end gap-4 px-5 -mt-6">
                        {/* Photo */}
                        <div className="w-[88px] h-[88px] rounded-2xl p-[3px] bg-gradient-to-br from-orange-400 to-orange-600 shadow-xl shrink-0 relative z-20">
                            <div className="w-full h-full rounded-[13px] overflow-hidden bg-slate-100 flex items-center justify-center">
                                {photoUrl ? (
                                    <img src={photoUrl} alt="Employee" className="w-full h-full object-cover" crossOrigin="anonymous" />
                                ) : (
                                    <span className="text-3xl text-slate-300 font-black select-none">
                                        {fullName.charAt(0).toUpperCase()}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Name + Position */}
                        <div className="pb-1 flex-1 min-w-0">
                            <h1 className="text-[17px] font-black text-slate-900 leading-tight uppercase truncate">{fullName}</h1>
                            <p className="text-[11px] font-bold text-orange-600 uppercase tracking-widest mt-0.5">{position}</p>
                        </div>
                    </div>

                    {/* Details Grid */}
                    <div className="px-5 pt-5 pb-4 space-y-0">
                        {/* Row: EMP Code + Department */}
                        <div className="grid grid-cols-2 gap-3">
                            <DetailField label="Emp Code" value={empCode} mono />
                            <DetailField label="Department" value={department} />
                        </div>

                        {/* Divider */}
                        <div className="w-full h-px bg-slate-100 my-3" />

                        {/* Row: Location + Company */}
                        <div className="grid grid-cols-2 gap-3">
                            <DetailField label="Job Location" value={jobLocation} />
                            <DetailField label="Company" value="Kontinuum Green Mobility" small />
                        </div>
                    </div>

                    {/* QR Code + Verified */}
                    <div className="px-5 pb-4 flex items-center justify-between gap-3">
                        {/* QR */}
                        <div className="p-2 bg-white rounded-xl border border-slate-100 shadow-sm">
                            <QRCodeSVG
                                value={qrPayload}
                                size={64}
                                level="M"
                                bgColor="#ffffff"
                                fgColor="#1e293b"
                                includeMargin={false}
                            />
                        </div>

                        {/* Verification Badge */}
                        <div className="flex-1 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl px-4 py-3 border border-emerald-100">
                            <div className="flex items-center gap-2 mb-1">
                                <ShieldCheck size={14} className="text-emerald-600" />
                                <span className="text-[9px] font-black text-emerald-700 uppercase tracking-[0.15em]">Digitally Verified</span>
                            </div>
                            <p className="text-[8px] font-semibold text-emerald-600/70 leading-tight">
                                Authenticated by TriEv Digital Identity Systems. Scan QR for full details.
                            </p>
                        </div>
                    </div>
                </div>

                {/* ── BOTTOM FOOTER ── */}
                <div
                    className="w-full py-2.5 flex items-center justify-center gap-2"
                    style={{ background: 'linear-gradient(90deg, #0f172a 0%, #1e293b 100%)' }}
                >
                    <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-[0.2em]">
                        Property of {companyName}
                    </span>
                </div>
            </div>

            {/* ═══════════════ ACTION BUTTONS ═══════════════ */}
            <div className="flex flex-col sm:flex-row gap-3 w-full max-w-[360px]">
                {/* Upload */}
                <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className={`flex-1 flex items-center justify-center gap-2.5 py-3.5 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-all shadow-sm group ${isUploading ? 'opacity-70 cursor-not-allowed' : ''}`}
                >
                    {isUploading
                        ? <Loader2 size={18} className="animate-spin text-orange-500" />
                        : <Camera size={18} className="text-slate-500 group-hover:text-orange-500 transition-colors" />
                    }
                    <span className="text-xs font-bold text-slate-700 tracking-wide">
                        {isUploading ? 'Uploading…' : 'Upload Photo'}
                    </span>
                </button>
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handlePhotoUpload} />

                {/* Download */}
                <button
                    onClick={handleDownload}
                    disabled={isDownloading}
                    className={`flex-1 flex items-center justify-center gap-2.5 py-3.5 px-4 rounded-xl text-white shadow-lg shadow-orange-500/25 transition-all ${isDownloading ? 'opacity-70 cursor-not-allowed' : 'hover:shadow-orange-500/40 hover:scale-[1.02]'}`}
                    style={{ background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)' }}
                >
                    {isDownloading
                        ? <Loader2 size={18} className="animate-spin" />
                        : <Download size={18} />
                    }
                    <span className="text-xs font-bold tracking-wide">
                        {isDownloading ? 'Generating…' : 'Download Card'}
                    </span>
                </button>
            </div>
        </div>
    );
};

// ─── Small helper sub-component for detail fields ───────────────
const DetailField: React.FC<{ label: string; value: string; mono?: boolean; small?: boolean }> = ({ label, value, mono, small }) => (
    <div className="flex flex-col">
        <span className="text-[8px] font-bold text-slate-400 uppercase tracking-[0.15em] leading-none mb-1">{label}</span>
        <span className={`${small ? 'text-[10px]' : 'text-[12px]'} font-bold text-slate-800 leading-tight ${mono ? 'font-mono tracking-wider' : ''}`}>
            {value}
        </span>
    </div>
);

export default EmployeeIDCard;

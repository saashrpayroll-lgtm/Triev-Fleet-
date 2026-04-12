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
    // Extract KONTI code from name if present like "Mohit Prajapati (KONTI/205)"
    const rawName = typeof userData.fullName === 'string' ? userData.fullName : String(userData.fullName || 'Employee');
    const nameMatch = rawName.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
    const fullName = nameMatch ? nameMatch[1].trim() : rawName.trim();
    
    // EMP Code priority: 1) Extracted from name parentheses  2) userData.userId  3) fallback 
    const empCode = nameMatch ? nameMatch[2].trim() : (userData.userId || 'KONTI/000');
    
    const jobLocation = typeof userData.jobLocation === 'string' ? userData.jobLocation : 'Indrapuram (Ghaziabad)';
    const department = 'Sales / Sourcing';
    const position = 'Team Leader';
    const companyName = 'KONTINUUM GREEN MOBILITY PVT. LTD.';

    // ─── QR Code payload (vCard format — universally scannable) ────
    const hubAddress = 'Plot no. 134, Makanpur Village, Near Valmiki Chowk, Indirapuram, Ghaziabad, Uttar Pradesh 201014';
    const mobile = userData.mobile || userData.mobileNumber || '';
    const email = userData.email || '';

    const qrPayload = useMemo(() => {
        // vCard 3.0 format — works with every phone camera & QR scanner
        // When scanned: shows formatted contact card + allows Save/Download
        const lines = [
            'BEGIN:VCARD',
            'VERSION:3.0',
            `FN:${fullName}`,
            `N:${fullName.split(' ').reverse().join(';')};;;`,
            `ORG:${companyName}`,
            `TITLE:${position} - ${department}`,
            `TEL;TYPE=CELL:${mobile}`,
            `EMAIL:${email}`,
            `ADR;TYPE=WORK:;;${hubAddress};;;;`,
            `NOTE:EMP Code: ${empCode} | Location: ${jobLocation} | Verified by TriEv Digital Identity Systems`,
            `URL:https://triev.in`,
            'END:VCARD'
        ];
        return lines.join('\n');
    }, [fullName, empCode, jobLocation, mobile, email]);

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
        <div className="w-full flex flex-col items-center gap-6 py-2">

            {/* ═══════════════ ID CARD (Standard CR80 Ratio ~3.375:2.125 ≈ 1.59:1) ═══════════════ */}
            <div
                ref={cardRef}
                style={{
                    width: '400px',
                    minHeight: '560px',
                    fontFamily: '"Inter", "Segoe UI", sans-serif',
                    background: '#ffffff',
                    borderRadius: '16px',
                    overflow: 'hidden',
                    boxShadow: '0 20px 60px -15px rgba(0,0,0,0.2), 0 0 0 1px rgba(0,0,0,0.05)',
                    display: 'flex',
                    flexDirection: 'column',
                }}
            >
                {/* ── HEADER STRIP - Orange Gradient ── */}
                <div style={{
                    background: 'linear-gradient(135deg, #f97316 0%, #ea580c 50%, #c2410c 100%)',
                    padding: '18px 20px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    position: 'relative',
                }}>
                    {/* Decorative dot pattern */}
                    <div style={{
                        position: 'absolute', top: 0, right: 0, width: '100px', height: '100px',
                        borderRadius: '50%', background: 'rgba(255,255,255,0.08)',
                        transform: 'translate(30px, -30px)',
                    }} />

                    {/* Logo + Company */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', position: 'relative', zIndex: 2 }}>
                        <img
                            src="/triev_logo.png"
                            alt="TriEv"
                            style={{
                                height: '38px', width: '38px', objectFit: 'contain',
                                borderRadius: '10px', background: 'rgba(255,255,255,0.2)',
                                padding: '4px', backdropFilter: 'blur(4px)',
                            }}
                            crossOrigin="anonymous"
                        />
                        <div>
                            <div style={{ color: '#fff', fontSize: '14px', fontWeight: 800, letterSpacing: '0.5px', lineHeight: 1.1 }}>TriEv</div>
                            <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: '7px', fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', marginTop: '2px' }}>
                                {companyName}
                            </div>
                        </div>
                    </div>

                    {/* Employee ID Badge */}
                    <div style={{
                        background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(4px)',
                        borderRadius: '20px', padding: '4px 14px',
                        border: '1px solid rgba(255,255,255,0.25)',
                        position: 'relative', zIndex: 2,
                    }}>
                        <span style={{ color: '#fff', fontSize: '8px', fontWeight: 800, letterSpacing: '2px', textTransform: 'uppercase' }}>
                            Employee ID
                        </span>
                    </div>
                </div>

                {/* ── MAIN BODY ── */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '0' }}>

                    {/* Photo + Name Row */}
                    <div style={{
                        display: 'flex', alignItems: 'stretch', gap: '0',
                        borderBottom: '1px solid #f1f5f9',
                    }}>
                        {/* Photo Panel */}
                        <div style={{
                            width: '145px', minHeight: '160px',
                            background: 'linear-gradient(180deg, #fff7ed 0%, #ffffff 100%)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            padding: '16px',
                            borderRight: '1px solid #f1f5f9',
                        }}>
                            <div style={{
                                width: '110px', height: '130px', borderRadius: '12px',
                                overflow: 'hidden', border: '3px solid #f97316',
                                boxShadow: '0 4px 12px rgba(249,115,22,0.25)',
                                background: '#f1f5f9',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                                {photoUrl ? (
                                    <img src={photoUrl} alt="Employee" style={{ width: '100%', height: '100%', objectFit: 'cover' }} crossOrigin="anonymous" />
                                ) : (
                                    <span style={{ fontSize: '36px', color: '#cbd5e1', fontWeight: 900 }}>
                                        {fullName.charAt(0).toUpperCase()}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Name + Position Panel */}
                        <div style={{ flex: 1, padding: '20px 18px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                            <div style={{ fontSize: '20px', fontWeight: 900, color: '#0f172a', textTransform: 'uppercase', lineHeight: 1.15, letterSpacing: '-0.3px', marginBottom: '4px' }}>
                                {fullName}
                            </div>
                            <div style={{ fontSize: '11px', fontWeight: 700, color: '#ea580c', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '12px' }}>
                                {position}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.2)' }} />
                                <span style={{ fontSize: '9px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px' }}>Active Employee</span>
                            </div>
                        </div>
                    </div>

                    {/* Details Grid */}
                    <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 20px' }}>
                        <DetailBlock label="EMP CODE" value={empCode} highlight />
                        <DetailBlock label="DEPARTMENT" value={department} />
                        <DetailBlock label="JOB LOCATION" value={jobLocation} />
                        <DetailBlock label="COMPANY" value="Kontinuum Green Mobility" small />
                    </div>

                    {/* Divider */}
                    <div style={{ height: '1px', background: 'linear-gradient(90deg, transparent, #e2e8f0, transparent)', margin: '0 20px' }} />

                    {/* QR + Verification */}
                    <div style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', gap: '14px', flex: 1 }}>
                        {/* QR Code */}
                        <div style={{
                            padding: '8px', background: '#fff', borderRadius: '12px',
                            border: '2px solid #f1f5f9', boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                            flexShrink: 0,
                        }}>
                            <QRCodeSVG
                                value={qrPayload}
                                size={80}
                                level="L"
                                bgColor="#ffffff"
                                fgColor="#0f172a"
                                includeMargin={true}
                            />
                        </div>

                        {/* Verification Block */}
                        <div style={{
                            flex: 1, background: 'linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 100%)',
                            borderRadius: '12px', padding: '12px 14px',
                            border: '1px solid #bbf7d0',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                                <ShieldCheck size={13} color="#16a34a" />
                                <span style={{ fontSize: '9px', fontWeight: 900, color: '#15803d', letterSpacing: '1.5px', textTransform: 'uppercase' }}>
                                    Digitally Verified
                                </span>
                            </div>
                            <p style={{ fontSize: '8px', fontWeight: 600, color: '#4ade80', lineHeight: 1.4, margin: 0 }}>
                                Authenticated by TriEv Digital Identity Systems. Scan QR code for complete employee verification.
                            </p>
                        </div>
                    </div>
                </div>

                {/* ── FOOTER ── */}
                <div style={{
                    background: 'linear-gradient(90deg, #0f172a 0%, #1e293b 100%)',
                    padding: '10px 20px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                    borderTop: '3px solid #ea580c',
                }}>
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#f97316' }} />
                    <span style={{ fontSize: '7px', fontWeight: 700, color: '#94a3b8', letterSpacing: '2px', textTransform: 'uppercase' }}>
                        Property of {companyName} • Not Transferable
                    </span>
                </div>
            </div>

            {/* ═══════════════ ACTION BUTTONS ═══════════════ */}
            <div className="flex flex-col sm:flex-row gap-3 w-full max-w-[400px]">
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

// ─── Detail block sub-component ─────────────────────────────────
const DetailBlock: React.FC<{ label: string; value: string; highlight?: boolean; small?: boolean }> = ({ label, value, highlight, small }) => (
    <div>
        <div style={{ fontSize: '8px', fontWeight: 800, color: '#94a3b8', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '3px' }}>
            {label}
        </div>
        <div style={{
            fontSize: small ? '10px' : '13px',
            fontWeight: 800,
            color: highlight ? '#ea580c' : '#1e293b',
            fontFamily: highlight ? '"JetBrains Mono", "Fira Code", monospace' : 'inherit',
            letterSpacing: highlight ? '1px' : '0',
            lineHeight: 1.2,
        }}>
            {value}
        </div>
    </div>
);

export default EmployeeIDCard;

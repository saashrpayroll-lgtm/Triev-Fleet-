/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import { Download, Camera, Loader2, ShieldCheck, MapPin, Briefcase } from 'lucide-react';
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
    let rawName = typeof userData.fullName === 'string' ? userData.fullName : String(userData.fullName || 'Employee');
    let parsedEmpCode = userData.id ? `KONTI/TL/${userData.id.substring(0, 4).toUpperCase()}` : 'KONTI/TL/0000';
    let cleanName = rawName;

    // Extract "(KONTI/205)" to use as EMP Code and remove from display name
    const match = rawName.match(/\((KONTI\/[^)]+)\)/i);
    if (match) {
        parsedEmpCode = match[1].toUpperCase();
        cleanName = rawName.replace(/\((KONTI\/[^)]+)\)/i, '').trim();
    }

    const dept = 'Sales/Operations';
    const position = 'Team Leader';
    
    // Default location expanded
    let rawLoc = typeof userData.jobLocation === 'string' ? userData.jobLocation : '';
    let jobLocation = rawLoc;
    if (!jobLocation || jobLocation.toLowerCase() === 'indrapuram') {
        jobLocation = 'Indrapuram(Ghaziabad)';
    }

    const qrData = `Name: ${cleanName}\nEMP Code: ${parsedEmpCode}\nRole: ${position}\nDept: ${dept}`;

    const handleDownload = async () => {
        if (!cardRef.current) return;
        setIsDownloading(true);
        try {
            // Fetch images via proxy/CORS before capturing if needed, but since it's local/CORS-enabled supabase
            const dataUrl = await toPng(cardRef.current, {
                cacheBust: true,
                pixelRatio: 3, // High quality
                style: { margin: '0' } // Ensure no outer margins bleed into image
            });
            const link = document.createElement('a');
            link.download = `Employee_ID_Card_${cleanName.replace(/\s+/g, '_')}.png`;
            link.href = dataUrl;
            link.click();
            success("ID Card downloaded successfully!");
        } catch (err) {
            console.error('Failed to generate image:', err);
            error("Failed to generate ID Card image.");
        } finally {
            setIsDownloading(false);
        }
    };

    const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        try {
            if (!event.target.files || event.target.files.length === 0) return;
            const file = event.target.files[0];
            
            // Limit to 2MB
            if (file.size > 2 * 1024 * 1024) {
               error("Image must be less than 2MB");
               return;
            }

            setIsUploading(true);
            const fileExt = file.name.split('.').pop();
            const fileName = `${userData.id}-idcard-${Math.random()}.${fileExt}`;
            const filePath = `${fileName}`;

            // Upload to Supabase 'avatars' bucket
            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, file, { cacheControl: '3600', upsert: true });

            if (uploadError) throw uploadError;

            // Get Public URL
            const { data: { publicUrl } } = supabase.storage
                .from('avatars')
                .getPublicUrl(filePath);

            // Update User Profile
            const { error: updateError } = await supabase
                .from('users')
                .update({ profile_pic_url: publicUrl })
                .eq('id', userData.id);

            if (updateError) throw updateError;

            setPhotoUrl(publicUrl);
            success("ID Card photo updated successfully!");
        } catch (err) {
            console.error('Upload Error:', err);
            error((err as Error).message || "Failed to upload ID Card photo");
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    return (
        <div className="w-full flex flex-col items-center gap-8 py-4">
            
            {/* ID CARD RENDER TARGET */}
            <div 
                ref={cardRef} 
                className="w-full max-w-[340px] aspect-[2.1/3.4] rounded-[20px] overflow-hidden flex flex-col relative shadow-[0_20px_50px_-10px_rgba(249,115,22,0.3)] bg-white border border-slate-200"
                style={{ background: '#ffffff', fontFamily: '"Inter", sans-serif' }}
            >
                {/* 1. TOP BRANDING - ORANGE HEADER */}
                <div className="bg-[#f97316] w-full pt-6 pb-[4.5rem] flex flex-col relative z-10" style={{ background: 'linear-gradient(135deg, #f97316 0%, #d94908 100%)' }}>
                    
                    {/* Dark/Pattern Overlay inside Header */}
                    <div className="absolute inset-0 opacity-10 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent pointer-events-none" />

                    <div className="relative z-20 px-5 flex items-center justify-between w-full">
                        {/* Company Logo placed properly Top Left inside a white pill for contrast */}
                        <div className="bg-white/95 px-2.5 py-1.5 rounded-lg shadow-sm border border-white/20">
                            <img 
                                src="/triev_logo.png" 
                                alt="TriEv" 
                                className="h-6 object-contain" 
                                crossOrigin="anonymous" 
                            />
                        </div>
                        <h2 className="text-white text-[8px] font-black tracking-[0.15em] text-right uppercase opacity-95 leading-tight max-w-[120px]">
                            Kontinuum Green Mobility Pvt Ltd
                        </h2>
                    </div>
                </div>

                {/* 2. PHOTO & MAIN DETAILS SECTION */}
                <div className="flex flex-col relative z-20 -mt-12 bg-white flex-1 px-6 rounded-t-[24px]">
                    <div className="flex justify-between items-end w-full">
                        {/* Photo */}
                        <div className="w-[100px] h-[100px] rounded-2xl p-1 bg-white shadow-xl border border-slate-100 z-30">
                            <div className="w-full h-full rounded-xl overflow-hidden bg-slate-100 flex items-center justify-center relative">
                                {photoUrl ? (
                                    <img 
                                        src={photoUrl} 
                                        alt="ID" 
                                        className="w-full h-full object-cover" 
                                        crossOrigin="anonymous" 
                                    />
                                ) : (
                                    <span className="text-4xl text-slate-300 font-bold">
                                        {cleanName.charAt(0)}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Small QR Code snippet */}
                        <div className="p-1.5 bg-white border border-slate-100 shadow-sm rounded-xl mb-1 flex-shrink-0 z-30">
                            <QRCodeSVG 
                                value={qrData} 
                                size={44} 
                                level={"L"} 
                                includeMargin={false} 
                                fgColor={"#0f172a"} 
                            />
                        </div>
                    </div>

                    {/* NAME & DEPT */}
                    <div className="w-full mt-4 space-y-1">
                        <h1 className="text-xl font-black text-slate-900 uppercase tracking-tight leading-none break-words pr-2">
                            {cleanName}
                        </h1>
                        <p className="text-[#ea580c] text-[10px] font-black uppercase tracking-[0.2em]">{dept}</p>
                    </div>
                    
                    <div className="w-full h-px bg-gradient-to-r from-slate-200 to-transparent mt-3 mb-4" />

                    {/* INFO GRID */}
                    <div className="w-full grid grid-cols-2 gap-y-3 gap-x-2">
                        <div className="flex flex-col">
                            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-[0.15em] leading-none mb-1">EMP Code</span>
                            <span className="text-xs font-black text-slate-800 font-mono tracking-wider">{parsedEmpCode}</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-[0.15em] leading-none mb-1">Position</span>
                            <div className="flex items-center gap-1">
                                <Briefcase size={12} className="text-[#ea580c] shrink-0" />
                                <span className="text-[10px] font-black text-slate-700 capitalize leading-tight">{position}</span>
                            </div>
                        </div>
                        <div className="flex flex-col col-span-2">
                            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-[0.15em] leading-none mb-1">Work Base</span>
                            <div className="flex items-start gap-1">
                                <MapPin size={12} className="text-[#ea580c] shrink-0 mt-0.5" />
                                <span className="text-[10px] font-black text-slate-700 capitalize leading-tight">{jobLocation}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 3. BOTTOM FOOTER - BLACK */}
                <div className="bg-slate-950 w-full px-3 py-3.5 flex items-center justify-center gap-2 mt-auto border-t-4 border-[#ea580c]">
                    <ShieldCheck size={14} className="text-emerald-400" />
                    <span className="text-[9px] font-black text-white uppercase tracking-[0.25em]">Digitally Verified By TriEv</span>
                </div>
            </div>

            {/* ACTION CONTROLS (OUTSIDE CARD) */}
            <div className="flex flex-col sm:flex-row gap-3 w-full max-w-[340px]">
                {/* Upload Button */}
                <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className={`flex-1 flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-colors shadow-sm ${isUploading ? 'opacity-70 cursor-not-allowed' : ''}`}
                >
                    {isUploading ? <Loader2 size={18} className="animate-spin text-[#ea580c]" /> : <Camera size={18} className="text-slate-600" />}
                    <span className="text-xs font-bold text-slate-700 tracking-wide">
                        {isUploading ? 'Uploading...' : 'Upload Photo'}
                    </span>
                </button>
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept="image/*" 
                    onChange={handlePhotoUpload} 
                />

                {/* Download Button */}
                <button
                    onClick={handleDownload}
                    disabled={isDownloading}
                    className={`flex-1 flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl bg-gradient-to-r from-[#f97316] to-[#ea580c] hover:opacity-90 transition-opacity text-white shadow-lg shadow-orange-500/30 ${isDownloading ? 'opacity-70 cursor-not-allowed' : ''}`}
                >
                    {isDownloading ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
                    <span className="text-xs font-bold tracking-wide">
                        {isDownloading ? 'Generating...' : 'Download Card'}
                    </span>
                </button>
            </div>
        </div>
    );
};

export default EmployeeIDCard;

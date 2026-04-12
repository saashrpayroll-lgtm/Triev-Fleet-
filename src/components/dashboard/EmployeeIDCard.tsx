/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import { Download, Camera, Loader2, ShieldCheck } from 'lucide-react';
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
    // Local state for immediate update without reload
    const [photoUrl, setPhotoUrl] = useState<string>(userData.profilePicUrl || '');

    // Format Emp Code
    const empCode = userData.id ? `KONTI/TL/${userData.id.substring(0, 4).toUpperCase()}` : 'KONTI/TL/0000';
    const fullName = typeof userData.fullName === 'string' ? userData.fullName : String(userData.fullName || 'Employee');
    const jobLocation = typeof userData.jobLocation === 'string' ? userData.jobLocation : 'Indrapuram (GZB)';
    const dept = 'Sales/Operations';

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
            link.download = `Employee_ID_Card_${fullName.replace(/\s+/g, '_')}.png`;
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
                className="w-full max-w-[340px] aspect-[2.1/3.4] rounded-[24px] overflow-hidden flex flex-col relative shadow-[0_20px_50px_-10px_rgba(249,115,22,0.3)] bg-white border border-slate-200"
                style={{ background: '#ffffff', fontFamily: '"Inter", sans-serif' }}
            >
                {/* 1. TOP BRANDING - ORANGE HEADER */}
                <div className="bg-[#f97316] w-full pt-8 pb-16 flex flex-col items-center justify-center relative shadow-md z-10" style={{ background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)' }}>
                    
                    {/* Dark/Pattern Overlay inside Header */}
                    <div className="absolute inset-0 opacity-10 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent pointer-events-none" />

                    <img 
                        src="/triev_logo.png" 
                        alt="TriEv" 
                        className="h-10 object-contain relative z-20 mix-blend-screen brightness-0 invert" 
                        crossOrigin="anonymous" 
                    />
                    <h2 className="text-white text-[9px] font-black tracking-[0.1em] mt-1 relative z-20 text-center uppercase opacity-90 leading-tight px-4">
                        Kontinuum Green Mobility Private Limited
                    </h2>
                </div>

                {/* 2. PHOTO SECTION */}
                <div className="flex flex-col items-center relative z-20 -mt-12 bg-white flex-1 p-5 rounded-t-[24px]">
                    <div className="w-32 h-32 rounded-2xl p-1 bg-white shadow-xl mb-4 border-2 border-slate-100 z-30">
                        <div className="w-full h-full rounded-xl overflow-hidden bg-slate-100 flex items-center justify-center">
                            {photoUrl ? (
                                <img 
                                    src={photoUrl} 
                                    alt="ID" 
                                    className="w-full h-full object-cover" 
                                    crossOrigin="anonymous" 
                                />
                            ) : (
                                <span className="text-4xl text-slate-300 font-bold">
                                    {fullName.charAt(0)}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* DETAILS */}
                    <div className="text-center w-full space-y-3">
                        <div className="space-y-0.5">
                            <h1 className="text-xl font-black text-slate-900 uppercase tracking-tight leading-none">{fullName}</h1>
                            <p className="text-[#ea580c] text-xs font-bold uppercase tracking-widest">{dept}</p>
                        </div>
                        
                        <div className="w-8 h-1 bg-slate-200 mx-auto rounded-full" />

                        <div className="space-y-2 w-full text-left pt-1">
                            <div className="flex flex-col">
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-0.5">EMP Code</span>
                                <span className="text-[13px] font-black text-slate-800 font-mono tracking-wider">{empCode}</span>
                            </div>
                            <div className="flex flex-col py-1">
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-0.5">Work Base</span>
                                <span className="text-[11px] font-bold text-slate-700 capitalize">{jobLocation}</span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-0.5">Blood Group</span>
                                <span className="text-[11px] font-bold text-[#ea580c]">O+</span> {/* Fallback or static for aesthetic unless specified */}
                            </div>
                        </div>
                    </div>
                </div>

                {/* 3. BOTTOM FOOTER - BLACK */}
                <div className="bg-slate-950 w-full p-3 flex items-center justify-center gap-2 mt-auto border-t-[8px] border-[#ea580c]">
                    <ShieldCheck size={14} className="text-emerald-400" />
                    <span className="text-[9px] font-bold text-white uppercase tracking-[0.2em]">Digitally Verified By TriEv</span>
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

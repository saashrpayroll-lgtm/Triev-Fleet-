import { forwardRef } from 'react';
import { User, Shield } from 'lucide-react';
import { Rider } from '@/types';

interface RiderIdCardProps {
    rider: Rider;
    teamLeaderName?: string;
}

const RiderIdCard = forwardRef<HTMLDivElement, RiderIdCardProps>(({ rider, teamLeaderName }, ref) => {
    return (
        <div
            ref={ref}
            className="w-[400px] h-[600px] bg-white rounded-[32px] overflow-hidden shadow-2xl relative flex flex-col font-sans border border-gray-100"
            id="rider-id-card"
        >
            {/* Top Section - Brand Gradient */}
            <div className="h-44 bg-[#0f172a] relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-orange-500/10 rounded-full blur-2xl -ml-20 -mb-20"></div>

                {/* Logo & Slogan - Repositioned to Top Left */}
                <div className="absolute top-8 left-6 flex flex-col items-start text-left">
                    <img
                        src="/triev_logo.png"
                        alt="TriEv Logo"
                        className="h-14 w-auto mb-1.5 drop-shadow-md"
                    />
                    <div className="flex flex-col items-start">
                        <h1 className="text-xl font-black tracking-tighter italic uppercase text-white">
                            TriEv <span className="text-orange-500 not-italic lowercase">Riders</span>
                        </h1>
                        <p className="text-[9px] uppercase font-bold tracking-[0.2em] text-blue-500 mt-0.5">#JoinTheEVTrieb</p>
                    </div>
                </div>
            </div>

            {/* Photo Section */}
            <div className="absolute top-32 left-1/2 -translate-x-1/2">
                <div className="relative">
                    <div className="absolute -inset-1 bg-gradient-to-tr from-orange-500 to-orange-300 rounded-full blur-sm opacity-40"></div>
                    <div className="relative w-32 h-32 bg-white rounded-full p-1 shadow-lg border border-gray-100">
                        <div className="w-full h-full rounded-full overflow-hidden bg-slate-100 flex items-center justify-center border border-gray-50">
                            {rider.photoUrl ? (
                                <img
                                    src={rider.photoUrl}
                                    alt={rider.riderName}
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <User className="w-14 h-14 text-slate-300" />
                            )}
                        </div>
                    </div>
                    {/* Verified Badge */}
                    <div className="absolute bottom-1 right-1 bg-white p-1 rounded-full shadow-lg">
                        <div className="bg-orange-500 p-1 rounded-full">
                            <Shield className="text-white w-3.5 h-3.5" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Info Section */}
            <div className="mt-28 flex-1 px-8 pb-10 flex flex-col">
                <div className="text-center mb-8">
                    <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight">{rider.riderName}</h2>
                    <div className="flex items-center justify-center gap-2 mt-1">
                        <span className="text-xs font-bold text-orange-500 uppercase tracking-widest bg-orange-50 px-2 py-0.5 rounded">RIDER PARTNER</span>
                    </div>
                </div>

                <div className="space-y-4 px-2">
                    {/* Rider Details - Key -- Value style */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <span className="text-[11px] font-bold text-slate-400 uppercase w-20">Name</span>
                            <span className="text-slate-300">--</span>
                            <span className="text-sm font-black text-slate-700 uppercase">{rider.riderName}</span>
                        </div>

                        <div className="flex items-center gap-2">
                            <span className="text-[11px] font-bold text-slate-400 uppercase w-20">Mob</span>
                            <span className="text-slate-300">---</span>
                            <span className="text-sm font-black text-slate-700">{rider.mobileNumber}</span>
                        </div>

                        <div className="flex items-center gap-2">
                            <span className="text-[11px] font-bold text-slate-400 uppercase w-20">Rider Id</span>
                            <span className="text-slate-300">---</span>
                            <span className="text-sm font-black text-slate-700">{rider.trievId}</span>
                        </div>

                        <div className="flex items-center gap-2">
                            <span className="text-[11px] font-bold text-slate-400 uppercase w-20">Chassis No</span>
                            <span className="text-slate-300">-</span>
                            <span className="text-sm font-black text-slate-700 font-mono">{rider.chassisNumber || 'N/A'}</span>
                        </div>

                        <div className="flex items-center gap-2">
                            <span className="text-[11px] font-bold text-slate-400 uppercase w-20">TL Name</span>
                            <span className="text-slate-300">---</span>
                            <span className="text-sm font-black text-slate-700">{teamLeaderName || 'N/A'}</span>
                        </div>
                    </div>
                </div>

                {/* Bottom Footer */}
                <div className="mt-auto pt-6 border-t border-slate-100 text-center">
                    <p className="text-[9px] font-bold text-slate-300 uppercase tracking-[0.2em]">Verified Secure Node Access • 2026 TriEv</p>
                </div>
            </div>
        </div>
    );
});

RiderIdCard.displayName = 'RiderIdCard';

export default RiderIdCard;

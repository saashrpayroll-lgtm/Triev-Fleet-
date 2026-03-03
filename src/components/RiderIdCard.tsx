import { forwardRef } from 'react';
import { User, Shield, Phone, Zap, Hash, UserCheck } from 'lucide-react';
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
            <div className="h-48 bg-[#0f172a] relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-orange-500/10 rounded-full blur-2xl -ml-20 -mb-20"></div>

                {/* Logo & Slogan */}
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
                    <img
                        src="/triev_logo.png"
                        alt="TriEv Logo"
                        className="h-16 w-auto mb-2 drop-shadow-lg"
                    />
                    <div className="text-white">
                        <h1 className="text-2xl font-black tracking-tighter italic uppercase">
                            TriEv <span className="text-orange-500 not-italic lowercase">Riders</span>
                        </h1>
                        <p className="text-[10px] uppercase font-bold tracking-[0.3em] text-orange-200/60 mt-1">#JoinTheEVTrieb</p>
                    </div>
                </div>
            </div>

            {/* Photo Section */}
            <div className="absolute top-36 left-1/2 -translate-x-1/2">
                <div className="relative">
                    <div className="absolute -inset-1.5 bg-gradient-to-tr from-orange-500 to-orange-300 rounded-full blur-sm opacity-50 animate-pulse"></div>
                    <div className="relative w-36 h-36 bg-white rounded-full p-1.5 shadow-xl border border-gray-100">
                        <div className="w-full h-full rounded-full overflow-hidden bg-slate-100 flex items-center justify-center border border-gray-50">
                            {rider.photoUrl ? (
                                <img
                                    src={rider.photoUrl}
                                    alt={rider.riderName}
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <User className="w-16 h-16 text-slate-300" />
                            )}
                        </div>
                    </div>
                    {/* Verified Badge */}
                    <div className="absolute bottom-1 right-1 bg-white p-1 rounded-full shadow-lg">
                        <div className="bg-orange-500 p-1.5 rounded-full">
                            <Shield className="text-white w-4 h-4" />
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

                <div className="space-y-4">
                    {/* Triev ID */}
                    <div className="flex items-center gap-4 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                        <div className="p-2 bg-white rounded-xl shadow-sm">
                            <Hash className="text-orange-500 w-4 h-4" />
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Triev Identifier</p>
                            <p className="text-sm font-black text-slate-700">{rider.trievId}</p>
                        </div>
                    </div>

                    {/* Mobile Number */}
                    <div className="flex items-center gap-4 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                        <div className="p-2 bg-white rounded-xl shadow-sm">
                            <Phone className="text-orange-500 w-4 h-4" />
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Contact Number</p>
                            <p className="text-sm font-black text-slate-700">{rider.mobileNumber}</p>
                        </div>
                    </div>

                    {/* Chassis Number */}
                    <div className="flex items-center gap-4 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                        <div className="p-2 bg-white rounded-xl shadow-sm">
                            <Zap className="text-orange-500 w-4 h-4" />
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Assigned Chassis</p>
                            <p className="text-sm font-black text-slate-700">{rider.chassisNumber || 'NOT ASSIGNED'}</p>
                        </div>
                    </div>

                    {/* Team Leader */}
                    <div className="flex items-center gap-4 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                        <div className="p-2 bg-white rounded-xl shadow-sm">
                            <UserCheck className="text-orange-500 w-4 h-4" />
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Team Manager</p>
                            <p className="text-sm font-black text-slate-700">{teamLeaderName || 'NOT ASSIGNED'}</p>
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

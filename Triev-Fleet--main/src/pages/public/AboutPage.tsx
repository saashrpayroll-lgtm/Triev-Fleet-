import React from 'react';
import { PublicLayout } from './PublicLayout';
import { Zap, ShieldCheck, TrendingUp, Users, Leaf, BatteryCharging, Trophy, Award } from 'lucide-react';
import { Link } from 'react-router-dom';

const AboutPage: React.FC = () => {
    return (
        <PublicLayout>
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
                {/* Hero */}
                <div className="text-center max-w-3xl mx-auto mb-16">
                    <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-black uppercase tracking-wider mb-4">
                        <Zap size={14} /> Powering Sustainable Urban Mobility
                    </div>
                    <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight mb-6 leading-tight">
                        Revolutionizing Electric Fleet Operations Across India
                    </h1>
                    <p className="text-base text-slate-400 leading-relaxed">
                        Triev Fleet is on a mission to electrify last-mile delivery. We combine intelligent cloud telematics, real-time rider tracking, and automated financial management to empower fleet owners, team leaders, and gig delivery riders.
                    </p>
                </div>

                {/* Stat Highlights */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-16">
                    {[
                        { label: 'Active EV Riders', value: '1,500+', icon: Users, color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
                        { label: 'Clean Km Powered', value: '5M+ km', icon: Leaf, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                        { label: 'Collection Rate', value: '99.4%', icon: TrendingUp, color: 'text-purple-400', bg: 'bg-purple-500/10' },
                        { label: 'Uptime Reliability', value: '99.9%', icon: ShieldCheck, color: 'text-amber-400', bg: 'bg-amber-500/10' },
                    ].map((stat, i) => {
                        const Icon = stat.icon;
                        return (
                            <div key={i} className="p-6 rounded-3xl bg-white/[0.02] border border-white/10 flex flex-col justify-between">
                                <div className={`w-10 h-10 rounded-2xl ${stat.bg} ${stat.color} flex items-center justify-center mb-4`}>
                                    <Icon size={20} />
                                </div>
                                <div>
                                    <p className="text-2xl sm:text-3xl font-black text-white">{stat.value}</p>
                                    <p className="text-xs text-slate-400 font-semibold mt-1">{stat.label}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Core Pillars */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
                    <div className="p-8 rounded-3xl bg-gradient-to-br from-indigo-950/40 to-transparent border border-indigo-500/20">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center mb-6">
                            <BatteryCharging size={24} />
                        </div>
                        <h3 className="text-xl font-black text-white mb-3">Smart EV Ecosystem</h3>
                        <p className="text-sm text-slate-400 leading-relaxed">
                            Seamless integration with major electric 2-wheeler manufacturers and battery swapping networks, ensuring zero downtime for delivery partners.
                        </p>
                    </div>

                    <div className="p-8 rounded-3xl bg-gradient-to-br from-purple-950/40 to-transparent border border-purple-500/20">
                        <div className="w-12 h-12 rounded-2xl bg-purple-500/20 text-purple-400 flex items-center justify-center mb-6">
                            <TrendingUp size={24} />
                        </div>
                        <h3 className="text-xl font-black text-white mb-3">Automated Collections</h3>
                        <p className="text-sm text-slate-400 leading-relaxed">
                            Algorithmic wallet deductions, daily rent recovery, and instant WhatsApp communication ensure reliable cash flow for fleet operators.
                        </p>
                    </div>

                    <div className="p-8 rounded-3xl bg-gradient-to-br from-emerald-950/40 to-transparent border border-emerald-500/20">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-6">
                            <Trophy size={24} />
                        </div>
                        <h3 className="text-xl font-black text-white mb-3">Team Leader Empowerment</h3>
                        <p className="text-sm text-slate-400 leading-relaxed">
                            Dedicated hierarchy management with real-time leaderboards, performance analytics, and automated shift tracking for field staff.
                        </p>
                    </div>
                </div>

                {/* CTA Box */}
                <div className="p-8 sm:p-12 rounded-3xl bg-gradient-to-r from-indigo-600/20 via-purple-600/20 to-emerald-600/20 border border-white/10 text-center">
                    <h2 className="text-2xl sm:text-3xl font-black text-white mb-3">Ready to scale your EV Fleet?</h2>
                    <p className="text-sm text-slate-400 max-w-xl mx-auto mb-6">
                        Calculate your fleet savings or speak with our fleet onboarding team today.
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-4">
                        <Link to="/calculator" className="px-6 py-3 rounded-2xl font-black text-xs bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/25 transition-all">
                            Try EV Savings Calculator
                        </Link>
                        <Link to="/contact" className="px-6 py-3 rounded-2xl font-black text-xs bg-white/10 hover:bg-white/15 text-white border border-white/10 transition-all">
                            Contact Us
                        </Link>
                    </div>
                </div>
            </div>
        </PublicLayout>
    );
};

export default AboutPage;

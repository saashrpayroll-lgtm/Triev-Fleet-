import React from 'react';
import { PublicLayout } from './PublicLayout';
import { Bot, Zap, Wallet, Users, Star, RefreshCw, Smartphone } from 'lucide-react';
import { Link } from 'react-router-dom';

const FeaturesPage: React.FC = () => {
    const features = [
        {
            icon: Bot,
            title: 'Triple-Engine AI Copilot',
            badge: 'AI Intelligence',
            color: 'from-purple-500/20 to-indigo-500/20 text-purple-400 border-purple-500/30',
            description: 'Leverages Groq (sub-second speed), Gemini 2.0 (deep analytics), and Mistral AI (Devanagari multilingual Hindi prompts) for automated debt collection and fleet forecasting.'
        },
        {
            icon: Wallet,
            title: 'Automated Daily Rent Recovery',
            badge: 'Financial Ops',
            color: 'from-emerald-500/20 to-teal-500/20 text-emerald-400 border-emerald-500/30',
            description: 'Intelligent digital wallet deductions that automatically account for client daily payouts, deductions, security deposits, and customized daily rental rates.'
        },
        {
            icon: Star,
            title: 'AI 5-Star Rider Rating Engine',
            badge: 'Retention',
            color: 'from-amber-500/20 to-orange-500/20 text-amber-400 border-amber-500/30',
            description: 'Calculates pure mathematical star ratings based on wallet stability, payment consistency, vehicle tenure, and predicts churn before a rider surrenders their vehicle.'
        },
        {
            icon: Users,
            title: 'Team Leader Performance & Leaderboard',
            badge: 'Staff Hierarchy',
            color: 'from-blue-500/20 to-cyan-500/20 text-blue-400 border-blue-500/30',
            description: 'Real-time performance rankings for Team Leaders, Reporting Managers, and City Heads with live target meters and conversion metrics.'
        },
        {
            icon: RefreshCw,
            title: 'Live Google Sheet 2-Way Sync',
            badge: 'Integration',
            color: 'from-indigo-500/20 to-violet-500/20 text-indigo-400 border-indigo-500/30',
            description: 'Auto-syncs fleet roster, client allocations, and wallet settlements directly from Google Sheets without requiring manual Excel file re-uploads.'
        },
        {
            icon: Smartphone,
            title: 'Multilingual WhatsApp Automation',
            badge: 'Communications',
            color: 'from-green-500/20 to-emerald-500/20 text-green-400 border-green-500/30',
            description: 'Instantly drafts customized payment reminders and recovery scripts in fluent Hindi and English with direct 1-click WhatsApp Web dispatch.'
        }
    ];

    return (
        <PublicLayout>
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
                {/* Header */}
                <div className="text-center max-w-3xl mx-auto mb-16">
                    <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-black uppercase tracking-wider mb-4">
                        <Zap size={14} /> Full Enterprise Capability
                    </div>
                    <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight mb-6">
                        Engineered for High-Scale Electric Fleets
                    </h1>
                    <p className="text-base text-slate-400 leading-relaxed">
                        Discover the powerful suite of tools designed to optimize EV utilization, eliminate unpaid dues, and streamline team management.
                    </p>
                </div>

                {/* Features Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
                    {features.map((f, i) => {
                        const Icon = f.icon;
                        return (
                            <div key={i} className="p-8 rounded-3xl bg-white/[0.02] border border-white/10 hover:border-white/20 transition-all flex flex-col justify-between group">
                                <div>
                                    <div className="flex items-center justify-between mb-6">
                                        <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${f.color} border flex items-center justify-center`}>
                                            <Icon size={22} />
                                        </div>
                                        <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-slate-300">
                                            {f.badge}
                                        </span>
                                    </div>
                                    <h3 className="text-xl font-black text-white mb-3 group-hover:text-indigo-400 transition-colors">
                                        {f.title}
                                    </h3>
                                    <p className="text-xs text-slate-400 leading-relaxed">
                                        {f.description}
                                    </p>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Bottom CTA */}
                <div className="p-8 sm:p-12 rounded-3xl bg-gradient-to-r from-indigo-900/30 via-purple-900/30 to-slate-900/30 border border-white/10 text-center">
                    <h2 className="text-2xl sm:text-3xl font-black text-white mb-3">Experience the platform in action</h2>
                    <p className="text-sm text-slate-400 max-w-md mx-auto mb-6">
                        Log in to your operations portal or try our interactive EV Fleet Savings calculator.
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-4">
                        <Link to="/calculator" className="px-6 py-3 rounded-2xl font-black text-xs bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/25 transition-all">
                            Calculate Fleet ROI
                        </Link>
                        <Link to="/login" className="px-6 py-3 rounded-2xl font-black text-xs bg-white/10 hover:bg-white/15 text-white border border-white/10 transition-all">
                            Staff Login
                        </Link>
                    </div>
                </div>
            </div>
        </PublicLayout>
    );
};

export default FeaturesPage;

import React from 'react';
import { PublicLayout } from './PublicLayout';
import { FileText, ShieldAlert, CheckCircle, Scale, AlertTriangle } from 'lucide-react';

const TermsPage: React.FC = () => {
    const lastUpdated = "August 30, 2026";

    return (
        <PublicLayout>
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
                <div className="text-center mb-12">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold mb-4">
                        <Scale size={14} /> Legal Agreement
                    </div>
                    <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight mb-3">
                        Terms of Service
                    </h1>
                    <p className="text-sm text-slate-400">
                        Last Updated: <span className="text-slate-200 font-semibold">{lastUpdated}</span>
                    </p>
                </div>

                <div className="space-y-8 bg-white/[0.02] border border-white/10 rounded-3xl p-6 sm:p-10 text-slate-300 leading-relaxed text-sm">
                    <section className="space-y-3">
                        <h2 className="text-lg font-black text-white flex items-center gap-2 border-b border-white/10 pb-2">
                            <FileText size={18} className="text-emerald-400" /> 1. Acceptance of Terms
                        </h2>
                        <p>
                            By accessing and using the <strong>Triev Fleet</strong> application, mobile portals, and fleet operations services, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service. If you do not agree, you must immediately discontinue use of the platform.
                        </p>
                    </section>

                    <section className="space-y-3">
                        <h2 className="text-lg font-black text-white flex items-center gap-2 border-b border-white/10 pb-2">
                            <CheckCircle size={18} className="text-emerald-400" /> 2. EV Fleet Allotment & Rider Obligations
                        </h2>
                        <ul className="list-disc list-inside space-y-1.5 text-slate-300">
                            <li>All electric vehicles allotted via Triev Fleet remain the exclusive property of the company or its leasing partners.</li>
                            <li>Riders must possess a valid driving license and comply with all applicable traffic and motor vehicle regulations in India.</li>
                            <li>Riders are solely responsible for safe vehicle operation, routine charging, and avoiding battery deep discharges.</li>
                            <li>Unauthorized vehicle handover or sub-leasing to third parties will result in immediate allotment cancellation and recovery.</li>
                        </ul>
                    </section>

                    <section className="space-y-3">
                        <h2 className="text-lg font-black text-white flex items-center gap-2 border-b border-white/10 pb-2">
                            <Scale size={18} className="text-emerald-400" /> 3. Daily Rent Deductions & Wallet Management
                        </h2>
                        <p>
                            Daily rental charges are automatically calculated and deducted from the rider's digital wallet based on the agreed allotment rate. Riders must maintain a non-negative wallet balance. If a wallet balance falls into critical negative arrears, Triev Fleet reserves the right to suspend vehicle access and initiate debt recovery.
                        </p>
                    </section>

                    <section className="space-y-3">
                        <h2 className="text-lg font-black text-white flex items-center gap-2 border-b border-white/10 pb-2">
                            <ShieldAlert size={18} className="text-emerald-400" /> 4. Intellectual Property & System Access
                        </h2>
                        <p>
                            All software, user interfaces, AI models, algorithms, telematics analytics, logos, and documentation provided on Triev Fleet are protected by copyright and intellectual property laws. Users may not reverse-engineer, scrape, copy, or exploit any part of the service.
                        </p>
                    </section>

                    <section className="space-y-3">
                        <h2 className="text-lg font-black text-white flex items-center gap-2 border-b border-white/10 pb-2">
                            <AlertTriangle size={18} className="text-emerald-400" /> 5. Limitation of Liability
                        </h2>
                        <p>
                            Triev Fleet is provided on an "AS IS" and "AS AVAILABLE" basis. In no event shall Triev Fleet Technologies be liable for indirect, incidental, punitive, or consequential damages arising from vehicle breakdowns, third-party network outages, or unauthorized third-party access.
                        </p>
                    </section>
                </div>
            </div>
        </PublicLayout>
    );
};

export default TermsPage;

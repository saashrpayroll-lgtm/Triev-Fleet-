import React from 'react';
import { PublicLayout } from './PublicLayout';
import { AlertTriangle, ShieldCheck, Scale } from 'lucide-react';

const DisclaimerPage: React.FC = () => {
    return (
        <PublicLayout>
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
                <div className="text-center mb-12">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold mb-4">
                        <AlertTriangle size={14} /> Legal Disclaimer
                    </div>
                    <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight mb-3">
                        Platform Disclaimer
                    </h1>
                    <p className="text-sm text-slate-400">
                        Official operational and financial calculations disclaimer for Triev Fleet.
                    </p>
                </div>

                <div className="space-y-6 bg-white/[0.02] border border-white/10 rounded-3xl p-6 sm:p-10 text-slate-300 leading-relaxed text-sm">
                    <section className="space-y-3">
                        <h2 className="text-lg font-black text-white flex items-center gap-2 border-b border-white/10 pb-2">
                            <Scale size={18} className="text-amber-400" /> 1. General Information
                        </h2>
                        <p>
                            All calculations, ROI estimates, battery ranges, and financial metrics presented on <strong>Triev Fleet</strong> (including the EV Fleet Savings Calculator) are provided for general informational and operational planning purposes only.
                        </p>
                    </section>

                    <section className="space-y-3">
                        <h2 className="text-lg font-black text-white flex items-center gap-2 border-b border-white/10 pb-2">
                            <ShieldCheck size={18} className="text-amber-400" /> 2. Accuracy & Third-Party Telematics
                        </h2>
                        <p>
                            While we strive for 100% data integrity and precision, actual vehicle performance, electricity tariffs, and fuel consumption may vary based on terrain, rider driving behavior, weather conditions, payload, and battery degradation over time.
                        </p>
                    </section>

                    <section className="space-y-3">
                        <h2 className="text-lg font-black text-white flex items-center gap-2 border-b border-white/10 pb-2">
                            <AlertTriangle size={18} className="text-amber-400" /> 3. External Third-Party Links
                        </h2>
                        <p>
                            Our platform may contain links to external third-party websites or services (e.g., Google Ads Settings, WhatsApp Web, payment gateways). We do not control or assume responsibility for the content, privacy practices, or accuracy of any third-party websites.
                        </p>
                    </section>
                </div>
            </div>
        </PublicLayout>
    );
};

export default DisclaimerPage;

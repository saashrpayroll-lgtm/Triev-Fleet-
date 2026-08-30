import React, { useState } from 'react';
import { PublicLayout } from './PublicLayout';
import { HelpCircle, ChevronDown, Sparkles, MessageCircle, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

const faqs = [
    {
        q: "What is Triev Fleet and how does it work?",
        a: "Triev Fleet is an AI-powered electric vehicle (EV) fleet management and automated financial operations platform. It helps fleet owners and logistics managers track vehicle allotments, automate daily rent deductions from rider digital wallets, monitor battery and vehicle health, and evaluate team leader performance in real time."
    },
    {
        q: "How does the automated daily rent collection system operate?",
        a: "Every active rider on the platform has a connected digital fleet wallet. Based on their daily allotment rate, the system automatically schedules and deducts the daily rent at midnight or upon ledger sync. Team leaders can view positive, negative, and critical debt accounts with instant 1-click WhatsApp payment reminders."
    },
    {
        q: "What is the AI 5-Star Rider Rating Engine?",
        a: "Our deterministic rating algorithm analyzes five core metrics: Current Wallet Status (25%), Rent Collection Consistency (25%), Recharge Flow & Timing (20%), Balance Maintenance above ₹250 (15%), and Vehicle Tenure Stability (15%). It assigns a transparent 1 to 5 star rating and flags early churn risks."
    },
    {
        q: "Can I synchronize rider data directly from Google Sheets?",
        a: "Yes! Triev Fleet features live 2-way Google Sheets synchronization. Any new riders, vehicle chassis updates, or wallet balance adjustments made in your Google Sheet can be automatically ingested into the platform with zero manual file uploads."
    },
    {
        q: "Which roles and hierarchy does Triev Fleet support?",
        a: "Triev Fleet provides tailored role-based access for Admins (full operational and financial control), Reporting Managers (team oversight), City Operations Heads (city-wide KPIs), Team Leaders (daily rider management), and Riders."
    },
    {
        q: "Is Triev Fleet secure and compliant with data privacy laws?",
        a: "Yes. Triev Fleet is built on enterprise cloud infrastructure with HTTPS TLS 1.3 encryption, Supabase Row-Level Security (RLS), and full compliance with standard privacy, cookie, and AdSense data processing guidelines."
    }
];

const FAQPage: React.FC = () => {
    const [openIndex, setOpenIndex] = useState<number | null>(0);

    const toggle = (idx: number) => {
        setOpenIndex(openIndex === idx ? null : idx);
    };

    return (
        <PublicLayout>
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
                <div className="text-center mb-12">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-bold mb-4">
                        <HelpCircle size={14} /> Knowledge Base & Support
                    </div>
                    <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight mb-3">
                        Frequently Asked Questions
                    </h1>
                    <p className="text-sm text-slate-400">
                        Everything you need to know about Triev Fleet management, automated collections, and EV telematics.
                    </p>
                </div>

                <div className="space-y-4 mb-16">
                    {faqs.map((faq, idx) => {
                        const isOpen = openIndex === idx;
                        return (
                            <div
                                key={idx}
                                className="rounded-3xl bg-white/[0.02] border border-white/10 overflow-hidden transition-colors"
                            >
                                <button
                                    onClick={() => toggle(idx)}
                                    className="w-full p-6 text-left flex items-center justify-between gap-4 hover:bg-white/[0.02] transition-colors"
                                >
                                    <span className="font-black text-base text-white">{faq.q}</span>
                                    <ChevronDown
                                        size={20}
                                        className={`text-slate-400 shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-180 text-indigo-400' : ''}`}
                                    />
                                </button>
                                {isOpen && (
                                    <div className="px-6 pb-6 text-sm text-slate-300 leading-relaxed border-t border-white/5 pt-4">
                                        {faq.a}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Help CTA */}
                <div className="p-8 rounded-3xl bg-white/[0.02] border border-white/10 text-center space-y-3">
                    <h3 className="text-lg font-black text-white">Still have questions?</h3>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto">
                        Can't find the answer you're looking for? Reach out directly to our fleet support specialists.
                    </p>
                    <Link
                        to="/contact"
                        className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-xs bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-lg shadow-indigo-500/25"
                    >
                        <MessageCircle size={14} /> Contact Support Team
                    </Link>
                </div>
            </div>
        </PublicLayout>
    );
};

export default FAQPage;

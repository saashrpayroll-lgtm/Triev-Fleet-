import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ShieldCheck, FileText, Info, Mail, AlertTriangle, Phone, MapPin, Globe } from 'lucide-react';

export type LegalTab = 'privacy' | 'terms' | 'about' | 'contact' | 'disclaimer';

interface LegalInfoModalProps {
    isOpen: boolean;
    initialTab?: LegalTab;
    onClose: () => void;
}

export const LegalInfoModal: React.FC<LegalInfoModalProps> = ({ isOpen, initialTab = 'privacy', onClose }) => {
    const [activeTab, setActiveTab] = useState<LegalTab>(initialTab);

    if (!isOpen) return null;

    const navTabs = [
        { id: 'privacy', label: 'Privacy Policy', icon: ShieldCheck },
        { id: 'terms', label: 'Terms of Service', icon: FileText },
        { id: 'about', label: 'About Us', icon: Info },
        { id: 'contact', label: 'Contact Us', icon: Mail },
        { id: 'disclaimer', label: 'Disclaimer', icon: AlertTriangle },
    ] as const;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 selection:bg-indigo-500/30">
                {/* Backdrop */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="absolute inset-0 bg-black/80 backdrop-blur-md"
                />

                {/* Modal Window */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                    className="relative w-full max-w-4xl max-h-[85vh] flex flex-col rounded-3xl bg-[#090a16] border border-white/10 shadow-2xl overflow-hidden z-10"
                >
                    {/* Modal Header */}
                    <div className="flex items-center justify-between px-6 py-5 border-b border-white/10 bg-white/[0.02]">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-sm"
                                style={{ background: 'linear-gradient(135deg, #6366f1, #7c3aed)' }}>
                                T
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-white">Triev Fleet Legal & Compliance</h3>
                                <p className="text-xs text-slate-400 font-mono">Official Documentation & Policies</p>
                            </div>
                        </div>

                        <button
                            onClick={onClose}
                            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    {/* Navigation Tabs */}
                    <div className="flex items-center gap-1 px-6 pt-3 pb-2 border-b border-white/5 overflow-x-auto no-scrollbar bg-black/40">
                        {navTabs.map((tab) => {
                            const Icon = tab.icon;
                            const isActive = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id as LegalTab)}
                                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                                        isActive
                                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/25'
                                            : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                                    }`}
                                >
                                    <Icon size={15} />
                                    <span>{tab.label}</span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Modal Content Body */}
                    <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6 text-slate-300 text-sm leading-relaxed font-sans">
                        {activeTab === 'privacy' && (
                            <div className="space-y-4 animate-in fade-in">
                                <h4 className="text-xl font-black text-white flex items-center gap-2">
                                    <ShieldCheck className="text-indigo-400" /> Privacy Policy
                                </h4>
                                <p className="text-xs text-slate-400 font-mono">Last updated: August 14, 2026</p>
                                
                                <p>At <strong>Triev Fleet Manager</strong>, we prioritize the protection and confidentiality of your fleet operations, rider details, and organizational data. This Privacy Policy details how we collect, process, and safeguard information.</p>
                                
                                <h5 className="font-bold text-white text-base pt-2">1. Data We Collect</h5>
                                <ul className="list-disc pl-5 space-y-1 text-slate-300">
                                    <li><strong>Account Profile Data:</strong> Full Name, Email Address, Mobile Number, Role (Admin, City Ops, RM, TL).</li>
                                    <li><strong>Fleet & Rider Information:</strong> Chassis numbers, allotment dates, wallet balance logs, and team assignments.</li>
                                    <li><strong>System Logs:</strong> IP address, user agent, timestamps, and action types for security audit compliance.</li>
                                </ul>

                                <h5 className="font-bold text-white text-base pt-2">2. How Data is Used</h5>
                                <p>Your operational data is strictly processed to provide fleet management, risk matrix calculations, auto-call scheduling, and analytics. We <strong>never sell, rent, or trade</strong> your operational data to third parties.</p>

                                <h5 className="font-bold text-white text-base pt-2">3. Data Security & Storage</h5>
                                <p>All database records are protected with <strong>Row-Level Security (RLS)</strong> in Supabase PostgreSQL infrastructure and transmitted over 256-bit SSL/TLS encryption.</p>
                            </div>
                        )}

                        {activeTab === 'terms' && (
                            <div className="space-y-4 animate-in fade-in">
                                <h4 className="text-xl font-black text-white flex items-center gap-2">
                                    <FileText className="text-indigo-400" /> Terms of Service
                                </h4>
                                <p className="text-xs text-slate-400 font-mono">Effective Date: August 14, 2026</p>

                                <p>By accessing or using the <strong>Triev Fleet Manager</strong> platform, you agree to comply with and be bound by the following terms and conditions.</p>

                                <h5 className="font-bold text-white text-base pt-2">1. Authorized B2B SaaS Use</h5>
                                <p>Triev Fleet Manager is an enterprise fleet intelligence SaaS platform. Access is restricted to authorized company administrators, City Operations staff, Reporting Managers, and Team Leaders.</p>

                                <h5 className="font-bold text-white text-base pt-2">2. Account Credentials & Responsibility</h5>
                                <p>Users are responsible for maintaining the confidentiality of their login credentials. Any unauthorized access under an account must be reported immediately to system administrators.</p>

                                <h5 className="font-bold text-white text-base pt-2">3. Acceptable Use Policy</h5>
                                <p>Users must not tamper with API endpoints, attempt unauthorized SQL injection, or export confidential rider data without proper administrative authorization.</p>
                            </div>
                        )}

                        {activeTab === 'about' && (
                            <div className="space-y-4 animate-in fade-in">
                                <h4 className="text-xl font-black text-white flex items-center gap-2">
                                    <Info className="text-indigo-400" /> About Triev Fleet Manager
                                </h4>

                                <p className="text-base text-slate-200"><strong>Triev Fleet Manager</strong> is an advanced, full-stack EV fleet intelligence and automation platform engineered specifically for modern electric vehicle fleet operators, 3PL logistics, and last-mile delivery fleets.</p>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                                    <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10">
                                        <h6 className="font-bold text-white mb-1">⚡ Automated Risk Matrix</h6>
                                        <p className="text-xs text-slate-400">Heatmap color-coding (Green/Yellow/Red) for real-time rider wallet deficit monitoring.</p>
                                    </div>
                                    <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10">
                                        <h6 className="font-bold text-white mb-1">🤖 AI Virtual Copilot</h6>
                                        <p className="text-xs text-slate-400">Intelligent outbound collection scheduling and automated team leader insights.</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'contact' && (
                            <div className="space-y-4 animate-in fade-in">
                                <h4 className="text-xl font-black text-white flex items-center gap-2">
                                    <Mail className="text-indigo-400" /> Contact Us
                                </h4>

                                <p>Have questions about Triev Fleet Manager or need enterprise fleet setup assistance? Get in touch with our team:</p>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                                    <div className="flex items-start gap-3 p-4 rounded-2xl bg-white/[0.03] border border-white/10">
                                        <Mail className="text-indigo-400 mt-1 shrink-0" size={18} />
                                        <div>
                                            <p className="font-bold text-white text-xs">Email Support</p>
                                            <p className="text-slate-300 text-sm">support@triev.in</p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3 p-4 rounded-2xl bg-white/[0.03] border border-white/10">
                                        <Phone className="text-indigo-400 mt-1 shrink-0" size={18} />
                                        <div>
                                            <p className="font-bold text-white text-xs">Phone Inquiry</p>
                                            <p className="text-slate-300 text-sm">+91 1800-TRIEV-EV</p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3 p-4 rounded-2xl bg-white/[0.03] border border-white/10">
                                        <MapPin className="text-indigo-400 mt-1 shrink-0" size={18} />
                                        <div>
                                            <p className="font-bold text-white text-xs">Headquarters</p>
                                            <p className="text-slate-300 text-sm">Triev Fleet Technologies, Cyber City, India</p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3 p-4 rounded-2xl bg-white/[0.03] border border-white/10">
                                        <Globe className="text-indigo-400 mt-1 shrink-0" size={18} />
                                        <div>
                                            <p className="font-bold text-white text-xs">Official Portal</p>
                                            <p className="text-slate-300 text-sm">https://triev-fleet.vercel.app</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'disclaimer' && (
                            <div className="space-y-4 animate-in fade-in">
                                <h4 className="text-xl font-black text-white flex items-center gap-2">
                                    <AlertTriangle className="text-amber-400" /> Disclaimer
                                </h4>

                                <p>The information and analytics provided by <strong>Triev Fleet Manager</strong> (including wallet balances, rider status metrics, and AI risk predictions) are generated based on real-time data inputs and telemetry.</p>

                                <h5 className="font-bold text-white text-base pt-2">Operational Accuracy</h5>
                                <p>While every effort is made to maintain 100% data accuracy, fleet operators should verify critical financial transactions and rider vehicle allotments through official administrative logs.</p>
                            </div>
                        )}
                    </div>

                    {/* Modal Footer */}
                    <div className="flex items-center justify-between px-6 py-4 border-t border-white/10 bg-white/[0.02]">
                        <span className="text-xs text-slate-500 font-mono">© 2026 Triev Rider Technologies</span>
                        <button
                            onClick={onClose}
                            className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all"
                        >
                            Close
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

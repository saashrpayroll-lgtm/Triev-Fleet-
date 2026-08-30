import React from 'react';
import { PublicLayout } from './PublicLayout';
import { ShieldCheck, Lock, Eye, FileText, Bell, Globe, Mail } from 'lucide-react';
import { Link } from 'react-router-dom';

const PrivacyPolicyPage: React.FC = () => {
    const lastUpdated = "August 30, 2026";

    return (
        <PublicLayout>
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
                {/* Header */}
                <div className="text-center mb-12">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-bold mb-4">
                        <ShieldCheck size={14} /> Official Legal Documentation
                    </div>
                    <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight mb-3">
                        Privacy Policy
                    </h1>
                    <p className="text-sm text-slate-400">
                        Last Updated: <span className="text-slate-200 font-semibold">{lastUpdated}</span>
                    </p>
                </div>

                {/* Policy Content */}
                <div className="space-y-8 bg-white/[0.02] border border-white/10 rounded-3xl p-6 sm:p-10 text-slate-300 leading-relaxed text-sm">
                    <section className="space-y-3">
                        <h2 className="text-lg font-black text-white flex items-center gap-2 border-b border-white/10 pb-2">
                            <Eye size={18} className="text-indigo-400" /> 1. Introduction
                        </h2>
                        <p>
                            Welcome to <strong>Triev Fleet</strong> ("we," "our," or "us"). We are committed to protecting your privacy and ensuring the security of your personal and fleet data. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website <strong>https://triev-fleet.vercel.app</strong> or use our EV Fleet Management Application.
                        </p>
                        <p>
                            By accessing or using our services, you agree to the collection and use of information in accordance with this policy.
                        </p>
                    </section>

                    <section className="space-y-3">
                        <h2 className="text-lg font-black text-white flex items-center gap-2 border-b border-white/10 pb-2">
                            <FileText size={18} className="text-indigo-400" /> 2. Information We Collect
                        </h2>
                        <ul className="list-disc list-inside space-y-1.5 text-slate-300">
                            <li><strong>Identity & Contact Data:</strong> Rider name, mobile number, emergency contact, national identification (e.g., Driving License number for EV allotment).</li>
                            <li><strong>Vehicle & Telematics Data:</strong> Electric vehicle chassis number, allotment dates, daily active status, battery swap logs, and fleet operational metrics.</li>
                            <li><strong>Financial & Wallet Data:</strong> Daily rent deductions, wallet top-up transactions, outstanding dues, and payment reference numbers.</li>
                            <li><strong>Technical Data:</strong> IP address, browser type, device information, operating system, and log activity for security and fraud prevention.</li>
                        </ul>
                    </section>

                    <section className="space-y-3">
                        <h2 className="text-lg font-black text-white flex items-center gap-2 border-b border-white/10 pb-2">
                            <Lock size={18} className="text-indigo-400" /> 3. How We Use Your Information
                        </h2>
                        <p>We use the collected information for the following business and operational purposes:</p>
                        <ul className="list-disc list-inside space-y-1.5 text-slate-300">
                            <li>Managing electric vehicle allotments and returns for delivery riders.</li>
                            <li>Calculating automated daily rent charges, wallet balances, and incentive payouts.</li>
                            <li>Providing real-time operations dashboards for Team Leaders, Reporting Managers, and City Operations heads.</li>
                            <li>Generating automated SMS/WhatsApp alerts regarding low wallet balances or urgent service updates.</li>
                            <li>Complying with legal obligations and preventing unauthorized system access or financial fraud.</li>
                        </ul>
                    </section>

                    <section className="space-y-3">
                        <h2 className="text-lg font-black text-white flex items-center gap-2 border-b border-white/10 pb-2">
                            <Globe size={18} className="text-indigo-400" /> 4. Cookies, Web Beacons & Third-Party Advertising (Google AdSense)
                        </h2>
                        <p>
                            Our website may use cookies, web beacons, and similar tracking technologies to enhance user experience, analyze website traffic, and display personalized advertisements.
                        </p>
                        <div className="bg-indigo-950/30 border border-indigo-500/20 rounded-2xl p-4 space-y-2">
                            <h3 className="font-bold text-white text-xs uppercase tracking-wider">Google AdSense Disclosure:</h3>
                            <p className="text-xs text-slate-300 leading-relaxed">
                                Third-party vendors, including Google, use cookies (such as the DoubleClick DART cookie) to serve ads based on a user's prior visits to our website or other websites on the Internet. Users may opt out of personalized advertising by visiting <a href="https://www.google.com/settings/ads" target="_blank" rel="noopener noreferrer" className="text-indigo-400 underline">Google Ads Settings</a> or <a href="https://www.aboutads.info" target="_blank" rel="noopener noreferrer" className="text-indigo-400 underline">aboutads.info</a>.
                            </p>
                        </div>
                    </section>

                    <section className="space-y-3">
                        <h2 className="text-lg font-black text-white flex items-center gap-2 border-b border-white/10 pb-2">
                            <ShieldCheck size={18} className="text-indigo-400" /> 5. Data Security & Retention
                        </h2>
                        <p>
                            We employ enterprise-grade cloud security measures, including HTTPS encryption, Row-Level Security (RLS) policies, and encrypted database connections. We retain your operational and transaction data only as long as necessary to fulfill fleet management purposes and satisfy regulatory compliance requirements.
                        </p>
                    </section>

                    <section className="space-y-3">
                        <h2 className="text-lg font-black text-white flex items-center gap-2 border-b border-white/10 pb-2">
                            <Bell size={18} className="text-indigo-400" /> 6. Your Rights & Choices
                        </h2>
                        <p>
                            Under applicable privacy laws, you have the right to request access to your personal data, request correction of inaccurate records, or request deletion of your account. To exercise any of these rights, please reach out to our Grievance Officer.
                        </p>
                    </section>

                    <section className="space-y-3">
                        <h2 className="text-lg font-black text-white flex items-center gap-2 border-b border-white/10 pb-2">
                            <Mail size={18} className="text-indigo-400" /> 7. Contact Us & Grievance Officer
                        </h2>
                        <p>If you have any questions regarding this Privacy Policy or our data practices, please contact us at:</p>
                        <div className="bg-white/[0.04] p-4 rounded-2xl border border-white/10 text-xs space-y-1">
                            <p><strong>Triev Fleet Technologies</strong></p>
                            <p>Email: <a href="mailto:support@triev.in" className="text-indigo-400">support@triev.in</a> / <a href="mailto:legal@triev.in" className="text-indigo-400">legal@triev.in</a></p>
                            <p>Operational Headquarters: New Delhi, India</p>
                        </div>
                    </section>
                </div>
            </div>
        </PublicLayout>
    );
};

export default PrivacyPolicyPage;

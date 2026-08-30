import React, { useState } from 'react';
import { PublicLayout } from './PublicLayout';
import { Mail, Clock, MapPin, Send, CheckCircle2, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';

const ContactPage: React.FC = () => {
    const primaryEmail = "saasappinfo@gmail.com";

    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        subject: 'Fleet Partnership Inquiry',
        message: ''
    });
    const [isSubmitted, setIsSubmitted] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name || !formData.email || !formData.message) {
            toast.error("Please fill in all required fields.");
            return;
        }

        // Generate direct mailto link as a transparent fallback
        const mailtoUrl = `mailto:${primaryEmail}?subject=${encodeURIComponent(`[Triev Fleet Inquiry] ${formData.subject}`)}&body=${encodeURIComponent(
            `Name: ${formData.name}\nEmail: ${formData.email}\nPhone: ${formData.phone || 'N/A'}\n\nMessage:\n${formData.message}`
        )}`;

        setIsSubmitted(true);
        toast.success(`Inquiry recorded! Redirecting to mail client for ${primaryEmail}...`);
        
        // Open user's email client after brief confirmation
        setTimeout(() => {
            window.location.href = mailtoUrl;
        }, 1200);
    };

    return (
        <PublicLayout>
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
                <div className="text-center max-w-2xl mx-auto mb-12">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-bold mb-4">
                        <MessageSquare size={14} /> Official Support & Inquiries
                    </div>
                    <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight mb-3">
                        Contact Triev Fleet Support
                    </h1>
                    <p className="text-sm text-slate-400">
                        Have questions about EV fleet onboarding, daily rent settlement, or technical support? Directly reach our team at <span className="text-indigo-400 font-bold">{primaryEmail}</span>.
                    </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left: Contact Info Cards */}
                    <div className="space-y-4">
                        <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/10 space-y-2">
                            <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-3">
                                <Mail size={18} />
                            </div>
                            <h3 className="font-black text-sm text-white">Direct Email Support</h3>
                            <p className="text-xs text-slate-400">Primary contact for all inquiries:</p>
                            <a
                                href={`mailto:${primaryEmail}`}
                                className="text-xs font-black text-indigo-400 block hover:underline break-all"
                            >
                                {primaryEmail}
                            </a>
                            <div className="pt-2">
                                <a
                                    href={`mailto:${primaryEmail}?subject=Triev%20Fleet%20Support%20Request`}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 text-[11px] font-bold transition-all border border-indigo-500/20"
                                >
                                    <Send size={11} /> Open Mail Client
                                </a>
                            </div>
                        </div>

                        <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/10 space-y-2">
                            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-3">
                                <Clock size={18} />
                            </div>
                            <h3 className="font-black text-sm text-white">Operating Hours</h3>
                            <p className="text-xs text-slate-400">Support Desk Availability:</p>
                            <p className="text-xs font-semibold text-slate-200">Monday – Saturday: 9:00 AM – 8:00 PM IST</p>
                            <p className="text-xs text-slate-500">Sunday: Priority Email Support</p>
                        </div>

                        <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/10 space-y-2">
                            <div className="w-10 h-10 rounded-2xl bg-purple-500/10 text-purple-400 flex items-center justify-center mb-3">
                                <MapPin size={18} />
                            </div>
                            <h3 className="font-black text-sm text-white">Headquarters</h3>
                            <p className="text-xs text-slate-400">Triev Fleet Technologies</p>
                            <p className="text-xs text-slate-300">National Capital Region (NCR), New Delhi, India</p>
                        </div>
                    </div>

                    {/* Right: Contact Form */}
                    <div className="lg:col-span-2 p-8 sm:p-10 rounded-3xl bg-white/[0.02] border border-white/10">
                        {isSubmitted ? (
                            <div className="py-12 text-center space-y-4">
                                <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-400 mx-auto flex items-center justify-center">
                                    <CheckCircle2 size={36} />
                                </div>
                                <h3 className="text-2xl font-black text-white">Inquiry Prepared for {primaryEmail}!</h3>
                                <p className="text-sm text-slate-400 max-w-md mx-auto">
                                    Thank you, {formData.name}. If your mail client did not open automatically, please send your email directly to <strong className="text-indigo-400">{primaryEmail}</strong>.
                                </p>
                                <button
                                    onClick={() => {
                                        setIsSubmitted(false);
                                        setFormData({ name: '', email: '', phone: '', subject: 'Fleet Partnership Inquiry', message: '' });
                                    }}
                                    className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs"
                                >
                                    Send Another Inquiry
                                </button>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} className="space-y-5">
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="text-xl font-black text-white">Send Us a Direct Message</h3>
                                    <span className="text-[11px] text-slate-400 font-mono">Recipient: {primaryEmail}</span>
                                </div>
                                
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-300 mb-1.5">Your Full Name *</label>
                                        <input
                                            type="text"
                                            required
                                            value={formData.name}
                                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                                            placeholder="e.g. Rahul Sharma"
                                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-300 mb-1.5">Email Address *</label>
                                        <input
                                            type="email"
                                            required
                                            value={formData.email}
                                            onChange={e => setFormData({ ...formData, email: e.target.value })}
                                            placeholder="e.g. rahul@domain.com"
                                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-300 mb-1.5">Mobile Number</label>
                                        <input
                                            type="tel"
                                            value={formData.phone}
                                            onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                            placeholder="+91 98765 43210"
                                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-300 mb-1.5">Inquiry Subject</label>
                                        <select
                                            value={formData.subject}
                                            onChange={e => setFormData({ ...formData, subject: e.target.value })}
                                            className="w-full bg-[#0a0b18] border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                                        >
                                            <option value="Fleet Partnership Inquiry">Fleet Partnership Inquiry</option>
                                            <option value="Rider Allotment Support">Rider Allotment Support</option>
                                            <option value="Rent / Wallet Deduction Query">Rent / Wallet Deduction Query</option>
                                            <option value="Technical Bug / Portal Access">Technical Bug / Portal Access</option>
                                            <option value="Other">Other</option>
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-300 mb-1.5">Message / Details *</label>
                                    <textarea
                                        required
                                        rows={4}
                                        value={formData.message}
                                        onChange={e => setFormData({ ...formData, message: e.target.value })}
                                        placeholder="Please provide details about your inquiry..."
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors resize-none"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    className="flex items-center justify-center gap-2 w-full sm:w-auto px-8 py-3.5 rounded-2xl font-black text-xs text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 shadow-lg shadow-indigo-500/25 transition-all cursor-pointer"
                                >
                                    <Send size={14} /> Send Inquiry to {primaryEmail}
                                </button>
                            </form>
                        )}
                    </div>
                </div>
            </div>
        </PublicLayout>
    );
};

export default ContactPage;

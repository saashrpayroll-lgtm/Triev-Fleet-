import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Zap, ShieldCheck, ArrowRight, Sparkles, LogIn, Lock } from 'lucide-react';

interface PublicLayoutProps {
    children: React.ReactNode;
}

export const PublicLayout: React.FC<PublicLayoutProps> = ({ children }) => {
    const location = useLocation();

    const navLinks = [
        { label: 'Home', path: '/' },
        { label: 'Features', path: '/features' },
        { label: 'EV Calculator', path: '/calculator' },
        { label: 'FAQ', path: '/faq' },
        { label: 'About Us', path: '/about' },
        { label: 'Contact', path: '/contact' },
    ];

    return (
        <div className="min-h-screen bg-[#030310] text-slate-100 font-sans selection:bg-indigo-500/30 flex flex-col">
            {/* Top Navigation */}
            <header className="sticky top-0 z-40 backdrop-blur-xl bg-[#030310]/80 border-b border-white/10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
                    {/* Brand */}
                    <Link to="/" className="flex items-center gap-3 group">
                        <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-white font-black text-lg shadow-lg shadow-indigo-500/30 group-hover:scale-105 transition-transform"
                            style={{ background: 'linear-gradient(135deg, #6366f1, #7c3aed)' }}>
                            ⚡
                        </div>
                        <div>
                            <span className="text-xl font-black tracking-tight text-white flex items-center gap-1.5">
                                Triev <span className="bg-gradient-to-r from-indigo-400 to-emerald-400 bg-clip-text text-transparent">Fleet</span>
                            </span>
                            <span className="text-[10px] text-slate-400 block -mt-1 tracking-wider uppercase font-semibold">EV Operations</span>
                        </div>
                    </Link>

                    {/* Navigation Links */}
                    <nav className="hidden md:flex items-center gap-1 bg-white/[0.03] border border-white/10 rounded-2xl p-1.5">
                        {navLinks.map(link => {
                            const isActive = location.pathname === link.path;
                            return (
                                <Link
                                    key={link.path}
                                    to={link.path}
                                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                                        isActive
                                            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/25'
                                            : 'text-slate-300 hover:text-white hover:bg-white/5'
                                    }`}
                                >
                                    {link.label}
                                </Link>
                            );
                        })}
                    </nav>

                    {/* Portal Login CTAs */}
                    <div className="flex items-center gap-2 sm:gap-3">
                        <Link
                            to="/login"
                            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-200 bg-white/5 hover:bg-white/10 border border-white/10 transition-all hover:border-white/20"
                        >
                            <LogIn size={14} className="text-indigo-400" />
                            <span className="hidden sm:inline">Rider / TL Login</span>
                            <span className="sm:hidden">Login</span>
                        </Link>
                        <Link
                            to="/admin-login"
                            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 shadow-lg shadow-indigo-500/25 transition-all hover:scale-105"
                        >
                            <Lock size={14} />
                            <span className="hidden sm:inline">Admin Portal</span>
                            <span className="sm:hidden">Admin</span>
                        </Link>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1">
                {children}
            </main>

            {/* Public SEO Footer */}
            <footer className="border-t border-white/10 bg-[#02020a] mt-auto">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
                        {/* Column 1: Brand Info */}
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-emerald-500 flex items-center justify-center text-white font-bold text-sm">
                                    ⚡
                                </div>
                                <span className="font-black text-lg text-white">Triev Fleet</span>
                            </div>
                            <p className="text-xs text-slate-400 leading-relaxed">
                                India's premier EV fleet management and automated rent collection system. Optimizing electric vehicle delivery operations with intelligent telematics.
                            </p>
                            <div className="flex items-center gap-2 text-xs text-emerald-400 font-semibold pt-1">
                                <ShieldCheck size={14} /> 100% Cloud Security & Compliance
                            </div>
                        </div>

                        {/* Column 2: Solutions */}
                        <div>
                            <h4 className="text-xs font-black uppercase tracking-wider text-slate-300 mb-3">Solutions</h4>
                            <ul className="space-y-2 text-xs text-slate-400">
                                <li><Link to="/features" className="hover:text-indigo-400 transition-colors">EV Rider Tracking</Link></li>
                                <li><Link to="/features" className="hover:text-indigo-400 transition-colors">Automated Rent Recovery</Link></li>
                                <li><Link to="/calculator" className="hover:text-indigo-400 transition-colors">EV Fleet Savings Calculator</Link></li>
                                <li><Link to="/features" className="hover:text-indigo-400 transition-colors">Team Leader Operations</Link></li>
                            </ul>
                        </div>

                        {/* Column 3: Quick Links */}
                        <div>
                            <h4 className="text-xs font-black uppercase tracking-wider text-slate-300 mb-3">Company</h4>
                            <ul className="space-y-2 text-xs text-slate-400">
                                <li><Link to="/about" className="hover:text-indigo-400 transition-colors">About Us</Link></li>
                                <li><Link to="/faq" className="hover:text-indigo-400 transition-colors">Frequently Asked Questions</Link></li>
                                <li><Link to="/contact" className="hover:text-indigo-400 transition-colors">Contact Support</Link></li>
                                <li><Link to="/login" className="hover:text-indigo-400 transition-colors">Staff Portal Login</Link></li>
                            </ul>
                        </div>

                        {/* Column 4: Legal & AdSense Compliance */}
                        <div>
                            <h4 className="text-xs font-black uppercase tracking-wider text-slate-300 mb-3">Legal & Policies</h4>
                            <ul className="space-y-2 text-xs text-slate-400">
                                <li><Link to="/privacy-policy" className="hover:text-indigo-400 transition-colors">Privacy Policy</Link></li>
                                <li><Link to="/terms" className="hover:text-indigo-400 transition-colors">Terms of Service</Link></li>
                                <li><Link to="/disclaimer" className="hover:text-indigo-400 transition-colors">Disclaimer</Link></li>
                                <li><Link to="/contact" className="hover:text-indigo-400 transition-colors">Grievance Officer</Link></li>
                            </ul>
                        </div>
                    </div>

                    <div className="pt-8 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
                        <p>© {new Date().getFullYear()} Triev Fleet Technologies. All rights reserved.</p>
                        <div className="flex items-center gap-6">
                            <Link to="/privacy-policy" className="hover:text-slate-400 transition-colors">Privacy</Link>
                            <Link to="/terms" className="hover:text-slate-400 transition-colors">Terms</Link>
                            <Link to="/disclaimer" className="hover:text-slate-400 transition-colors">Disclaimer</Link>
                            <Link to="/contact" className="hover:text-slate-400 transition-colors">Contact</Link>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default PublicLayout;

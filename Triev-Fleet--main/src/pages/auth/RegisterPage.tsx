import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, UserPlus, Sparkles, Mail, Lock, User, Phone, MapPin, Check, X } from 'lucide-react';
import { supabase } from '@/config/supabase';
import AnimatedBackground from '@/components/auth/AnimatedBackground';

const RegisterPage: React.FC = () => {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        fullName: '',
        email: '',
        mobile: '',
        password: '',
        confirmPassword: '',
        jobLocation: '',
        agreeToTerms: false
    });
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    // Password strength validation
    const passwordStrength = {
        hasMinLength: formData.password.length >= 6,
        hasNumber: /\d/.test(formData.password),
        hasLetter: /[a-zA-Z]/.test(formData.password),
        passwordsMatch: formData.password === formData.confirmPassword && formData.confirmPassword.length > 0
    };

    const isPasswordStrong = passwordStrength.hasMinLength && passwordStrength.hasNumber && passwordStrength.hasLetter;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        // Validation
        if (!formData.agreeToTerms) {
            setError('Please agree to the terms and conditions');
            return;
        }

        if (!isPasswordStrong) {
            setError('Password must be at least 6 characters with at least one number and one letter');
            return;
        }

        if (!passwordStrength.passwordsMatch) {
            setError('Passwords do not match');
            return;
        }

        // Mobile validation
        if (!/^[6-9]\d{9}$/.test(formData.mobile)) {
            setError('Please enter a valid 10-digit mobile number');
            return;
        }

        setLoading(true);

        try {
            // Create user in Supabase Auth
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: formData.email,
                password: formData.password,
            });

            if (authError) throw authError;

            if (authData.user) {
                // Create user record in users table
                const { error: dbError } = await supabase
                    .from('users')
                    .insert([{
                        id: authData.user.id,
                        email: formData.email,
                        full_name: formData.fullName,
                        mobile: formData.mobile,
                        job_location: formData.jobLocation,
                        role: 'teamLeader', // Default role
                        status: 'active',
                        created_at: new Date().toISOString()
                    }]);

                if (dbError) throw dbError;

                // Show success animation
                setSuccess(true);

                // Redirect to login after 2 seconds
                setTimeout(() => {
                    navigate('/login');
                }, 2000);
            }
        } catch (err: any) {
            console.error('Registration error:', err);
            setError(err.message || 'Failed to create account. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <>
                <AnimatedBackground variant="register" />
                <div className="min-h-screen flex items-center justify-center p-4 relative z-10">
                    <div className="text-center animate-in fade-in zoom-in duration-500">
                        <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-green-500/20 backdrop-blur-xl border-4 border-green-500/50 mb-6">
                            <Check className="w-12 h-12 text-green-500" />
                        </div>
                        <h2 className="text-4xl font-bold text-white mb-4">Account Created!</h2>
                        <p className="text-white/80 text-lg">Redirecting you to login...</p>
                    </div>
                </div>
            </>
        );
    }

    return (
        <>
            <AnimatedBackground variant="register" />

            <div className="min-h-screen flex items-center justify-center p-4 relative z-10 py-12">
                <div className="w-full max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-700">
                    {/* Logo and Title */}
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-white/20 to-white/5 backdrop-blur-xl border border-white/30 mb-4 shadow-2xl">
                            <Sparkles className="w-10 h-10 text-white" />
                        </div>
                        <h1 className="text-5xl font-bold text-white mb-2 drop-shadow-lg">
                            Join Triev Rider Pro
                        </h1>
                        <p className="text-white/80 text-lg">Create your account to get started</p>
                    </div>

                    {/* Register Card */}
                    <div className="glass-morphism rounded-3xl p-8 shadow-2xl">
                        <form onSubmit={handleSubmit} className="space-y-5">
                            {/* Error Message */}
                            {error && (
                                <div className="bg-red-500/10 backdrop-blur-sm border border-red-500/30 text-red-100 px-4 py-3 rounded-xl text-sm animate-in fade-in slide-in-from-top-2 duration-300 flex items-start gap-2">
                                    <X className="w-5 h-5 flex-shrink-0 mt-0.5" />
                                    <span>{error}</span>
                                </div>
                            )}

                            {/* Two Column Layout */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                {/* Full Name */}
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-white/90 flex items-center gap-2">
                                        <User className="w-4 h-4" />
                                        Full Name
                                    </label>
                                    <input
                                        type="text"
                                        name="fullName"
                                        value={formData.fullName}
                                        onChange={handleChange}
                                        className="w-full px-4 py-3 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-transparent transition-all duration-300"
                                        placeholder="John Doe"
                                        required
                                    />
                                </div>

                                {/* Mobile */}
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-white/90 flex items-center gap-2">
                                        <Phone className="w-4 h-4" />
                                        Mobile Number
                                    </label>
                                    <input
                                        type="tel"
                                        name="mobile"
                                        value={formData.mobile}
                                        onChange={handleChange}
                                        className="w-full px-4 py-3 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-transparent transition-all duration-300"
                                        placeholder="9876543210"
                                        required
                                        maxLength={10}
                                    />
                                </div>
                            </div>

                            {/* Email */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-white/90 flex items-center gap-2">
                                    <Mail className="w-4 h-4" />
                                    Email Address
                                </label>
                                <input
                                    type="email"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    className="w-full px-4 py-3 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-transparent transition-all duration-300"
                                    placeholder="john@example.com"
                                    required
                                />
                            </div>

                            {/* Job Location */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-white/90 flex items-center gap-2">
                                    <MapPin className="w-4 h-4" />
                                    Job Location
                                </label>
                                <input
                                    type="text"
                                    name="jobLocation"
                                    value={formData.jobLocation}
                                    onChange={handleChange}
                                    className="w-full px-4 py-3 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-transparent transition-all duration-300"
                                    placeholder="Mumbai, India"
                                />
                            </div>

                            {/* Password Fields */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                {/* Password */}
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-white/90 flex items-center gap-2">
                                        <Lock className="w-4 h-4" />
                                        Password
                                    </label>
                                    <div className="relative">
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            name="password"
                                            value={formData.password}
                                            onChange={handleChange}
                                            className="w-full px-4 py-3 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-transparent transition-all duration-300 pr-12"
                                            placeholder="••••••••"
                                            required
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white transition-colors p-1"
                                        >
                                            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                        </button>
                                    </div>
                                </div>

                                {/* Confirm Password */}
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-white/90 flex items-center gap-2">
                                        <Lock className="w-4 h-4" />
                                        Confirm Password
                                    </label>
                                    <div className="relative">
                                        <input
                                            type={showConfirmPassword ? 'text' : 'password'}
                                            name="confirmPassword"
                                            value={formData.confirmPassword}
                                            onChange={handleChange}
                                            className="w-full px-4 py-3 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-transparent transition-all duration-300 pr-12"
                                            placeholder="••••••••"
                                            required
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white transition-colors p-1"
                                        >
                                            {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Password Strength Indicators */}
                            {formData.password && (
                                <div className="space-y-2 p-4 bg-white/5 backdrop-blur-sm rounded-xl border border-white/10">
                                    <p className="text-sm font-medium text-white/90 mb-2">Password Requirements:</p>
                                    <div className="space-y-1.5">
                                        <div className={`flex items-center gap-2 text-sm ${passwordStrength.hasMinLength ? 'text-green-400' : 'text-white/50'}`}>
                                            {passwordStrength.hasMinLength ? <Check size={16} /> : <X size={16} />}
                                            <span>At least 6 characters</span>
                                        </div>
                                        <div className={`flex items-center gap-2 text-sm ${passwordStrength.hasNumber ? 'text-green-400' : 'text-white/50'}`}>
                                            {passwordStrength.hasNumber ? <Check size={16} /> : <X size={16} />}
                                            <span>At least one number</span>
                                        </div>
                                        <div className={`flex items-center gap-2 text-sm ${passwordStrength.hasLetter ? 'text-green-400' : 'text-white/50'}`}>
                                            {passwordStrength.hasLetter ? <Check size={16} /> : <X size={16} />}
                                            <span>At least one letter</span>
                                        </div>
                                        {formData.confirmPassword && (
                                            <div className={`flex items-center gap-2 text-sm ${passwordStrength.passwordsMatch ? 'text-green-400' : 'text-red-400'}`}>
                                                {passwordStrength.passwordsMatch ? <Check size={16} /> : <X size={16} />}
                                                <span>Passwords match</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Terms & Conditions */}
                            <label className="flex items-start gap-3 text-sm text-white/80 cursor-pointer group">
                                <input
                                    type="checkbox"
                                    checked={formData.agreeToTerms}
                                    onChange={(e) => setFormData({ ...formData, agreeToTerms: e.target.checked })}
                                    className="w-5 h-5 mt-0.5 rounded border-white/30 bg-white/10 text-white focus:ring-white/50 focus:ring-offset-0 cursor-pointer flex-shrink-0"
                                    required
                                />
                                <span className="group-hover:text-white transition-colors">
                                    I agree to the{' '}
                                    <a href="/terms" className="text-white font-semibold hover:underline">
                                        Terms and Conditions
                                    </a>
                                    {' '}and{' '}
                                    <a href="/privacy" className="text-white font-semibold hover:underline">
                                        Privacy Policy
                                    </a>
                                </span>
                            </label>

                            {/* Register Button */}
                            <button
                                type="submit"
                                disabled={loading || !formData.agreeToTerms}
                                className="w-full bg-white text-cyan-600 font-semibold py-3 px-6 rounded-xl hover:bg-white/90 focus:outline-none focus:ring-2 focus:ring-white/50 focus:ring-offset-2 focus:ring-offset-transparent transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]"
                            >
                                {loading ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-cyan-600/30 border-t-cyan-600 rounded-full animate-spin" />
                                        <span>Creating Account...</span>
                                    </>
                                ) : (
                                    <>
                                        <UserPlus size={20} />
                                        <span>Create Account</span>
                                    </>
                                )}
                            </button>
                        </form>

                        {/* Sign In Link */}
                        <div className="mt-6 text-center text-sm text-white/70">
                            Already have an account?{' '}
                            <a href="/login" className="text-white font-semibold hover:underline">
                                Sign in
                            </a>
                        </div>
                    </div>

                    {/* Footer */}
                    <p className="text-center text-sm text-white/50 mt-6">
                        © 2026 Triev Rider Pro. All rights reserved.
                    </p>
                </div>
            </div>
        </>
    );
};

export default RegisterPage;

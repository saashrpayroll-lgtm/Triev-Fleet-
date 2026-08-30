import React, { useState } from 'react';
import { PublicLayout } from './PublicLayout';
import { Calculator, Zap, Fuel, Leaf } from 'lucide-react';
import { Link } from 'react-router-dom';

const CalculatorPage: React.FC = () => {
    // Calculator State
    const [fleetSize, setFleetSize] = useState<number>(25);
    const [dailyKmPerVehicle, setDailyKmPerVehicle] = useState<number>(80);
    const [petrolPrice, setPetrolPrice] = useState<number>(96);
    const [petrolMileage, setPetrolMileage] = useState<number>(35); // km per liter
    const [electricityRate, setElectricityRate] = useState<number>(8); // Rs per kWh
    const [evMileage, setEvMileage] = useState<number>(30); // km per kWh

    // Calculations
    const dailyKmTotal = fleetSize * dailyKmPerVehicle;
    
    // Petrol cost per day
    const petrolCostPerDay = (dailyKmTotal / petrolMileage) * petrolPrice;
    const petrolCostPerMonth = petrolCostPerDay * 30;
    const petrolCostPerYear = petrolCostPerMonth * 12;

    // EV charging / battery cost per day
    const evCostPerDay = (dailyKmTotal / evMileage) * electricityRate;
    const evCostPerMonth = evCostPerDay * 30;
    const evCostPerYear = evCostPerMonth * 12;

    // Net Savings
    const monthlySavings = Math.round(petrolCostPerMonth - evCostPerMonth);
    const yearlySavings = Math.round(petrolCostPerYear - evCostPerYear);
    const co2SavedKg = Math.round(dailyKmTotal * 0.12 * 365); // ~120g CO2 per km petrol 2-wheeler

    return (
        <PublicLayout>
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
                <div className="text-center max-w-2xl mx-auto mb-12">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold mb-4">
                        <Calculator size={14} /> Interactive ROI Tool
                    </div>
                    <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight mb-3">
                        EV Fleet Savings & ROI Calculator
                    </h1>
                    <p className="text-sm text-slate-400">
                        Estimate how much your delivery fleet saves by switching from petrol two-wheelers to electric vehicles managed via Triev Fleet.
                    </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* Left Controls (5 cols) */}
                    <div className="lg:col-span-5 space-y-6 bg-white/[0.02] border border-white/10 rounded-3xl p-6 sm:p-8">
                        <h3 className="text-base font-black text-white border-b border-white/10 pb-3 flex items-center gap-2">
                            <Zap size={18} className="text-indigo-400" /> Fleet Parameters
                        </h3>

                        {/* Fleet Size Slider */}
                        <div>
                            <div className="flex justify-between text-xs font-bold mb-2">
                                <span className="text-slate-300">Fleet Size (Vehicles)</span>
                                <span className="text-indigo-400 font-mono font-black">{fleetSize} EVs</span>
                            </div>
                            <input
                                type="range"
                                min="1"
                                max="500"
                                value={fleetSize}
                                onChange={e => setFleetSize(Number(e.target.value))}
                                className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                            />
                            <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                                <span>1 EV</span>
                                <span>250 EVs</span>
                                <span>500 EVs</span>
                            </div>
                        </div>

                        {/* Daily KM Slider */}
                        <div>
                            <div className="flex justify-between text-xs font-bold mb-2">
                                <span className="text-slate-300">Avg Daily Run / Rider</span>
                                <span className="text-emerald-400 font-mono font-black">{dailyKmPerVehicle} km / day</span>
                            </div>
                            <input
                                type="range"
                                min="20"
                                max="200"
                                step="5"
                                value={dailyKmPerVehicle}
                                onChange={e => setDailyKmPerVehicle(Number(e.target.value))}
                                className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                            />
                            <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                                <span>20 km</span>
                                <span>100 km</span>
                                <span>200 km</span>
                            </div>
                        </div>

                        {/* Fuel Price & Mileage inputs */}
                        <div className="grid grid-cols-2 gap-3 pt-2">
                            <div>
                                <label className="block text-[11px] font-bold text-slate-400 mb-1">Petrol Price (₹/L)</label>
                                <input
                                    type="number"
                                    value={petrolPrice}
                                    onChange={e => setPetrolPrice(Number(e.target.value))}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
                                />
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-slate-400 mb-1">Petrol Mileage (km/L)</label>
                                <input
                                    type="number"
                                    value={petrolMileage}
                                    onChange={e => setPetrolMileage(Number(e.target.value))}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-[11px] font-bold text-slate-400 mb-1">Power Rate (₹/kWh)</label>
                                <input
                                    type="number"
                                    value={electricityRate}
                                    onChange={e => setElectricityRate(Number(e.target.value))}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
                                />
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-slate-400 mb-1">EV Range (km/kWh)</label>
                                <input
                                    type="number"
                                    value={evMileage}
                                    onChange={e => setEvMileage(Number(e.target.value))}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Right Savings Output (7 cols) */}
                    <div className="lg:col-span-7 space-y-6">
                        {/* Major Highlight Card */}
                        <div className="p-8 rounded-3xl bg-gradient-to-br from-emerald-950/40 via-indigo-950/30 to-[#090a16] border border-emerald-500/30 relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                                <Leaf size={120} className="text-emerald-400" />
                            </div>

                            <p className="text-xs font-black uppercase tracking-widest text-emerald-400 mb-2">Estimated Fleet Savings</p>
                            <h2 className="text-4xl sm:text-5xl font-black text-white mb-2 tracking-tight">
                                ₹{monthlySavings.toLocaleString('en-IN')}
                                <span className="text-sm font-semibold text-slate-400 font-sans"> / month</span>
                            </h2>
                            <p className="text-xs text-slate-300 font-semibold mb-6">
                                That's <strong className="text-emerald-400 font-mono text-sm">₹{yearlySavings.toLocaleString('en-IN')}</strong> in annual operational fuel savings for {fleetSize} electric vehicles!
                            </p>

                            {/* Comparison Row */}
                            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10">
                                <div className="p-4 rounded-2xl bg-black/40 border border-white/5">
                                    <div className="flex items-center gap-1.5 text-xs text-rose-400 font-bold mb-1">
                                        <Fuel size={14} /> Petrol Fleet Cost
                                    </div>
                                    <p className="text-lg font-black text-white">₹{Math.round(petrolCostPerMonth).toLocaleString('en-IN')}</p>
                                    <p className="text-[10px] text-slate-500">per month</p>
                                </div>

                                <div className="p-4 rounded-2xl bg-black/40 border border-white/5">
                                    <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-bold mb-1">
                                        <Zap size={14} /> EV Charging Cost
                                    </div>
                                    <p className="text-lg font-black text-white">₹{Math.round(evCostPerMonth).toLocaleString('en-IN')}</p>
                                    <p className="text-[10px] text-slate-500">per month</p>
                                </div>
                            </div>
                        </div>

                        {/* Carbon Offset Card */}
                        <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/10 flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
                                <Leaf size={24} />
                            </div>
                            <div>
                                <h4 className="text-sm font-black text-white">Green Environmental Impact</h4>
                                <p className="text-xs text-slate-400 mt-0.5">
                                    Your {fleetSize}-EV fleet eliminates approx <strong className="text-emerald-400">{(co2SavedKg / 1000).toFixed(1)} tonnes</strong> of CO₂ emissions each year!
                                </p>
                            </div>
                        </div>

                        {/* Action CTA */}
                        <div className="flex items-center justify-between p-6 rounded-3xl bg-indigo-600/10 border border-indigo-500/20">
                            <div>
                                <h4 className="text-sm font-black text-white">Start managing with Triev Fleet</h4>
                                <p className="text-xs text-slate-400">Track collections, vehicle health, and rider wallets seamlessly.</p>
                            </div>
                            <Link
                                to="/contact"
                                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shrink-0 transition-all shadow-lg shadow-indigo-500/25"
                            >
                                Get Started
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </PublicLayout>
    );
};

export default CalculatorPage;

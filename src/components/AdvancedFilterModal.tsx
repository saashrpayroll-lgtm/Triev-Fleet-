import React, { useState, useEffect } from 'react';
import { X, Filter, Calendar, User, MapPin, Tag, FileText, CheckCircle } from 'lucide-react';
import { LeadStatus, LeadCategory, LeadSource, LicenseType } from '@/types';

export interface FilterConfig {
    dateRange: { start: string; end: string } | null;
    teamLeaderId: string | null;
    status: LeadStatus[];
    category: LeadCategory[];
    source: LeadSource[];
    city: string | null;
    drivingLicense: LicenseType | null;
}

interface AdvancedFilterModalProps {
    isOpen: boolean;
    onClose: () => void;
    onApply: (filters: FilterConfig) => void;
    onReset: () => void;
    initialFilters: FilterConfig;
    teamLeaders: { id: string; name: string }[];
    availableCities: string[];
}

const AdvancedFilterModal: React.FC<AdvancedFilterModalProps> = ({
    isOpen,
    onClose,
    onApply,
    onReset,
    initialFilters,
    teamLeaders,
    availableCities
}) => {
    const [filters, setFilters] = useState<FilterConfig>(initialFilters);

    useEffect(() => {
        if (isOpen) {
            setFilters(initialFilters);
        }
    }, [isOpen, initialFilters]);

    if (!isOpen) return null;

    const handleStatusToggle = (status: LeadStatus) => {
        setFilters(prev => ({
            ...prev,
            status: prev.status.includes(status)
                ? prev.status.filter(s => s !== status)
                : [...prev.status, status]
        }));
    };

    const handleCategoryToggle = (category: LeadCategory) => {
        setFilters(prev => ({
            ...prev,
            category: prev.category.includes(category)
                ? prev.category.filter(c => c !== category)
                : [...prev.category, category]
        }));
    };

    const handleSourceToggle = (source: LeadSource) => {
        setFilters(prev => ({
            ...prev,
            source: prev.source.includes(source)
                ? prev.source.filter(s => s !== source)
                : [...prev.source, source]
        }));
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex justify-end animate-in fade-in duration-200">
            <div className="w-full max-w-md bg-white h-full shadow-2xl overflow-y-auto animate-in slide-in-from-right duration-300">
                <div className="p-5 border-b flex justify-between items-center bg-gray-50 sticky top-0 z-10">
                    <h2 className="text-lg font-bold flex items-center gap-2">
                        <Filter className="w-5 h-5 text-primary" /> Advanced Filters
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 space-y-8">
                    {/* Date Range */}
                    <div className="space-y-3">
                        <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                            <Calendar size={16} /> Date Range
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <span className="text-xs text-gray-500 mb-1 block">Start Date</span>
                                <input
                                    type="date"
                                    value={filters.dateRange?.start || ''}
                                    onChange={(e) => setFilters(prev => ({
                                        ...prev,
                                        dateRange: { start: e.target.value, end: prev.dateRange?.end || '' }
                                    }))}
                                    className="w-full p-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                                />
                            </div>
                            <div>
                                <span className="text-xs text-gray-500 mb-1 block">End Date</span>
                                <input
                                    type="date"
                                    value={filters.dateRange?.end || ''}
                                    onChange={(e) => setFilters(prev => ({
                                        ...prev,
                                        dateRange: { start: prev.dateRange?.start || '', end: e.target.value }
                                    }))}
                                    className="w-full p-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Team Leader */}
                    <div className="space-y-3">
                        <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                            <User size={16} /> Team Leader
                        </label>
                        <select
                            value={filters.teamLeaderId || ''}
                            onChange={(e) => setFilters(prev => ({ ...prev, teamLeaderId: e.target.value || null }))}
                            className="w-full p-2.5 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary/20 outline-none"
                        >
                            <option value="">All Team Leaders</option>
                            {teamLeaders.map(tl => (
                                <option key={tl.id} value={tl.id}>{tl.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Status */}
                    <div className="space-y-3">
                        <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                            <CheckCircle size={16} /> Lead Status
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {(['New', 'Convert', 'Not Convert'] as LeadStatus[]).map(status => (
                                <button
                                    key={status}
                                    onClick={() => handleStatusToggle(status)}
                                    className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-all ${filters.status.includes(status)
                                        ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                                        : 'bg-white text-gray-600 border-gray-200 hover:border-primary/50'
                                        }`}
                                >
                                    {status}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Source */}
                    <div className="space-y-3">
                        <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                            <Tag size={16} /> Lead Source
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {(['Online', 'Walking', 'Field Sourcing', 'Calling', 'Referral', 'Other'] as LeadSource[]).map(src => (
                                <button
                                    key={src}
                                    onClick={() => handleSourceToggle(src)}
                                    className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-all ${filters.source.includes(src)
                                        ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                                        : 'bg-white text-gray-600 border-gray-200 hover:border-primary/50'
                                        }`}
                                >
                                    {src}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* AI Category / Stats */}
                    <div className="space-y-3">
                        <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                            <Tag size={16} /> AI Category
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {(['Genuine', 'Match', 'Duplicate'] as LeadCategory[]).map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => handleCategoryToggle(cat)}
                                    className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-all ${filters.category.includes(cat)
                                        ? cat === 'Genuine' ? 'bg-emerald-600 text-white border-emerald-600'
                                            : cat === 'Match' ? 'bg-blue-600 text-white border-blue-600'
                                                : 'bg-amber-600 text-white border-amber-600'
                                        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                                        }`}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* City */}
                    <div className="space-y-3">
                        <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                            <MapPin size={16} /> Location (City)
                        </label>
                        <select
                            value={filters.city || ''}
                            onChange={(e) => setFilters(prev => ({ ...prev, city: e.target.value || null }))}
                            className="w-full p-2.5 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary/20 outline-none"
                        >
                            <option value="">All Cities</option>
                            {availableCities.map(city => (
                                <option key={city} value={city}>{city}</option>
                            ))}
                        </select>
                    </div>

                    {/* License */}
                    <div className="space-y-3">
                        <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                            <FileText size={16} /> Driving License
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                            {(['Permanent', 'Learning', 'No'] as LicenseType[]).map(type => (
                                <button
                                    key={type}
                                    onClick={() => setFilters(prev => ({ ...prev, drivingLicense: prev.drivingLicense === type ? null : type }))}
                                    className={`px-2 py-2 text-xs font-medium rounded-lg border text-center transition-all ${filters.drivingLicense === type
                                        ? 'bg-primary text-primary-foreground border-primary'
                                        : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                                        }`}
                                >
                                    {type}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Footer Buttons */}
                <div className="p-5 border-t bg-gray-50 flex gap-3 sticky bottom-0">
                    <button
                        onClick={() => {
                            setFilters(initialFilters);
                            onReset();
                        }}
                        className="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                        Reset All
                    </button>
                    <button
                        onClick={() => onApply(filters)}
                        className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-bold hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all"
                    >
                        Apply Filters
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AdvancedFilterModal;

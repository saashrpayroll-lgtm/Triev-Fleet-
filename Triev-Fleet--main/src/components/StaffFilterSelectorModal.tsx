import React, { useState, useEffect } from 'react';
import { X, Search, Check, Users, ShieldCheck, CheckSquare, Square, AlertCircle } from 'lucide-react';
import { LiveSyncStaffFilter } from '@/types';
import { supabase } from '@/config/supabase';
import { toast } from 'sonner';

interface StaffFilterSelectorModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentFilter?: LiveSyncStaffFilter;
    onSaveFilter: (filter: LiveSyncStaffFilter) => void;
}

export const StaffFilterSelectorModal: React.FC<StaffFilterSelectorModalProps> = ({
    isOpen,
    onClose,
    currentFilter,
    onSaveFilter
}) => {
    const [filter, setFilter] = useState<LiveSyncStaffFilter>(currentFilter || {
        teamLeaderIds: [],
        reportingManagerIds: [],
        cityOpsIds: [],
        syncAllStaff: false
    });

    const [users, setUsers] = useState<{ id: string; fullName: string; email: string; role: string }[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [activeTab, setActiveTab] = useState<'teamLeader' | 'reportingManager' | 'cityOps'>('teamLeader');

    useEffect(() => {
        if (currentFilter) setFilter(currentFilter);
    }, [currentFilter]);

    useEffect(() => {
        if (!isOpen) return;
        const fetchStaffUsers = async () => {
            setLoading(true);
            try {
                const { data, error } = await supabase
                    .from('users')
                    .select('id, full_name, email, role')
                    .in('role', ['teamLeader', 'reportingManager', 'cityOps', 'admin', 'manager'])
                    .order('full_name');
                if (error) throw error;
                setUsers((data || []).map(u => ({
                    id: u.id,
                    fullName: u.full_name || 'Unnamed',
                    email: u.email || '',
                    role: u.role
                })));
            } catch (err) {
                console.error(err);
                toast.error("Failed to load staff list.");
            } finally {
                setLoading(false);
            }
        };
        fetchStaffUsers();
    }, [isOpen]);

    if (!isOpen) return null;

    const teamLeaders = users.filter(u => u.role === 'teamLeader' || u.role === 'admin' || u.role === 'manager');
    const reportingManagers = users.filter(u => u.role === 'reportingManager');
    const cityOps = users.filter(u => u.role === 'cityOps');

    const currentList = activeTab === 'teamLeader' ? teamLeaders : activeTab === 'reportingManager' ? reportingManagers : cityOps;
    const currentSelectedIds = activeTab === 'teamLeader' ? filter.teamLeaderIds : activeTab === 'reportingManager' ? filter.reportingManagerIds : filter.cityOpsIds;

    const filteredList = currentList.filter(u =>
        u.fullName.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase())
    );

    const toggleSelectUser = (id: string) => {
        setFilter(prev => {
            const listKey = activeTab === 'teamLeader' ? 'teamLeaderIds' : activeTab === 'reportingManager' ? 'reportingManagerIds' : 'cityOpsIds';
            const existing = prev[listKey] || [];
            const nextList = existing.includes(id) ? existing.filter(item => item !== id) : [...existing, id];
            return { ...prev, [listKey]: nextList };
        });
    };

    const handleSelectAllCurrentTab = () => {
        const listKey = activeTab === 'teamLeader' ? 'teamLeaderIds' : activeTab === 'reportingManager' ? 'reportingManagerIds' : 'cityOpsIds';
        const allIds = currentList.map(u => u.id);
        const isAllSelected = allIds.every(id => (filter[listKey] || []).includes(id));

        setFilter(prev => ({
            ...prev,
            [listKey]: isAllSelected ? [] : allIds
        }));
    };

    const handleSave = () => {
        onSaveFilter(filter);
        toast.success("Staff Filter saved! Only riders of selected staff will sync.");
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-200">
            <div className="bg-card border border-border/60 w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="px-6 py-5 border-b border-border/40 bg-muted/20 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-500 border border-purple-500/20">
                            <ShieldCheck size={22} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-foreground">Team Leader / RM / City Ops Scope Filter</h2>
                            <p className="text-xs text-muted-foreground">Select staff members whose riders should sync from Live Sheet</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Controls Bar */}
                <div className="px-6 py-4 bg-accent/30 border-b border-border/40 space-y-3">
                    <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2 text-xs font-semibold text-foreground cursor-pointer">
                            <input
                                type="checkbox"
                                checked={filter.syncAllStaff}
                                onChange={(e) => setFilter(prev => ({ ...prev, syncAllStaff: e.target.checked }))}
                                className="w-4 h-4 rounded text-primary border-input focus:ring-primary"
                            />
                            <span>Sync All Staff Members (Disable Filter)</span>
                        </label>
                        {!filter.syncAllStaff && (
                            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
                                Total Selected: {filter.teamLeaderIds.length + filter.reportingManagerIds.length + filter.cityOpsIds.length} Staff
                            </span>
                        )}
                    </div>

                    {!filter.syncAllStaff && (
                        <div className="flex items-center gap-2 pt-2 border-t border-border/30">
                            <div className="flex rounded-xl bg-muted p-1 border border-border/50 flex-1">
                                <button
                                    onClick={() => setActiveTab('teamLeader')}
                                    className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all ${activeTab === 'teamLeader' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                                >
                                    Team Leaders ({filter.teamLeaderIds.length}/{teamLeaders.length})
                                </button>
                                <button
                                    onClick={() => setActiveTab('reportingManager')}
                                    className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all ${activeTab === 'reportingManager' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                                >
                                    Reporting Managers ({filter.reportingManagerIds.length}/{reportingManagers.length})
                                </button>
                                <button
                                    onClick={() => setActiveTab('cityOps')}
                                    className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all ${activeTab === 'cityOps' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                                >
                                    City Ops ({filter.cityOpsIds.length}/{cityOps.length})
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto flex-1 space-y-4 scrollbar-thin">
                    {filter.syncAllStaff ? (
                        <div className="p-8 text-center space-y-3 bg-muted/20 rounded-2xl border border-dashed border-border/60">
                            <Users size={36} className="mx-auto text-primary/60" />
                            <h3 className="font-bold text-foreground">Global Sync Enabled</h3>
                            <p className="text-xs text-muted-foreground max-w-md mx-auto">
                                All riders from any registered Team Leader, RM, or City Ops in your system will be synced automatically without filtering.
                            </p>
                        </div>
                    ) : (
                        <>
                            <div className="flex items-center justify-between gap-3">
                                <div className="relative flex-1">
                                    <Search size={14} className="absolute left-3 top-3 text-muted-foreground" />
                                    <input
                                        type="text"
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        placeholder={`Search ${activeTab}...`}
                                        className="w-full text-xs pl-8 pr-3 py-2 rounded-xl border border-input bg-card text-foreground focus:ring-2 focus:ring-primary outline-none"
                                    />
                                </div>
                                <button
                                    onClick={handleSelectAllCurrentTab}
                                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border border-border hover:bg-accent transition-colors"
                                >
                                    {currentList.length > 0 && currentList.every(u => currentSelectedIds.includes(u.id)) ? (
                                        <>
                                            <Square size={14} />
                                            <span>Deselect All</span>
                                        </>
                                    ) : (
                                        <>
                                            <CheckSquare size={14} />
                                            <span>Select All</span>
                                        </>
                                    )}
                                </button>
                            </div>

                            {loading ? (
                                <div className="text-center py-10 text-xs text-muted-foreground">Loading staff members...</div>
                            ) : filteredList.length === 0 ? (
                                <div className="text-center py-10 text-xs text-muted-foreground">No staff members found matching search.</div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[350px] overflow-y-auto p-1 scrollbar-thin">
                                    {filteredList.map(user => {
                                        const isChecked = currentSelectedIds.includes(user.id);
                                        return (
                                            <div
                                                key={user.id}
                                                onClick={() => toggleSelectUser(user.id)}
                                                className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${isChecked
                                                        ? 'bg-primary/10 border-primary/40 text-foreground font-medium shadow-sm'
                                                        : 'bg-card border-border/50 text-muted-foreground hover:border-border hover:bg-accent/40'
                                                    }`}
                                            >
                                                <div className="space-y-0.5 truncate pr-2">
                                                    <div className="text-xs font-bold truncate text-foreground">{user.fullName}</div>
                                                    <div className="text-[11px] text-muted-foreground truncate">{user.email || 'No email'}</div>
                                                </div>
                                                <div className={`w-5 h-5 rounded-lg flex items-center justify-center border transition-all ${isChecked ? 'bg-primary border-primary text-primary-foreground' : 'border-input bg-background'
                                                    }`}>
                                                    {isChecked && <Check size={14} />}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-border/40 bg-muted/20 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <AlertCircle size={14} className="text-blue-500" />
                        <span>Riders of unselected staff will be skipped from sync</span>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-xs font-medium rounded-xl border border-border hover:bg-accent transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            className="px-5 py-2 text-xs font-semibold rounded-xl bg-primary text-primary-foreground hover:opacity-90 shadow-lg shadow-primary/25 transition-all"
                        >
                            Save Staff Filter
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StaffFilterSelectorModal;

import React, { useState, useEffect } from 'react';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/config/supabase';
import { Rider } from '@/types';
import { FileText, Download, TrendingUp, Filter, Search, RefreshCw, Wallet, BarChart3, Users, Shield } from 'lucide-react';
import {
    REPORT_TEMPLATES,
    generateRiderListReport,
    generateWalletSummaryReport,
    generateClientDistributionReport,
    transformRiderData
} from '@/utils/reportUtils';
import { exportToCSV, exportToExcel, exportToPDF } from '@/utils/exportUtils';
import { logActivity } from '@/utils/activityLog';
import { toast } from 'sonner';

interface ReportFilters {
    status: string;
    client: string;
}

const Reports: React.FC = () => {
    const { userData } = useSupabaseAuth();
    const [riders, setRiders] = useState<Rider[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedTemplate, setSelectedTemplate] = useState('active_riders');
    const [filters, setFilters] = useState<ReportFilters>({
        status: 'all',
        client: 'all',
    });
    const [reportData, setReportData] = useState<any[]>([]);
    const [reportGenerated, setReportGenerated] = useState(false);
    const [generating, setGenerating] = useState(false);

    useEffect(() => {
        if (userData?.id) {
            fetchRiders();
        }
    }, [userData?.id]);

    const fetchRiders = async () => {
        if (!userData) return;

        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('riders')
                .select(`
                    id, 
                    trievId:triev_id, 
                    riderName:rider_name, 
                    mobileNumber:mobile_number, 
                    chassisNumber:chassis_number, 
                    clientName:client_name, 
                    clientId:client_id, 
                    walletAmount:wallet_amount, 
                    allotmentDate:allotment_date, 
                    remarks,
                    status, 
                    teamLeaderId:team_leader_id,
                    teamLeaderName:team_leader_name,
                    createdAt:created_at,
                    updatedAt:updated_at
                `)
                .eq('team_leader_id', userData.id);

            if (error) {
                console.error('Error fetching riders:', error);
                toast.error('Failed to load rider data');
            } else {
                setRiders((data || []) as Rider[]);
            }
        } catch (error) {
            console.error('Error fetching riders:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleGenerateReport = async () => {
        setGenerating(true);
        let data: any[] = [];

        // Simulate async if needed, or just keep it sync
        await new Promise(resolve => setTimeout(resolve, 500));

        try {
            const currentTemp = REPORT_TEMPLATES.find(t => t.id === selectedTemplate);

            switch (selectedTemplate) {
                case 'active_riders':
                    const activeRiders = generateRiderListReport(riders, {
                        status: filters.status !== 'all' ? filters.status : undefined,
                        client: filters.client !== 'all' ? filters.client : undefined,
                    });
                    data = activeRiders.map(transformRiderData);
                    break;

                case 'wallet_summary':
                    const walletSummary = generateWalletSummaryReport(riders);
                    data = [
                        {
                            'Category': 'Positive Balances',
                            'Count': walletSummary.positiveCount,
                            'Total': walletSummary.totalPositive,
                            'Average': walletSummary.positiveCount > 0 ? walletSummary.totalPositive / walletSummary.positiveCount : 0
                        },
                        {
                            'Category': 'Negative Balances',
                            'Count': walletSummary.negativeCount,
                            'Total': -walletSummary.totalNegative,
                            'Average': walletSummary.negativeCount > 0 ? -walletSummary.totalNegative / walletSummary.negativeCount : 0
                        },
                        {
                            'Category': 'Zero Balances',
                            'Count': walletSummary.zeroCount,
                            'Total': 0,
                            'Average': 0
                        },
                        {
                            'Category': 'Total',
                            'Count': riders.length,
                            'Total': walletSummary.totalPositive - walletSummary.totalNegative,
                            'Average': walletSummary.averageWallet
                        },
                    ];
                    break;

                case 'client_distribution':
                    const distData = generateClientDistributionReport(riders.filter(r =>
                        filters.status === 'all' || r.status === filters.status
                    ));
                    data = distData.map(d => ({
                        'Client Name': d.clientName,
                        'Rider Count': d.riderCount,
                        'Total Wallet': d.totalWallet, // Keep number for now, format in render
                        'Avg Wallet': d.averageWallet
                    }));
                    break;

                case 'inactive_riders':
                    const inactiveRiders = riders.filter(r => r.status === 'inactive');
                    data = inactiveRiders.map(transformRiderData);
                    break;

                case 'negative_wallet':
                    const negativeRiders = riders.filter(r => r.walletAmount < 0).sort((a, b) => a.walletAmount - b.walletAmount);
                    data = negativeRiders.map(transformRiderData);
                    break;

                default:
                    data = riders.map(transformRiderData);
            }

            setReportData(data);
            setReportGenerated(true);
            toast.success(`Generated report with ${data.length} records`);

            logActivity({
                actionType: 'reportGenerated',
                targetType: 'report',
                targetId: selectedTemplate,
                details: `Generated ${currentTemp?.name} (${data.length} records)`,
                metadata: { template: selectedTemplate, count: data.length }
            });
        } catch (error) {
            console.error("Report Generation Error", error);
            toast.error("Failed to generate report");
        } finally {
            setGenerating(false);
        }
    };

    const handleExportCSV = () => {
        const filename = `${selectedTemplate}_${new Date().toISOString().split('T')[0]}`;
        exportToCSV(reportData, filename);
        toast.success("Exported to CSV");
    };

    const handleExportExcel = () => {
        const filename = `${selectedTemplate}_${new Date().toISOString().split('T')[0]}`;
        exportToExcel(reportData, filename);
        toast.success("Exported to Excel");
    };

    const handleExportPDF = () => {
        const template = REPORT_TEMPLATES.find(t => t.id === selectedTemplate);
        const filename = `${selectedTemplate}_${new Date().toISOString().split('T')[0]}`;
        // Ensure columns are just the keys from the first object
        const columns = reportData.length > 0 ? Object.keys(reportData[0]) : [];

        const success = exportToPDF(reportData, columns, filename, template?.name || 'Report');
        if (success) toast.success("Exported to PDF");
        else toast.error("PDF Export Failed");
    };

    const currentTemplate = REPORT_TEMPLATES.find(t => t.id === selectedTemplate);

    // Helpers for Icons
    const getTemplateIcon = (id: string, active?: boolean) => {
        switch (id) {
            case 'active_riders': return <Users size={18} className={active ? "text-white" : "text-blue-500"} />;
            case 'wallet_summary': return <Wallet size={18} className={active ? "text-white" : "text-green-500"} />;
            case 'client_distribution': return <BarChart3 size={18} className={active ? "text-white" : "text-purple-500"} />;
            case 'request_history': return <Shield size={18} className={active ? "text-white" : "text-amber-500"} />;
            default: return <FileText size={18} className={active ? "text-white" : "text-gray-500"} />;
        }
    };

    // Render Badges in Table
    const renderCell = (key: string, value: any) => {
        // Status Badges
        if (typeof key === 'string' && key.toLowerCase().includes('status')) {
            const status = String(value).toLowerCase();
            if (status === 'active' || status === 'good') return <span className="px-2 py-0.5 bg-green-500/10 text-green-500 rounded-full text-xs font-medium border border-green-500/20 capitalize">{value}</span>;
            if (status === 'inactive' || status === 'warning') return <span className="px-2 py-0.5 bg-amber-500/10 text-amber-500 rounded-full text-xs font-medium border border-amber-500/20 capitalize">{value}</span>;
            if (status === 'deleted' || status === 'alert') return <span className="px-2 py-0.5 bg-red-500/10 text-red-500 rounded-full text-xs font-medium border border-red-500/20 capitalize">{value}</span>;
            if (status === 'pending') return <span className="px-2 py-0.5 bg-blue-500/10 text-blue-500 rounded-full text-xs font-medium border border-blue-500/20 capitalize">{value}</span>;
        }

        // Currency
        if (typeof value === 'number' && (key.toLowerCase().includes('wallet') || key.toLowerCase().includes('total') || key.toLowerCase().includes('amount') || key.toLowerCase().includes('average'))) {
            if (key === 'Count') return value; // Don't format Count
            return <span className={`font-mono font-medium ${value < 0 ? 'text-red-500' : 'text-green-500'}`}>₹{value.toFixed(2)}</span>;
        }
        if (String(value).includes('₹')) {
            return <span className={`font-mono font-medium ${String(value).includes('-') ? 'text-red-500' : 'text-green-500'}`}>{value}</span>;
        }

        return <span className="text-muted-foreground">{value}</span>;
    };


    const canViewPage = userData?.permissions?.modules?.reports ?? true;
    const canGenerate = userData?.permissions?.reports?.generate ?? true;
    const canExport = userData?.permissions?.reports?.export ?? true;

    if (!canViewPage) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center p-8 bg-muted/30 rounded-lg">
                    <h2 className="text-xl font-bold mb-2">Access Restricted</h2>
                    <p className="text-muted-foreground">You do not have permission to view the Reports page.</p>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-muted-foreground animate-pulse">Loading Report Data...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
                        Reports & Analytics
                    </h1>
                    <p className="text-muted-foreground mt-1">Generate insights from your rider fleet.</p>
                </div>
                {canGenerate && (
                    <button
                        onClick={handleGenerateReport}
                        disabled={generating}
                        className="bg-primary hover:bg-primary/90 text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-primary/20 disabled:opacity-50"
                    >
                        {generating ? <RefreshCw className="animate-spin" size={20} /> : <TrendingUp size={20} />}
                        {reportGenerated ? 'Re-generate Report' : 'Generate Report'}
                    </button>
                )}
                <div className="bg-card/50 backdrop-blur-sm border border-white/20 px-4 py-2 rounded-xl text-center">
                    <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Total Records</div>
                    <div className="text-xl font-bold text-primary">{riders.length}</div>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
                {/* Left Panel: Templates */}
                <div className="xl:col-span-4 space-y-6">
                    <div className="bg-card/60 backdrop-blur-md border border-white/20 rounded-2xl p-6 shadow-xl sticky top-6">
                        <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
                            <FileText size={20} className="text-primary" />
                            Report Templates
                        </h2>
                        <div className="space-y-3">
                            {REPORT_TEMPLATES.filter(t => {
                                if (t.name.includes('Admin Only')) return false;
                                const supportedTemplates = [
                                    'active_riders', 'inactive_riders', 'wallet_summary', 'negative_wallet', 'client_distribution'
                                ];
                                return supportedTemplates.includes(t.id);
                            }).map((template) => (
                                <button
                                    key={template.id}
                                    onClick={() => {
                                        setSelectedTemplate(template.id);
                                        setReportGenerated(false);
                                        setReportData([]);
                                    }}
                                    className={`w-full text-left p-4 rounded-xl border transition-all duration-300 relative overflow-hidden group ${selectedTemplate === template.id
                                        ? 'border-primary/50 bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                                        : 'border-white/10 hover:border-primary/30 hover:bg-white/5'
                                        }`}
                                >
                                    <div className="relative z-10 flex items-start gap-4">
                                        <div className={`p-2 rounded-lg ${selectedTemplate === template.id ? 'bg-white/20' : 'bg-muted/50'}`}>
                                            {getTemplateIcon(template.id, selectedTemplate === template.id)}
                                        </div>
                                        <div className="flex-1">
                                            <div className="font-semibold flex items-center justify-between">
                                                {template.name}
                                                {selectedTemplate === template.id && <TrendingUp size={16} />}
                                            </div>
                                            <div className={`text-xs mt-1 ${selectedTemplate === template.id ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                                                {template.description}
                                            </div>
                                        </div>
                                    </div>
                                    {selectedTemplate === template.id && (
                                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] animate-[shimmer_2s_infinite]"></div>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right Panel: Configuration & Results */}
                <div className="xl:col-span-8 space-y-6">
                    {/* Configuration Card */}
                    <div className="bg-card/60 backdrop-blur-md border border-white/20 rounded-2xl p-6 shadow-xl">
                        <div className="flex flex-col mb-6 gap-4 border-b border-white/10 pb-4">
                            <div>
                                <h2 className="font-semibold text-xl">{currentTemplate?.name}</h2>
                                <p className="text-sm text-muted-foreground">{currentTemplate?.description}</p>
                            </div>
                        </div>

                        {/* Filters */}
                        {currentTemplate?.parameters.length! > 0 && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                {currentTemplate?.parameters.includes('status') && (
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
                                            <Filter size={14} /> Status Filter
                                        </label>
                                        <select
                                            value={filters.status}
                                            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                                            className="w-full px-4 py-2.5 rounded-lg bg-background/50 border border-white/10 focus:ring-2 focus:ring-primary/50 outline-none transition-all"
                                        >
                                            <option value="all">All Statuses</option>
                                            <option value="active">Active Only</option>
                                            <option value="inactive">Inactive Only</option>
                                            <option value="deleted">Deleted Only</option>
                                        </select>
                                    </div>
                                )}
                                {currentTemplate?.parameters.includes('client') && (
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
                                            <Search size={14} /> Client Filter
                                        </label>
                                        <select
                                            value={filters.client}
                                            onChange={(e) => setFilters({ ...filters, client: e.target.value })}
                                            className="w-full px-4 py-2.5 rounded-lg bg-background/50 border border-white/10 focus:ring-2 focus:ring-primary/50 outline-none transition-all"
                                        >
                                            <option value="all">All Clients</option>
                                            <option value="Zomato">Zomato</option>
                                            <option value="Swiggy">Swiggy</option>
                                            <option value="Zepto">Zepto</option>
                                            <option value="Blinkit">Blinkit</option>
                                            <option value="Uber">Uber</option>
                                            <option value="Rapido">Rapido</option>
                                            <option value="Porter">Porter</option>
                                            <option value="FLK">FLK</option>
                                            <option value="Other">Other</option>
                                        </select>
                                    </div>
                                )}
                            </div>
                        )}

                        {canGenerate && (
                            <button
                                onClick={handleGenerateReport}
                                disabled={generating}
                                className="w-full md:w-auto md:float-right bg-primary text-primary-foreground px-8 py-3 rounded-xl font-medium hover:bg-primary/90 transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/20 disabled:opacity-70"
                            >
                                {generating ? (
                                    <RefreshCw size={18} className="animate-spin" />
                                ) : (
                                    <TrendingUp size={18} />
                                )}
                                Generate Report
                            </button>
                        )}
                        <div className="clear-both"></div>
                    </div>

                    {/* Results Area */}
                    {reportGenerated && (
                        <div className="bg-card/60 backdrop-blur-md border border-white/20 rounded-2xl shadow-xl overflow-hidden animate-in slide-in-from-bottom-4 duration-500">
                            <div className="p-4 border-b border-white/10 bg-muted/30 flex justify-between items-center">
                                <div className="text-sm font-medium">
                                    Results: <span className="text-primary font-bold">{reportData.length}</span> entries
                                </div>
                                <div className="flex gap-2">
                                    {canExport && (
                                        <>
                                            <button onClick={handleExportCSV} className="p-2 hover:bg-white/10 rounded-lg transition-colors text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs">
                                                <Download size={14} /> CSV
                                            </button>
                                            <button onClick={handleExportExcel} className="p-2 hover:bg-white/10 rounded-lg transition-colors text-green-600 hover:text-green-500 flex items-center gap-1 text-xs">
                                                <Download size={14} /> Excel
                                            </button>
                                            <button onClick={handleExportPDF} className="p-2 hover:bg-white/10 rounded-lg transition-colors text-red-600 hover:text-red-500 flex items-center gap-1 text-xs">
                                                <Download size={14} /> PDF
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>

                            {reportData.length > 0 ? (
                                <div className="overflow-x-auto max-h-[500px] scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-transparent">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-muted/50 text-muted-foreground sticky top-0 backdrop-blur-md z-10">
                                            <tr>
                                                {Object.keys(reportData[0]).map(key => (
                                                    <th key={key} className="px-6 py-4 font-semibold whitespace-nowrap">
                                                        {key}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {reportData.map((row, i) => (
                                                <tr key={i} className="hover:bg-white/5 transition-colors">
                                                    {Object.keys(row).map((key, j) => (
                                                        <td key={j} className="px-6 py-3 whitespace-nowrap text-muted-foreground">
                                                            {renderCell(key, row[key])}
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="p-12 text-center text-muted-foreground flex flex-col items-center">
                                    <div className="w-16 h-16 bg-muted/50 rounded-full flex items-center justify-center mb-4">
                                        <Search size={32} className="opacity-50" />
                                    </div>
                                    <p>No data found matching your criteria.</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Reports;

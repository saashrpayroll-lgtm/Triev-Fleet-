import React, { useState, useEffect } from 'react';
import { supabase } from '@/config/supabase';
import { ExternalLink, FileText, Loader2, Link2Off, Plus } from 'lucide-react';

interface ExternalForm {
    id: string;
    title: string;
    url: string;
    category: 'form' | 'sheet';
    is_active: boolean;
    display_order: number;
    created_at: string;
}

const TLForms: React.FC = () => {
    const [forms, setForms] = useState<ExternalForm[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchForms();

        // Subscribe to real-time changes
        const channel = supabase.channel('external-forms-changes')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'external_forms'
            }, () => {
                fetchForms();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const fetchForms = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('external_forms')
                .select('*')
                .eq('is_active', true) // Only fetch active forms
                .order('display_order', { ascending: true })
                .order('created_at', { ascending: false });

            if (error) throw error;
            setForms(data || []);
        } catch (error: any) {
            console.error('Error fetching forms:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleFormClick = (url: string) => {
        window.open(url, '_blank');
    };

    const formsList = forms.filter(f => f.category === 'form' || !f.category);
    const sheetsList = forms.filter(f => f.category === 'sheet');

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card p-6 rounded-2xl border border-border shadow-sm">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-foreground flex items-center gap-3">
                        <FileText className="text-primary" size={32} />
                        Company Forms
                    </h1>
                    <p className="text-muted-foreground mt-1 font-medium text-lg">Access important Google Forms and external resources here.</p>
                </div>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center p-20 bg-card border border-border rounded-2xl shadow-sm">
                    <Loader2 className="animate-spin text-primary mb-4" size={40} />
                    <p className="text-muted-foreground font-medium text-lg text-center">Loading forms and sheets...</p>
                </div>
            ) : forms.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-20 bg-card border border-border rounded-2xl shadow-sm text-center">
                    <div className="w-20 h-20 bg-muted/40 rounded-3xl flex items-center justify-center mb-6 shadow-inner">
                        <Link2Off size={40} className="text-muted-foreground" />
                    </div>
                    <h3 className="text-2xl font-black mb-2 tracking-tight">No Active Links</h3>
                    <p className="text-muted-foreground text-lg max-w-md">There are currently no active forms or links assigned to Team Leaders.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 h-full">
                    {/* Forms Section */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 mb-2 px-1">
                            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                <FileText size={18} className="text-primary" />
                            </div>
                            <h2 className="text-sm font-black uppercase tracking-wider text-muted-foreground">Google Forms</h2>
                        </div>
                        <div className="flex flex-col gap-3 max-h-[460px] overflow-y-auto pr-3 py-1 bg-card/50 p-1 rounded-2xl scrollbar-thin scrollbar-thumb-muted-foreground/20 hover:scrollbar-thumb-muted-foreground/40 min-h-[100px]">
                            {formsList.length === 0 ? (
                                <div className="text-center py-10 px-4 bg-card border border-dashed border-border rounded-xl text-muted-foreground italic text-sm">No forms available presently.</div>
                            ) : formsList.map((form) => (
                                <button
                                    key={form.id}
                                    onClick={() => handleFormClick(form.url)}
                                    className="group flex items-center justify-between p-4 bg-card border border-border/60 hover:border-primary hover:bg-primary/5 hover:translate-y-[-2px] shadow-sm hover:shadow-md rounded-xl cursor-pointer transition-all duration-300 w-full text-left overflow-hidden relative"
                                >
                                    <div className="absolute inset-0 bg-gradient-to-r from-primary/0 to-primary/0 group-hover:from-primary/5 group-hover:to-transparent transition-all duration-300" />
                                    <span className="font-bold text-base text-foreground group-hover:text-primary transition-colors relative z-10 truncate pr-2">
                                        {form.title}
                                    </span>
                                    <div className="w-9 h-9 rounded-lg bg-muted/50 text-muted-foreground flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground group-hover:scale-110 transition-all duration-300 relative z-10 shrink-0">
                                        <ExternalLink size={16} />
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Sheets Section */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 mb-2 px-1">
                            <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
                                <Plus size={18} className="text-indigo-600" />
                            </div>
                            <h2 className="text-sm font-black uppercase tracking-wider text-muted-foreground">Google Sheets</h2>
                        </div>
                        <div className="flex flex-col gap-3 max-h-[460px] overflow-y-auto pr-3 py-1 bg-card/50 p-1 rounded-2xl scrollbar-thin scrollbar-thumb-muted-foreground/20 hover:scrollbar-thumb-muted-foreground/40 min-h-[100px]">
                            {sheetsList.length === 0 ? (
                                <div className="text-center py-10 px-4 bg-card border border-dashed border-border rounded-xl text-muted-foreground italic text-sm">No sheets available presently.</div>
                            ) : sheetsList.map((sheet) => (
                                <button
                                    key={sheet.id}
                                    onClick={() => handleFormClick(sheet.url)}
                                    className="group flex items-center justify-between p-4 bg-card border border-border/60 hover:border-indigo-400 hover:bg-indigo-50/50 hover:translate-y-[-2px] shadow-sm hover:shadow-md rounded-xl cursor-pointer transition-all duration-300 w-full text-left overflow-hidden relative"
                                >
                                    <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/0 to-indigo-500/0 group-hover:from-indigo-500/5 group-hover:to-transparent transition-all duration-300" />
                                    <span className="font-bold text-base text-foreground group-hover:text-indigo-600 transition-colors relative z-10 truncate pr-2">
                                        {sheet.title}
                                    </span>
                                    <div className="w-9 h-9 rounded-lg bg-muted/50 text-muted-foreground flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white group-hover:scale-110 transition-all duration-300 relative z-10 shrink-0">
                                        <ExternalLink size={16} />
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TLForms;

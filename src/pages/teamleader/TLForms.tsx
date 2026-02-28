import React, { useState, useEffect } from 'react';
import { supabase } from '@/config/supabase';
import { ExternalLink, FileText, Loader2, Link2Off } from 'lucide-react';

interface ExternalForm {
    id: string;
    title: string;
    url: string;
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

    return (
        <div className="space-y-6 max-w-6xl mx-auto">
            <div className="mb-8">
                <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
                    <FileText className="text-primary" size={32} />
                    Company Forms
                </h1>
                <p className="text-muted-foreground mt-1">Access important Google Forms and external resources here.</p>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center p-20 bg-card border border-border rounded-2xl shadow-sm">
                    <Loader2 className="animate-spin text-primary mb-4" size={40} />
                    <p className="text-muted-foreground font-medium text-lg">Loading forms...</p>
                </div>
            ) : forms.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-20 bg-card border border-border rounded-2xl shadow-sm text-center">
                    <div className="w-20 h-20 bg-muted/40 rounded-3xl flex items-center justify-center mb-6 shadow-inner">
                        <Link2Off size={40} className="text-muted-foreground" />
                    </div>
                    <h3 className="text-2xl font-black mb-2 tracking-tight">No Active Forms</h3>
                    <p className="text-muted-foreground text-lg max-w-md">There are currently no active forms or links assigned to Team Leaders. Please check back later.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[500px] overflow-y-auto pr-2 pb-2 block w-full">
                    {forms.map((form) => (
                        <button
                            key={form.id}
                            onClick={() => handleFormClick(form.url)}
                            className="group relative flex items-center p-4 bg-card border border-border/60 hover:border-primary/50 shadow-sm hover:shadow-md rounded-2xl cursor-pointer transition-all duration-300 w-full text-left"
                        >
                            <div className="w-12 h-12 bg-primary/10 text-primary rounded-xl flex items-center justify-center shrink-0 mr-4 group-hover:bg-primary group-hover:text-primary-foreground transition-colors duration-300">
                                <FileText size={24} />
                            </div>
                            <div className="flex-1 min-w-0 pr-4">
                                <h3 className="font-bold text-base leading-tight text-foreground truncate group-hover:text-primary transition-colors">
                                    {form.title}
                                </h3>
                            </div>
                            <div className="w-8 h-8 rounded-full bg-muted/50 text-muted-foreground flex items-center justify-center group-hover:bg-primary/10 group-hover:text-primary transition-all duration-300 shrink-0">
                                <ExternalLink size={16} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

export default TLForms;

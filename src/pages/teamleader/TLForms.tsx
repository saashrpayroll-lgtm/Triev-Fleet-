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
                <div className="flex flex-col gap-3 max-h-[460px] overflow-y-auto pr-3 py-2 scrollbar-thin scrollbar-thumb-muted-foreground/20 hover:scrollbar-thumb-muted-foreground/40">
                    {forms.map((form) => (
                        <button
                            key={form.id}
                            onClick={() => handleFormClick(form.url)}
                            className="group flex items-center justify-between p-5 bg-card border border-border/80 hover:border-primary hover:bg-primary/5 shadow-sm hover:shadow-md rounded-2xl cursor-pointer transition-all duration-300 w-full text-left"
                        >
                            <span className="font-bold text-lg text-foreground group-hover:text-primary transition-colors">
                                {form.title}
                            </span>
                            <div className="w-10 h-10 rounded-full bg-muted/40 text-muted-foreground flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300">
                                <ExternalLink size={18} />
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

export default TLForms;

import React, { useState, useEffect } from 'react';
import { supabase } from '@/config/supabase';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { Plus, Link as LinkIcon, Edit2, Trash2, ExternalLink, Loader2, FileText, CheckCircle2, XCircle, GripVertical } from 'lucide-react';
import { Reorder } from 'framer-motion';
import { toast } from 'sonner';
import { logActivity } from '@/utils/activityLog';

interface ExternalForm {
    id: string;
    title: string;
    url: string;
    category: 'form' | 'sheet';
    is_active: boolean;
    display_order: number;
    created_at: string;
}

const AdminForms: React.FC = () => {
    const { userData } = useSupabaseAuth();
    const [forms, setForms] = useState<ExternalForm[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingForm, setEditingForm] = useState<ExternalForm | null>(null);

    // Form State
    const [title, setTitle] = useState('');
    const [url, setUrl] = useState('');
    const [category, setCategory] = useState<'form' | 'sheet'>('form');
    const [isActive, setIsActive] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        fetchForms();
    }, []);

    const fetchForms = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('external_forms')
                .select('*')
                .order('display_order', { ascending: true })
                .order('created_at', { ascending: false });

            if (error) throw error;
            setForms(data || []);
        } catch (error) {
            console.error('Error fetching forms:', error);
            toast.error('Failed to load forms');
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setTitle('');
        setUrl('');
        setCategory('form');
        setIsActive(true);
        setEditingForm(null);
        setShowModal(false);
    };

    const handleOpenEdit = (form: ExternalForm) => {
        setEditingForm(form);
        setTitle(form.title);
        setUrl(form.url);
        setCategory(form.category || 'form');
        setIsActive(form.is_active);
        setShowModal(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!title.trim() || !url.trim()) {
            toast.error('Title and URL are required');
            return;
        }

        // Basic URL validation
        try {
            new URL(url);
        } catch {
            toast.error('Please enter a valid URL (e.g., https://forms.gle/...)');
            return;
        }

        try {
            setIsSubmitting(true);

            if (editingForm) {
                const { error } = await supabase
                    .from('external_forms')
                    .update({ title, url, category, is_active: isActive, updated_at: new Date().toISOString() })
                    .eq('id', editingForm.id);

                if (error) throw error;

                await logActivity({
                    actionType: 'form_updated',
                    targetType: 'system',
                    targetId: editingForm.id,
                    details: `Updated external ${category}: ${title}`,
                    performedBy: userData?.email
                });

                toast.success(`${category === 'form' ? 'Form' : 'Sheet'} updated successfully`);
            } else {
                const { error } = await supabase
                    .from('external_forms')
                    .insert([{
                        title,
                        url,
                        category,
                        is_active: isActive,
                        display_order: forms.length,
                        created_by: userData?.id
                    }]);

                if (error) throw error;

                await logActivity({
                    actionType: 'form_created',
                    targetType: 'system',
                    targetId: 'new',
                    details: `Created new external ${category}: ${title}`,
                    performedBy: userData?.email
                });

                toast.success(`${category === 'form' ? 'Form' : 'Sheet'} added successfully`);
            }

            resetForm();
            await fetchForms();
        } catch (error: unknown) {
            console.error('Error saving form:', error);
            toast.error(error instanceof Error ? error.message : 'Failed to save form');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleToggleStatus = async (form: ExternalForm) => {
        try {
            const { error } = await supabase
                .from('external_forms')
                .update({ is_active: !form.is_active })
                .eq('id', form.id);

            if (error) throw error;

            await logActivity({
                actionType: 'form_toggled',
                targetType: 'system',
                targetId: form.id,
                details: `${form.is_active ? 'Disabled' : 'Enabled'} external form: ${form.title}`,
                performedBy: userData?.email
            });

            toast.success(`Form ${form.is_active ? 'disabled' : 'enabled'}`);

            // Optimistic update
            setForms(forms.map(f => f.id === form.id ? { ...f, is_active: !f.is_active } : f));
        } catch (error) {
            console.error('Error toggling form status:', error);
            toast.error('Failed to update form status');
        }
    };

    const handleDelete = async (form: ExternalForm) => {
        if (!confirm(`Are you sure you want to delete the form "${form.title}"?`)) return;

        try {
            const { error } = await supabase
                .from('external_forms')
                .delete()
                .eq('id', form.id);

            if (error) throw error;

            await logActivity({
                actionType: 'form_deleted',
                targetType: 'system',
                targetId: form.id,
                details: `Deleted external form: ${form.title}`,
                performedBy: userData?.email
            });

            toast.success('Form deleted');
            setForms(forms.filter(f => f.id !== form.id));
        } catch (error) {
            console.error('Error deleting form:', error);
            toast.error('Failed to delete form');
        }
    };

    const handleReorder = async (reorderedForms: ExternalForm[], targetCategory: 'form' | 'sheet') => {
        // Optimistically update UI
        setForms(prev => {
            const otherCategoryForms = prev.filter(f => f.category !== targetCategory);
            return [...otherCategoryForms, ...reorderedForms].sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
        });

        try {
            const updates = reorderedForms.map((form, index) => ({
                id: form.id,
                title: form.title,
                url: form.url,
                category: form.category,
                is_active: form.is_active,
                display_order: index,
                updated_at: new Date().toISOString()
            }));

            const { error } = await supabase
                .from('external_forms')
                .upsert(updates, { onConflict: 'id' });

            if (error) throw error;
            fetchForms(); // Refresh to ensure correct global order
        } catch (error) {
            console.error('Error saving new form order:', error);
            toast.error('Failed to save the new order. Please refresh.');
            fetchForms();
        }
    };

    const formsList = forms.filter(f => f.category === 'form' || !f.category);
    const sheetsList = forms.filter(f => f.category === 'sheet');

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card p-6 rounded-2xl border border-border shadow-sm">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-foreground">Company Forms</h1>
                    <p className="text-muted-foreground mt-1 font-medium">Manage Google Forms and External Sheets for your Team Leaders.</p>
                </div>
                <button
                    onClick={() => { resetForm(); setShowModal(true); }}
                    className="bg-primary text-primary-foreground font-bold px-6 py-3 rounded-xl hover:bg-primary/90 transition-all shadow-lg hover:shadow-primary/20 flex items-center justify-center gap-2 whitespace-nowrap"
                >
                    <Plus size={20} /> Add New Link
                </button>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center p-24 bg-card border border-border rounded-2xl">
                    <Loader2 className="animate-spin text-primary mb-4" size={32} />
                    <p className="text-muted-foreground font-bold">Loading forms and sheets...</p>
                </div>
            ) : (
                <div className="space-y-8">
                    {/* Forms Section */}
                    <div>
                        <div className="flex items-center gap-2 mb-3 px-1">
                            <FileText size={18} className="text-primary" />
                            <h2 className="text-sm font-black uppercase tracking-wider text-muted-foreground">Google Forms</h2>
                        </div>
                        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
                            {formsList.length === 0 ? (
                                <div className="p-8 text-center text-muted-foreground bg-muted/5 italic">No forms added in this category.</div>
                            ) : (
                                <Reorder.Group axis="y" values={formsList} onReorder={(vals) => handleReorder(vals, 'form')} className="divide-y divide-border max-h-[460px] overflow-y-auto w-full block scrollbar-thin scrollbar-thumb-muted-foreground/20 hover:scrollbar-thumb-muted-foreground/40">
                                    {formsList.map(form => (
                                        <Reorder.Item
                                            key={form.id}
                                            value={form}
                                            className="bg-card w-full active:shadow-2xl active:z-10 transition-shadow duration-200"
                                            whileDrag={{ scale: 1.02, backgroundColor: "var(--muted)" }}
                                        >
                                            <div className="p-4 hover:bg-muted/10 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4 group">
                                                <div className="flex items-center gap-4 flex-1 min-w-0">
                                                    <div className="cursor-grab active:cursor-grabbing p-2 text-muted-foreground/40 hover:text-foreground hover:bg-muted rounded-lg transition-colors shrink-0 touch-none">
                                                        <GripVertical size={20} />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                                                            {form.title}
                                                            {form.is_active ?
                                                                <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider font-black px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200">
                                                                    <CheckCircle2 size={10} /> Active
                                                                </span> :
                                                                <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider font-black px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
                                                                    <XCircle size={10} /> Inactive
                                                                </span>
                                                            }
                                                        </h3>
                                                        <div className="flex items-center gap-2 mt-1.5 text-sm text-muted-foreground/80">
                                                            <LinkIcon size={14} className="shrink-0" />
                                                            <a href={form.url} target="_blank" rel="noopener noreferrer" className="truncate hover:text-primary hover:underline max-w-[400px]">
                                                                {form.url}
                                                            </a>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-3 shrink-0">
                                                    <div className="flex items-center gap-2 mr-4 bg-muted/30 px-3 py-1.5 rounded-lg border border-border/50">
                                                        <span className="text-xs font-bold text-muted-foreground">TL VISIBILITY</span>
                                                        <button
                                                            onClick={() => handleToggleStatus(form)}
                                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background ${form.is_active ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'}`}
                                                        >
                                                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${form.is_active ? 'translate-x-6' : 'translate-x-1'}`} />
                                                        </button>
                                                    </div>

                                                    <button onClick={() => handleOpenEdit(form)} className="p-2 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors" title="Edit Form"><Edit2 size={18} /></button>
                                                    <a href={form.url} target="_blank" rel="noopener noreferrer" className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors" title="Test Link"><ExternalLink size={18} /></a>
                                                    <button onClick={() => handleDelete(form)} className="p-2 text-slate-400 hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors" title="Delete Form"><Trash2 size={18} /></button>
                                                </div>
                                            </div>
                                        </Reorder.Item>
                                    ))}
                                </Reorder.Group>
                            )}
                        </div>
                    </div>

                    {/* Sheets Section */}
                    <div>
                        <div className="flex items-center gap-2 mb-3 px-1">
                            <Plus size={18} className="text-indigo-600" />
                            <h2 className="text-sm font-black uppercase tracking-wider text-muted-foreground">Google Sheets</h2>
                        </div>
                        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
                            {sheetsList.length === 0 ? (
                                <div className="p-8 text-center text-muted-foreground bg-muted/5 italic">No sheets added in this category.</div>
                            ) : (
                                <Reorder.Group axis="y" values={sheetsList} onReorder={(vals) => handleReorder(vals, 'sheet')} className="divide-y divide-border max-h-[460px] overflow-y-auto w-full block scrollbar-thin scrollbar-thumb-muted-foreground/20 hover:scrollbar-thumb-muted-foreground/40">
                                    {sheetsList.map(sheet => (
                                        <Reorder.Item
                                            key={sheet.id}
                                            value={sheet}
                                            className="bg-card w-full active:shadow-2xl active:z-10 transition-shadow duration-200"
                                            whileDrag={{ scale: 1.02, backgroundColor: "var(--muted)" }}
                                        >
                                            <div className="p-4 hover:bg-muted/10 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4 group">
                                                <div className="flex items-center gap-4 flex-1 min-w-0">
                                                    <div className="cursor-grab active:cursor-grabbing p-2 text-muted-foreground/40 hover:text-foreground hover:bg-muted rounded-lg transition-colors shrink-0 touch-none">
                                                        <GripVertical size={20} />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                                                            {sheet.title}
                                                            {sheet.is_active ?
                                                                <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider font-black px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-200">
                                                                    <CheckCircle2 size={10} /> Active
                                                                </span> :
                                                                <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider font-black px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
                                                                    <XCircle size={10} /> Inactive
                                                                </span>
                                                            }
                                                        </h3>
                                                        <div className="flex items-center gap-2 mt-1.5 text-sm text-muted-foreground/80">
                                                            <LinkIcon size={14} className="shrink-0" />
                                                            <a href={sheet.url} target="_blank" rel="noopener noreferrer" className="truncate hover:text-indigo-600 hover:underline max-w-[400px]">
                                                                {sheet.url}
                                                            </a>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-3 shrink-0">
                                                    <div className="flex items-center gap-2 mr-4 bg-muted/30 px-3 py-1.5 rounded-lg border border-border/50">
                                                        <span className="text-xs font-bold text-muted-foreground">TL VISIBILITY</span>
                                                        <button
                                                            onClick={() => handleToggleStatus(sheet)}
                                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 focus:ring-offset-background ${sheet.is_active ? 'bg-indigo-500' : 'bg-slate-300 dark:bg-slate-700'}`}
                                                        >
                                                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${sheet.is_active ? 'translate-x-6' : 'translate-x-1'}`} />
                                                        </button>
                                                    </div>

                                                    <button onClick={() => handleOpenEdit(sheet)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Edit Sheet"><Edit2 size={18} /></button>
                                                    <a href={sheet.url} target="_blank" rel="noopener noreferrer" className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors" title="Test Link"><ExternalLink size={18} /></a>
                                                    <button onClick={() => handleDelete(sheet)} className="p-2 text-slate-400 hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors" title="Delete Sheet"><Trash2 size={18} /></button>
                                                </div>
                                            </div>
                                        </Reorder.Item>
                                    ))}
                                </Reorder.Group>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Add/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={resetForm} />
                    <div className="relative bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl p-6 overflow-hidden">
                        <div className="mb-6">
                            <h2 className="text-2xl font-black">{editingForm ? 'Edit Link' : 'Add New Link'}</h2>
                            <p className="text-sm text-muted-foreground">Provide the details below for TL access.</p>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-foreground mb-1.5">Title</label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="e.g. Daily Attendance Form"
                                    className="w-full px-4 py-2.5 bg-background border border-input rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                                    required
                                    autoFocus
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-foreground mb-1.5">Category</label>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setCategory('form')}
                                        className={`py-2.5 rounded-xl font-bold border transition-all ${category === 'form' ? 'bg-primary/10 border-primary text-primary' : 'bg-background border-border text-muted-foreground hover:bg-muted'}`}
                                    >
                                        Google Form
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setCategory('sheet')}
                                        className={`py-2.5 rounded-xl font-bold border transition-all ${category === 'sheet' ? 'bg-indigo-50 border-indigo-400 text-indigo-600' : 'bg-background border-border text-muted-foreground hover:bg-muted'}`}
                                    >
                                        Google Sheet
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-foreground mb-1.5">External URL</label>
                                <input
                                    type="url"
                                    value={url}
                                    onChange={(e) => setUrl(e.target.value)}
                                    placeholder="https://"
                                    className="w-full px-4 py-2.5 bg-background border border-input rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                                    required
                                />
                                <p className="text-xs text-muted-foreground mt-1.5">Make sure to include https://</p>
                            </div>

                            <div className="pt-2 flex items-center gap-3">
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" className="sr-only peer" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
                                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-primary"></div>
                                </label>
                                <span className="text-sm font-bold text-foreground">Make visible to Team Leaders immediately</span>
                            </div>

                            <div className="flex gap-3 pt-6 mt-6 border-t border-border">
                                <button
                                    type="button"
                                    onClick={resetForm}
                                    className="flex-1 px-4 py-2.5 bg-muted text-foreground font-bold rounded-xl hover:bg-muted/80 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="flex-1 bg-primary text-primary-foreground font-bold px-4 py-2.5 rounded-xl hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 shadow-lg"
                                >
                                    {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : editingForm ? 'Save Changes' : 'Add Link'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminForms;

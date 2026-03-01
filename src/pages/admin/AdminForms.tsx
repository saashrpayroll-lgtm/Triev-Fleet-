import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { supabase } from '@/config/supabase';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import {
    Plus, Link as LinkIcon, Edit2, Trash2, ExternalLink,
    FileText, CheckCircle2, XCircle, GripVertical, X, TableProperties, Save
} from 'lucide-react';
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

    useEffect(() => { fetchForms(); }, []);

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
        setTitle(''); setUrl(''); setCategory('form'); setIsActive(true);
        setEditingForm(null); setShowModal(false);
    };

    const handleOpenEdit = (form: ExternalForm) => {
        setEditingForm(form); setTitle(form.title); setUrl(form.url);
        setCategory(form.category || 'form'); setIsActive(form.is_active);
        setShowModal(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim() || !url.trim()) { toast.error('Title and URL are required'); return; }
        try { new URL(url); } catch { toast.error('Please enter a valid URL (e.g., https://forms.gle/...)'); return; }

        try {
            setIsSubmitting(true);
            if (editingForm) {
                const { error } = await supabase.from('external_forms')
                    .update({ title, url, category, is_active: isActive, updated_at: new Date().toISOString() })
                    .eq('id', editingForm.id);
                if (error) throw error;
                await logActivity({ actionType: 'form_updated', targetType: 'system', targetId: editingForm.id, details: `Updated external ${category}: ${title}`, performedBy: userData?.email });
                toast.success(`${category === 'form' ? 'Form' : 'Sheet'} updated successfully`);
            } else {
                const { error } = await supabase.from('external_forms')
                    .insert([{ title, url, category, is_active: isActive, display_order: forms.length, created_by: userData?.id }]);
                if (error) throw error;
                await logActivity({ actionType: 'form_created', targetType: 'system', targetId: 'new', details: `Created new external ${category}: ${title}`, performedBy: userData?.email });
                toast.success(`${category === 'form' ? 'Form' : 'Sheet'} added successfully`);
            }
            resetForm(); await fetchForms();
        } catch (error: unknown) {
            console.error('Error saving form:', error);
            toast.error(error instanceof Error ? error.message : 'Failed to save form');
        } finally { setIsSubmitting(false); }
    };

    const handleToggleStatus = async (form: ExternalForm) => {
        try {
            const { error } = await supabase.from('external_forms')
                .update({ is_active: !form.is_active }).eq('id', form.id);
            if (error) throw error;
            await logActivity({ actionType: 'form_toggled', targetType: 'system', targetId: form.id, details: `${form.is_active ? 'Disabled' : 'Enabled'} external form: ${form.title}`, performedBy: userData?.email });
            toast.success(`Form ${form.is_active ? 'disabled' : 'enabled'}`);
            setForms(forms.map(f => f.id === form.id ? { ...f, is_active: !f.is_active } : f));
        } catch (error) {
            console.error('Error toggling form status:', error);
            toast.error('Failed to update form status');
        }
    };

    const handleDelete = async (form: ExternalForm) => {
        if (!confirm(`Are you sure you want to delete the form "${form.title}"?`)) return;
        try {
            const { error } = await supabase.from('external_forms').delete().eq('id', form.id);
            if (error) throw error;
            await logActivity({ actionType: 'form_deleted', targetType: 'system', targetId: form.id, details: `Deleted external form: ${form.title}`, performedBy: userData?.email });
            toast.success('Form deleted');
            setForms(forms.filter(f => f.id !== form.id));
        } catch (error) {
            console.error('Error deleting form:', error);
            toast.error('Failed to delete form');
        }
    };

    const handleReorder = async (reorderedForms: ExternalForm[], targetCategory: 'form' | 'sheet') => {
        setForms(prev => {
            const otherCategoryForms = prev.filter(f => f.category !== targetCategory);
            return [...otherCategoryForms, ...reorderedForms].sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
        });
        try {
            const updates = reorderedForms.map((form, index) => ({
                id: form.id, title: form.title, url: form.url, category: form.category,
                is_active: form.is_active, display_order: index, updated_at: new Date().toISOString()
            }));
            const { error } = await supabase.from('external_forms').upsert(updates, { onConflict: 'id' });
            if (error) throw error;
            fetchForms();
        } catch (error) {
            console.error('Error saving new form order:', error);
            toast.error('Failed to save the new order. Please refresh.');
            fetchForms();
        }
    };

    const formsList = forms.filter(f => f.category === 'form' || !f.category);
    const sheetsList = forms.filter(f => f.category === 'sheet');

    const FormRow = ({ form, accent }: { form: ExternalForm; accent: 'primary' | 'indigo' }) => (
        <Reorder.Item
            key={form.id}
            value={form}
            className="bg-card/60 w-full active:shadow-2xl active:z-10 transition-shadow duration-200 backdrop-blur-sm"
            whileDrag={{ scale: 1.01, boxShadow: '0 20px 40px rgba(0,0,0,0.2)', zIndex: 10 }}
        >
            <div className="p-4 hover:bg-muted/5 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-3 group">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="cursor-grab active:cursor-grabbing p-1.5 text-muted-foreground/30 hover:text-foreground hover:bg-muted/50 rounded-lg transition-colors shrink-0 touch-none">
                        <GripVertical size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm font-bold text-foreground truncate">{form.title}</h3>
                            {form.is_active
                                ? <span className="flex items-center gap-1 text-[9px] uppercase tracking-widest font-black px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 shrink-0"><CheckCircle2 size={9} />Active</span>
                                : <span className="flex items-center gap-1 text-[9px] uppercase tracking-widest font-black px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border shrink-0"><XCircle size={9} />Inactive</span>
                            }
                        </div>
                        <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground/60">
                            <LinkIcon size={11} className="shrink-0" />
                            <a href={form.url} target="_blank" rel="noopener noreferrer"
                                className={`truncate max-w-[280px] hover:underline hover:text-${accent === 'primary' ? 'primary' : 'indigo-500'} transition-colors`}>
                                {form.url}
                            </a>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 pl-8 md:pl-0">
                    {/* Toggle */}
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted/30 border border-border/40">
                        <span className="text-[9px] font-black text-muted-foreground uppercase tracking-wider hidden sm:block">TL Visible</span>
                        <button
                            onClick={() => handleToggleStatus(form)}
                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${form.is_active ? (accent === 'primary' ? 'bg-emerald-500' : 'bg-indigo-500') : 'bg-slate-300 dark:bg-slate-700'}`}
                        >
                            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${form.is_active ? 'translate-x-5' : 'translate-x-0.5'}`} />
                        </button>
                    </div>
                    <button onClick={() => handleOpenEdit(form)} className="p-1.5 text-muted-foreground/50 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors" title="Edit"><Edit2 size={15} /></button>
                    <a href={form.url} target="_blank" rel="noopener noreferrer" className="p-1.5 text-muted-foreground/50 hover:text-blue-500 hover:bg-blue-500/10 rounded-lg transition-colors" title="Open"><ExternalLink size={15} /></a>
                    <button onClick={() => handleDelete(form)} className="p-1.5 text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors" title="Delete"><Trash2 size={15} /></button>
                </div>
            </div>
        </Reorder.Item>
    );

    return (
        <div className="space-y-5 max-w-5xl mx-auto">
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card/80 backdrop-blur p-5 rounded-2xl border border-border/60 shadow-sm"
            >
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                        <FileText size={20} className="text-primary" />
                    </div>
                    <div>
                        <h1 className="text-xl font-black tracking-tight text-foreground">Company Forms</h1>
                        <p className="text-muted-foreground text-xs font-medium">Manage Google Forms & Sheets for Team Leaders.</p>
                    </div>
                </div>
                <motion.button
                    onClick={() => { resetForm(); setShowModal(true); }}
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.97 }}
                    className="flex items-center justify-center gap-2 bg-primary text-primary-foreground font-bold px-5 py-2.5 rounded-xl hover:bg-primary/90 transition-all shadow-lg hover:shadow-primary/20 text-sm whitespace-nowrap"
                >
                    <Plus size={17} /> Add New Link
                </motion.button>
            </motion.div>

            {loading ? (
                <div className="flex flex-col items-center justify-center p-24 bg-card/50 border border-border rounded-2xl">
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                        className="w-9 h-9 border-2 border-primary/20 border-t-primary rounded-full mb-4" />
                    <p className="text-muted-foreground font-semibold text-sm">Loading forms...</p>
                </div>
            ) : (
                <div className="space-y-6">
                    {/* Forms Section */}
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
                        <div className="flex items-center gap-2.5 mb-3">
                            <div className="w-6 h-6 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                                <FileText size={13} className="text-primary" />
                            </div>
                            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Google Forms</h2>
                            <div className="flex-1 h-px bg-border/50" />
                            <span className="text-[9px] font-bold text-muted-foreground/40">{formsList.length} items</span>
                        </div>
                        <div className="bg-card/60 border border-border/60 rounded-2xl overflow-hidden backdrop-blur-sm">
                            {formsList.length === 0 ? (
                                <div className="p-10 text-center text-muted-foreground/50 text-sm italic">No forms added yet.</div>
                            ) : (
                                <Reorder.Group axis="y" values={formsList} onReorder={(vals) => handleReorder(vals, 'form')}
                                    className="divide-y divide-border/50 max-h-[420px] overflow-y-auto block">
                                    {formsList.map(form => <FormRow key={form.id} form={form} accent="primary" />)}
                                </Reorder.Group>
                            )}
                        </div>
                    </motion.div>

                    {/* Sheets Section */}
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                        <div className="flex items-center gap-2.5 mb-3">
                            <div className="w-6 h-6 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                                <TableProperties size={13} className="text-indigo-400" />
                            </div>
                            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Google Sheets</h2>
                            <div className="flex-1 h-px bg-border/50" />
                            <span className="text-[9px] font-bold text-muted-foreground/40">{sheetsList.length} items</span>
                        </div>
                        <div className="bg-card/60 border border-border/60 rounded-2xl overflow-hidden backdrop-blur-sm">
                            {sheetsList.length === 0 ? (
                                <div className="p-10 text-center text-muted-foreground/50 text-sm italic">No sheets added yet.</div>
                            ) : (
                                <Reorder.Group axis="y" values={sheetsList} onReorder={(vals) => handleReorder(vals, 'sheet')}
                                    className="divide-y divide-border/50 max-h-[420px] overflow-y-auto block">
                                    {sheetsList.map(sheet => <FormRow key={sheet.id} form={sheet} accent="indigo" />)}
                                </Reorder.Group>
                            )}
                        </div>
                    </motion.div>
                </div>
            )}

            {/* Add / Edit Modal */}
            <AnimatePresence>
                {showModal && (
                    <motion.div
                        className="fixed inset-0 z-50 flex items-center justify-center p-4"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <motion.div
                            className="absolute inset-0 bg-background/70 backdrop-blur-md"
                            onClick={resetForm}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                        />
                        <motion.div
                            className="relative bg-card border border-border/60 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden"
                            initial={{ opacity: 0, scale: 0.93, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.93, y: 20 }}
                            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] as const }}
                        >
                            {/* Gradient top bar */}
                            <div className={`h-1 w-full ${category === 'form' ? 'bg-gradient-to-r from-primary via-violet-500 to-primary/50' : 'bg-gradient-to-r from-indigo-500 via-teal-500 to-indigo-500/50'}`} />

                            <div className="p-6">
                                <div className="flex items-center justify-between mb-5">
                                    <div>
                                        <h2 className="text-lg font-black">{editingForm ? 'Edit Link' : 'Add New Link'}</h2>
                                        <p className="text-xs text-muted-foreground mt-0.5">Provide details for Team Leader access.</p>
                                    </div>
                                    <motion.button onClick={resetForm} whileTap={{ scale: 0.85 }}
                                        className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                                        <X size={18} />
                                    </motion.button>
                                </div>

                                <form onSubmit={handleSubmit} className="space-y-4">
                                    {/* Category Selector */}
                                    <div>
                                        <label className="block text-xs font-bold text-foreground mb-2">Category</label>
                                        <div className="grid grid-cols-2 gap-2">
                                            {(['form', 'sheet'] as const).map(c => (
                                                <motion.button key={c} type="button" onClick={() => setCategory(c)}
                                                    whileTap={{ scale: 0.96 }}
                                                    className={`py-2.5 rounded-xl text-sm font-bold border transition-all flex items-center justify-center gap-2 ${category === c
                                                        ? c === 'form'
                                                            ? 'bg-primary/10 border-primary text-primary'
                                                            : 'bg-indigo-500/10 border-indigo-500 text-indigo-500'
                                                        : 'border-border text-muted-foreground hover:bg-muted/50'}`}
                                                >
                                                    {c === 'form' ? <FileText size={14} /> : <TableProperties size={14} />}
                                                    Google {c === 'form' ? 'Form' : 'Sheet'}
                                                </motion.button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Title */}
                                    <div>
                                        <label className="block text-xs font-bold text-foreground mb-1.5">Title</label>
                                        <input
                                            type="text" value={title} onChange={(e) => setTitle(e.target.value)}
                                            placeholder="e.g. Daily Attendance Form"
                                            className="w-full px-4 py-2.5 bg-background border border-input rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                                            required autoFocus
                                        />
                                    </div>

                                    {/* URL */}
                                    <div>
                                        <label className="block text-xs font-bold text-foreground mb-1.5">External URL</label>
                                        <input
                                            type="url" value={url} onChange={(e) => setUrl(e.target.value)}
                                            placeholder="https://"
                                            className="w-full px-4 py-2.5 bg-background border border-input rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                                            required
                                        />
                                        <p className="text-[11px] text-muted-foreground mt-1.5">Make sure to include https://</p>
                                    </div>

                                    {/* Visibility Toggle */}
                                    <div className="flex items-center gap-3 py-1">
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input type="checkbox" className="sr-only peer" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
                                            <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:bg-primary" />
                                        </label>
                                        <span className="text-xs font-bold text-foreground">Visible to Team Leaders immediately</span>
                                    </div>

                                    {/* Footer Buttons */}
                                    <div className="flex gap-3 pt-4 border-t border-border">
                                        <button type="button" onClick={resetForm}
                                            className="flex-1 px-4 py-2.5 bg-muted text-foreground font-bold rounded-xl hover:bg-muted/80 transition-colors text-sm">
                                            Cancel
                                        </button>
                                        <motion.button type="submit" disabled={isSubmitting}
                                            whileHover={!isSubmitting ? { scale: 1.02 } : {}}
                                            whileTap={!isSubmitting ? { scale: 0.97 } : {}}
                                            className="flex-1 bg-primary text-primary-foreground font-bold px-4 py-2.5 rounded-xl hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 shadow-md text-sm disabled:opacity-50">
                                            {isSubmitting
                                                ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }} className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
                                                : <><Save size={15} /> {editingForm ? 'Save Changes' : 'Add Link'}</>
                                            }
                                        </motion.button>
                                    </div>
                                </form>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default AdminForms;

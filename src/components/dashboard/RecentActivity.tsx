import React, { useEffect, useState } from 'react';
import { supabase } from '@/config/supabase';
import { Clock, FileText, CheckCircle, AlertCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface ActivityLog {
    id: string;
    actionType: string;
    details: string;
    timestamp: string;
    userId: string;
    userName?: string;
    metadata?: any;
}

const RecentActivity: React.FC = () => {
    const [activities, setActivities] = useState<ActivityLog[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchActivity = async () => {
        try {
            // Fetch last 5 logs
            const { data, error } = await supabase
                .from('activity_logs')
                .select(`
                    id, 
                    actionType:action_type, 
                    details, 
                    timestamp, 
                    userId:user_id, 
                    userName:user_name, 
                    metadata
                `)
                .order('timestamp', { ascending: false })
                .limit(5);

            if (error) throw error;
            setActivities((data || []) as ActivityLog[]);
        } catch (err) {
            console.error("Failed to fetch activity:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchActivity();

        // Realtime Subscription
        const sub = supabase
            .channel('recent-activity-sync')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_logs' }, (payload) => {
                const item = payload.new as any;
                const mapped: ActivityLog = {
                    id: item.id,
                    actionType: item.action_type,
                    details: item.details,
                    timestamp: item.timestamp,
                    userId: item.user_id,
                    userName: item.user_name,
                    metadata: item.metadata
                };
                setActivities(prev => [mapped, ...prev].slice(0, 5));
            })
            .subscribe();

        return () => { sub.unsubscribe(); };
    }, []);

    const getIcon = (action: string) => {
        if (action.includes('create') || action.includes('add')) return <CheckCircle size={16} className="text-green-500" />;
        if (action.includes('delete') || action.includes('remove')) return <AlertCircle size={16} className="text-red-500" />;
        if (action.includes('update') || action.includes('edit')) return <FileText size={16} className="text-blue-500" />;
        return <Clock size={16} className="text-gray-500" />;
    };

    if (loading) return <div className="h-full flex items-center justify-center text-xs text-muted-foreground">Loading activity...</div>;

    if (activities.length === 0) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-4">
                <Clock size={24} className="mb-2 opacity-50" />
                <p className="text-sm">No recent activity</p>
            </div>
        );
    }

    return (
        <div className="bg-card border rounded-xl shadow-sm overflow-hidden h-full flex flex-col">
            <div className="p-4 border-b bg-muted/30 flex justify-between items-center">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                    <Clock size={16} className="text-indigo-500" />
                    Recent Activity
                </h3>
            </div>
            <div className="flex-1 overflow-y-auto max-h-[300px]">
                <ul className="divide-y divide-border">
                    {activities.map((log) => (
                        <li key={log.id} className="p-3 hover:bg-muted/50 transition-colors text-sm">
                            <div className="flex gap-3">
                                <div className="mt-0.5">{getIcon(log.actionType)}</div>
                                <div className="space-y-0.5">
                                    <p className="font-medium text-foreground">{log.actionType.replace(/_/g, ' ')}</p>
                                    <p className="text-muted-foreground text-xs line-clamp-2">{log.details}</p>
                                    <p className="text-[10px] text-muted-foreground/70 pt-1">
                                        {formatDistanceToNow(new Date(log.timestamp), { addSuffix: true })}
                                    </p>
                                </div>
                            </div>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
};

export default RecentActivity;

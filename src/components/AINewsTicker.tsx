import React, { useEffect, useState } from 'react';
import { supabase } from '@/config/supabase';
import { Sparkles, Activity } from 'lucide-react';

interface NewsItem {
    id: string;
    details: string;
    timestamp: string; // ISO String from Supabase
    actionType: string;
}

const AINewsTicker: React.FC = () => {
    const [news, setNews] = useState<NewsItem[]>([]);

    useEffect(() => {
        // Initial Fetch
        const fetchNews = async () => {
            const { data } = await supabase
                .from('activity_logs')
                .select('*')
                .order('timestamp', { ascending: false })
                .limit(10);

            if (data) {
                setNews(data as NewsItem[]);
            }
        };

        fetchNews();

        // Real-time Subscription
        const channel = supabase
            .channel('ai-news-ticker')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'activity_logs' },
                (payload) => {
                    const newLog = payload.new as NewsItem;
                    setNews((prev) => [newLog, ...prev].slice(0, 10));
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    if (news.length === 0) return null;

    return (
        <div className="bg-gradient-to-r from-indigo-900 to-purple-900 text-white py-2 overflow-hidden relative flex items-center shadow-md mb-6 rounded-lg mx-1">
            <div className="bg-indigo-900/90 absolute left-0 z-10 px-3 py-1 flex items-center gap-2 h-full font-bold text-xs uppercase tracking-wider border-r border-white/10">
                <Sparkles size={14} className="text-yellow-400 animate-pulse" />
                <span>AI Live Feed</span>
            </div>

            <div className="flex animate-marquee whitespace-nowrap items-center hover:pause-animation">
                {news.map((item, index) => (
                    <div key={item.id} className="inline-flex items-center mx-12 text-base font-medium">
                        <Activity size={16} className="mr-3 text-indigo-300" />
                        <span className="text-indigo-50 tracking-wide">{item.details}</span>
                        <span className="ml-3 text-xs text-indigo-300/80 font-mono border border-indigo-500/30 px-1.5 rounded">
                            {item.timestamp ? new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                        </span>
                        {index < news.length - 1 && (
                            <span className="ml-12 text-indigo-500/30 text-xl">|</span>
                        )}
                    </div>
                ))}
            </div>

            <style>{`
                @keyframes marquee {
                    0% { transform: translateX(100%); }
                    100% { transform: translateX(-100%); }
                }
                .animate-marquee {
                    animation: marquee 60s linear infinite;
                }
                .hover\\:pause-animation:hover {
                    animation-play-state: paused;
                }
            `}</style>
        </div>
    );
};

export default AINewsTicker;

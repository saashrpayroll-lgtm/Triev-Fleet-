import React, { useMemo } from 'react';
import { format, eachDayOfInterval, subDays, isSameDay, getDay } from 'date-fns';

interface HeatmapChartProps {
    data: { date: Date; value: number }[];
    days?: number;
    colorScale?: string[];
}

const HeatmapChart: React.FC<HeatmapChartProps> = ({
    data,
    days = 60,
    colorScale = ['bg-gray-100', 'bg-indigo-100', 'bg-indigo-300', 'bg-indigo-500', 'bg-indigo-700']
}) => {

    // Group by Week
    const calendarWeeks = useMemo(() => {
        const today = new Date();
        const startDate = subDays(today, days);
        const dateRange = eachDayOfInterval({ start: startDate, end: today });

        const weeks: { date: Date; count: number; colorClass: string }[][] = [];
        let currentWeek: { date: Date; count: number; colorClass: string }[] = [];

        dateRange.forEach(date => {
            if (getDay(date) === 0 && currentWeek.length > 0) {
                weeks.push(currentWeek);
                currentWeek = [];
            }

            const dayData = data.find(d => isSameDay(d.date, date));
            const count = dayData ? dayData.value : 0;

            let colorClass = colorScale[0];
            if (count > 0) colorClass = colorScale[1];
            if (count > 2) colorClass = colorScale[2];
            if (count > 5) colorClass = colorScale[3];
            if (count > 10) colorClass = colorScale[4];

            currentWeek.push({ date, count, colorClass });
        });
        if (currentWeek.length > 0) weeks.push(currentWeek);

        return weeks;
    }, [data, days, colorScale]);

    return (
        <div className="w-full overflow-x-auto pb-2">
            <div className="flex gap-1 min-w-max">
                {/* Columns are Weeks */}
                {calendarWeeks.map((week, wIdx) => (
                    <div key={wIdx} className="flex flex-col gap-1">
                        {week.map((day, dIdx) => (
                            <div
                                key={`${wIdx}-${dIdx}`}
                                title={`${format(day.date, 'MMM dd, yyyy')}: ${day.count} Activities`}
                                className={`w-3 h-3 rounded-sm ${day.colorClass} hover:ring-2 ring-offset-1 ring-indigo-400 transition-all cursor-pointer`}
                            />
                        ))}
                    </div>
                ))}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-2 mt-3 text-xs text-gray-400 justify-end">
                <span>Less</span>
                {colorScale.map((c, i) => (
                    <div key={i} className={`w-3 h-3 rounded-sm ${c}`} />
                ))}
                <span>More</span>
            </div>
        </div>
    );
};

export default HeatmapChart;

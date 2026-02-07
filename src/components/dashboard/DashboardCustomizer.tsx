import React from 'react';
import { X, Eye, EyeOff, ArrowUp, ArrowDown, RotateCcw } from 'lucide-react';

interface DashboardSection {
    id: string;
    label: string;
    visible: boolean;
}

interface DashboardCustomizerProps {
    sections: DashboardSection[];
    onUpdate: (sections: DashboardSection[]) => void;
    onClose: () => void;
    onReset: () => void;
}

const DashboardCustomizer: React.FC<DashboardCustomizerProps> = ({
    sections,
    onUpdate,
    onClose,
    onReset
}) => {
    const handleToggle = (id: string) => {
        const updated = sections.map(s =>
            s.id === id ? { ...s, visible: !s.visible } : s
        );
        onUpdate(updated);
    };

    const handleMove = (index: number, direction: 'up' | 'down') => {
        if (direction === 'up' && index === 0) return;
        if (direction === 'down' && index === sections.length - 1) return;

        const newSections = [...sections];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;

        [newSections[index], newSections[targetIndex]] = [newSections[targetIndex], newSections[index]];

        onUpdate(newSections);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-end p-4 bg-black/20 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-xl shadow-2xl border w-80 mt-16 mr-4 overflow-hidden animate-in slide-in-from-right duration-300">
                <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                    <h3 className="font-bold flex items-center gap-2 text-gray-800">Customize Layout</h3>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={onReset}
                            className="p-1.5 hover:bg-gray-200 rounded-md text-xs font-medium text-gray-600 flex items-center gap-1"
                            title="Reset to Default"
                        >
                            <RotateCcw size={14} /> Reset
                        </button>
                        <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded-full"><X size={18} /></button>
                    </div>
                </div>

                <div className="p-4 bg-indigo-50/50">
                    <p className="text-xs text-gray-500 mb-3">Reorder sections and toggle visibility.</p>

                    <div className="space-y-2">
                        {sections.map((section, index) => (
                            <div
                                key={section.id}
                                className={`
                                    flex items-center justify-between p-3 rounded-lg border bg-white shadow-sm hover:border-indigo-300 transition-all
                                `}
                            >
                                <div className="flex items-center gap-2">
                                    <div className="flex flex-col gap-0.5">
                                        <button
                                            onClick={() => handleMove(index, 'up')}
                                            disabled={index === 0}
                                            className="text-gray-400 hover:text-indigo-600 disabled:opacity-30"
                                        >
                                            <ArrowUp size={12} />
                                        </button>
                                        <button
                                            onClick={() => handleMove(index, 'down')}
                                            disabled={index === sections.length - 1}
                                            className="text-gray-400 hover:text-indigo-600 disabled:opacity-30"
                                        >
                                            <ArrowDown size={12} />
                                        </button>
                                    </div>
                                    <span className={`text-sm font-medium ${!section.visible && 'text-gray-400 line-through'}`}>
                                        {section.label}
                                    </span>
                                </div>

                                <button
                                    onClick={() => handleToggle(section.id)}
                                    className={`p-1.5 rounded-md transition-colors ${section.visible ? 'text-indigo-600 bg-indigo-50' : 'text-gray-400 hover:text-gray-600'}`}
                                >
                                    {section.visible ? <Eye size={16} /> : <EyeOff size={16} />}
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="p-3 bg-gray-50 text-xs text-center text-gray-500 border-t">
                    Changes are auto-saved.
                </div>
            </div>
        </div>
    );
};

export default DashboardCustomizer;

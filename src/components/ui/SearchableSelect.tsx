import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { createPortal } from 'react-dom';

interface Option {
    value: string;
    label: string;
}

interface SearchableSelectProps {
    options: Option[];
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
    searchPlaceholder?: string;
}

const SearchableSelect: React.FC<SearchableSelectProps> = ({
    options,
    value,
    onChange,
    placeholder = 'Select...',
    className = '',
    searchPlaceholder = 'Search...'
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 0 });
    const triggerRef = useRef<HTMLDivElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    /* position dropdown on open */
    const openDropdown = () => {
        if (triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            const spaceAbove = rect.top;
            const top = spaceBelow >= 240 || spaceBelow >= spaceAbove
                ? rect.bottom + window.scrollY + 4
                : rect.top + window.scrollY - 244;
            setDropdownPos({ top, left: rect.left + window.scrollX, width: rect.width });
        }
        setIsOpen(true);
    };

    /* close on outside click */
    useEffect(() => {
        if (!isOpen) return;
        const handler = (e: MouseEvent) => {
            const target = e.target as Node;
            if (!triggerRef.current?.contains(target) && !dropdownRef.current?.contains(target)) {
                setIsOpen(false);
                setSearchTerm('');
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [isOpen]);

    /* reposition on scroll/resize */
    useEffect(() => {
        if (!isOpen) return;
        const update = () => {
            if (triggerRef.current) {
                const rect = triggerRef.current.getBoundingClientRect();
                setDropdownPos(p => ({ ...p, top: rect.bottom + window.scrollY + 4, left: rect.left + window.scrollX, width: rect.width }));
            }
        };
        window.addEventListener('scroll', update, true);
        window.addEventListener('resize', update);
        return () => { window.removeEventListener('scroll', update, true); window.removeEventListener('resize', update); };
    }, [isOpen]);

    const filtered = options.filter(o => (o.label || '').toLowerCase().includes(searchTerm.toLowerCase()));
    const selected = options.find(o => o.value === value);

    return (
        <div className={`relative ${className}`}>
            {/* Trigger */}
            <div
                ref={triggerRef}
                onClick={isOpen ? () => { setIsOpen(false); setSearchTerm(''); } : openDropdown}
                className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-foreground shadow-sm cursor-pointer flex items-center justify-between hover:border-blue-400 transition-colors select-none"
            >
                <span className={`block truncate text-sm font-medium ${!selected ? 'text-muted-foreground' : ''}`}>
                    {selected ? selected.label : placeholder}
                </span>
                <ChevronDown size={15} className={`text-muted-foreground transition-transform shrink-0 ml-1 ${isOpen ? 'rotate-180' : ''}`} />
            </div>

            {/* Dropdown — rendered in a portal so overflow:hidden NEVER clips it */}
            {isOpen && createPortal(
                <div
                    ref={dropdownRef}
                    style={{ position: 'absolute', top: dropdownPos.top, left: dropdownPos.left, width: dropdownPos.width, zIndex: 99999 }}
                    className="bg-white dark:bg-slate-900 border border-border rounded-xl shadow-2xl max-h-64 flex flex-col overflow-hidden"
                >
                    {/* Search input */}
                    <div className="p-2 border-b border-border/60 bg-white dark:bg-slate-900 shrink-0">
                        <div className="relative">
                            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
                            <input
                                type="text"
                                autoFocus
                                className="w-full pl-7 pr-2.5 py-1.5 text-sm bg-muted/40 rounded-lg border border-input focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 text-foreground"
                                placeholder={searchPlaceholder}
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                onClick={e => e.stopPropagation()}
                            />
                        </div>
                    </div>

                    {/* Options list */}
                    <div className="overflow-y-auto flex-1">
                        {filtered.length > 0 ? (
                            filtered.map(option => (
                                <div
                                    key={option.value}
                                    onClick={() => { onChange(option.value); setIsOpen(false); setSearchTerm(''); }}
                                    className={`px-3 py-2.5 text-sm cursor-pointer transition-colors ${value === option.value
                                            ? 'bg-blue-500/10 text-blue-600 font-semibold'
                                            : 'text-foreground hover:bg-muted/60'
                                        }`}
                                >
                                    {option.label}
                                </div>
                            ))
                        ) : (
                            <div className="px-3 py-5 text-center text-xs text-muted-foreground/60">No results found</div>
                        )}
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default SearchableSelect;

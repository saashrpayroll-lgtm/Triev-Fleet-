import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search } from 'lucide-react';

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
    const containerRef = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filteredOptions = options.filter(option =>
        (option.label || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const selectedFormat = options.find(o => o.value === value);

    return (
        <div className={`relative ${className}`} ref={containerRef}>
            <div
                className="w-full px-3 py-2 rounded-lg border border-input bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 shadow-sm cursor-pointer flex items-center justify-between hover:border-primary/50 transition-colors"
                onClick={() => setIsOpen(!isOpen)}
            >
                <span className={`block truncate ${!selectedFormat ? 'text-muted-foreground' : ''}`}>
                    {selectedFormat ? selectedFormat.label : placeholder}
                </span>
                <ChevronDown size={16} className={`text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </div>

            {isOpen && (
                <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-950 border border-border rounded-lg shadow-lg max-h-60 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-100">
                    <div className="p-2 border-b border-border sticky top-0 bg-white dark:bg-slate-950">
                        <div className="relative">
                            <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                            <input
                                type="text"
                                className="w-full pl-8 pr-2 py-1.5 text-sm bg-muted/30 rounded-md border border-input focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
                                placeholder={searchPlaceholder}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                autoFocus
                                onClick={(e) => e.stopPropagation()}
                            />
                        </div>
                    </div>

                    <div className="overflow-y-auto flex-1">
                        {filteredOptions.length > 0 ? (
                            filteredOptions.map((option) => (
                                <div
                                    key={option.value}
                                    className={`px-3 py-2 text-sm cursor-pointer hover:bg-primary/10 hover:text-primary transition-colors ${value === option.value ? 'bg-primary/5 text-primary font-medium' : 'text-foreground'}`}
                                    onClick={() => {
                                        onChange(option.value);
                                        setIsOpen(false);
                                        setSearchTerm('');
                                    }}
                                >
                                    {option.label}
                                </div>
                            ))
                        ) : (
                            <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                                No results found
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default SearchableSelect;

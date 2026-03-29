import { useState } from 'react';
import { Calendar } from 'lucide-react';

interface DateRange {
    from: Date;
    to: Date;
}

interface DateRangeSelectorProps {
    value: DateRange;
    onChange: (range: DateRange) => void;
    maxDays?: number;
}

const presets = [
    { label: '7 días', days: 7 },
    { label: '14 días', days: 14 },
    { label: '30 días', days: 30 },
    { label: '90 días', days: 90 },
    { label: '180 días', days: 180 },
];

export default function DateRangeSelector({ value, onChange, maxDays = 30 }: DateRangeSelectorProps) {
    const [isOpen, setIsOpen] = useState(false);

    const handlePreset = (days: number) => {
        const to = new Date();
        const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        onChange({ from, to });
        setIsOpen(false);
    };

    const formatDate = (date: Date) => {
        return date.toLocaleDateString('es-ES', {
            day: '2-digit',
            month: 'short'
        });
    };

    const currentDays = Math.ceil((value.to.getTime() - value.from.getTime()) / (24 * 60 * 60 * 1000));

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-4 py-2.5 bg-[#f8fafc] dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] rounded-lg text-[#1e293b] dark:text-[#f8fafc] hover:bg-white dark:hover:bg-[#1B1C1D] transition-colors"
            >
                <Calendar className="w-4 h-4 text-[#64748b] dark:text-[#94a3b8]" />
                <span className="text-sm font-medium">
                    {formatDate(value.from)} - {formatDate(value.to)}
                </span>
            </button>

            {isOpen && (
                <>
                    <div
                        className="fixed inset-0 z-10"
                        onClick={() => setIsOpen(false)}
                    />
                    <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-[#1B1C1D] border border-[#e2e8f0] dark:border-[#374151] rounded-xl shadow-xl z-20 overflow-hidden">
                        <div className="p-3 border-b border-[#e2e8f0] dark:border-[#374151]">
                            <p className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wider">
                                Rango de Fechas
                            </p>
                            <p className="text-[10px] text-[#94a3b8] dark:text-[#64748b] mt-1">
                                Tu plan permite hasta {maxDays} días
                            </p>
                        </div>
                        <div className="p-1">
                            {presets.filter(p => p.days <= maxDays).map((preset) => (
                                <button
                                    key={preset.days}
                                    onClick={() => handlePreset(preset.days)}
                                    className={`w-full px-4 py-2.5 text-left text-sm rounded-lg transition-colors
                                        ${currentDays === preset.days
                                            ? 'bg-[#2563eb]/10 text-[#2563eb] font-semibold'
                                            : 'text-[#1e293b] dark:text-[#f8fafc] hover:bg-[#f8fafc] dark:hover:bg-[#262626]'
                                        }`}
                                >
                                    Últimos {preset.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

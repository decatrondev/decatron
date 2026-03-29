// TimeUnitInput - Reusable time input with unit selector (seconds, minutes, hours, days)

import React from 'react';
import { Clock } from 'lucide-react';

export type TimeUnit = 'seconds' | 'minutes' | 'hours' | 'days';

interface TimeUnitInputProps {
    value: number; // Always stored as seconds internally
    onChange: (seconds: number) => void;
    label?: string;
    min?: number;
    max?: number;
    className?: string;
    showLabel?: boolean;
}

export const TimeUnitInput: React.FC<TimeUnitInputProps> = ({
    value,
    onChange,
    label = 'Tiempo',
    min = 0,
    max = 999999999,
    className = '',
    showLabel = true
}) => {
    // Determine best unit to display
    const getBestUnit = (seconds: number): TimeUnit => {
        if (seconds >= 86400 && seconds % 86400 === 0) return 'days';
        if (seconds >= 3600 && seconds % 3600 === 0) return 'hours';
        if (seconds >= 60 && seconds % 60 === 0) return 'minutes';
        return 'seconds';
    };

    const [displayUnit, setDisplayUnit] = React.useState<TimeUnit>(() => getBestUnit(value));

    // Convert seconds to display value
    const getDisplayValue = (): number => {
        switch (displayUnit) {
            case 'days': return Math.floor(value / 86400);
            case 'hours': return Math.floor(value / 3600);
            case 'minutes': return Math.floor(value / 60);
            default: return value;
        }
    };

    // Convert display value to seconds
    const toSeconds = (displayValue: number, unit: TimeUnit): number => {
        switch (unit) {
            case 'days': return displayValue * 86400;
            case 'hours': return displayValue * 3600;
            case 'minutes': return displayValue * 60;
            default: return displayValue;
        }
    };

    const handleValueChange = (newDisplayValue: number) => {
        const newSeconds = toSeconds(newDisplayValue, displayUnit);
        onChange(Math.max(min, Math.min(max, newSeconds)));
    };

    const handleUnitChange = (newUnit: TimeUnit) => {
        setDisplayUnit(newUnit);
        // Optionally recalculate to preserve the value
    };

    const units: { id: TimeUnit; label: string; shortLabel: string }[] = [
        { id: 'seconds', label: 'Segundos', shortLabel: 's' },
        { id: 'minutes', label: 'Minutos', shortLabel: 'm' },
        { id: 'hours', label: 'Horas', shortLabel: 'h' },
        { id: 'days', label: 'Días', shortLabel: 'd' }
    ];

    // Format for display
    const formatTimePreview = (): string => {
        const totalSeconds = value;
        const days = Math.floor(totalSeconds / 86400);
        const hours = Math.floor((totalSeconds % 86400) / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        const parts: string[] = [];
        if (days > 0) parts.push(`${days}d`);
        if (hours > 0) parts.push(`${hours}h`);
        if (minutes > 0) parts.push(`${minutes}m`);
        if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);

        return parts.join(' ');
    };

    return (
        <div className={className}>
            {showLabel && (
                <label className="flex items-center gap-2 text-sm font-medium text-[#64748b] dark:text-[#94a3b8] mb-2">
                    <Clock className="w-4 h-4" />
                    {label}
                </label>
            )}
            <div className="flex items-center gap-2">
                {/* Number Input */}
                <input
                    type="number"
                    min={0}
                    value={getDisplayValue()}
                    onChange={(e) => handleValueChange(Number(e.target.value) || 0)}
                    className="w-24 px-3 py-2 bg-[#f8fafc] dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] rounded-lg text-[#1e293b] dark:text-[#f8fafc] text-center"
                />

                {/* Unit Selector */}
                <div className="flex rounded-lg overflow-hidden border border-[#e2e8f0] dark:border-[#374151]">
                    {units.map((unit) => (
                        <button
                            key={unit.id}
                            onClick={() => handleUnitChange(unit.id)}
                            className={`px-3 py-2 text-sm font-medium transition-colors ${
                                displayUnit === unit.id
                                    ? 'bg-[#667eea] text-white'
                                    : 'bg-white dark:bg-[#1B1C1D] text-[#64748b] hover:bg-[#f8fafc] dark:hover:bg-[#262626]'
                            }`}
                            title={unit.label}
                        >
                            {unit.shortLabel}
                        </button>
                    ))}
                </div>

                {/* Preview */}
                <span className="text-sm text-[#94a3b8] font-mono">
                    = {formatTimePreview()}
                </span>
            </div>
        </div>
    );
};

export default TimeUnitInput;

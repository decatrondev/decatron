/**
 * Now Playing Extension - Shared UI Components
 */

import React from 'react';
import { Check } from 'lucide-react';
import { TIER_LABELS } from '../../constants/defaults';

export const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
    <div className={`bg-ds-surface rounded-lg border border-ds-border p-5 ${className}`}>
        {children}
    </div>
);

export const SectionTitle: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
    <h3 className={`text-sm font-semibold text-ds-soft uppercase tracking-wider mb-4 ${className}`}>{children}</h3>
);

export const Label: React.FC<{ children: React.ReactNode; htmlFor?: string }> = ({ children, htmlFor }) => (
    <label htmlFor={htmlFor} className="block text-sm font-medium text-ds-text mb-1.5">{children}</label>
);

export const SubLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <span className="text-xs text-ds-soft">{children}</span>
);

export const TierLock: React.FC<{
    allowed: boolean;
    requiredTier?: 'supporter' | 'premium';
    children: React.ReactNode;
}> = ({ allowed, requiredTier = 'supporter', children }) => {
    if (allowed) return <>{children}</>;
    const tier = TIER_LABELS[requiredTier];
    return (
        <div className="relative">
            <div className="opacity-40 pointer-events-none select-none">{children}</div>
            <a
                href="/supporters"
                className={`absolute inset-0 flex items-center justify-center cursor-pointer group`}
            >
                <span className={`text-[10px] font-bold px-2 py-1 rounded border ${tier.color} group-hover:scale-105 transition-transform`}>
                    {tier.label}
                </span>
            </a>
        </div>
    );
};

export const TextInput: React.FC<{
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    className?: string;
    id?: string;
}> = ({ value, onChange, placeholder, className = '', id }) => (
    <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full px-3 py-2 bg-ds-bg border border-ds-border rounded-lg text-ds-text placeholder-ds-soft focus:outline-none focus:ring-2 focus:ring-ds-accent focus:border-transparent text-sm ${className}`}
    />
);

export const NumberInput: React.FC<{
    value: number;
    onChange: (v: number) => void;
    min?: number;
    max?: number;
    step?: number;
    className?: string;
    disabled?: boolean;
}> = ({ value, onChange, min, max, step = 1, className = '', disabled = false }) => (
    <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        className={`w-full px-3 py-2 bg-ds-bg border border-ds-border rounded-lg text-ds-text focus:outline-none focus:ring-2 focus:ring-ds-accent focus:border-transparent text-sm disabled:opacity-50 ${className}`}
    />
);

export const ColorInput: React.FC<{
    value: string;
    onChange: (v: string) => void;
    label?: string;
}> = ({ value, onChange, label }) => (
    <div className="flex items-center gap-2">
        <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-9 h-9 rounded-lg border border-ds-border cursor-pointer bg-transparent p-0.5"
        />
        <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="ds-input flex-1 font-mono"
        />
        {label && <span className="text-xs text-ds-soft whitespace-nowrap">{label}</span>}
    </div>
);

export const SelectInput: React.FC<{
    value: string | number;
    onChange: (v: string) => void;
    options: { value: string | number; label: string; disabled?: boolean }[];
    className?: string;
}> = ({ value, onChange, options, className = '' }) => (
    <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full px-3 py-2 bg-ds-bg border border-ds-border rounded-lg text-ds-text focus:outline-none focus:ring-2 focus:ring-ds-accent text-sm ${className}`}
    >
        {options.map((opt) => (
            <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                {opt.label}
            </option>
        ))}
    </select>
);

export const Slider: React.FC<{
    value: number;
    onChange: (v: number) => void;
    min: number;
    max: number;
    step?: number;
    unit?: string;
}> = ({ value, onChange, min, max, step = 1, unit = '' }) => (
    <div className="flex items-center gap-3">
        <input
            type="range"
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            min={min}
            max={max}
            step={step}
            className="flex-1 h-2 rounded-lg appearance-none bg-ds-raised accent-ds-accent cursor-pointer"
        />
        <span className="text-sm text-ds-soft font-mono w-16 text-right">
            {value}{unit}
        </span>
    </div>
);

export const Toggle: React.FC<{
    checked: boolean;
    onChange: (v: boolean) => void;
    label: string;
    description?: string;
    size?: 'sm' | 'lg';
    disabled?: boolean;
}> = ({ checked, onChange, label, description, size = 'sm', disabled = false }) => {
    const trackSize = size === 'lg' ? 'w-14 h-7' : 'w-10 h-5';
    const dotSize = size === 'lg' ? 'w-5 h-5' : 'w-3.5 h-3.5';
    const dotTranslate = size === 'lg' ? (checked ? 'translate-x-7' : 'translate-x-1') : (checked ? 'translate-x-5' : 'translate-x-0.5');

    return (
        <label className={`flex items-center justify-between group py-1 ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}>
            <div className="flex-1 mr-3">
                <span className="text-sm font-medium text-ds-text group-hover:text-ds-text transition-colors">{label}</span>
                {description && <p className="text-xs text-ds-soft mt-0.5">{description}</p>}
            </div>
            <div className={`relative ${trackSize} rounded-full transition-colors ${checked ? 'bg-ds-accent' : 'bg-ds-raised'}`}
                onClick={() => { if (!disabled) onChange(!checked); }}>
                <div className={`absolute top-1/2 -translate-y-1/2 ${dotSize} rounded-full bg-ds-surface transition-transform ${dotTranslate}`} />
            </div>
        </label>
    );
};

export const Checkbox: React.FC<{
    checked: boolean;
    onChange: (v: boolean) => void;
    label: string;
}> = ({ checked, onChange, label }) => (
    <label className="flex items-center gap-2.5 cursor-pointer group py-0.5">
        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
            checked ? 'bg-ds-accent border-ds-accent' : 'border-ds-border bg-ds-bg'
        }`} onClick={() => onChange(!checked)}>
            {checked && <Check className="w-3 h-3 text-ds-on-accent" />}
        </div>
        <span className="text-sm text-ds-text group-hover:text-ds-text transition-colors">{label}</span>
    </label>
);

export interface DateRangePickerProps {
    displayLabel: string;
    fromValue: string;
    toValue: string;
    onChangeFrom: (v: string) => void;
    onChangeTo: (v: string) => void;
    onApplyCustom: () => void;
    onSelectPreset: (preset: string) => void;
    presets: string[];
    error?: string | null;
    isOpen: boolean;
    onToggle: () => void;
}

import { ChevronDown, ChevronUp } from 'lucide-react';

export function DateRangePicker({
    displayLabel,
    fromValue,
    toValue,
    onChangeFrom,
    onChangeTo,
    onApplyCustom,
    onSelectPreset,
    presets,
    error,
    isOpen,
    onToggle,
}: DateRangePickerProps) {
    return (
        <div className="text-right">
            <button
                className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1 text-xs text-text hover:border-primary"
                onClick={onToggle}
            >
                <span className="font-semibold">{displayLabel}</span>
                <span className="text-subtle" aria-hidden>
                    {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </span>
            </button>
            {isOpen && (
                <div className="mt-2 space-y-2">
                    <div className="flex flex-wrap gap-1 justify-end">
                        {presets.map((p) => (
                            <button
                                key={p}
                                className="rounded-md border border-border px-2 py-1 text-[11px] text-text hover:border-primary"
                                onClick={() => onSelectPreset(p)}
                            >
                                {p}
                            </button>
                        ))}
                    </div>
                    <label className="block text-[11px] uppercase tracking-[0.08em] text-subtle">
                        From
                        <input
                            type="datetime-local"
                            className="mt-1 w-44 rounded-md border border-border bg-surface px-2 py-1 text-xs text-text"
                            value={fromValue}
                            onChange={(e) => onChangeFrom(e.target.value)}
                        />
                    </label>
                    <label className="block text-[11px] uppercase tracking-[0.08em] text-subtle">
                        To
                        <input
                            type="datetime-local"
                            className="mt-1 w-44 rounded-md border border-border bg-surface px-2 py-1 text-xs text-text"
                            value={toValue}
                            onChange={(e) => onChangeTo(e.target.value)}
                        />
                    </label>
                    <button
                        className="w-full rounded-md border border-border-strong bg-primary/15 px-2 py-1 text-xs font-semibold text-text hover:border-border-strong"
                        onClick={onApplyCustom}
                    >
                        Apply
                    </button>
                    {error ? <p className="text-[11px] text-danger">{error}</p> : null}
                </div>
            )}
        </div>
    );
}

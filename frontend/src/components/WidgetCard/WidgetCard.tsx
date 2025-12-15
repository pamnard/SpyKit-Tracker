import { useEffect, useState } from 'react';
import { Widget } from '../../types';
import { DateRangePicker } from '../DateRangePicker';
import { useWidgetItem, PRESETS, computeRelative } from '../../hooks/useWidgetItem';
import { useWidgetData, useUpdateWidget } from '../../hooks/useWidget';

export interface WidgetCardProps {
    widget: Widget;
}

type Preset = '1h' | '24h' | '7d' | '14d' | '30d';

export function WidgetCard({ widget }: WidgetCardProps) {
    const {
        mode,
        setMode,
        preset,
        setPreset,
        appliedRange,
        setAppliedRange,
        rangeToParams
    } = useWidgetItem(widget);

    // Fetch data using React Query
    // We pass rangeToParams. If mode is 'relative', this range is static at the moment of render,
    // so we need a mechanism to update it periodically if we want "live" relative windows.
    // Ideally, useWidgetData could handle refetchInterval.
    const { data, isLoading, error } = useWidgetData(
        widget.id,
        rangeToParams,
        true
    );

    const updateWidgetMutation = useUpdateWidget();

    const [fromInput, setFromInput] = useState<string>(() => {
        if (rangeToParams) return toLocalInput(new Date(rangeToParams.from));
        return defaultFromInput();
    });

    const [toInput, setToInput] = useState<string>(() => {
        if (rangeToParams) return toLocalInput(new Date(rangeToParams.to));
        return defaultToInput();
    });

    const [rangeError, setRangeError] = useState<string | null>(null);
    const [editing, setEditing] = useState<boolean>(false);

    // Sync inputs when range changes externally
    useEffect(() => {
        if (rangeToParams) {
            setFromInput(toLocalInput(new Date(rangeToParams.from)));
            setToInput(toLocalInput(new Date(rangeToParams.to)));
        }
    }, [rangeToParams]);

    // Live update for relative mode
    // We can't easily rely on React Query's refetchInterval alone because the *params* (the time range) need to shift.
    // So we force a re-calc of relative params periodically in useWidgetItem or here.
    // For now, let's keep it simple: relying on useWidgetData's cache key change when rangeToParams changes?
    // Wait, useWidgetItem returns static rangeToParams that only updates when mode/preset changes, OR when we re-compute.
    // To make it "live", we need to update appliedRange periodically if relative.

    useEffect(() => {
        let interval: ReturnType<typeof setInterval>;
        if (mode === 'relative') {
            interval = setInterval(() => {
                const fresh = computeRelative(preset);
                // Updating appliedRange will trigger useWidgetData with new params
                setAppliedRange(fresh);
            }, 60000);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [mode, preset, setAppliedRange]);


    const applyRange = () => {
        const from = new Date(fromInput);
        const to = new Date(toInput);
        if (isNaN(from.getTime()) || isNaN(to.getTime())) {
            setRangeError('Некорректные даты');
            return;
        }
        if (to <= from) {
            setRangeError('to должен быть позже from');
            return;
        }
        setRangeError(null);
        setMode('absolute');

        const newRange = { from: from.toISOString(), to: to.toISOString() };
        setAppliedRange(newRange);
        setEditing(false);

        updateWidgetMutation.mutate({
            ...widget,
            timeFrom: newRange.from,
            timeTo: newRange.to,
        });
    };

    const applyPreset = (p: Preset) => {
        setPreset(p);
        setMode('relative');
        setRangeError(null);
        setEditing(false);

        // Optimistically update local state
        const rel = computeRelative(p);
        setAppliedRange(rel);

        updateWidgetMutation.mutate({
            ...widget,
            timeFrom: `now-${p}`,
            timeTo: 'now',
        });
    };

    const displayValue = isLoading ? '…' : (data ? data.value.toLocaleString() : '—');
    const displayError = error ? (error as Error).message : null;

    return (
        <section className="rounded-md border border-border bg-surface-muted p-4">
            <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                    <p className="text-sm text-muted">{widget.title}</p>
                    <p className="text-3xl font-semibold">{displayValue}</p>
                    {displayError ? <p className="text-xs text-subtle">{displayError}</p> : null}
                    {rangeError ? <p className="text-xs text-danger">{rangeError}</p> : null}
                </div>
                <DateRangePicker
                    displayLabel={mode === 'relative' ? formatPresetLabel(preset) : formatLabel(appliedRange)}
                    fromValue={fromInput}
                    toValue={toInput}
                    onChangeFrom={setFromInput}
                    onChangeTo={setToInput}
                    onApplyCustom={applyRange}
                    onSelectPreset={(p) => applyPreset(p as any)}
                    presets={PRESETS}
                    error={rangeError}
                    isOpen={editing}
                    onToggle={() => setEditing((v) => !v)}
                />
            </div>
        </section>
    );
}

function defaultToInput() {
    const d = new Date();
    d.setSeconds(0, 0);
    return toLocalInput(d);
}

function defaultFromInput() {
    const d = new Date();
    d.setSeconds(0, 0);
    d.setHours(d.getHours() - 24);
    return toLocalInput(d);
}

function toLocalInput(date: Date) {
    const pad = (n: number) => String(n).padStart(2, '0');
    const y = date.getFullYear();
    const m = pad(date.getMonth() + 1);
    const d = pad(date.getDate());
    const hh = pad(date.getHours());
    const mm = pad(date.getMinutes());
    return `${y}-${m}-${d}T${hh}:${mm}`;
}

function formatLabel(range: { from: string; to: string }) {
    const from = new Date(range.from);
    const to = new Date(range.to);
    if (isNaN(from.getTime()) || isNaN(to.getTime())) return 'n/a';
    const fmt = (d: Date) =>
        `${pad2(d.getMonth() + 1)}/${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
    return `${fmt(from)} – ${fmt(to)}`;
}

function formatPresetLabel(preset: Preset) {
    switch (preset) {
        case '1h':
            return 'Last 1h';
        case '24h':
            return 'Last 24h';
        case '7d':
            return 'Last 7d';
        case '14d':
            return 'Last 14d';
        case '30d':
            return 'Last 30d';
    }
}

function pad2(n: number) {
    return String(n).padStart(2, '0');
}

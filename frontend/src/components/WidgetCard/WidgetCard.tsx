import { useEffect, useState, useMemo } from 'react';
import { Widget } from '../../types';
import { DateRangePicker } from '../DateRangePicker';
import { useWidgetItem, PRESETS, computeRelative } from '../../hooks/useWidgetItem';
import { useWidgetData, useUpdateWidget } from '../../hooks/useWidget';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

export interface WidgetCardProps {
    widget: Widget;
    className?: string;
}

type Preset = '1h' | '24h' | '7d' | '14d' | '30d';

export function WidgetCard({ widget, className }: WidgetCardProps) {
    const {
        mode,
        setMode,
        preset,
        setPreset,
        appliedRange,
        setAppliedRange,
        rangeToParams
    } = useWidgetItem(widget);

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

    useEffect(() => {
        if (rangeToParams) {
            setFromInput(toLocalInput(new Date(rangeToParams.from)));
            setToInput(toLocalInput(new Date(rangeToParams.to)));
        }
    }, [rangeToParams]);

    useEffect(() => {
        let interval: ReturnType<typeof setInterval>;
        if (mode === 'relative') {
            const refreshMs = (widget.refreshInterval || 0) * 1000;
            
            if (refreshMs > 0) {
                interval = setInterval(() => {
                    const fresh = computeRelative(preset);
                    setAppliedRange(fresh);
                }, refreshMs);
            }
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [mode, preset, setAppliedRange, widget.refreshInterval]);


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

        const rel = computeRelative(p);
        setAppliedRange(rel);

        updateWidgetMutation.mutate({
            ...widget,
            timeFrom: `now-${p}`,
            timeTo: 'now',
        });
    };

    // Prepare data for rendering
    const chartData = useMemo(() => {
        if (!data || !data.data) return [];
        return data.data;
    }, [data]);

    // Determine keys for X and Y axes
    const { xKey, yKey } = useMemo(() => {
        if (!chartData || chartData.length === 0) return { xKey: '', yKey: '' };
        const keys = Object.keys(chartData[0]);
        // Simple heuristic: first key is X, second is Y.
        // Or prefer keys like "time", "date", "timestamp" for X.
        const x = keys.find(k => /time|date|minute|hour|day/.test(k)) || keys[0];
        const y = keys.find(k => k !== x) || keys[1] || keys[0];
        return { xKey: x, yKey: y };
    }, [chartData]);

    const renderContent = () => {
        if (isLoading) return <div className="h-full flex items-center justify-center text-muted">Loading...</div>;
        if (error) return <div className="text-xs text-danger">{(error as Error).message}</div>;

        if (widget.type === 'stat' || !widget.type) {
             let val: any = '—';
             if (data?.data && data.data.length > 0) {
                 // Try to find "value" key, or take first value
                 val = data.data[0].value !== undefined ? data.data[0].value : Object.values(data.data[0])[0];
             }
             // Format number if possible
             if (typeof val === 'number') val = val.toLocaleString();

             return <p className="text-3xl font-semibold">{val}</p>;
        }

        if (widget.type === 'bar') {
            return (
                <div className="h-48 w-full mt-2">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" opacity={0.2} vertical={false} />
                            <XAxis 
                                dataKey={xKey} 
                                tick={{fontSize: 10, fill: '#888'}} 
                                tickFormatter={(val) => {
                                    // If val looks like time "HH:MM", return as is
                                    if (typeof val === 'string' && val.match(/^\d{1,2}:\d{2}$/)) {
                                        return val;
                                    }
                                    // Try to format date
                                    try { 
                                        const d = new Date(val);
                                        if (isNaN(d.getTime())) return val;
                                        return d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}); 
                                    }
                                    catch { return val; }
                                }}
                            />
                            <YAxis tick={{fontSize: 10, fill: '#888'}} width={30} />
                            <Tooltip 
                                contentStyle={{backgroundColor: '#222', borderColor: '#444', color: '#eee'}}
                                itemStyle={{color: '#eee'}}
                            />
                            <Bar dataKey={yKey} fill="#3b82f6" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            );
        }

        if (widget.type === 'line') {
             return (
                <div className="h-48 w-full mt-2">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" opacity={0.2} vertical={false} />
                            <XAxis 
                                dataKey={xKey} 
                                tick={{fontSize: 10, fill: '#888'}} 
                                tickFormatter={(val) => {
                                    try { return new Date(val).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}); }
                                    catch { return val; }
                                }}
                            />
                            <YAxis tick={{fontSize: 10, fill: '#888'}} width={30} />
                            <Tooltip 
                                contentStyle={{backgroundColor: '#222', borderColor: '#444', color: '#eee'}}
                            />
                            <Line type="monotone" dataKey={yKey} stroke="#10b981" strokeWidth={2} dot={false} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            );
        }

        return <div className="text-muted text-sm">Unknown widget type</div>;
    };

    return (
        <section className={`rounded-md border border-border bg-surface-muted p-4 flex flex-col h-full min-h-[150px] ${className || ''}`}>
            <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                    <p className="text-sm text-muted">{widget.title}</p>
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
            
            <div className="flex-1 flex flex-col justify-center">
                {renderContent()}
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

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Widget } from '../types';

type Preset = '1h' | '24h' | '7d' | '14d' | '30d';

export const PRESETS: Preset[] = ['1h', '24h', '7d', '14d', '30d'];

export function useWidgetItem(widget: Widget) {
    // 1. Determine initial state from DB
    const initialState = useMemo(() => {
        const from = widget.timeFrom || '';
        const to = widget.timeTo || '';

        // Check for relative format "now-..."
        if (from.startsWith('now-')) {
            const presetPart = from.replace('now-', '') as Preset;
            if (PRESETS.includes(presetPart)) {
                return {
                    mode: 'relative' as const,
                    preset: presetPart,
                    range: computeRelative(presetPart),
                };
            }
        }

        // If explicitly absolute dates
        if (from && to && !from.startsWith('now')) {
            return {
                mode: 'absolute' as const,
                preset: '24h' as Preset, // fallback for UI
                range: { from, to },
            };
        }

        // Default fallback (fresh 24h)
        return {
            mode: 'relative' as const,
            preset: '24h' as Preset,
            range: computeRelative('24h'),
        };
    }, [widget.timeFrom, widget.timeTo]);

    // 2. Local state for UI
    const [mode, setMode] = useState<'relative' | 'absolute'>(initialState.mode);
    const [preset, setPreset] = useState<Preset>(initialState.preset);
    const [appliedRange, setAppliedRange] = useState(initialState.range);

    // 3. Sync if widget props change (e.g. from websocket or refetch)
    useEffect(() => {
        setMode(initialState.mode);
        setPreset(initialState.preset);
        setAppliedRange(initialState.range);
    }, [initialState]);

    // 4. Compute effective params for API
    const rangeToParams = useMemo(() => {
        if (mode === 'relative') {
            return computeRelative(preset);
        }
        return appliedRange;
    }, [mode, preset, appliedRange]);

    const getFreshParams = useCallback(() => {
        if (mode === 'relative') {
            return computeRelative(preset);
        }
        return appliedRange;
    }, [mode, preset, appliedRange]);

    return {
        mode,
        setMode,
        preset,
        setPreset,
        appliedRange,
        setAppliedRange,
        rangeToParams,
        getFreshParams,
    };
}

// Helpers
export function computeRelative(preset: Preset) {
    const now = new Date();
    const hours =
        preset === '1h' ? 1 : preset === '24h' ? 24 : preset === '7d' ? 24 * 7 : preset === '14d' ? 24 * 14 : 24 * 30;
    const from = new Date(now.getTime() - hours * 3600 * 1000);
    return { from: from.toISOString(), to: now.toISOString() };
}

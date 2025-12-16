import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { widgetApi } from '../services/api';
import { Widget } from '../types';

export const useWidgets = () => {
    return useQuery({
        queryKey: ['widgets'],
        queryFn: () => widgetApi.fetchAll(),
    });
};

export const useWidgetData = (id: string, range?: { from?: string; to?: string }, enabled: boolean = true) => {
    return useQuery({
        queryKey: ['widget-data', id, range],
        queryFn: () => widgetApi.getData(id, range),
        enabled: enabled && !!id,
        placeholderData: keepPreviousData,
    });
};

export const useCreateWidget = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (widget: Widget) => widgetApi.create(widget),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['widgets'] });
        },
    });
};

export const useUpdateWidget = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (widget: Widget) => widgetApi.update(widget),
        onSuccess: (data, variables) => {
            queryClient.invalidateQueries({ queryKey: ['widgets'] });
            // Invalidate specific widget data as well since query might have changed
            queryClient.invalidateQueries({ queryKey: ['widget-data', variables.id] });
        },
    });
};

export const useDeleteWidget = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => widgetApi.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['widgets'] });
        },
    });
};

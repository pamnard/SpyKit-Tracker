import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { reportApi } from '../services/api';

export const useReports = () => {
    return useQuery({
        queryKey: ['reports'],
        queryFn: () => reportApi.fetchAll(),
    });
};

export const useReport = (id: string | null) => {
    return useQuery({
        queryKey: ['report', id],
        queryFn: () => reportApi.get(id!),
        enabled: !!id,
    });
};

export const useCreateReport = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ title, widgets }: { title: string; widgets?: string[] }) =>
            reportApi.create(title, widgets),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['reports'] });
        },
    });
};

export const useUpdateReport = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, title, widgets }: { id: string; title: string; widgets: string[] }) =>
            reportApi.update(id, title, widgets),
        onSuccess: (data, variables) => {
            queryClient.invalidateQueries({ queryKey: ['report', variables.id] });
            queryClient.invalidateQueries({ queryKey: ['reports'] });
        },
    });
};

export const useDeleteReport = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => reportApi.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['reports'] });
        },
    });
};

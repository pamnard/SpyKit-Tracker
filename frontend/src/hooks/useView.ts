import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { viewApi } from '../services/api';

export const useViews = () => {
    return useQuery({
        queryKey: ['views'],
        queryFn: () => viewApi.fetchAll(),
    });
};

export const useView = (id?: string) => {
    return useQuery({
        queryKey: ['view', id],
        queryFn: () => viewApi.get(id!),
        enabled: !!id,
    });
};

export const useCreateView = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ name, query, isMaterialized }: { name: string; query: string; isMaterialized: boolean }) =>
            viewApi.create(name, query, isMaterialized),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['views'] });
        },
    });
};

export const useUpdateView = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, name, query, isMaterialized }: { id: string; name: string; query: string; isMaterialized: boolean }) =>
            viewApi.update(id, name, query, isMaterialized),
        onSuccess: (data, variables) => {
            queryClient.invalidateQueries({ queryKey: ['view', variables.id] });
            queryClient.invalidateQueries({ queryKey: ['views'] });
        },
    });
};

export const useDeleteView = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => viewApi.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['views'] });
        },
    });
};

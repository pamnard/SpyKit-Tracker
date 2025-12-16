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
        mutationFn: ({ name, query, isMaterialized, engine, orderBy }: { name: string; query: string; isMaterialized: boolean; engine?: string; orderBy?: string }) =>
            viewApi.create(name, query, isMaterialized, engine, orderBy),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['views'] });
        },
    });
};

export const useUpdateView = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, name, query, isMaterialized, engine, orderBy }: { id: string; name: string; query: string; isMaterialized: boolean; engine?: string; orderBy?: string }) =>
            viewApi.update(id, name, query, isMaterialized, engine, orderBy),
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

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { settingsApi } from '../services/api';
import { PixelSettings } from '../types';

export const useSettings = () => {
    return useQuery({
        queryKey: ['settings'],
        queryFn: () => settingsApi.fetch(),
    });
};

export const useUpdateSettings = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (settings: PixelSettings) => settingsApi.update(settings),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['settings'] });
        },
    });
};

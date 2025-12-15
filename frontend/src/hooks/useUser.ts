import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { userApi } from '../services/api';
import { User } from '../types';

export const useUsers = () => {
    return useQuery({
        queryKey: ['users'],
        queryFn: () => userApi.fetchAll(),
    });
};

export const useCreateUser = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (user: User) => userApi.create(user),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] });
        },
    });
};

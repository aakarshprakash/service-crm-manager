import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { api, ApiError, type Envelope } from './api';
import { toast } from '@/components/toast';
import type { Lookups, StaffOption } from './types';

/** Dropdown data (branches, complaint types, service locations), cached 10 minutes. */
export function useLookups() {
  return useQuery({
    queryKey: ['lookups'],
    queryFn: () => api.get<Envelope<Lookups>>('/master/lookups').then((r) => r.data),
    staleTime: 10 * 60_000,
  });
}

/** Mutation with a success toast and an error toast (field errors are shown inline instead). */
export function useApiMutation<TVars, TResult = unknown>(
  fn: (vars: TVars) => Promise<TResult>,
  opts: { success?: string | ((r: TResult) => string); invalidate?: QueryKey[]; onSuccess?: (r: TResult, v: TVars) => void; toastValidation?: boolean } = {},
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (result, vars) => {
      const msg = typeof opts.success === 'function' ? opts.success(result) : opts.success ?? (result as { message?: string })?.message;
      if (msg) toast.success(msg);
      opts.invalidate?.forEach((k) => qc.invalidateQueries({ queryKey: k }));
      opts.onSuccess?.(result, vars);
    },
    onError: (e) => {
      const hasFieldErrors = e instanceof ApiError && Object.keys(e.errors).length > 0;
      if (!hasFieldErrors || opts.toastValidation !== false) toast.error(e instanceof Error ? e.message : 'Something went wrong.');
    },
  });
}

export function fieldError(error: unknown, name: string): string | undefined {
  return error instanceof ApiError ? error.field(name) : undefined;
}

export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

/** Active staff for pickers (technicians with on-duty status), cached a minute. */
export function useStaffOptions(role?: string) {
  return useQuery({
    queryKey: ['staff-options', role ?? 'all'],
    queryFn: () => api.get<Envelope<StaffOption[]>>('/users/options', { role }).then((r) => r.data),
    staleTime: 60_000,
  });
}

/** Value that only changes after the user stops typing for `ms`. */
export function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}
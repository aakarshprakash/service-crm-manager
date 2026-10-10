import { useQueries } from '@tanstack/react-query';
import { api, type Paginated } from './api';
import { useAuth } from './auth';

export type ApprovalKind = 'claims' | 'leave' | 'cash';

/** Which approval queues this role works on (same abilities the API checks). */
export function useApprovalKinds(): ApprovalKind[] {
  const { can } = useAuth();
  return [can('expenses.manage') && 'claims', can('leave.approve') && 'leave', can('cash.verify') && 'cash'].filter(Boolean) as ApprovalKind[];
}

const COUNT: Record<ApprovalKind, { key: string; path: string; params: Record<string, string | number>; read: (r: Paginated<unknown>) => number }> = {
  claims: { key: 'expense-claims', path: '/expense-claims', params: { status: 'pending', per_page: 1 }, read: (r) => Number(r.meta.pending_count ?? r.meta.total ?? 0) },
  leave: { key: 'hr-leave', path: '/hr/leave-requests', params: { status: 'pending', per_page: 1 }, read: (r) => Number(r.meta.pending ?? r.meta.total ?? 0) },
  cash: { key: 'cash-closes', path: '/accounts/cash-close', params: { status: 'submitted', per_page: 1 }, read: (r) => Number(r.meta.total ?? 0) },
};

/** Waiting items per queue, for the tab badge and the segment counts. */
export function useApprovalCounts(): Partial<Record<ApprovalKind, number>> & { total: number } {
  const kinds = useApprovalKinds();
  const results = useQueries({
    queries: kinds.map((k) => ({
      queryKey: [COUNT[k].key, 'count'],
      queryFn: () => api.get<Paginated<unknown>>(COUNT[k].path, COUNT[k].params).then(COUNT[k].read),
      refetchInterval: 120_000,
    })),
  });
  const out: Partial<Record<ApprovalKind, number>> & { total: number } = { total: 0 };
  kinds.forEach((k, i) => {
    const n = results[i]?.data ?? 0;
    out[k] = n;
    out.total += n;
  });
  return out;
}

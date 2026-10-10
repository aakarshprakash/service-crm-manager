import { useEffect, useState } from 'react';
import { FlatList, Image, Pressable, RefreshControl, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useInfiniteQuery } from '@tanstack/react-query';
import { api, type Paginated } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApprovalCounts, useApprovalKinds, type ApprovalKind } from '@/lib/approvals';
import { fieldError, useApiMutation } from '@/lib/hooks';
import { date, money, num, relative } from '@/lib/format';
import type { CashClose, ExpenseClaim, LeaveRequest } from '@/lib/types';
import { Text } from '@/components/Text';
import { Badge, Button, Empty, ErrorView, Field, Icon, Input, Loading, Muted, Segmented, Sheet } from '@/components/ui';
import { Chip } from '@/components/pickers';
import { colors, radius, shadow } from '@/components/theme';

const TITLE: Record<ApprovalKind, string> = { claims: 'Expenses', leave: 'Leave', cash: 'Cash close' };

export default function Approvals() {
  const kinds = useApprovalKinds();
  const counts = useApprovalCounts();
  const p = useLocalSearchParams<{ tab?: string; at?: string }>();
  const [kind, setKind] = useState<ApprovalKind>(kinds[0] ?? 'claims');
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (p.tab && kinds.includes(p.tab as ApprovalKind)) setKind(p.tab as ApprovalKind);
  }, [p.tab, p.at, kinds.join()]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!kinds.length) return <Empty icon="lock-closed-outline" title="Nothing to approve" message="Your role doesn’t approve expenses, leave or cash." />;

  return (
    <View style={{ flex: 1 }}>
      <View style={{ backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: colors.border, padding: 12, paddingBottom: 6, gap: 8 }}>
        {kinds.length > 1 ? (
          <Segmented value={kind} onChange={setKind} options={kinds.map((k) => ({ value: k, label: TITLE[k], count: counts[k] || undefined }))} />
        ) : (
          <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text, paddingHorizontal: 4 }}>{kind === 'leave' ? 'Leave requests' : kind === 'claims' ? 'Expense claims' : 'Cash closes'}</Text>
        )}
        <View style={{ flexDirection: 'row', gap: 6, paddingBottom: 4 }}>
          <Chip label="Waiting" on={!done} onPress={() => setDone(false)} count={counts[kind]} />
          <Chip label="Decided" on={done} onPress={() => setDone(true)} />
        </View>
      </View>
      {kind === 'claims' && <Claims done={done} />}
      {kind === 'leave' && <Leave done={done} />}
      {kind === 'cash' && <Cash done={done} />}
    </View>
  );
}

function usePaged<T>(key: string, path: string, params: Record<string, string>) {
  return useInfiniteQuery({
    queryKey: [key, params],
    queryFn: ({ pageParam }) => api.get<Paginated<T>>(path, { ...params, page: pageParam, per_page: 20 }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.meta.current_page < last.meta.last_page ? last.meta.current_page + 1 : undefined),
  });
}

function List<T extends { id: number }>({ q, render, empty }: { q: ReturnType<typeof usePaged<T>>; render: (item: T) => React.ReactElement; empty: string }) {
  if (q.isLoading) return <Loading />;
  const rows = q.data?.pages.flatMap((pg) => pg.data) ?? [];
  if (q.error && !rows.length) return <ErrorView error={q.error} onRetry={q.refetch} />;
  return (
    <FlatList
      data={rows}
      keyExtractor={(r) => String(r.id)}
      contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 32 }}
      renderItem={({ item }) => render(item)}
      onEndReachedThreshold={0.4}
      onEndReached={() => q.hasNextPage && !q.isFetchingNextPage && q.fetchNextPage()}
      refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={q.refetch} colors={[colors.brand]} />}
      ListEmptyComponent={<Empty icon="checkmark-done-circle-outline" title={empty} />}
    />
  );
}

function Item({ children, onPress }: { children: React.ReactNode; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => [{ backgroundColor: '#fff', borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: 14, gap: 6, ...shadow }, pressed && { opacity: 0.85 }]}>
      {children}
    </Pressable>
  );
}

/* ---------------- Expense claims ---------------- */

function Claims({ done }: { done: boolean }) {
  const q = usePaged<ExpenseClaim>('expense-claims', '/expense-claims', { status: done ? 'approved,rejected' : 'pending' });
  const [open, setOpen] = useState<ExpenseClaim | null>(null);
  return (
    <>
      <List
        q={q}
        empty={done ? 'No decided claims yet' : 'No expense claims waiting'}
        render={(c) => (
          <Item onPress={() => setOpen(c)}>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              {c.receipt_url ? (
                <Image source={{ uri: c.receipt_url }} style={{ width: 52, height: 52, borderRadius: 8, backgroundColor: colors.border }} />
              ) : (
                <View style={{ width: 52, height: 52, borderRadius: 8, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="receipt-outline" color={colors.faint} />
                </View>
              )}
              <View style={{ flex: 1, gap: 2 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                  <Text style={{ fontWeight: '700', color: colors.text, flex: 1 }} numberOfLines={1}>
                    {c.user?.name}
                  </Text>
                  <Text style={{ fontWeight: '800', color: colors.text }}>{money(c.amount)}</Text>
                </View>
                <Text style={{ color: colors.text }} numberOfLines={1}>
                  {c.category?.name}
                  {c.job ? ` · ${c.job.crm_call_id}` : ''}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Muted style={{ fontSize: 12, flex: 1 }}>
                    {date(c.claim_date)} · {c.paid_from === 'cash_in_hand' ? 'From collected cash' : 'Own money'}
                  </Muted>
                  {c.status !== 'pending' && <Badge text={c.status} />}
                </View>
              </View>
            </View>
          </Item>
        )}
      />
      {open && <ClaimSheet claim={open} onClose={() => setOpen(null)} />}
    </>
  );
}

const METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'bank_transfer', label: 'Bank' },
  { value: 'cheque', label: 'Cheque' },
] as const;

function ClaimSheet({ claim, onClose }: { claim: ExpenseClaim; onClose: () => void }) {
  const [action, setAction] = useState<'approve' | 'reject' | null>(null);
  const [method, setMethod] = useState<(typeof METHODS)[number]['value']>('cash');
  const [note, setNote] = useState('');
  const [zoom, setZoom] = useState(false);
  const m = useApiMutation(
    (a: 'approve' | 'reject') => api.post(`/expense-claims/${claim.id}/${a}`, a === 'approve' ? { payment_method: claim.paid_from === 'own_money' ? method : undefined, note: note || undefined } : { note }),
    { invalidate: [['expense-claims'], ['dashboard']], toastValidation: false, onSuccess: onClose },
  );
  const pending = claim.status === 'pending';
  return (
    <Sheet
      open
      onClose={onClose}
      title={`${claim.user?.name ?? 'Claim'} · ${money(claim.amount)}`}
      footer={
        pending ? (
          action ? (
            <>
              <Button title="Back" variant="secondary" onPress={() => setAction(null)} style={{ flex: 1 }} />
              <Button title={action === 'approve' ? 'Approve' : 'Reject'} variant={action === 'approve' ? 'success' : 'danger'} loading={m.isPending} disabled={action === 'reject' && !note.trim()} onPress={() => m.mutate(action)} style={{ flex: 1 }} />
            </>
          ) : (
            <>
              <Button title="Reject" variant="secondary" icon="close" onPress={() => setAction('reject')} style={{ flex: 1 }} />
              <Button title="Approve" variant="success" icon="checkmark" onPress={() => setAction('approve')} style={{ flex: 1 }} />
            </>
          )
        ) : undefined
      }
    >
      <View style={{ gap: 4 }}>
        <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text }}>
          {claim.category?.name} · {date(claim.claim_date)}
        </Text>
        <Muted>{claim.paid_from === 'cash_in_hand' ? 'Paid from cash collected from customers' : 'Paid from their own money – to be reimbursed'}</Muted>
        {claim.job && (
          <Pressable onPress={() => { onClose(); router.push(`/job/${claim.job!.id}`); }}>
            <Text style={{ color: colors.brand }}>Job {claim.job.crm_call_id} ›</Text>
          </Pressable>
        )}
        {claim.description ? <Text style={{ color: colors.text, marginTop: 4 }}>“{claim.description}”</Text> : null}
        {!pending && (
          <Text style={{ color: claim.status === 'rejected' ? colors.red : colors.green, marginTop: 4 }}>
            {claim.status === 'rejected' ? 'Rejected' : 'Approved'}
            {claim.decider ? ` by ${claim.decider.name}` : ''}
            {claim.decision_note ? ` – ${claim.decision_note}` : ''}
          </Text>
        )}
      </View>
      {claim.receipt_url ? (
        <Pressable onPress={() => setZoom((z) => !z)} accessibilityLabel="Receipt photo, tap to enlarge">
          <Image source={{ uri: claim.receipt_url }} style={{ width: '100%', height: zoom ? 460 : 220, borderRadius: radius.sm, backgroundColor: colors.bg }} resizeMode="contain" />
        </Pressable>
      ) : (
        <Muted>No receipt photo attached.</Muted>
      )}
      {action === 'approve' && claim.paid_from === 'own_money' && (
        <Field label="Reimbursed by" required error={fieldError(m.error, 'payment_method')}>
          <Segmented value={method} onChange={setMethod} options={METHODS.map((x) => ({ ...x }))} />
        </Field>
      )}
      {action === 'approve' && claim.paid_from === 'cash_in_hand' && <Muted>Recorded as a cash expense. It was already deducted from the technician’s cash close.</Muted>}
      {action === 'reject' && claim.cash_close_id && <Text style={{ color: colors.amber }}>This was deducted from their cash close. Rejecting adds it back to the cash they must hand over.</Text>}
      {action && (
        <Field label={action === 'approve' ? 'Note (optional)' : 'Reason'} required={action === 'reject'} error={fieldError(m.error, 'note') ?? fieldError(m.error, 'claim')}>
          <Input value={note} onChangeText={setNote} multiline maxLength={300} autoFocus={action === 'reject'} />
        </Field>
      )}
    </Sheet>
  );
}

/* ---------------- Leave ---------------- */

function Leave({ done }: { done: boolean }) {
  const { user } = useAuth();
  const q = usePaged<LeaveRequest>('hr-leave', '/hr/leave-requests', { status: done ? 'approved,rejected,cancelled' : 'pending' });
  const [deciding, setDeciding] = useState<{ leave: LeaveRequest; status: 'approved' | 'rejected' } | null>(null);
  return (
    <>
      <List
        q={q}
        empty={done ? 'No decided leave yet' : 'No leave requests waiting'}
        render={(l) => (
          <Item>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
              <Text style={{ fontWeight: '700', color: colors.text, flex: 1 }}>{l.user?.name}</Text>
              {l.status === 'pending' ? <Muted style={{ fontSize: 12 }}>{relative(l.created_at)}</Muted> : <Badge text={l.status} />}
            </View>
            <Text style={{ color: colors.text }}>
              {l.type?.name} · <Text style={{ fontWeight: '700' }}>{num(l.days)}</Text> day{l.days === 1 ? '' : 's'}
              {l.half_day ? ' (half day)' : ''}
            </Text>
            <Muted>
              {date(l.from_date)}
              {l.to_date !== l.from_date ? ` → ${date(l.to_date)}` : ''}
            </Muted>
            {l.reason ? <Text style={{ color: '#334155' }}>“{l.reason}”</Text> : null}
            {l.decision_note ? <Muted>Note: {l.decision_note}</Muted> : null}
            {l.status === 'pending' && l.user_id !== user?.id && (
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                <Button title="Reject" variant="secondary" size="sm" icon="close" style={{ flex: 1 }} onPress={() => setDeciding({ leave: l, status: 'rejected' })} />
                <Button title="Approve" variant="success" size="sm" icon="checkmark" style={{ flex: 1 }} onPress={() => setDeciding({ leave: l, status: 'approved' })} />
              </View>
            )}
            {l.status === 'pending' && l.user_id === user?.id && <Muted style={{ fontSize: 12 }}>Your own request – another approver decides it.</Muted>}
          </Item>
        )}
      />
      {deciding && <LeaveSheet {...deciding} onClose={() => setDeciding(null)} />}
    </>
  );
}

function LeaveSheet({ leave, status, onClose }: { leave: LeaveRequest; status: 'approved' | 'rejected'; onClose: () => void }) {
  const [note, setNote] = useState('');
  const approve = status === 'approved';
  const m = useApiMutation(() => api.patch(`/hr/leave-requests/${leave.id}`, { status, note: note || null }), { invalidate: [['hr-leave']], toastValidation: false, onSuccess: onClose });
  return (
    <Sheet
      open
      onClose={onClose}
      title={`${approve ? 'Approve' : 'Reject'} ${leave.user?.name?.split(' ')[0]}’s leave?`}
      footer={<Button title={approve ? 'Approve' : 'Reject'} variant={approve ? 'success' : 'danger'} loading={m.isPending} disabled={!approve && !note.trim()} onPress={() => m.mutate(undefined)} style={{ flex: 1 }} />}
    >
      <Muted>
        {leave.type?.name}, {num(leave.days)} day(s) from {date(leave.from_date)}. They are notified on their phone.
      </Muted>
      <Field label={approve ? 'Note (optional)' : 'Reason'} required={!approve} error={fieldError(m.error, 'note') ?? fieldError(m.error, 'status')}>
        <Input value={note} onChangeText={setNote} multiline maxLength={500} />
      </Field>
    </Sheet>
  );
}

/* ---------------- Cash close ---------------- */

function Cash({ done }: { done: boolean }) {
  const q = usePaged<CashClose>('cash-closes', '/accounts/cash-close', { status: done ? 'verified,closed' : 'submitted' });
  return (
    <List
      q={q}
      empty={done ? 'No verified closes yet' : 'No cash closes to verify'}
      render={(c) => {
        const mismatch = c.amount_confirmed !== c.expected_in_hand;
        return (
          <Item onPress={() => router.push(`/cash/${c.id}`)}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
              <Text style={{ fontWeight: '700', color: colors.text, flex: 1 }}>{c.technician?.name}</Text>
              <Text style={{ fontWeight: '800', color: colors.text }}>{money(c.amount_confirmed)}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Muted style={{ flex: 1 }}>
                {date(c.close_date)} · expected {money(c.expected_in_hand)}
              </Muted>
              {c.status !== 'submitted' && <Badge text={c.status} />}
            </View>
            {mismatch && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Icon name="warning-outline" size={16} color={colors.amber} />
                <Text style={{ color: colors.amber, fontSize: 13, fontWeight: '600' }}>
                  {c.amount_confirmed < c.expected_in_hand ? 'Short' : 'Excess'} by {money(Math.abs(c.amount_confirmed - c.expected_in_hand))}
                </Text>
              </View>
            )}
          </Item>
        );
      }}
    />
  );
}

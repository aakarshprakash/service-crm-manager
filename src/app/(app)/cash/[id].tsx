import { useState } from 'react';
import { Linking, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { api, type Envelope } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { fieldError, useApiMutation } from '@/lib/hooks';
import { date, dateTime, METHOD_LABEL, money, toMajor, toMinor, today } from '@/lib/format';
import type { CashClose, CashPayment } from '@/lib/types';
import { Text } from '@/components/Text';
import { Badge, Button, Card, ErrorView, Field, Icon, Input, Loading, Muted, Row, Screen, Segmented, Sheet } from '@/components/ui';
import { colors, radius } from '@/components/theme';

export default function CashCloseDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { can } = useAuth();
  const q = useQuery({ queryKey: ['cash-close', id], queryFn: () => api.get<Envelope<{ close: CashClose; payments: CashPayment[] }>>(`/accounts/cash-close/${id}`).then((r) => r.data) });
  const [dialog, setDialog] = useState<'verify' | 'deposit' | null>(null);
  if (q.isLoading) return <Loading />;
  const c = q.data?.close;
  if (!c) return <ErrorView error={q.error} onRetry={q.refetch} />;
  const mismatch = c.amount_confirmed - c.expected_in_hand;
  const verifier = can('cash.verify');

  return (
    <>
      <Stack.Screen options={{ title: `${c.technician?.name?.split(' ')[0] ?? 'Cash'} · ${date(c.close_date)}` }} />
      <Screen refreshing={q.isRefetching} onRefresh={q.refetch}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Badge text={c.status} />
          <Muted style={{ flex: 1 }}>
            Submitted {dateTime(c.submitted_at)}
            {c.force_closed ? ' by admin' : ''}
          </Muted>
          {c.technician?.phone && <Button title="Call" icon="call-outline" variant="ghost" size="sm" onPress={() => Linking.openURL(`tel:${c.technician?.phone}`)} />}
        </View>

        {mismatch !== 0 && (
          <View style={{ flexDirection: 'row', gap: 10, padding: 14, borderRadius: radius.md, backgroundColor: colors.amberSoft }}>
            <Icon name="warning-outline" color={colors.amber} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.amber, fontWeight: '600' }}>
                Declared {money(c.amount_confirmed)} against {money(c.expected_in_hand)} expected ({mismatch < 0 ? 'short' : 'excess'} {money(Math.abs(mismatch))}).
              </Text>
              {c.technician_remarks ? <Text style={{ color: colors.amber, marginTop: 4 }}>“{c.technician_remarks}”</Text> : null}
            </View>
          </View>
        )}

        {verifier && c.status !== 'closed' && (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {c.status === 'submitted' && <Button title="Verify" icon="shield-checkmark-outline" style={{ flex: 1 }} onPress={() => setDialog('verify')} />}
            {c.closing_balance > 0 && <Button title="Record deposit" icon="business-outline" variant="secondary" style={{ flex: 1 }} onPress={() => setDialog('deposit')} />}
          </View>
        )}

        <Card title="Reconciliation">
          <Row k="Opening (carried forward)" v={money(c.opening_balance)} />
          <Row k="Cash collected" v={money(c.total_cash_collected)} />
          <Row k="Cheques collected" v={money(c.total_cheque_collected)} />
          {!!c.total_expenses && <Row k="Expenses paid from cash" v={`− ${money(c.total_expenses)}`} />}
          <Row k="Expected in hand" v={money(c.expected_in_hand)} strong />
          <Row k="Declared by technician" v={money(c.amount_confirmed)} />
          {c.amount_verified !== null && <Row k="Verified count" v={money(c.amount_verified)} />}
          {c.status !== 'submitted' && <Row k="Discrepancy" v={money(c.discrepancy_amount)} vStyle={c.discrepancy_amount ? { color: colors.red, fontWeight: '700' } : undefined} />}
          <Row k="Deposited" v={money(c.total_deposited)} />
          <Row k="Still with technician" v={money(c.closing_balance)} strong />
          <Muted style={{ marginTop: 6, fontSize: 12 }}>UPI / bank received (no hand-over): {money(c.total_digital_collected)}</Muted>
          {c.discrepancy_remarks ? <Muted style={{ marginTop: 4 }}>Accountant: {c.discrepancy_remarks}</Muted> : null}
          {c.verifier ? <Muted style={{ marginTop: 4, fontSize: 12 }}>Verified by {c.verifier.name} · {dateTime(c.verified_at)}</Muted> : null}
        </Card>

        <Card title={`Collections (${q.data!.payments.length})`} padded={false}>
          {q.data!.payments.length ? (
            q.data!.payments.map((p, i) => (
              <View key={p.id} style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: colors.border }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: '600' }} numberOfLines={1}>
                    {p.customer ?? '–'}
                  </Text>
                  <Muted style={{ fontSize: 12 }}>
                    {METHOD_LABEL[p.method] ?? p.method} · {p.receipt_number ?? ''} · {p.call_id ?? ''}
                  </Muted>
                </View>
                <Text style={{ fontWeight: '700', color: colors.text }}>{money(p.amount)}</Text>
              </View>
            ))
          ) : (
            <Muted style={{ padding: 16 }}>No collections in this close (carry-forward only).</Muted>
          )}
        </Card>

        {!!c.deposits?.length && (
          <Card title="Deposits" padded={false}>
            {c.deposits.map((d, i) => (
              <View key={d.id} style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: colors.border }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text }}>{d.deposited_to === 'bank' ? 'Bank' : 'Office cash'}</Text>
                  <Muted style={{ fontSize: 12 }}>
                    {date(d.deposit_date)}
                    {d.reference_no ? ` · ${d.reference_no}` : ''}
                  </Muted>
                </View>
                <Text style={{ fontWeight: '700', color: colors.text }}>{money(d.amount)}</Text>
              </View>
            ))}
          </Card>
        )}
      </Screen>

      {dialog === 'verify' && <VerifySheet close={c} onClose={() => setDialog(null)} />}
      {dialog === 'deposit' && <DepositSheet close={c} onClose={() => setDialog(null)} />}
    </>
  );
}

const refresh = (c: CashClose) => [['cash-close', String(c.id)], ['cash-closes'], ['dashboard']];

function VerifySheet({ close, onClose }: { close: CashClose; onClose: () => void }) {
  const [amount, setAmount] = useState(toMajor(close.amount_confirmed) || '0');
  const [remarks, setRemarks] = useState('');
  const diff = toMinor(amount) - close.expected_in_hand;
  const m = useApiMutation(() => api.patch(`/accounts/cash-close/${close.id}/verify`, { amount_verified: toMinor(amount), discrepancy_remarks: remarks || null }), { invalidate: refresh(close), toastValidation: false, onSuccess: onClose });
  return (
    <Sheet open onClose={onClose} title="Verify cash close" footer={<Button title="Mark verified" loading={m.isPending} disabled={diff !== 0 && !remarks.trim()} onPress={() => m.mutate(undefined)} style={{ flex: 1 }} />}>
      <Muted>Expected in hand: {money(close.expected_in_hand)}. Enter what you actually received.</Muted>
      <Field label="Amount counted (₹)" required error={fieldError(m.error, 'amount_verified')}>
        <Input value={amount} onChangeText={(v) => setAmount(v.replace(/[^\d.]/g, ''))} keyboardType="decimal-pad" selectTextOnFocus />
      </Field>
      {diff !== 0 && (
        <Text style={{ padding: 10, borderRadius: radius.sm, backgroundColor: diff < 0 ? colors.redSoft : colors.amberSoft, color: diff < 0 ? colors.red : colors.amber }}>
          {diff < 0 ? 'Shortfall' : 'Excess'} of {money(Math.abs(diff))} will be recorded as a discrepancy.
        </Text>
      )}
      <Field label="Remarks" required={diff !== 0} error={fieldError(m.error, 'discrepancy_remarks')}>
        <Input value={remarks} onChangeText={setRemarks} multiline maxLength={500} />
      </Field>
    </Sheet>
  );
}

function DepositSheet({ close, onClose }: { close: CashClose; onClose: () => void }) {
  const [form, setForm] = useState({ amount: toMajor(close.closing_balance), deposited_to: 'bank' as 'bank' | 'office', reference_no: '', remarks: '' });
  const m = useApiMutation(() => api.post(`/accounts/cash-close/${close.id}/deposit`, { ...form, amount: toMinor(form.amount), reference_no: form.reference_no || null, deposit_date: today() }), { invalidate: refresh(close), toastValidation: false, onSuccess: onClose });
  return (
    <Sheet open onClose={onClose} title="Record deposit" footer={<Button title="Save deposit" loading={m.isPending} onPress={() => m.mutate(undefined)} style={{ flex: 1 }} />}>
      <Muted>
        Cash still with {close.technician?.name}: {money(close.closing_balance)}
      </Muted>
      <Field label="Deposited to">
        <Segmented value={form.deposited_to} onChange={(v) => setForm({ ...form, deposited_to: v })} options={[{ value: 'bank', label: 'Bank', icon: 'business-outline' }, { value: 'office', label: 'Office cash', icon: 'home-outline' }]} />
      </Field>
      <Field label="Amount (₹)" required error={fieldError(m.error, 'amount')}>
        <Input value={form.amount} onChangeText={(v) => setForm({ ...form, amount: v.replace(/[^\d.]/g, '') })} keyboardType="decimal-pad" />
      </Field>
      <Field label="Reference no." required={form.deposited_to === 'bank'} error={fieldError(m.error, 'reference_no')}>
        <Input value={form.reference_no} onChangeText={(v) => setForm({ ...form, reference_no: v })} autoCapitalize="characters" />
      </Field>
      <Field label="Remarks" error={fieldError(m.error, 'deposit_date')}>
        <Input value={form.remarks} onChangeText={(v) => setForm({ ...form, remarks: v })} />
      </Field>
    </Sheet>
  );
}

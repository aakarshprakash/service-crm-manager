import { useState } from 'react';
import { Linking, Pressable, Share, View } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { api, openPdf, type Envelope } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { fieldError, useApiMutation } from '@/lib/hooks';
import { date, dateTime, METHOD_LABEL, money, qty, toMajor, toMinor } from '@/lib/format';
import type { Invoice } from '@/lib/types';
import { Text } from '@/components/Text';
import { Badge, Button, Card, ErrorView, Field, Input, Loading, Muted, Row, Screen, Segmented, Sheet } from '@/components/ui';
import { toast } from '@/components/toast';
import { colors } from '@/components/theme';

export default function InvoiceDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { can } = useAuth();
  const q = useQuery({ queryKey: ['invoice', id], queryFn: () => api.get<Envelope<Invoice>>(`/invoices/${id}`).then((r) => r.data) });
  const [paying, setPaying] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const remind = useApiMutation(() => api.post<{ message: string }>(`/invoices/${id}/remind`));
  if (q.isLoading) return <Loading />;
  const inv = q.data;
  if (!inv) return <ErrorView error={q.error} onRetry={q.refetch} />;
  const due = inv.balance_amount > 0;

  const pdf = async () => {
    setPdfBusy(true);
    try {
      await openPdf(`/invoices/${inv.id}/pdf`, `${inv.invoice_number}.pdf`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setPdfBusy(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: inv.invoice_number }} />
      <Screen refreshing={q.isRefetching} onRefresh={q.refetch}>
        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
          <Badge text={inv.payment_status} />
          {inv.is_credit && due && <Badge text="Credit" tone="in_progress" />}
          <Muted style={{ flex: 1 }}>
            {inv.source === 'walk_in' ? 'Walk-in bill' : `Job ${inv.job?.crm_call_id}`} · {date(inv.generated_at)}
          </Muted>
        </View>

        <Card>
          <Muted>{due ? 'Balance due' : 'Fully paid'}</Muted>
          <Text style={{ fontSize: 30, fontWeight: '800', color: due ? colors.red : colors.green }}>{money(due ? inv.balance_amount : inv.total_amount)}</Text>
          <Muted>
            Total {money(inv.total_amount)} · paid {money(inv.paid_amount)}
          </Muted>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
            {due && can('payments.record') && <Button title="Record payment" icon="cash-outline" style={{ flex: 1 }} onPress={() => setPaying(true)} />}
            <Button title="PDF" icon="document-outline" variant="secondary" loading={pdfBusy} onPress={pdf} style={due && can('payments.record') ? undefined : { flex: 1 }} />
          </View>
          {due && inv.pay_link && (
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
              <Button title="Share pay link" icon="share-social-outline" variant="secondary" size="sm" style={{ flex: 1 }} onPress={() => Share.share({ message: `Invoice ${inv.invoice_number}: ${money(inv.balance_amount)} due. Pay online: ${inv.pay_link}` })} />
              {can('payments.record') && <Button title="Send reminder" icon="paper-plane-outline" variant="secondary" size="sm" style={{ flex: 1 }} loading={remind.isPending} onPress={() => remind.mutate(undefined)} />}
            </View>
          )}
        </Card>

        <Card title="Bill to">
          <Text style={{ fontWeight: '700', color: colors.text }}>{inv.customer?.name}</Text>
          <Pressable onPress={() => inv.customer?.phone && Linking.openURL(`tel:${inv.customer.phone}`)}>
            <Text style={{ color: colors.brand }}>{inv.customer?.phone}</Text>
          </Pressable>
          {inv.customer?.address ? <Muted>{[inv.customer.address, inv.customer.city].filter(Boolean).join(', ')}</Muted> : null}
          {inv.job_id && (
            <Pressable onPress={() => router.push(`/job/${inv.job_id}`)} style={{ marginTop: 6 }}>
              <Text style={{ color: colors.brand, fontWeight: '600' }}>View job {inv.job?.crm_call_id} ›</Text>
            </Pressable>
          )}
        </Card>

        <Card title="Charges">
          {inv.job?.visits?.flatMap((v) => [
            v.labour_charge > 0 ? <Row key={`l${v.id}`} k={`Service${v.action_taken ? ` – ${v.action_taken.name}` : ''}`} v={money(v.labour_charge)} /> : null,
            ...(v.inventory_usage ?? []).map((u) => <Row key={`u${u.id}`} k={`${u.item?.name} × ${qty(u.quantity)}`} v={money(u.total_price)} />),
          ])}
          {inv.items?.map((it) => <Row key={it.id} k={`${it.description}${it.type === 'part' ? ` × ${qty(it.quantity)}` : ''}`} v={money(it.total)} />)}
          <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 6 }} />
          <Row k="Service charge" v={money(inv.total_service_charge)} />
          <Row k="Spare charge" v={money(inv.total_spare_charge)} />
          {inv.discount_amount > 0 && <Row k="Discount" v={`− ${money(inv.discount_amount)}`} />}
          <Row k="Total" v={money(inv.total_amount)} strong />
        </Card>

        <Card title="Payments" padded={false}>
          {inv.payments?.length ? (
            inv.payments.map((p, i) => (
              <View key={p.id} style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: colors.border }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: '600' }}>{METHOD_LABEL[p.method] ?? p.method}{p.receipt_number ? ` · ${p.receipt_number}` : ''}</Text>
                  <Muted style={{ fontSize: 12 }}>
                    {dateTime(p.paid_at)} · {p.collector?.name ?? 'Office'}
                    {p.reference_no ? ` · ${p.reference_no}` : ''}
                  </Muted>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontWeight: '700', color: colors.text }}>{money(p.amount)}</Text>
                  {p.status !== 'success' && p.status !== 'completed' && <Badge text={p.status} />}
                </View>
              </View>
            ))
          ) : (
            <Muted style={{ padding: 16 }}>No payments recorded yet.</Muted>
          )}
        </Card>
      </Screen>
      {paying && <PaymentSheet invoice={inv} onClose={() => setPaying(false)} />}
    </>
  );
}

const METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'bank_transfer', label: 'Bank' },
] as const;

function PaymentSheet({ invoice, onClose }: { invoice: Invoice; onClose: () => void }) {
  const [form, setForm] = useState({ amount: toMajor(invoice.balance_amount), method: 'cash' as (typeof METHODS)[number]['value'], reference_no: '', remarks: '' });
  const m = useApiMutation(
    () => api.post(`/invoices/${invoice.id}/pay`, { amount: toMinor(form.amount), method: form.method, reference_no: form.reference_no || null, remarks: form.remarks || null }),
    { invalidate: [['invoice', String(invoice.id)], ['invoices'], ['job'], ['dashboard']], toastValidation: false, onSuccess: onClose },
  );
  const refLabel = form.method === 'cheque' ? 'Cheque number' : form.method === 'upi' ? 'UPI transaction ref. (optional)' : 'Bank reference / UTR';
  return (
    <Sheet open onClose={onClose} title="Record payment" footer={<Button title="Save payment" loading={m.isPending} onPress={() => m.mutate(undefined)} style={{ flex: 1 }} />}>
      <Muted>Balance due {money(invoice.balance_amount)}. A receipt number is created automatically.</Muted>
      <Field label="Amount (₹)" required error={fieldError(m.error, 'amount')}>
        <Input value={form.amount} onChangeText={(v) => setForm({ ...form, amount: v.replace(/[^\d.]/g, '') })} keyboardType="decimal-pad" selectTextOnFocus />
      </Field>
      <Field label="Method" required error={fieldError(m.error, 'method')}>
        <Segmented value={form.method} onChange={(v) => setForm({ ...form, method: v })} options={METHODS.map((x) => ({ ...x }))} />
      </Field>
      {form.method !== 'cash' && (
        <Field label={refLabel} required={form.method !== 'upi'} error={fieldError(m.error, 'reference_no')}>
          <Input value={form.reference_no} onChangeText={(v) => setForm({ ...form, reference_no: v })} autoCapitalize="characters" maxLength={100} />
        </Field>
      )}
      <Field label="Remarks">
        <Input value={form.remarks} onChangeText={(v) => setForm({ ...form, remarks: v })} maxLength={500} />
      </Field>
    </Sheet>
  );
}

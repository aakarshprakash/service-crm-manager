import { Linking, Pressable, View } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { api, type Envelope } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { date, label, money } from '@/lib/format';
import type { Customer, Job } from '@/lib/types';
import { Text } from '@/components/Text';
import { Badge, Button, Card, ErrorView, Loading, Muted, Screen } from '@/components/ui';
import { colors } from '@/components/theme';

interface CustomerView {
  customer: Customer;
  jobs: (Job & { invoice?: { invoice_number: string; total_amount: number; balance_amount: number; payment_status: string } | null })[];
  outstanding: number;
}

export default function CustomerDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { can } = useAuth();
  const q = useQuery({ queryKey: ['customer', id], queryFn: () => api.get<Envelope<CustomerView>>(`/customers/${id}`).then((r) => r.data) });
  if (q.isLoading) return <Loading />;
  const c = q.data?.customer;
  if (!c || !q.data) return <ErrorView error={q.error} onRetry={q.refetch} />;
  const address = [c.address, c.city, c.pincode].filter(Boolean).join(', ');
  return (
    <>
      <Stack.Screen options={{ title: c.name }} />
      <Screen refreshing={q.isRefetching} onRefresh={q.refetch}>
        <Card>
          <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>{c.name}</Text>
          <Muted>
            {[c.phone, c.alt_phone, c.email].filter(Boolean).join(' · ')}
            {c.crm_id ? ` · CRM ${c.crm_id}` : ''}
          </Muted>
          {address ? <Text style={{ color: colors.text, marginTop: 4 }}>{address}</Text> : null}
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
            <Button title="Call" icon="call-outline" variant="secondary" size="sm" style={{ flex: 1 }} onPress={() => Linking.openURL(`tel:${c.phone}`)} />
            <Button
              title="Map"
              icon="navigate-outline"
              variant="secondary"
              size="sm"
              style={{ flex: 1 }}
              disabled={!address && !c.lat}
              onPress={() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(c.lat && c.lng ? `${c.lat},${c.lng}` : address)}`)}
            />
            {can('jobs.manage') && <Button title="New job" icon="add" size="sm" style={{ flex: 1 }} onPress={() => router.push({ pathname: '/job/new', params: { customer_id: String(c.id) } })} />}
          </View>
        </Card>

        {q.data.outstanding > 0 && (
          <Card>
            <Muted>Outstanding</Muted>
            <Text style={{ fontSize: 22, fontWeight: '800', color: colors.red }}>{money(q.data.outstanding)}</Text>
          </Card>
        )}

        {!!c.products?.length && (
          <Card title={`Products (${c.products.length})`}>
            <View style={{ gap: 10 }}>
              {c.products.map((p) => (
                <View key={p.id}>
                  <Text style={{ fontWeight: '600', color: colors.text }}>{[p.product?.brand?.name, p.product?.model_name].filter(Boolean).join(' ') || 'Product'}</Text>
                  <Muted style={{ fontSize: 12 }}>
                    {[p.serial_no && `SN ${p.serial_no}`, p.warranty_type && label(p.warranty_type), p.warranty_expiry && `till ${date(p.warranty_expiry)}`].filter(Boolean).join(' · ') || '–'}
                  </Muted>
                </View>
              ))}
            </View>
          </Card>
        )}

        <Card title={`Service history (${q.data.jobs.length})`} padded={false}>
          {q.data.jobs.length ? (
            q.data.jobs.map((j, i) => (
              <Pressable key={j.id} onPress={() => router.push(`/job/${j.id}`)} style={({ pressed }) => ({ paddingHorizontal: 16, paddingVertical: 12, gap: 2, borderTopWidth: i ? 1 : 0, borderTopColor: colors.border, backgroundColor: pressed ? colors.bg : 'transparent' })}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ fontWeight: '600', color: colors.text, flex: 1 }}>{j.crm_call_id}</Text>
                  <Badge text={j.status} />
                </View>
                <Muted style={{ fontSize: 12 }}>
                  {date(j.created_at)} · {j.complaint_type?.name ?? j.complaint_details ?? '–'}
                  {j.technician ? ` · ${j.technician.name}` : ''}
                </Muted>
                {j.invoice && (
                  <Muted style={{ fontSize: 12 }}>
                    {j.invoice.invoice_number} · {money(j.invoice.total_amount)}
                    {j.invoice.balance_amount > 0 ? ` · due ${money(j.invoice.balance_amount)}` : ''}
                  </Muted>
                )}
              </Pressable>
            ))
          ) : (
            <Muted style={{ padding: 16 }}>No jobs yet.</Muted>
          )}
        </Card>
      </Screen>
    </>
  );
}

import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { api, ApiError, type Envelope, type Paginated } from '@/lib/api';
import { useDebounced, useLookups, useStaffOptions } from '@/lib/hooks';
import type { Customer, Job } from '@/lib/types';
import { Text } from '@/components/Text';
import { Button, Card, Field, Icon, Input, Muted, Screen, Segmented } from '@/components/ui';
import { DateTimeField, PickerField, SelectSheet, type Option } from '@/components/pickers';
import { toast } from '@/components/toast';
import { colors, radius } from '@/components/theme';

type Picker = 'product' | 'type' | 'summary' | 'tech' | 'location' | null;
const emptyCustomer = { name: '', phone: '', address: '', city: '', pincode: '' };

/** Log a customer complaint as a job, pick the visit time and the technician. */
export default function NewJob() {
  const preset = useLocalSearchParams<{ customer_id?: string }>().customer_id;
  const lookups = useLookups();
  const techs = useStaffOptions('technician');
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [draft, setDraft] = useState<typeof emptyCustomer | null>(null);
  const [search, setSearch] = useState('');
  const q = useDebounced(search.trim(), 300);
  const [form, setForm] = useState({ customer_product_id: null as number | null, complaint_type_id: null as number | null, complaint_summary_id: null as number | null, complaint_details: '', priority: 'medium' as 'low' | 'medium' | 'high', service_location_id: null as number | null, tech: null as number | null });
  const [when, setWhen] = useState<Date | null>(null);
  const [auto, setAuto] = useState(false);
  const [picker, setPicker] = useState<Picker>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));
  const f = (n: string) => error?.field(n);

  const choose = async (id: number) => {
    const r = await api.get<Envelope<{ customer: Customer }>>(`/customers/${id}`);
    setCustomer(r.data.customer);
    set('customer_product_id', r.data.customer.products?.length === 1 ? r.data.customer.products[0]!.id : null);
  };
  useEffect(() => {
    if (preset) choose(Number(preset)).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset]);

  const results = useQuery({
    queryKey: ['customer-search', q],
    queryFn: () => api.get<Paginated<Customer>>('/customers', { search: q, per_page: 8 }),
    enabled: q.length >= 2 && !customer && !draft,
  });

  // Suggest the service location whose PIN codes include the customer's PIN.
  const locations = lookups.data?.service_locations ?? [];
  const pin = (customer?.pincode ?? draft?.pincode ?? '').replace(/\D/g, '');
  useEffect(() => {
    if (pin.length < 6 || form.service_location_id) return;
    const match = locations.find((l) => (l.pincodes ?? '').split(/[\s,]+/).includes(pin));
    if (match) set('service_location_id', match.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin, locations.length]);

  const summaries = (lookups.data?.complaint_summaries ?? []).filter((s) => !form.complaint_type_id || !s.complaint_type_id || s.complaint_type_id === form.complaint_type_id);
  const products = customer?.products ?? [];
  const productLabel = (id: number | null) => {
    const p = products.find((x) => x.id === id);
    return p ? [p.product?.brand?.name, p.product?.model_name].filter(Boolean).join(' ') + (p.serial_no ? ` · SN ${p.serial_no}` : '') || 'Product' : null;
  };
  const nameOf = <T extends { id: number; name: string }>(list: T[] | undefined, id: number | null) => list?.find((x) => x.id === id)?.name ?? null;

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      let customerId = customer?.id;
      if (!customerId && draft) {
        const created = await api.post<Envelope<Customer>>('/customers', { ...draft, products: [] });
        customerId = created.data.id;
        setCustomer(created.data);
        setDraft(null);
      }
      if (!customerId) {
        setError(new ApiError(422, 'Select or add a customer.', { customer_id: ['Select or add a customer.'] }));
        return;
      }
      const res = await api.post<Envelope<Job> & { message?: string; meta?: { auto_assign?: { assigned: boolean } } }>('/jobs', {
        customer_id: customerId,
        customer_product_id: form.customer_product_id,
        complaint_type_id: form.complaint_type_id,
        complaint_summary_id: form.complaint_summary_id,
        complaint_details: form.complaint_details || null,
        priority: form.priority,
        call_type: 'crm_call',
        scheduled_at: when?.toISOString() ?? null,
        assigned_technician_id: auto ? null : form.tech,
        auto_assign: auto,
        service_location_id: form.service_location_id,
      });
      if (res.meta?.auto_assign && !res.meta.auto_assign.assigned) toast.info(res.message ?? 'Job created but not assigned.');
      else toast.success(res.message ?? 'Job created.');
      router.replace(`/job/${res.data.id}`);
    } catch (e) {
      const err = e instanceof ApiError ? e : new ApiError(0, (e as Error).message);
      setError(err);
      if (!Object.keys(err.errors).length) toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const opts = (list: { id: number; name: string }[] | undefined): Option<number>[] => (list ?? []).map((x) => ({ value: x.id, label: x.name }));

  return (
    <Screen>
      <Card title="Customer">
        {customer ? (
          <View style={{ gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 12, borderRadius: radius.sm, backgroundColor: colors.bg }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '700', color: colors.text }}>{customer.name}</Text>
                <Muted>
                  {customer.phone}
                  {customer.city ? ` · ${customer.city}` : ''}
                </Muted>
              </View>
              <Pressable onPress={() => { setCustomer(null); set('customer_product_id', null); }} hitSlop={10} accessibilityLabel="Change customer">
                <Icon name="close" color={colors.muted} />
              </Pressable>
            </View>
            {products.length > 0 && <PickerField label="Product" value={productLabel(form.customer_product_id)} placeholder="Not specified" onPress={() => setPicker('product')} error={f('customer_product_id')} />}
          </View>
        ) : draft ? (
          <View style={{ gap: 12 }}>
            <Field label="Name" required error={f('name')}>
              <Input value={draft.name} onChangeText={(v) => setDraft({ ...draft, name: v })} autoCapitalize="words" />
            </Field>
            <Field label="Mobile number" required error={f('phone')}>
              <Input value={draft.phone} onChangeText={(v) => setDraft({ ...draft, phone: v.replace(/[^\d+]/g, '') })} keyboardType="phone-pad" maxLength={15} />
            </Field>
            <Field label="Address" error={f('address')}>
              <Input value={draft.address} onChangeText={(v) => setDraft({ ...draft, address: v })} multiline />
            </Field>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Field label="City" error={f('city')}>
                  <Input value={draft.city} onChangeText={(v) => setDraft({ ...draft, city: v })} />
                </Field>
              </View>
              <View style={{ width: 120 }}>
                <Field label="PIN code" error={f('pincode')}>
                  <Input value={draft.pincode} onChangeText={(v) => setDraft({ ...draft, pincode: v.replace(/\D/g, '') })} keyboardType="number-pad" maxLength={6} />
                </Field>
              </View>
            </View>
            <Button title="Search existing customers instead" variant="ghost" size="sm" onPress={() => setDraft(null)} />
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            <Input value={search} onChangeText={setSearch} placeholder="Name, phone, CRM ID or serial number" autoCorrect={false} autoFocus />
            {f('customer_id') && <Text style={{ color: colors.red, fontSize: 12 }}>{f('customer_id')}</Text>}
            {q.length >= 2 && (
              <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm }}>
                {results.data?.data.map((c, i) => (
                  <Pressable key={c.id} onPress={() => choose(c.id).catch((e) => toast.error(e.message))} style={({ pressed }) => ({ padding: 12, borderTopWidth: i ? 1 : 0, borderTopColor: colors.border, backgroundColor: pressed ? colors.bg : '#fff', flexDirection: 'row', alignItems: 'center' })}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: '600', color: colors.text }}>{c.name}</Text>
                      <Muted style={{ fontSize: 12 }}>
                        {c.phone} · {c.city ?? '–'}
                      </Muted>
                    </View>
                    <Muted style={{ fontSize: 12 }}>{c.jobs_count ?? 0} job{c.jobs_count === 1 ? '' : 's'}</Muted>
                  </Pressable>
                ))}
                {results.data && !results.data.data.length && <Muted style={{ padding: 12, textAlign: 'center' }}>No customer matches “{q}”.</Muted>}
                {results.isFetching && !results.data && <Muted style={{ padding: 12, textAlign: 'center' }}>Searching…</Muted>}
              </View>
            )}
            <Button
              title="Add a new customer"
              icon="person-add-outline"
              variant="secondary"
              onPress={() => setDraft({ ...emptyCustomer, phone: /^\d+$/.test(q) ? q : '', name: /^\d+$/.test(q) ? '' : q })}
            />
          </View>
        )}
      </Card>

      <Card title="Complaint">
        <View style={{ gap: 12 }}>
          <PickerField label="Complaint type" value={nameOf(lookups.data?.complaint_types, form.complaint_type_id)} onPress={() => setPicker('type')} error={f('complaint_type_id')} />
          {summaries.length > 0 && <PickerField label="Summary" value={nameOf(summaries, form.complaint_summary_id)} placeholder="Optional" onPress={() => setPicker('summary')} />}
          <Field label="Details" error={f('complaint_details')}>
            <Input value={form.complaint_details} onChangeText={(v) => set('complaint_details', v)} multiline placeholder="What does the customer report?" maxLength={2000} />
          </Field>
          <Field label="Priority">
            <Segmented value={form.priority} onChange={(v) => set('priority', v)} options={[{ value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' }, { value: 'high', label: 'High' }]} />
          </Field>
        </View>
      </Card>

      <Card title="Visit & technician">
        <View style={{ gap: 12 }}>
          <DateTimeField label="Visit date & time" value={when} onChange={setWhen} allowClear error={f('scheduled_at')} />
          {locations.length > 0 && <PickerField label="Service location" value={nameOf(locations, form.service_location_id)} placeholder="Not specified" onPress={() => setPicker('location')} hint={pin.length === 6 && form.service_location_id ? `Suggested from PIN ${pin}` : undefined} />}
          <Segmented value={auto ? 'auto' : 'pick'} onChange={(v) => setAuto(v === 'auto')} options={[{ value: 'pick', label: 'Choose technician', icon: 'person-outline' }, { value: 'auto', label: 'Auto-assign', icon: 'flash-outline' }]} />
          {auto ? (
            <Muted>Picks the technician covering this location (or branch) with the fewest open jobs.</Muted>
          ) : (
            <PickerField label="Technician" value={nameOf(techs.data, form.tech)} placeholder="Assign later" onPress={() => setPicker('tech')} error={f('assigned_technician_id')} icon="person-outline" />
          )}
        </View>
      </Card>

      <Button title="Create job" size="lg" icon="checkmark" loading={saving} disabled={!customer && !(draft?.name && draft.phone)} onPress={submit} />

      <SelectSheet open={picker === 'product'} onClose={() => setPicker(null)} title="Product" value={form.customer_product_id ?? undefined} onSelect={(v) => set('customer_product_id', v)} options={products.map((p) => ({ value: p.id, label: productLabel(p.id) ?? 'Product', detail: p.under_warranty === undefined ? undefined : p.under_warranty ? 'Under warranty' : 'Out of warranty' }))} />
      <SelectSheet open={picker === 'type'} onClose={() => setPicker(null)} title="Complaint type" value={form.complaint_type_id ?? undefined} onSelect={(v) => { set('complaint_type_id', v); set('complaint_summary_id', null); }} options={opts(lookups.data?.complaint_types)} />
      <SelectSheet open={picker === 'summary'} onClose={() => setPicker(null)} title="Complaint summary" value={form.complaint_summary_id ?? undefined} onSelect={(v) => set('complaint_summary_id', v)} options={opts(summaries)} />
      <SelectSheet open={picker === 'location'} onClose={() => setPicker(null)} title="Service location" value={form.service_location_id ?? undefined} onSelect={(v) => set('service_location_id', v)} options={locations.map((l) => ({ value: l.id, label: l.name, detail: l.city ?? undefined }))} />
      <SelectSheet
        open={picker === 'tech'}
        onClose={() => setPicker(null)}
        title="Technician"
        value={form.tech ?? undefined}
        onSelect={(v) => set('tech', v)}
        options={(techs.data ?? []).slice().sort((a, b) => Number(b.punch_status === 'in') - Number(a.punch_status === 'in')).map((t) => ({ value: t.id, label: t.name, detail: t.punch_status === 'in' ? 'On duty now' : 'Off duty', tone: t.punch_status === 'in' ? colors.green : undefined }))}
      />
    </Screen>
  );
}

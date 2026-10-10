import { useState } from 'react';
import { Alert, Image, Linking, Pressable, Share, View } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { api, type Envelope } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { fieldError, useApiMutation, useStaffOptions } from '@/lib/hooks';
import { date, dateTime, duration, label, METHOD_LABEL, money, qty, relative } from '@/lib/format';
import type { Job } from '@/lib/types';
import { Text } from '@/components/Text';
import { Badge, Button, Card, ErrorView, Field, Icon, Input, Loading, Muted, Row, Screen, Sheet, type IconName } from '@/components/ui';
import { DateTimeField, SelectSheet, PickerField } from '@/components/pickers';
import { PhotoGrid, VoiceNoteList } from '@/components/media';
import { toast } from '@/components/toast';
import { colors, radius } from '@/components/theme';

type Dialog = 'assign' | 'reschedule' | 'cancel' | 'followup' | null;

export default function JobDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { can } = useAuth();
  const q = useQuery({ queryKey: ['job', id], queryFn: () => api.get<Envelope<Job>>(`/jobs/${id}`).then((r) => r.data) });
  const [dialog, setDialog] = useState<Dialog>(null);
  const job = q.data;

  if (q.isLoading) return <Loading />;
  if (!job) return <ErrorView error={q.error} onRetry={q.refetch} />;

  const final = ['completed', 'cancelled'].includes(job.status);
  const manage = can('jobs.manage') && !final;
  const c = job.customer;
  const photos = job.images?.filter((i) => i.type !== 'signature') ?? [];
  const product = [job.customer_product?.product?.brand?.name, job.customer_product?.product?.model_name].filter(Boolean).join(' ');
  const mapQuery = c?.lat && c?.lng ? `${c.lat},${c.lng}` : [c?.address, c?.city, c?.pincode].filter(Boolean).join(', ');

  return (
    <>
      <Stack.Screen options={{ title: job.crm_call_id }} />
      <Screen refreshing={q.isRefetching} onRefresh={q.refetch}>
        <View style={{ gap: 6 }}>
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
            <Badge text={job.status} />
            <Badge text={job.priority} />
            {job.call_type === 'portal' && <Badge text="Customer portal" tone="verified" />}
          </View>
          <Muted>
            Logged {relative(job.created_at)} by {job.creator?.name ?? 'customer portal'} · {job.call_age_days ?? 0} day(s) old
          </Muted>
        </View>

        {manage && (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button title={job.technician ? 'Reassign' : 'Assign'} icon="person-add-outline" style={{ flex: 1 }} onPress={() => setDialog('assign')} />
            <Button title="Reschedule" icon="calendar-outline" variant="secondary" style={{ flex: 1 }} onPress={() => setDialog('reschedule')} />
          </View>
        )}

        <Card title="Customer">
          <View style={{ gap: 4 }}>
            <Pressable onPress={() => router.push(`/customer/${job.customer_id}`)}>
              <Text style={{ fontSize: 17, fontWeight: '700', color: colors.brand }}>{c?.name}</Text>
            </Pressable>
            <Text style={{ color: colors.text }}>{c?.phone}{c?.alt_phone ? ` · ${c.alt_phone}` : ''}</Text>
            {!!(c?.address || c?.city) && <Muted>{[c?.address, c?.city, c?.pincode].filter(Boolean).join(', ')}</Muted>}
            {product ? <Text style={{ color: colors.text, marginTop: 6 }}>{product}{job.customer_product?.serial_no ? ` · SN ${job.customer_product.serial_no}` : ''}</Text> : null}
            {job.customer_product?.under_warranty !== undefined && (
              <Muted>
                {label(job.customer_product.warranty_type)} · {job.customer_product.under_warranty ? 'Under warranty' : 'Warranty expired'}
                {job.customer_product.warranty_expiry ? ` (till ${date(job.customer_product.warranty_expiry)})` : ''}
              </Muted>
            )}
          </View>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
            <Action icon="call" label="Call" onPress={() => Linking.openURL(`tel:${c?.phone}`)} />
            <Action icon="logo-whatsapp" label="WhatsApp" onPress={() => Linking.openURL(`https://wa.me/${whatsappNumber(c?.phone)}`)} />
            <Action icon="navigate" label="Map" disabled={!mapQuery} onPress={() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`)} />
            {manage && <LocationRequest jobId={job.id} hasLocation={!!(c?.lat && c?.lng)} />}
          </View>
        </Card>

        <Card title="Complaint">
          <Row k="Type" v={job.complaint_type?.name ?? '–'} />
          {job.complaint_summary && <Row k="Summary" v={job.complaint_summary.name} />}
          <Row k="Call type" v={label(job.call_type)} />
          {job.service_location && <Row k="Location" v={job.service_location.name} />}
          {job.branch && <Row k="Branch" v={job.branch.name} />}
          {job.complaint_details ? <Text style={{ marginTop: 8, padding: 10, borderRadius: radius.sm, backgroundColor: colors.bg, color: colors.text }}>{job.complaint_details}</Text> : null}
          {job.cancel_reason ? <Text style={{ marginTop: 8, color: colors.red }}>Cancelled: {job.cancel_reason}</Text> : null}
        </Card>

        <Card title="Assignment">
          <Row k="Technician" v={job.technician?.name ?? 'Not assigned'} vStyle={!job.technician ? { color: colors.amber, fontWeight: '600' } : undefined} />
          <Row k="Visit" v={dateTime(job.scheduled_at)} />
          {job.technician?.phone && (
            <Button title={`Call ${job.technician.name.split(' ')[0]}`} icon="call-outline" variant="ghost" size="sm" style={{ alignSelf: 'flex-start', marginTop: 4 }} onPress={() => Linking.openURL(`tel:${job.technician?.phone}`)} />
          )}
          {job.parent && (
            <Pressable onPress={() => router.push(`/job/${job.parent!.id}`)} style={{ marginTop: 6 }}>
              <Text style={{ color: colors.brand }}>Follow-up of {job.parent.crm_call_id} ›</Text>
            </Pressable>
          )}
          {job.follow_ups?.map((f) => (
            <Pressable key={f.id} onPress={() => router.push(`/job/${f.id}`)} style={{ marginTop: 6, flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: colors.brand }}>Follow-up {f.crm_call_id} ›</Text>
              <Badge text={f.status} />
            </Pressable>
          ))}
        </Card>

        <Card title={`Visits (${job.visits?.length ?? 0})`}>
          {!job.visits?.length ? (
            <Muted>No visits yet. The technician starts the service from their app.</Muted>
          ) : (
            <View style={{ gap: 16 }}>
              {job.visits.map((v, i) => {
                const notes = job.voice_notes?.filter((n) => n.job_visit_id === v.id) ?? [];
                const sig = job.images?.find((im) => im.type === 'signature' && im.job_visit_id === v.id);
                return (
                  <View key={v.id} style={{ gap: 6, paddingTop: i ? 16 : 0, borderTopWidth: i ? 1 : 0, borderTopColor: colors.border }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ fontWeight: '600', color: colors.text }}>{dateTime(v.start_time)}</Text>
                      <Badge text={v.status} />
                    </View>
                    <Muted>
                      {v.technician?.name} · {label(v.service_type)} · {duration(v.duration_seconds)}
                    </Muted>
                    {v.action_taken && <Text style={{ color: colors.text }}>Action: {v.action_taken.name}</Text>}
                    {v.service_summary ? <Text style={{ color: '#334155' }}>{v.service_summary}</Text> : null}
                    {!!v.inventory_usage?.length && (
                      <View style={{ backgroundColor: colors.bg, borderRadius: radius.sm, padding: 10, gap: 4 }}>
                        {v.inventory_usage.map((u) => (
                          <View key={u.id} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                            <Text style={{ fontSize: 13, color: colors.text, flex: 1 }}>
                              {u.item?.name} × {qty(u.quantity)} {u.item?.unit_of_measure}
                            </Text>
                            <Text style={{ fontSize: 13, color: colors.text }}>{money(u.total_price)}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                    {notes.length > 0 && <VoiceNoteList notes={notes} />}
                    {sig && (
                      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10 }}>
                        <Image source={{ uri: sig.url }} style={{ width: 140, height: 56, borderRadius: 6, borderWidth: 1, borderColor: colors.border, backgroundColor: '#fff' }} resizeMode="contain" />
                        <Muted style={{ fontSize: 12 }}>Signed by {v.signer_name ?? 'customer'}{v.signed_at ? ` · ${dateTime(v.signed_at)}` : ''}</Muted>
                      </View>
                    )}
                    {v.status !== 'in_progress' && (
                      <Text style={{ fontSize: 12, color: colors.muted }}>
                        Labour {money(v.labour_charge)} · Spares {money(v.spare_charge)} · <Text style={{ fontWeight: '700', color: colors.text }}>Total {money(v.total_charge)}</Text>
                        {v.payment_method ? ` · ${METHOD_LABEL[v.payment_method] ?? v.payment_method}` : ''}
                        {v.amount_collected > 0 ? ` ${money(v.amount_collected)}` : ''}
                      </Text>
                    )}
                  </View>
                );
              })}
            </View>
          )}
        </Card>

        {photos.length > 0 && (
          <Card title={`Photos (${photos.length})`}>
            <PhotoGrid images={photos} />
          </Card>
        )}

        {job.invoice && (
          <Card title="Invoice">
            <Pressable onPress={() => router.push(`/invoice/${job.invoice!.id}`)} style={{ gap: 4 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontWeight: '700', color: colors.brand }}>{job.invoice.invoice_number} ›</Text>
                <Badge text={job.invoice.payment_status} />
              </View>
              <Row k="Total" v={money(job.invoice.total_amount)} strong />
              <Row k="Balance" v={money(job.invoice.balance_amount)} vStyle={job.invoice.balance_amount > 0 ? { color: colors.red, fontWeight: '700' } : undefined} />
            </Pressable>
          </Card>
        )}

        {job.review && (
          <Card title="Customer feedback">
            <Text style={{ fontSize: 18, color: colors.amber }}>{'★'.repeat(job.review.rating)}{'☆'.repeat(5 - job.review.rating)}</Text>
            {job.review.comment ? <Text style={{ color: colors.text, marginTop: 4 }}>“{job.review.comment}”</Text> : null}
          </Card>
        )}

        {!!job.status_history?.length && (
          <Card title="History">
            <View style={{ gap: 12 }}>
              {job.status_history.map((h) => (
                <View key={h.id} style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.brand, marginTop: 6 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text }}>{h.remarks ?? label(h.status)}</Text>
                    <Muted style={{ fontSize: 12 }}>
                      {dateTime(h.changed_at)}
                      {h.user ? ` · ${h.user.name}` : ''}
                    </Muted>
                  </View>
                </View>
              ))}
            </View>
          </Card>
        )}

        {can('jobs.manage') && (
          <View style={{ gap: 8 }}>
            <Button title="Create follow-up call" icon="repeat-outline" variant="secondary" onPress={() => setDialog('followup')} />
            {manage && <Button title="Cancel job" icon="close-circle-outline" variant="ghost" onPress={() => setDialog('cancel')} style={{ borderColor: 'transparent' }} />}
          </View>
        )}
      </Screen>

      {dialog === 'assign' && <AssignSheet job={job} onClose={() => setDialog(null)} />}
      {dialog === 'reschedule' && <RescheduleSheet job={job} onClose={() => setDialog(null)} />}
      {dialog === 'cancel' && <CancelSheet job={job} onClose={() => setDialog(null)} />}
      {dialog === 'followup' && <FollowUpSheet job={job} onClose={() => setDialog(null)} />}
    </>
  );
}

/** Indian 10-digit numbers get the country code WhatsApp needs. */
function whatsappNumber(phone?: string | null) {
  const d = (phone ?? '').replace(/\D/g, '');
  return d.length === 10 ? `91${d}` : d;
}

function Action({ icon, label: l, onPress, disabled }: { icon: IconName; label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => ({ flex: 1, alignItems: 'center', gap: 4, paddingVertical: 10, borderRadius: radius.sm, backgroundColor: pressed ? colors.border : colors.bg, opacity: disabled ? 0.4 : 1 })}
    >
      <Icon name={icon} size={20} color={colors.brand} />
      <Text style={{ fontSize: 12, fontWeight: '600', color: colors.text }}>{l}</Text>
    </Pressable>
  );
}

/** Link the customer opens to drop a pin; shared from the phone or sent by SMS / WhatsApp. */
function LocationRequest({ jobId, hasLocation }: { jobId: number; hasLocation: boolean }) {
  const [busy, setBusy] = useState(false);
  const run = async (send: boolean) => {
    setBusy(true);
    try {
      const r = await api.post<Envelope<{ link: string; message: string }> & { message?: string }>(`/jobs/${jobId}/location-request`, { send });
      if (send) toast.success(r.message || 'Location request sent to the customer.');
      else await Share.share({ message: r.data.message });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Action
      icon={hasLocation ? 'location' : 'location-outline'}
      label={busy ? '…' : hasLocation ? 'Update pin' : 'Ask pin'}
      disabled={busy}
      onPress={() =>
        Alert.alert('Ask the customer for their location', 'They get a link to share where they are, so the technician can reach them.', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Send SMS / WhatsApp', onPress: () => run(true) },
          { text: 'Share link myself', onPress: () => run(false) },
        ])
      }
    />
  );
}

const invalidate = (job: Job) => [['job', String(job.id)], ['jobs'], ['dashboard']];

function AssignSheet({ job, onClose }: { job: Job; onClose: () => void }) {
  const techs = useStaffOptions('technician');
  const [tech, setTech] = useState<number | null>(job.assigned_technician_id);
  const [when, setWhen] = useState<Date | null>(job.scheduled_at ? new Date(job.scheduled_at) : null);
  const [picking, setPicking] = useState(false);
  const m = useApiMutation((body: object) => api.patch(`/jobs/${job.id}/assign`, body), { invalidate: invalidate(job), toastValidation: false, onSuccess: onClose });
  const auto = useApiMutation(() => api.post(`/jobs/${job.id}/auto-assign`), { invalidate: invalidate(job), toastValidation: false, onSuccess: onClose });
  const chosen = techs.data?.find((t) => t.id === tech);
  return (
    <Sheet
      open
      onClose={onClose}
      title={job.technician ? 'Reassign technician' : 'Assign technician'}
      footer={
        <>
          <Button title="Auto-assign" variant="secondary" loading={auto.isPending} onPress={() => auto.mutate(undefined)} style={{ flex: 1 }} />
          <Button title="Assign" loading={m.isPending} disabled={!tech} onPress={() => m.mutate({ technician_id: tech, scheduled_at: when?.toISOString() ?? null })} style={{ flex: 1 }} />
        </>
      }
    >
      <Muted>The technician gets a push notification and the customer an SMS / WhatsApp update.</Muted>
      <PickerField label="Technician" required value={chosen ? `${chosen.name}${chosen.punch_status === 'in' ? ' · on duty' : ''}` : null} onPress={() => setPicking(true)} error={fieldError(m.error, 'technician_id') ?? fieldError(auto.error, 'technician')} icon="person-outline" />
      <DateTimeField label="Visit date & time" value={when} onChange={setWhen} allowClear />
      <SelectSheet
        open={picking}
        onClose={() => setPicking(false)}
        title="Choose technician"
        value={tech ?? undefined}
        onSelect={setTech}
        options={(techs.data ?? [])
          .slice()
          .sort((a, b) => Number(b.punch_status === 'in') - Number(a.punch_status === 'in'))
          .map((t) => ({ value: t.id, label: t.name, detail: t.punch_status === 'in' ? 'On duty now' : 'Off duty', tone: t.punch_status === 'in' ? colors.green : undefined }))}
      />
    </Sheet>
  );
}

function RescheduleSheet({ job, onClose }: { job: Job; onClose: () => void }) {
  const [when, setWhen] = useState<Date | null>(job.scheduled_at ? new Date(job.scheduled_at) : null);
  const [reason, setReason] = useState('');
  const m = useApiMutation(() => api.patch(`/jobs/${job.id}/reschedule`, { scheduled_at: when?.toISOString(), reason: reason || null }), { invalidate: invalidate(job), toastValidation: false, onSuccess: onClose });
  return (
    <Sheet open onClose={onClose} title="Reschedule visit" footer={<Button title="Reschedule" loading={m.isPending} disabled={!when} onPress={() => m.mutate(undefined)} style={{ flex: 1 }} />}>
      <DateTimeField label="New date & time" required value={when} onChange={setWhen} error={fieldError(m.error, 'scheduled_at')} />
      <Field label="Reason">
        <Input value={reason} onChangeText={setReason} placeholder="e.g. Customer asked for an evening slot" maxLength={300} />
      </Field>
    </Sheet>
  );
}

function CancelSheet({ job, onClose }: { job: Job; onClose: () => void }) {
  const [reason, setReason] = useState('');
  const m = useApiMutation(() => api.post(`/jobs/${job.id}/cancel`, { reason }), { invalidate: invalidate(job), toastValidation: false, onSuccess: onClose });
  return (
    <Sheet open onClose={onClose} title="Cancel this job?" footer={<Button title="Cancel job" variant="danger" loading={m.isPending} disabled={!reason.trim()} onPress={() => m.mutate(undefined)} style={{ flex: 1 }} />}>
      <Muted>The job is closed as cancelled and any running visit is stopped. This can’t be undone.</Muted>
      <Field label="Reason" required error={fieldError(m.error, 'reason')}>
        <Input value={reason} onChangeText={setReason} multiline maxLength={300} />
      </Field>
    </Sheet>
  );
}

function FollowUpSheet({ job, onClose }: { job: Job; onClose: () => void }) {
  const techs = useStaffOptions('technician');
  const [tech, setTech] = useState<number | null>(job.assigned_technician_id);
  const [when, setWhen] = useState<Date | null>(null);
  const [notes, setNotes] = useState('');
  const [picking, setPicking] = useState(false);
  const m = useApiMutation(
    () => api.post<Envelope<Job>>(`/jobs/${job.id}/follow-up`, { scheduled_at: when?.toISOString() ?? null, assigned_technician_id: tech, complaint_details: notes || null }),
    {
      invalidate: invalidate(job),
      toastValidation: false,
      onSuccess: (r) => {
        onClose();
        router.push(`/job/${r.data.id}`);
      },
    },
  );
  return (
    <Sheet open onClose={onClose} title="Follow-up call" footer={<Button title="Create follow-up" loading={m.isPending} onPress={() => m.mutate(undefined)} style={{ flex: 1 }} />}>
      <Muted>A revisit or repeat complaint, linked to {job.crm_call_id} with the same customer and product.</Muted>
      <DateTimeField label="Visit date & time" value={when} onChange={setWhen} allowClear error={fieldError(m.error, 'scheduled_at')} />
      <PickerField label="Technician" value={techs.data?.find((t) => t.id === tech)?.name ?? null} placeholder="Assign later" onPress={() => setPicking(true)} icon="person-outline" />
      <Field label="Notes">
        <Input value={notes} onChangeText={setNotes} multiline placeholder="e.g. Check gas pressure again" maxLength={2000} />
      </Field>
      <SelectSheet open={picking} onClose={() => setPicking(false)} title="Technician" value={tech ?? undefined} onSelect={setTech} options={(techs.data ?? []).map((t) => ({ value: t.id, label: t.name, detail: t.punch_status === 'in' ? 'On duty' : undefined }))} />
    </Sheet>
  );
}

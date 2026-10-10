import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Text } from './Text';
import { Badge, Icon } from './ui';
import { colors, radius, shadow } from './theme';
import { dateTime } from '@/lib/format';
import type { Job } from '@/lib/types';

const OPEN = ['open', 'pending'];

/** One job in a list: call ID, customer, complaint, technician and visit time. */
export function JobCard({ job }: { job: Job }) {
  const product = [job.customer_product?.product?.brand?.name, job.customer_product?.product?.model_name].filter(Boolean).join(' ');
  const late = OPEN.includes(job.status) && !!job.scheduled_at && new Date(job.scheduled_at).setHours(23, 59, 59, 999) < Date.now();
  return (
    <Pressable
      onPress={() => router.push(`/job/${job.id}`)}
      accessibilityRole="button"
      style={({ pressed }) => [{ backgroundColor: '#fff', borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: 14, gap: 6, ...shadow }, pressed && { opacity: 0.85 }]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={{ fontWeight: '700', color: colors.text, flex: 1 }} numberOfLines={1}>
          {job.crm_call_id}
        </Text>
        {job.priority === 'high' && <Badge text="high" />}
        <Badge text={job.status} />
      </View>
      <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text }} numberOfLines={1}>
        {job.customer?.name}
        {job.customer?.city ? <Text style={{ fontWeight: '400', color: colors.muted }}> · {job.customer.city}</Text> : null}
      </Text>
      {(job.complaint_type?.name || product || job.complaint_details) && (
        <Text style={{ color: colors.muted, fontSize: 13 }} numberOfLines={1}>
          {[job.complaint_type?.name, product].filter(Boolean).join(' · ') || job.complaint_details}
        </Text>
      )}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 }}>
          <Icon name={job.technician ? 'person-outline' : 'person-add-outline'} size={14} color={job.technician ? colors.muted : colors.amber} />
          <Text style={{ fontSize: 12, color: job.technician ? colors.muted : colors.amber, fontWeight: job.technician ? '400' : '600' }} numberOfLines={1}>
            {job.technician?.name ?? 'Unassigned'}
          </Text>
        </View>
        {job.scheduled_at && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Icon name="calendar-outline" size={14} color={late ? colors.red : colors.muted} />
            <Text style={{ fontSize: 12, color: late ? colors.red : colors.muted, fontWeight: late ? '600' : '400' }}>{dateTime(job.scheduled_at)}</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

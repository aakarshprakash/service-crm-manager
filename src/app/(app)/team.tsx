import { FlatList, Linking, Pressable, RefreshControl, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api, type Envelope } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useStaffOptions } from '@/lib/hooks';
import { label, time } from '@/lib/format';
import { Text } from '@/components/Text';
import { Empty, ErrorView, Icon, Loading, Muted, StatTile } from '@/components/ui';
import { colors, dayTone, radius } from '@/components/theme';

interface DailyRow {
  user: { id: number; name: string; role: string; branch: string | null; punch_status: 'in' | 'out' };
  day: { status: string; in: string | null; out: string | null; outside: boolean; leave_type?: string | null };
  punches: { id: number; type: 'in' | 'out'; lat: number | null; lng: number | null; within_fence: boolean | null; created_at: string }[];
}

/** Who's working today: attendance for HR roles, on-duty status for everyone else. */
export default function Team() {
  const { can } = useAuth();
  return can('hr.view') ? <Attendance /> : <OnDuty />;
}

function Attendance() {
  const staff = useStaffOptions();
  const q = useQuery({
    queryKey: ['hr', 'daily'],
    queryFn: () => api.get<Envelope<DailyRow[]> & { meta: { present: number; on_leave: number; absent: number; on_duty_now: number } }>('/hr/attendance/daily'),
    refetchInterval: 120_000,
  });
  if (q.isLoading) return <Loading />;
  if (!q.data) return <ErrorView error={q.error} onRetry={q.refetch} />;
  const m = q.data.meta;
  const phone = (id: number) => staff.data?.find((s) => s.id === id)?.phone;
  // Technicians first, people on duty at the top.
  const rows = q.data.data.slice().sort((a, b) => Number(b.user.role === 'technician') - Number(a.user.role === 'technician') || Number(b.user.punch_status === 'in') - Number(a.user.punch_status === 'in'));
  return (
    <FlatList
      data={rows}
      keyExtractor={(r) => String(r.user.id)}
      contentContainerStyle={{ padding: 16, gap: 10 }}
      refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={q.refetch} colors={[colors.brand]} />}
      ListHeaderComponent={
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 4 }}>
          <StatTile label="On duty" value={m.on_duty_now} tone={colors.green} />
          <StatTile label="Present" value={m.present} tone={colors.brand} />
          <StatTile label="Leave" value={m.on_leave} tone={colors.sky} />
          <StatTile label="Absent" value={m.absent} tone={colors.red} />
        </View>
      }
      ListEmptyComponent={<Empty icon="people-outline" title="No staff yet" />}
      renderItem={({ item: r }) => {
        const tone = dayTone[r.day.status] ?? { fg: colors.muted, bg: colors.bg };
        const last = [...r.punches].reverse().find((p) => p.lat && p.lng);
        const tel = phone(r.user.id);
        return (
          <View style={{ backgroundColor: '#fff', borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: 14, gap: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: r.user.punch_status === 'in' ? colors.accent : colors.border }} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '700', color: colors.text }}>{r.user.name}</Text>
                <Muted style={{ fontSize: 12 }}>
                  {label(r.user.role)}
                  {r.user.branch ? ` · ${r.user.branch}` : ''}
                </Muted>
              </View>
              <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: tone.bg }}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: tone.fg }}>{r.day.leave_type ?? label(r.day.status)}</Text>
              </View>
              {last && (
                <Pressable onPress={() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${last.lat},${last.lng}`)} hitSlop={8} accessibilityLabel={`Where ${r.user.name} last punched`}>
                  <Icon name="location-outline" size={20} color={colors.brand} />
                </Pressable>
              )}
              {tel && (
                <Pressable onPress={() => Linking.openURL(`tel:${tel}`)} hitSlop={8} accessibilityLabel={`Call ${r.user.name}`}>
                  <Icon name="call-outline" size={20} color={colors.brand} />
                </Pressable>
              )}
            </View>
            {r.day.in && (
              <Muted style={{ fontSize: 12, marginLeft: 20 }}>
                In {time(r.day.in)}
                {r.day.out ? ` · Out ${time(r.day.out)}` : ''}
                {r.day.outside ? ' · outside site' : ''}
              </Muted>
            )}
          </View>
        );
      }}
    />
  );
}

function OnDuty() {
  const q = useStaffOptions('technician');
  if (q.isLoading) return <Loading />;
  if (!q.data) return <ErrorView error={q.error} onRetry={q.refetch} />;
  const rows = q.data.slice().sort((a, b) => Number(b.punch_status === 'in') - Number(a.punch_status === 'in'));
  return (
    <FlatList
      data={rows}
      keyExtractor={(t) => String(t.id)}
      contentContainerStyle={{ padding: 16, gap: 10 }}
      refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={q.refetch} colors={[colors.brand]} />}
      ListEmptyComponent={<Empty icon="people-outline" title="No technicians yet" />}
      renderItem={({ item: t }) => (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: 14 }}>
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: t.punch_status === 'in' ? colors.accent : colors.border }} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: '700', color: colors.text }}>{t.name}</Text>
            <Muted style={{ fontSize: 12 }}>{t.punch_status === 'in' ? 'On duty' : 'Off duty'}</Muted>
          </View>
          {t.phone && (
            <Pressable onPress={() => Linking.openURL(`tel:${t.phone}`)} hitSlop={8} accessibilityLabel={`Call ${t.name}`}>
              <Icon name="call-outline" size={20} color={colors.brand} />
            </Pressable>
          )}
        </View>
      )}
    />
  );
}

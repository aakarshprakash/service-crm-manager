import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { api, type Envelope } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApprovalCounts } from '@/lib/approvals';
import { METHOD_LABEL, money, moneyShort } from '@/lib/format';
import type { Dashboard } from '@/lib/types';
import { Text } from '@/components/Text';
import { Card, ErrorView, Icon, ListRow, Loading, Muted, Screen, StatTile, type IconName } from '@/components/ui';
import { colors, radius } from '@/components/theme';

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export default function Home() {
  const { user, can } = useAuth();
  const approvals = useApprovalCounts();
  const q = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get<Envelope<Dashboard>>('/dashboard').then((r) => r.data),
    refetchInterval: 120_000,
  });
  const d = q.data;
  const s = d?.jobs.by_status;
  // `at` makes a repeat tap re-apply the filter even if the tab already had it.
  const jobs = (params: Record<string, string>) => router.push({ pathname: '/jobs', params: { ...params, at: String(Date.now()) } });

  return (
    <Screen refreshing={q.isRefetching} onRefresh={q.refetch}>
      <View style={{ gap: 2 }}>
        <Text style={{ fontSize: 22, fontWeight: '700', color: colors.text }}>
          {greeting()}, {user?.name.split(' ')[0]}
        </Text>
        <Muted>
          {user?.role_label} · {user?.tenant?.name}
        </Muted>
      </View>

      {can('jobs.manage') && (
        <Pressable
          onPress={() => router.push('/job/new')}
          accessibilityRole="button"
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: radius.md, backgroundColor: pressed ? colors.brandDark : colors.brand })}
        >
          <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: '#ffffff26', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="add" size={24} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>New job</Text>
            <Text style={{ color: '#DBEAFE', fontSize: 12 }}>Log a complaint and assign a technician</Text>
          </View>
          <Icon name="chevron-forward" color="#fff" />
        </Pressable>
      )}

      {q.isLoading && !d ? (
        <Loading />
      ) : q.error && !d ? (
        <ErrorView error={q.error} onRetry={q.refetch} />
      ) : d && s ? (
        <>
          <Attention d={d} approvals={approvals.total} canStock={can('inventory.view')} />

          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <StatTile label="Open" value={s.open} tone={colors.sky} icon="radio-button-on-outline" onPress={() => jobs({ status: 'open' })} />
              <StatTile label="In progress" value={s.in_progress} tone={colors.violet} icon="time-outline" onPress={() => jobs({ status: 'in_progress' })} />
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <StatTile label="Pending" value={s.pending} tone={colors.amber} icon="hourglass-outline" onPress={() => jobs({ status: 'pending' })} />
              <StatTile label="Completed" value={s.completed} tone={colors.green} icon="checkmark-circle-outline" onPress={() => jobs({ status: 'completed' })} />
            </View>
          </View>

          <Card title="Last 14 days" right={<Legend />}>
            <Trend data={d.jobs.trend.slice(-14)} />
            <Muted style={{ marginTop: 8 }}>
              {d.jobs.created_this_month} jobs logged this month · {d.jobs.scheduled_today} visits scheduled today
            </Muted>
          </Card>

          <Card title="Collections this month">
            <Text style={{ fontSize: 28, fontWeight: '800', color: colors.navy }}>{money(d.revenue.collected_this_month)}</Text>
            <Muted>Invoiced {money(d.revenue.invoiced_this_month)}</Muted>
            <MethodBars byMethod={d.revenue.by_method} />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              <MiniStat label="Outstanding" value={moneyShort(d.revenue.outstanding)} tone={d.revenue.outstanding ? colors.red : colors.muted} onPress={can('invoices.view') ? () => router.push({ pathname: '/money', params: { status: 'unpaid,partial', at: String(Date.now()) } }) : undefined} />
              <MiniStat label="On credit" value={moneyShort(d.revenue.credit_outstanding)} tone={colors.violet} onPress={can('invoices.view') ? () => router.push({ pathname: '/money', params: { status: 'unpaid,partial', credit: '1', at: String(Date.now()) } }) : undefined} />
            </View>
          </Card>

          <Card
            title="Technicians"
            padded={false}
            right={
              <Pressable onPress={() => router.push('/team')} hitSlop={8}>
                <Text style={{ color: colors.brand, fontWeight: '600', fontSize: 13 }}>
                  {d.technicians.on_duty}/{d.technicians.total} on duty ›
                </Text>
              </Pressable>
            }
          >
            {d.technicians.performance.length ? (
              d.technicians.performance.slice(0, 5).map((t, i) => (
                <View key={t.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 11, borderTopWidth: i ? 1 : 0, borderTopColor: colors.border }}>
                  <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: colors.brand, fontWeight: '700' }}>{t.name.slice(0, 1)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '600', color: colors.text }}>{t.name}</Text>
                    <Muted style={{ fontSize: 12 }}>
                      {t.completed} completed · {t.visits} visits{t.rating ? ` · ★ ${t.rating}` : ''}
                    </Muted>
                  </View>
                  <Text style={{ fontWeight: '700', color: colors.text }}>{moneyShort(t.revenue)}</Text>
                </View>
              ))
            ) : (
              <Muted style={{ padding: 16 }}>No visits this month yet.</Muted>
            )}
          </Card>
        </>
      ) : null}
    </Screen>
  );
}

function Attention({ d, approvals, canStock }: { d: Dashboard; approvals: number; canStock: boolean }) {
  const items: { icon: IconName; title: string; detail: string; tone: string; onPress: () => void }[] = [];
  if (d.jobs.overdue) items.push({ icon: 'alarm-outline', title: `${d.jobs.overdue} overdue job${d.jobs.overdue > 1 ? 's' : ''}`, detail: 'Visit date has passed', tone: colors.red, onPress: () => router.push({ pathname: '/jobs', params: { status: 'overdue', at: String(Date.now()) } }) });
  if (d.jobs.unassigned) items.push({ icon: 'person-add-outline', title: `${d.jobs.unassigned} unassigned`, detail: 'Waiting for a technician', tone: colors.amber, onPress: () => router.push({ pathname: '/jobs', params: { status: 'unassigned', at: String(Date.now()) } }) });
  if (approvals) items.push({ icon: 'checkmark-done-outline', title: `${approvals} waiting for approval`, detail: 'Expenses, leave and cash', tone: colors.brand, onPress: () => router.push({ pathname: '/approvals', params: { at: String(Date.now()) } }) });
  if (canStock && d.inventory.low_stock_count) items.push({ icon: 'cube-outline', title: `${d.inventory.low_stock_count} item${d.inventory.low_stock_count > 1 ? 's' : ''} low on stock`, detail: 'At or below reorder level', tone: colors.violet, onPress: () => router.push({ pathname: '/stock', params: { low: '1' } }) });
  if (!items.length) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: radius.md, backgroundColor: colors.greenSoft }}>
        <Icon name="checkmark-circle" color={colors.green} />
        <Text style={{ color: colors.green, fontWeight: '600' }}>All clear – nothing needs your attention.</Text>
      </View>
    );
  }
  return (
    <Card title="Needs attention" padded={false}>
      {items.map((it, i) => (
        <ListRow key={it.title} first={i === 0} icon={it.icon} tone={it.tone} title={it.title} detail={it.detail} onPress={it.onPress} />
      ))}
    </Card>
  );
}

function Legend() {
  return (
    <View style={{ flexDirection: 'row', gap: 10 }}>
      {[
        [colors.brand, 'Logged'],
        [colors.accent, 'Completed'],
      ].map(([c, l]) => (
        <View key={l} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: c }} />
          <Text style={{ fontSize: 11, color: colors.muted }}>{l}</Text>
        </View>
      ))}
    </View>
  );
}

/** Paired daily bars: jobs logged vs completed. */
function Trend({ data }: { data: Dashboard['jobs']['trend'] }) {
  const max = Math.max(1, ...data.flatMap((p) => [p.created, p.completed]));
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 96, gap: 4 }} accessibilityLabel="Jobs logged and completed per day">
      {data.map((p) => (
        <View key={p.date} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 1, height: 80 }}>
            <View style={{ width: 5, borderRadius: 2, height: Math.max(2, (p.created / max) * 80), backgroundColor: colors.brand }} />
            <View style={{ width: 5, borderRadius: 2, height: Math.max(2, (p.completed / max) * 80), backgroundColor: colors.accent }} />
          </View>
          <Text style={{ fontSize: 9, color: colors.faint }}>{Number(p.date.slice(8))}</Text>
        </View>
      ))}
    </View>
  );
}

function MethodBars({ byMethod }: { byMethod: Record<string, number> }) {
  const rows = Object.entries(byMethod).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  if (!rows.length) return <Muted style={{ marginTop: 10 }}>No collections yet this month.</Muted>;
  const max = rows[0]![1];
  return (
    <View style={{ gap: 8, marginTop: 12 }}>
      {rows.map(([m, v]) => (
        <View key={m} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ width: 92, fontSize: 12, color: colors.muted }} numberOfLines={1}>
            {METHOD_LABEL[m] ?? m}
          </Text>
          <View style={{ flex: 1, height: 10, borderRadius: 5, backgroundColor: colors.bg }}>
            <View style={{ width: `${(v / max) * 100}%`, height: 10, borderRadius: 5, backgroundColor: colors.brand }} />
          </View>
          <Text style={{ width: 60, textAlign: 'right', fontSize: 12, fontWeight: '600', color: colors.text }}>{moneyShort(v)}</Text>
        </View>
      ))}
    </View>
  );
}

function MiniStat({ label, value, tone, onPress }: { label: string; value: string; tone: string; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => ({ flex: 1, padding: 12, borderRadius: radius.sm, backgroundColor: pressed ? colors.border : colors.bg })}>
      <Text style={{ fontSize: 12, color: colors.muted }}>{label}</Text>
      <Text style={{ fontSize: 17, fontWeight: '700', color: tone }}>{value}</Text>
    </Pressable>
  );
}

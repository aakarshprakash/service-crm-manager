import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { api, type Envelope, type Paginated } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useDebounced, useStaffOptions } from '@/lib/hooks';
import type { Job, JobStatus } from '@/lib/types';
import { JobCard } from '@/components/JobCard';
import { Chip, SelectSheet } from '@/components/pickers';
import { Empty, ErrorView, Icon, Input, Loading } from '@/components/ui';
import { Text } from '@/components/Text';
import { colors } from '@/components/theme';

type View_ = 'active' | 'today' | 'overdue' | 'unassigned' | JobStatus;

const VIEWS: { value: View_; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'today', label: 'Today' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'unassigned', label: 'Unassigned' },
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'pending', label: 'Pending' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

function params(view: View_): Record<string, string> {
  switch (view) {
    case 'active':
      return { status: 'open,in_progress,pending', sort: 'priority' };
    case 'today':
      return { today: '1', sort: 'scheduled' };
    case 'overdue':
      return { overdue: '1', sort: 'scheduled' };
    case 'unassigned':
      return { technician_id: 'unassigned', status: 'open,pending', sort: 'oldest' };
    default:
      return { status: view };
  }
}

export default function Jobs() {
  const { can } = useAuth();
  const p = useLocalSearchParams<{ status?: string; at?: string }>();
  const [view, setView] = useState<View_>('active');
  const [search, setSearch] = useState('');
  const [tech, setTech] = useState<number | null>(null);
  const [pickTech, setPickTech] = useState(false);
  const q = useDebounced(search.trim(), 350);
  const techs = useStaffOptions('technician');

  // Dashboard tiles open this tab with a filter.
  useEffect(() => {
    if (p.status && VIEWS.some((v) => v.value === p.status)) setView(p.status as View_);
  }, [p.status, p.at]);

  const filter = useMemo(() => ({ ...params(view), ...(tech && view !== 'unassigned' ? { technician_id: String(tech) } : {}), search: q || undefined }), [view, tech, q]);
  const list = useInfiniteQuery({
    queryKey: ['jobs', filter],
    queryFn: ({ pageParam }) => api.get<Paginated<Job>>('/jobs', { ...filter, page: pageParam, per_page: 20 }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.meta.current_page < last.meta.last_page ? last.meta.current_page + 1 : undefined),
    placeholderData: keepPreviousData,
  });
  const counts = useQuery({
    queryKey: ['jobs', 'counts', tech],
    queryFn: () => api.get<Envelope<Record<JobStatus, number>>>('/jobs/counts', { technician_id: tech ?? undefined }).then((r) => r.data),
  });
  const rows = list.data?.pages.flatMap((pg) => pg.data) ?? [];
  const total = list.data?.pages[0]?.meta.total;
  const techName = techs.data?.find((t) => t.id === tech)?.name;
  const c = counts.data;
  const countFor = (v: View_) => (c ? (v === 'active' ? c.open + c.in_progress + c.pending : (c as Record<string, number>)[v]) : undefined);

  return (
    <View style={{ flex: 1 }}>
      <View style={{ backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: colors.border, paddingTop: 10, gap: 10 }}>
        <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16 }}>
          <View style={{ flex: 1 }}>
            <Input value={search} onChangeText={setSearch} placeholder="Call ID, phone, name or serial" autoCorrect={false} returnKeyType="search" style={{ paddingLeft: 40, height: 44 }} />
            <View style={{ position: 'absolute', left: 12, top: 12 }} pointerEvents="none">
              <Icon name="search" size={19} color={colors.faint} />
            </View>
          </View>
          <Pressable
            onPress={() => setPickTech(true)}
            accessibilityLabel={techName ? `Technician filter: ${techName}` : 'Filter by technician'}
            style={{ width: 44, height: 44, borderRadius: 12, borderWidth: 1, borderColor: tech ? colors.brand : colors.border, backgroundColor: tech ? colors.brandSoft : '#fff', alignItems: 'center', justifyContent: 'center' }}
          >
            <Icon name="person-circle-outline" size={22} color={tech ? colors.brand : colors.muted} />
          </Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingHorizontal: 16, paddingBottom: 10 }}>
          {tech && <Chip label={`${techName ?? 'Technician'} ✕`} on onPress={() => setTech(null)} tone={colors.violet} />}
          {VIEWS.map((v) => (
            <Chip key={v.value} label={v.label} on={view === v.value} onPress={() => setView(v.value)} count={['active', 'open', 'in_progress', 'pending'].includes(v.value) ? countFor(v.value) : undefined} />
          ))}
        </ScrollView>
      </View>

      {list.isLoading ? (
        <Loading />
      ) : list.error && !rows.length ? (
        <ErrorView error={list.error} onRetry={list.refetch} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(j) => String(j.id)}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 96 }}
          renderItem={({ item }) => <JobCard job={item} />}
          onEndReachedThreshold={0.4}
          onEndReached={() => list.hasNextPage && !list.isFetchingNextPage && list.fetchNextPage()}
          refreshControl={<RefreshControl refreshing={list.isRefetching && !list.isFetchingNextPage} onRefresh={() => { list.refetch(); counts.refetch(); }} colors={[colors.brand]} />}
          ListHeaderComponent={total !== undefined && rows.length ? <Text style={{ color: colors.muted, fontSize: 12 }}>{total} job{total === 1 ? '' : 's'}</Text> : null}
          ListFooterComponent={list.isFetchingNextPage ? <ActivityIndicator color={colors.brand} style={{ padding: 16 }} /> : null}
          ListEmptyComponent={<Empty icon="clipboard-outline" title={q ? `Nothing matches “${q}”` : 'No jobs here'} message={view === 'overdue' ? 'Every open job is on schedule.' : view === 'unassigned' ? 'Every open job has a technician.' : undefined} />}
        />
      )}

      {can('jobs.manage') && (
        <Pressable
          onPress={() => router.push('/job/new')}
          accessibilityRole="button"
          accessibilityLabel="New job"
          style={({ pressed }) => ({ position: 'absolute', right: 18, bottom: 18, width: 58, height: 58, borderRadius: 29, backgroundColor: pressed ? colors.brandDark : colors.brand, alignItems: 'center', justifyContent: 'center', elevation: 6, shadowColor: '#0B2545', shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } })}
        >
          <Icon name="add" size={30} color="#fff" />
        </Pressable>
      )}

      <SelectSheet
        open={pickTech}
        onClose={() => setPickTech(false)}
        title="Technician"
        value={tech ?? undefined}
        onSelect={(v) => setTech(v)}
        options={(techs.data ?? []).map((t) => ({ value: t.id, label: t.name, detail: t.punch_status === 'in' ? 'On duty' : 'Off duty', tone: t.punch_status === 'in' ? colors.green : undefined }))}
      />
    </View>
  );
}

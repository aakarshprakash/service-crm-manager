import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import { api, type Paginated } from '@/lib/api';
import { useDebounced } from '@/lib/hooks';
import { date, money, moneyShort } from '@/lib/format';
import type { Invoice } from '@/lib/types';
import { Text } from '@/components/Text';
import { Badge, Empty, ErrorView, Icon, Input, Loading, Muted } from '@/components/ui';
import { Chip } from '@/components/pickers';
import { colors, radius, shadow } from '@/components/theme';

const FILTERS = [
  { value: 'unpaid,partial', label: 'Due' },
  { value: '', label: 'All' },
  { value: 'paid', label: 'Paid' },
  { value: 'credit', label: 'On credit' },
  { value: 'walk_in', label: 'Walk-in' },
];

export default function Money() {
  const p = useLocalSearchParams<{ status?: string; credit?: string; at?: string }>();
  const [filter, setFilter] = useState('unpaid,partial');
  const [search, setSearch] = useState('');
  const q = useDebounced(search.trim(), 350);
  useEffect(() => {
    if (p.credit === '1') setFilter('credit');
    else if (p.status) setFilter(p.status);
  }, [p.status, p.credit, p.at]);

  const params = useMemo(() => {
    const out: Record<string, string> = {};
    if (filter === 'credit') Object.assign(out, { credit: '1', payment_status: 'unpaid,partial' });
    else if (filter === 'walk_in') out.source = 'walk_in';
    else if (filter) out.payment_status = filter;
    if (q) out.search = q;
    return out;
  }, [filter, q]);

  const list = useInfiniteQuery({
    queryKey: ['invoices', params],
    queryFn: ({ pageParam }) => api.get<Paginated<Invoice>>('/invoices', { ...params, page: pageParam, per_page: 20 }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.meta.current_page < last.meta.last_page ? last.meta.current_page + 1 : undefined),
    placeholderData: keepPreviousData,
  });
  const rows = list.data?.pages.flatMap((pg) => pg.data) ?? [];
  const totals = list.data?.pages[0]?.meta.totals as { total: number; paid: number; balance: number } | undefined;

  return (
    <View style={{ flex: 1 }}>
      <View style={{ backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: colors.border, paddingTop: 10, gap: 10 }}>
        {totals && (
          <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16 }}>
            <Total label="Invoiced" value={moneyShort(totals.total)} tone={colors.navy} />
            <Total label="Received" value={moneyShort(totals.paid)} tone={colors.green} />
            <Total label="Balance due" value={moneyShort(totals.balance)} tone={totals.balance ? colors.red : colors.muted} />
          </View>
        )}
        <View style={{ paddingHorizontal: 16 }}>
          <Input value={search} onChangeText={setSearch} placeholder="Invoice no., call ID, customer or phone" autoCorrect={false} style={{ paddingLeft: 40, height: 44 }} />
          <View style={{ position: 'absolute', left: 28, top: 12 }} pointerEvents="none">
            <Icon name="search" size={19} color={colors.faint} />
          </View>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingHorizontal: 16, paddingBottom: 10 }}>
          {FILTERS.map((f) => (
            <Chip key={f.label} label={f.label} on={filter === f.value} onPress={() => setFilter(f.value)} />
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
          keyExtractor={(i) => String(i.id)}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 32 }}
          onEndReachedThreshold={0.4}
          onEndReached={() => list.hasNextPage && !list.isFetchingNextPage && list.fetchNextPage()}
          refreshControl={<RefreshControl refreshing={list.isRefetching && !list.isFetchingNextPage} onRefresh={list.refetch} colors={[colors.brand]} />}
          ListFooterComponent={list.isFetchingNextPage ? <ActivityIndicator color={colors.brand} style={{ padding: 16 }} /> : null}
          ListEmptyComponent={<Empty icon="receipt-outline" title={filter === 'unpaid,partial' ? 'Nothing due – all collected' : 'No invoices'} />}
          renderItem={({ item: i }) => (
            <Pressable onPress={() => router.push(`/invoice/${i.id}`)} style={({ pressed }) => [{ backgroundColor: '#fff', borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: 14, gap: 4, ...shadow }, pressed && { opacity: 0.85 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ fontWeight: '700', color: colors.text, flex: 1 }}>{i.invoice_number}</Text>
                {i.is_credit && i.balance_amount > 0 && <Badge text="Credit" tone="in_progress" />}
                <Badge text={i.payment_status} />
              </View>
              <Text style={{ color: colors.text }} numberOfLines={1}>
                {i.customer?.name}
                <Text style={{ color: colors.muted }}> · {i.source === 'walk_in' ? 'Walk-in' : i.job?.crm_call_id}</Text>
              </Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Muted style={{ fontSize: 12 }}>
                  {date(i.generated_at)}
                  {i.job?.technician ? ` · ${i.job.technician.name}` : ''}
                </Muted>
                <Text style={{ fontSize: 13, color: colors.text }}>
                  {money(i.total_amount)}
                  {i.balance_amount > 0 && <Text style={{ color: colors.red, fontWeight: '700' }}> · due {money(i.balance_amount)}</Text>}
                </Text>
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

function Total({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <View style={{ flex: 1, padding: 10, borderRadius: radius.sm, backgroundColor: colors.bg }}>
      <Text style={{ fontSize: 11, color: colors.muted }}>{label}</Text>
      <Text style={{ fontSize: 16, fontWeight: '800', color: tone }}>{value}</Text>
    </View>
  );
}

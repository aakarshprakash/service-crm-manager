import { useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import { api, type Paginated } from '@/lib/api';
import { useDebounced } from '@/lib/hooks';
import { money, qty } from '@/lib/format';
import type { StockRow } from '@/lib/types';
import { Text } from '@/components/Text';
import { Empty, ErrorView, Icon, Input, Loading, Muted } from '@/components/ui';
import { Chip } from '@/components/pickers';
import { colors, radius } from '@/components/theme';

export default function Stock() {
  const p = useLocalSearchParams<{ low?: string }>();
  const [low, setLow] = useState(p.low === '1');
  const [search, setSearch] = useState('');
  const q = useDebounced(search.trim(), 350);
  const list = useInfiniteQuery({
    queryKey: ['stock', low, q],
    queryFn: ({ pageParam }) => api.get<Paginated<StockRow>>('/inventory/stock', { low_stock: low ? 1 : undefined, search: q || undefined, page: pageParam, per_page: 30 }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.meta.current_page < last.meta.last_page ? last.meta.current_page + 1 : undefined),
    placeholderData: keepPreviousData,
  });
  const rows = list.data?.pages.flatMap((pg) => pg.data) ?? [];
  return (
    <View style={{ flex: 1 }}>
      <View style={{ padding: 16, paddingBottom: 10, gap: 10, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <View>
          <Input value={search} onChangeText={setSearch} placeholder="Part name or code" autoCorrect={false} style={{ paddingLeft: 40, height: 44 }} />
          <View style={{ position: 'absolute', left: 12, top: 12 }} pointerEvents="none">
            <Icon name="search" size={19} color={colors.faint} />
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <Chip label="All items" on={!low} onPress={() => setLow(false)} />
          <Chip label="Low stock" on={low} onPress={() => setLow(true)} tone={colors.red} />
        </View>
      </View>
      {list.isLoading ? (
        <Loading />
      ) : list.error && !rows.length ? (
        <ErrorView error={list.error} onRetry={list.refetch} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => String(r.id)}
          contentContainerStyle={{ padding: 16, gap: 8 }}
          onEndReachedThreshold={0.4}
          onEndReached={() => list.hasNextPage && !list.isFetchingNextPage && list.fetchNextPage()}
          refreshControl={<RefreshControl refreshing={list.isRefetching && !list.isFetchingNextPage} onRefresh={list.refetch} colors={[colors.brand]} />}
          ListFooterComponent={list.isFetchingNextPage ? <ActivityIndicator color={colors.brand} style={{ padding: 16 }} /> : null}
          ListEmptyComponent={<Empty icon="cube-outline" title={low ? 'Nothing is low on stock' : 'No stock found'} />}
          renderItem={({ item: r }) => {
            const n = Number(r.quantity_available);
            const isLow = !!Number(r.is_low);
            return (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.md, backgroundColor: '#fff', borderWidth: 1, borderColor: isLow ? colors.red + '40' : colors.border }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '600', color: colors.text }} numberOfLines={1}>
                    {r.name}
                  </Text>
                  <Muted style={{ fontSize: 12 }}>
                    {r.code} · {r.branch_name} · {money(r.unit_price)}
                  </Muted>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontSize: 17, fontWeight: '800', color: n <= 0 ? colors.red : isLow ? colors.amber : colors.text }}>{qty(n)}</Text>
                  <Muted style={{ fontSize: 11 }}>
                    {r.unit_of_measure}
                    {r.reorder_level > 0 ? ` · min ${qty(r.reorder_level)}` : ''}
                  </Muted>
                </View>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

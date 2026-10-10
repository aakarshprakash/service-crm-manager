import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, View } from 'react-native';
import { router } from 'expo-router';
import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import { api, type Paginated } from '@/lib/api';
import { useDebounced } from '@/lib/hooks';
import type { Customer } from '@/lib/types';
import { Text } from '@/components/Text';
import { Empty, ErrorView, Icon, Input, Loading, Muted } from '@/components/ui';
import { colors, radius } from '@/components/theme';

export default function Customers() {
  const [search, setSearch] = useState('');
  const q = useDebounced(search.trim(), 350);
  const list = useInfiniteQuery({
    queryKey: ['customers', q],
    queryFn: ({ pageParam }) => api.get<Paginated<Customer>>('/customers', { search: q || undefined, page: pageParam, per_page: 25 }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.meta.current_page < last.meta.last_page ? last.meta.current_page + 1 : undefined),
    placeholderData: keepPreviousData,
  });
  const rows = list.data?.pages.flatMap((p) => p.data) ?? [];
  return (
    <View style={{ flex: 1 }}>
      <View style={{ padding: 16, paddingBottom: 8, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <Input value={search} onChangeText={setSearch} placeholder="Name, phone, CRM ID or serial number" autoCorrect={false} style={{ paddingLeft: 40, height: 44 }} />
        <View style={{ position: 'absolute', left: 28, top: 28 }} pointerEvents="none">
          <Icon name="search" size={19} color={colors.faint} />
        </View>
      </View>
      {list.isLoading ? (
        <Loading />
      ) : list.error && !rows.length ? (
        <ErrorView error={list.error} onRetry={list.refetch} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(c) => String(c.id)}
          contentContainerStyle={{ padding: 16, gap: 8 }}
          onEndReachedThreshold={0.4}
          onEndReached={() => list.hasNextPage && !list.isFetchingNextPage && list.fetchNextPage()}
          refreshControl={<RefreshControl refreshing={list.isRefetching && !list.isFetchingNextPage} onRefresh={list.refetch} colors={[colors.brand]} />}
          ListFooterComponent={list.isFetchingNextPage ? <ActivityIndicator color={colors.brand} style={{ padding: 16 }} /> : null}
          ListEmptyComponent={<Empty icon="people-outline" title={q ? `No customer matches “${q}”` : 'No customers yet'} />}
          renderItem={({ item: c }) => (
            <Pressable onPress={() => router.push(`/customer/${c.id}`)} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.md, backgroundColor: pressed ? colors.bg : '#fff', borderWidth: 1, borderColor: colors.border })}>
              <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: colors.brand, fontWeight: '700' }}>{c.name.slice(0, 1).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '600', color: colors.text }} numberOfLines={1}>
                  {c.name}
                </Text>
                <Muted style={{ fontSize: 12 }}>
                  {c.phone}
                  {c.city ? ` · ${c.city}` : ''}
                </Muted>
              </View>
              <Muted style={{ fontSize: 12 }}>{c.jobs_count ?? 0} job{c.jobs_count === 1 ? '' : 's'}</Muted>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

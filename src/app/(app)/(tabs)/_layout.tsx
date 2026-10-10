import { Image, Pressable, View, type ColorValue } from 'react-native';
import { Tabs } from 'expo-router/js-tabs';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { api, type Paginated } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApprovalCounts, useApprovalKinds } from '@/lib/approvals';
import type { NotificationItem } from '@/lib/types';
import { FONT, Text } from '@/components/Text';
import { colors } from '@/components/theme';

function Bell() {
  const q = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get<Paginated<NotificationItem> & { meta: { unread: number } }>('/notifications', { per_page: 30 }),
    refetchInterval: 60_000,
  });
  const unread = (q.data?.meta.unread as number) ?? 0;
  return (
    <Pressable onPress={() => router.push('/notifications')} hitSlop={10} style={{ marginRight: 16 }} accessibilityLabel={`Notifications, ${unread} unread`}>
      <Ionicons name="notifications-outline" size={24} color={colors.navy} />
      {unread > 0 && (
        <View style={{ position: 'absolute', right: -12, top: -7, minWidth: 28, height: 20, paddingHorizontal: 3, borderRadius: 10, backgroundColor: colors.red, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' }}>
          <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700', includeFontPadding: false, textAlign: 'center' }}>{unread > 9 ? '9+' : unread}</Text>
        </View>
      )}
    </Pressable>
  );
}

/** SERVON wordmark with the Manager tag. */
function Brand() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Image source={require('../../../../assets/logo-mark.png')} style={{ width: 28, height: 28 }} resizeMode="contain" accessibilityIgnoresInvertColors />
      <Text style={{ fontSize: 19, fontWeight: '800', color: colors.navy, letterSpacing: 0.5 }}>SERVON</Text>
      <View style={{ paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6, backgroundColor: colors.accentSoft }}>
        <Text style={{ fontSize: 10, fontWeight: '700', color: colors.green, letterSpacing: 1 }}>MANAGER</Text>
      </View>
    </View>
  );
}

const icon =
  (outline: keyof typeof Ionicons.glyphMap, filled: keyof typeof Ionicons.glyphMap) =>
  ({ color, size, focused }: { color: ColorValue; size: number; focused: boolean }) => <Ionicons name={focused ? filled : outline} size={size} color={color as string} />;

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const { can } = useAuth();
  const kinds = useApprovalKinds();
  const counts = useApprovalCounts();
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.faint,
        tabBarLabelStyle: { fontFamily: FONT.semibold, fontSize: 11 },
        tabBarStyle: { borderTopColor: colors.border, height: 60 + insets.bottom, paddingTop: 6, paddingBottom: insets.bottom + 4 },
        tabBarBadgeStyle: { backgroundColor: colors.red, fontSize: 10, fontFamily: FONT.bold },
        headerRight: () => <Bell />,
        headerTitleStyle: { fontFamily: FONT.bold, fontSize: 19, color: colors.text },
        headerShadowVisible: false,
        headerStyle: { backgroundColor: '#fff' },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', headerTitle: () => <Brand />, tabBarIcon: icon('grid-outline', 'grid') }} />
      <Tabs.Screen name="jobs" options={{ title: 'Jobs', tabBarIcon: icon('clipboard-outline', 'clipboard') }} />
      <Tabs.Screen
        name="approvals"
        options={{
          title: 'Approvals',
          href: kinds.length ? undefined : null,
          tabBarBadge: counts.total ? (counts.total > 99 ? '99+' : counts.total) : undefined,
          tabBarIcon: icon('checkmark-done-circle-outline', 'checkmark-done-circle'),
        }}
      />
      <Tabs.Screen name="money" options={{ title: 'Money', href: can('invoices.view') ? undefined : null, tabBarIcon: icon('wallet-outline', 'wallet') }} />
      <Tabs.Screen name="more" options={{ title: 'More', tabBarIcon: icon('menu-outline', 'menu') }} />
    </Tabs>
  );
}

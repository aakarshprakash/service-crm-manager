import { useState } from 'react';
import { Alert, View } from 'react-native';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { getPushStatus, registerForPush } from '@/lib/push';
import { Text } from '@/components/Text';
import { Button, Card, ListRow, Muted, Screen } from '@/components/ui';
import { toast } from '@/components/toast';
import { colors } from '@/components/theme';

export default function More() {
  const { user, can, logout } = useAuth();
  const [testing, setTesting] = useState(false);

  const testPush = async () => {
    setTesting(true);
    try {
      const status = await registerForPush();
      if (status === 'denied') return toast.error('Notifications are turned off for Servon Manager in your phone settings.');
      if (status !== 'registered') return toast.error('Push notifications are not available on this phone.');
      await api.post('/auth/device/test');
      toast.success('Test notification sent – it should arrive in a few seconds.');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setTesting(false);
    }
  };

  const links = [
    can('customers.view') && { icon: 'people-outline' as const, title: 'Customers', detail: 'Search, history, start a job', to: '/customers' },
    can('inventory.view') && { icon: 'cube-outline' as const, title: 'Stock', detail: 'Parts on hand and low stock', to: '/stock', tone: colors.violet },
    { icon: 'id-card-outline' as const, title: 'Team today', detail: can('hr.view') ? 'Attendance and who is on duty' : 'Technicians on duty', to: '/team', tone: colors.green },
    { icon: 'notifications-outline' as const, title: 'Notifications', detail: 'Alerts sent to you', to: '/notifications', tone: colors.amber },
  ].filter(Boolean) as { icon: 'people-outline'; title: string; detail: string; to: string; tone?: string }[];

  return (
    <Screen>
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#fff', fontSize: 20, fontWeight: '700' }}>{user?.name.slice(0, 1)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text }}>{user?.name}</Text>
            <Muted>
              {user?.role_label} · {user?.tenant?.name}
            </Muted>
            <Muted style={{ fontSize: 12 }}>{user?.email ?? user?.phone}</Muted>
          </View>
        </View>
      </Card>

      <Card padded={false}>
        {links.map((l, i) => (
          <ListRow key={l.to} first={i === 0} icon={l.icon} title={l.title} detail={l.detail} tone={l.tone} onPress={() => router.push(l.to as never)} />
        ))}
      </Card>

      <Card title="Push notifications">
        <Muted>New complaints from customers, cash closes to verify, expense and leave requests, low stock and a 9:30 am summary of overdue and unassigned jobs.</Muted>
        <Button title="Send a test notification" icon="notifications-outline" variant="secondary" size="sm" loading={testing} onPress={testPush} style={{ marginTop: 10, alignSelf: 'flex-start' }} />
        {getPushStatus() === 'denied' && <Text style={{ color: colors.amber, marginTop: 6, fontSize: 12 }}>Notifications are blocked in phone settings.</Text>}
      </Card>

      <Button
        title="Sign out"
        icon="log-out-outline"
        variant="secondary"
        onPress={() =>
          Alert.alert('Sign out?', 'You will stop getting notifications on this phone.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Sign out', style: 'destructive', onPress: () => void logout() },
          ])
        }
      />
      <Muted style={{ textAlign: 'center', fontSize: 12 }}>Servon Manager v{Constants.expoConfig?.version}</Muted>
    </Screen>
  );
}

import { View } from 'react-native';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/lib/auth';
import { ForcePasswordChange } from '@/components/ChangePassword';
import { FONT } from '@/components/Text';
import { colors } from '@/components/theme';

export default function AppLayout() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  // A temporary password from the admin must be replaced before anything else.
  if (user?.must_change_password) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
        <ForcePasswordChange />
      </View>
    );
  }
  return (
    <Stack
      screenOptions={{
        headerTintColor: colors.navy,
        headerTitleStyle: { color: colors.text, fontFamily: FONT.bold, fontSize: 18 },
        headerShadowVisible: false,
        headerStyle: { backgroundColor: '#fff' },
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="job/[id]" options={{ title: 'Job' }} />
      <Stack.Screen name="job/new" options={{ title: 'New job' }} />
      <Stack.Screen name="invoice/[id]" options={{ title: 'Invoice' }} />
      <Stack.Screen name="cash/[id]" options={{ title: 'Cash close' }} />
      <Stack.Screen name="customers" options={{ title: 'Customers' }} />
      <Stack.Screen name="customer/[id]" options={{ title: 'Customer' }} />
      <Stack.Screen name="stock" options={{ title: 'Stock' }} />
      <Stack.Screen name="team" options={{ title: 'Team today' }} />
      <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
    </Stack>
  );
}

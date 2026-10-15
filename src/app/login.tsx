import { useRef, useState } from 'react';
import { Image, KeyboardAvoidingView, Pressable, ScrollView, View } from 'react-native';
import { Text } from '@/components/Text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Constants from 'expo-constants';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Button, Field, Icon, Input, Muted } from '@/components/ui';
import { colors } from '@/components/theme';

/** Office staff (admin, coordinator, accountant) sign in with email or mobile number + password. */
export default function Login() {
  const { login } = useAuth();
  const [form, setForm] = useState({ login: '', password: '', company: '' });
  const [showCompany, setShowCompany] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  const [secure, setSecure] = useState(true);
  const scroll = useRef<ScrollView>(null);
  // Keep the Sign in button above the keyboard once a field is focused.
  const reveal = () => setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 250);
  // The API reports bad credentials on "email" (web form name) or "login".
  const loginError = error?.field('login') ?? error?.field('email');

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await login(form.login, form.password, form.company);
    } catch (e) {
      const err = e instanceof ApiError ? e : new ApiError(0, (e as Error).message);
      setError(err);
      if (err.field('company')) setShowCompany(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.navy }}>
      <StatusBar style="light" />
      {/* Android draws edge to edge, so the window no longer shrinks for the keyboard: pad on both platforms. */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView ref={scroll} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24, gap: 22 }} keyboardShouldPersistTaps="handled">
          <View style={{ alignItems: 'center', gap: 8 }}>
            <View style={{ width: 76, height: 76, borderRadius: 20, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
              <Image source={require('../../assets/logo-mark.png')} style={{ width: 54, height: 54 }} resizeMode="contain" accessibilityLabel="Servon" />
            </View>
            <Text style={{ fontSize: 28, fontWeight: '800', color: '#fff', letterSpacing: 1 }}>SERVON</Text>
            <View style={{ paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, backgroundColor: colors.accent }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#fff', letterSpacing: 1.5 }}>MANAGER</Text>
            </View>
            <Text style={{ color: '#CBD5E1', textAlign: 'center', marginTop: 4 }}>Run your service business from your phone</Text>
          </View>

          <View style={{ gap: 14, backgroundColor: '#fff', borderRadius: 18, padding: 18 }}>
            <Field label="Email or mobile number" error={loginError}>
              <Input value={form.login} onChangeText={(v) => setForm({ ...form, login: v })} autoCapitalize="none" autoComplete="username" keyboardType="email-address" textContentType="username" onFocus={reveal} placeholder="you@company.com or 98765 43210" />
            </Field>
            <Field label="Password" error={error?.field('password')}>
              <View>
                <Input value={form.password} onChangeText={(v) => setForm({ ...form, password: v })} secureTextEntry={secure} autoComplete="password" textContentType="password" onFocus={reveal} onSubmitEditing={submit} style={{ paddingRight: 48 }} />
                <Pressable onPress={() => setSecure((s) => !s)} hitSlop={10} style={{ position: 'absolute', right: 12, top: 12 }} accessibilityLabel={secure ? 'Show password' : 'Hide password'}>
                  <Icon name={secure ? 'eye-outline' : 'eye-off-outline'} color={colors.muted} />
                </Pressable>
              </View>
            </Field>
            {showCompany && (
              <Field label="Company code" error={error?.field('company')} hint="The name in your company’s Servon portal link.">
                <Input value={form.company} onChangeText={(v) => setForm({ ...form, company: v })} autoCapitalize="none" />
              </Field>
            )}
            {error && !loginError && !error.field('password') && !error.field('company') && <Text style={{ color: colors.red }}>{error.message}</Text>}
            <Button title="Sign in" size="lg" loading={busy} disabled={!form.login || !form.password} onPress={submit} />
            <Muted style={{ fontSize: 12, textAlign: 'center' }}>For admins, coordinators and accountants. Technicians use the Servon Technician app.</Muted>
          </View>

          <View style={{ alignItems: 'center', gap: 4 }}>
            <Text style={{ fontSize: 12, color: '#94A3B8' }}>Service Business, Simplified.</Text>
            <Text style={{ fontSize: 11, color: '#64748B' }}>v{Constants.expoConfig?.version} · Powered by <Text style={{ fontWeight: '700', letterSpacing: 1.5, color: '#94A3B8' }}>SYSNAC</Text></Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

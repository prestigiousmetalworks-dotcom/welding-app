import { useEffect, useState } from 'react';
import { Stack, router } from 'expo-router';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setReady(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (session) {
      router.replace('/(tabs)/analyze');
    } else {
      router.replace('/auth/sign-in');
    }
  }, [ready, session]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="auth/sign-in" />
      <Stack.Screen name="auth/sign-up" />
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}

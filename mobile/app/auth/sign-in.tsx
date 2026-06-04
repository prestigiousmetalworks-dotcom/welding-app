import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { Link } from 'expo-router';
import { supabase } from '../../lib/supabase';

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSignIn() {
    if (!email || !password) return;
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) Alert.alert('Sign in failed', error.message);
    // on success, _layout.tsx detects session and redirects automatically
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.inner}>
        <Text style={styles.logo}>DIMEVISION</Text>
        <Text style={styles.tagline}>Built for welders.</Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#626362"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#626362"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        <TouchableOpacity style={styles.button} onPress={handleSignIn} disabled={loading}>
          {loading
            ? <ActivityIndicator color="#000" />
            : <Text style={styles.buttonText}>SIGN IN</Text>
          }
        </TouchableOpacity>

        <Link href="/auth/sign-up" asChild>
          <TouchableOpacity style={styles.link}>
            <Text style={styles.linkText}>No account? <Text style={styles.linkAccent}>Create one</Text></Text>
          </TouchableOpacity>
        </Link>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#000' },
  inner:       { flex: 1, justifyContent: 'center', paddingHorizontal: 32 },
  logo:        { fontSize: 36, fontWeight: '900', color: '#CB2027', letterSpacing: 4, marginBottom: 4 },
  tagline:     { fontSize: 14, color: '#626362', marginBottom: 48, letterSpacing: 1 },
  input:       {
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 4,
    color: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    marginBottom: 12,
  },
  button:      {
    backgroundColor: '#CB2027',
    borderRadius: 4,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  buttonText:  { color: '#000', fontWeight: '800', fontSize: 15, letterSpacing: 2 },
  link:        { alignItems: 'center' },
  linkText:    { color: '#626362', fontSize: 14 },
  linkAccent:  { color: '#CB2027' },
});

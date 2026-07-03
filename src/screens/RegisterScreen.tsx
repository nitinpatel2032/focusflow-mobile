import { useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { isAxiosError } from 'axios';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { Header } from '../components/Header';
import { Screen } from '../components/Screen';
import { TextField } from '../components/TextField';
import { colors } from '../constants/colors';
import type { AuthStackParamList } from '../navigation/types';
import { useAuthStore } from '../store/authStore';

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

export function RegisterScreen({ navigation }: Props) {
  const registerAction = useAuthStore((state) => state.register);
  const verifyAction = useAuthStore((state) => state.verifyRegistration);

  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRegister() {
    if (!name.trim() || name.trim().length < 2) {
      setError('Name must be at least 2 characters.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    // Password validation mirroring Zod schema rules
    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    if (!/[A-Z]/.test(password)) {
      setError('Password must include an uppercase letter.');
      return;
    }
    if (!/[a-z]/.test(password)) {
      setError('Password must include a lowercase letter.');
      return;
    }
    if (!/[0-9]/.test(password)) {
      setError('Password must include a number.');
      return;
    }
    if (!/[^A-Za-z0-9]/.test(password)) {
      setError('Password must include a symbol (e.g. !@#$).');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await registerAction({ name: name.trim(), email: email.trim(), password });
      Alert.alert(
        'Verification Code Sent',
        'A 6-digit verification code has been sent to your email address to complete registration.'
      );
      setStep(2);
    } catch (err: unknown) {
      const msg =
        isAxiosError(err) && err.response?.data?.message
          ? err.response.data.message
          : 'Registration failed. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify() {
    if (!code.trim() || code.trim().length !== 6) {
      setError('Please enter the 6-digit verification code.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await verifyAction(email.trim(), code.trim());
      Alert.alert('Welcome!', 'Your email has been successfully verified. Welcome to FocusFlow!');
    } catch (err: unknown) {
      const msg =
        isAxiosError(err) && err.response?.data?.message
          ? err.response.data.message
          : 'Verification failed. Please verify the code and try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <Header
        title={step === 1 ? 'Create Account' : 'Verify Account'}
        subtitle={step === 1 ? 'Join FocusFlow and build regular study habits' : `We sent a code to ${email}`}
      />

      <View style={styles.form}>
        {error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {step === 1 ? (
          <>
            <TextField
              label="Full Name"
              value={name}
              onChangeText={(val) => {
                setName(val);
                setError(null);
              }}
              placeholder="e.g. John Doe"
            />
            <TextField
              label="Email Address"
              value={email}
              onChangeText={(val) => {
                setEmail(val);
                setError(null);
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholder="you@example.com"
            />
            <TextField
              label="Password"
              value={password}
              onChangeText={(val) => {
                setPassword(val);
                setError(null);
              }}
              secureTextEntry
              placeholder="At least 8 chars with uppercase, number & symbol"
            />
            <Button
              title="Sign Up & Verify"
              icon="mail-unread-outline"
              disabled={loading}
              onPress={handleRegister}
            />
          </>
        ) : (
          <>
            <TextField
              label="Verification Code (OTP)"
              value={code}
              onChangeText={(val) => {
                setCode(val.replace(/[^0-9]/g, '').slice(0, 6));
                setError(null);
              }}
              keyboardType="number-pad"
              placeholder="6-digit activation code"
            />
            <Button
              title="Verify & Create Account"
              icon="checkmark-done-outline"
              disabled={loading}
              onPress={handleVerify}
            />
            <Pressable onPress={() => setStep(1)} style={styles.backButton}>
              <Text style={styles.backButtonText}>Resend OTP / Edit registration details</Text>
            </Pressable>
          </>
        )}

        <Pressable onPress={() => navigation.navigate('Login')} style={styles.link}>
          <Text style={styles.linkText}>Back to login</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: 14,
    marginTop: 8
  },
  link: {
    alignItems: 'center',
    padding: 8
  },
  linkText: {
    color: colors.primary,
    fontWeight: '800'
  },
  backButton: {
    alignItems: 'center',
    padding: 8,
    marginTop: 4
  },
  backButtonText: {
    color: colors.muted,
    fontWeight: '700',
    fontSize: 13
  },
  errorContainer: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 4
  },
  errorText: {
    color: colors.danger,
    fontWeight: '700',
    fontSize: 13
  }
});

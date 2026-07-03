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
import * as authApi from '../api/authApi';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>;

export function ForgotPasswordScreen({ navigation }: Props) {
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRequestCode() {
    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await authApi.forgotPassword(email.trim());
      Alert.alert(
        'Code Sent',
        'If an account exists for this email, a 6-digit verification code has been sent. Please check your inbox (and spam folder).'
      );
      setStep(2);
    } catch (err: unknown) {
      const msg =
        isAxiosError(err) && err.response?.data?.message
          ? err.response.data.message
          : 'Failed to request reset code. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword() {
    if (!code.trim() || code.trim().length !== 6) {
      setError('Verification code must be exactly 6 digits.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await authApi.resetPassword({
        email: email.trim(),
        code: code.trim(),
        password: password
      });
      Alert.alert('Success', 'Your password has been successfully reset. Please login with your new password.', [
        { text: 'OK', onPress: () => navigation.navigate('Login') }
      ]);
    } catch (err: unknown) {
      const msg =
        isAxiosError(err) && err.response?.data?.message
          ? err.response.data.message
          : 'Failed to reset password. Please verify the code and try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <Header
        title="Reset Password"
        subtitle={step === 1 ? 'Enter your email to receive a recovery code' : 'Verify your code and choose a new password'}
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
              label="Email Address"
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                setError(null);
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholder="Enter your registered email"
            />
            <Button
              title="Send Recovery Code"
              icon="send-outline"
              disabled={loading}
              onPress={handleRequestCode}
            />
          </>
        ) : (
          <>
            <TextField
              label="Verification Code"
              value={code}
              onChangeText={(text) => {
                setCode(text.replace(/[^0-9]/g, '').slice(0, 6));
                setError(null);
              }}
              keyboardType="number-pad"
              placeholder="6-digit code"
            />
            <TextField
              label="New Password"
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                setError(null);
              }}
              secureTextEntry
              placeholder="At least 8 characters"
            />
            <TextField
              label="Confirm New Password"
              value={confirmPassword}
              onChangeText={(text) => {
                setConfirmPassword(text);
                setError(null);
              }}
              secureTextEntry
              placeholder="Repeat password"
            />
            <Button
              title="Reset Password"
              icon="checkmark-circle-outline"
              disabled={loading}
              onPress={handleResetPassword}
            />
            <Pressable onPress={() => setStep(1)} style={styles.backButton}>
              <Text style={styles.backButtonText}>Resend Code / Change Email</Text>
            </Pressable>
          </>
        )}

        <Pressable onPress={() => navigation.navigate('Login')} style={styles.link}>
          <Text style={styles.linkText}>Back to Login</Text>
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

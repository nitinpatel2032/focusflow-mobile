import { zodResolver } from '@hookform/resolvers/zod';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { isAxiosError } from 'axios';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { z } from 'zod';
import { Button } from '../components/Button';
import { Header } from '../components/Header';
import { Screen } from '../components/Screen';
import { TextField } from '../components/TextField';
import { colors } from '../constants/colors';
import type { AuthStackParamList } from '../navigation/types';
import { useAuthStore } from '../store/authStore';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

type FormValues = z.infer<typeof schema>;
type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export function LoginScreen({ navigation }: Props) {
  const signIn = useAuthStore((state) => state.login);
  const { control, handleSubmit, formState, setError } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' }
  });

  return (
    <Screen>
      <Header title="FocusFlow" subtitle="Open the book. Start the timer. Keep going." />
      <View style={styles.form}>
        <Controller
          control={control}
          name="email"
          render={({ field, fieldState }) => (
            <TextField
              label="Email"
              value={field.value}
              onChangeText={field.onChange}
              keyboardType="email-address"
              error={fieldState.error?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="password"
          render={({ field, fieldState }) => (
            <TextField
              label="Password"
              value={field.value}
              onChangeText={field.onChange}
              secureTextEntry
              error={fieldState.error?.message}
            />
          )}
        />
        {formState.errors.root ? <Text style={styles.error}>{formState.errors.root.message}</Text> : null}
        <Button
          title="Login"
          icon="log-in-outline"
          disabled={formState.isSubmitting}
          onPress={handleSubmit(async (values) => {
            try {
              await signIn(values.email, values.password);
            } catch (err: unknown) {
              const message =
                isAxiosError(err) && err.response?.data?.message
                  ? err.response.data.message
                  : 'Login failed. Please try again.';
              setError('root', { message });
            }
          })}
        />
        <Pressable onPress={() => navigation.navigate('ForgotPassword')} style={styles.link}>
          <Text style={styles.linkText}>Forgot password?</Text>
        </Pressable>
        <Pressable onPress={() => navigation.navigate('Register')} style={[styles.link, { marginTop: -8 }]}>
          <Text style={styles.linkText}>Create account</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: 14
  },
  link: {
    alignItems: 'center',
    padding: 8
  },
  linkText: {
    color: colors.primary,
    fontWeight: '800'
  },
  error: {
    color: colors.danger
  }
});

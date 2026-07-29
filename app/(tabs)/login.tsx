import React, { useState } from "react";
import { View, Text, Alert, KeyboardAvoidingView, ScrollView, Platform } from "react-native";
import { useRouter } from "expo-router";
import { Header, Button, Card } from "../../src/components/ui";
import { auth } from "../../src/services/auth";
import { Input } from "../../src/components/ui/Input";

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    setError(null);
    if (!email || !password) {
      setError("Email dan kata sandi harus diisi");
      return;
    }

    setLoading(true);
    try {
      const result = await auth.signIn(email, password);
      Alert.alert("Berhasil", `Selamat datang, ${result.profile.displayName}!`);
      router.replace("/(tabs)");
    } catch (err: any) {
      setError(err.message || "Login gagal");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1 bg-slate-50">
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <Header title="Masuk" subtitle="Masukkan kredensial untuk WASTEX" />
        <View className="px-6 pt-6">
          <Card className="p-6">
            <Input
              label="Email"
              placeholder="nama@example.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <Input
              label="Kata Sandi"
              placeholder="••••••••"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
            {error && <Text className="text-xs text-red-600 mb-4">{error}</Text>}
            <Button
              title="Masuk"
              onPress={handleLogin}
              loading={loading}
              fullWidth
              className="mt-4"
            />
            <View className="flex-row justify-center mt-6">
              <Text className="text-sm text-slate-600">Belum punya akun? </Text>
              <Text 
                className="text-sm text-brand font-semibold" 
                onPress={() => router.push("/(tabs)/register")}
              >
                Daftar sekarang
              </Text>
            </View>
          </Card>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

import "../global.css";
import { Stack } from "expo-router";
import { View, ActivityIndicator, Text } from "react-native";
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold } from "@expo-google-fonts/inter";

// Apply Inter as the app-wide default font family for all RN Text.
// Weight utilities (font-bold, dll.) tetap bekerja — Android mensintesis bold dari family dasar.
(Text as any).defaultProps = (Text as any).defaultProps || {};
(Text as any).defaultProps.style = { fontFamily: "Inter_400Regular" };

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });

  if (!fontsLoaded) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#16a34a" />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#ffffff" },
      }}
    >
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="scan/upload" />
      <Stack.Screen name="scan/hasil" />
      <Stack.Screen name="scan/rekomendasi" />
      <Stack.Screen name="product/[id]/index" />
      <Stack.Screen name="product/[id]/tutorial" />
      <Stack.Screen name="product/[id]/before-after" />
      <Stack.Screen name="product/[id]/mockup" />
      <Stack.Screen name="product/[id]/pricing" />
      <Stack.Screen name="product/[id]/selling" />
      <Stack.Screen name="expert-dashboard" />
    </Stack>
  );
}

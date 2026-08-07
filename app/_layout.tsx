import "../global.css";
import { useEffect } from "react";
import { View, ActivityIndicator, Text } from "react-native";
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold } from "@expo-google-fonts/inter";
import { ErrorBoundary } from "../src/components/ErrorBoundary";
import { seedDemoDataIfNeeded } from "../src/services/demoSeed";
import { RootStack, RootStackScreen } from "../src/navigation/root-stack";

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

  useEffect(() => {
    seedDemoDataIfNeeded();
  }, []);

  if (!fontsLoaded) {
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: "#E9EEE7" }}>
        <ActivityIndicator size="large" color="#5D7458" />
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <RootStack>
        <RootStackScreen name="(tabs)" />
        <RootStackScreen name="scan/upload" />
        <RootStackScreen name="scan/hasil" />
        <RootStackScreen name="scan/rekomendasi" />
        <RootStackScreen name="product/[id]/index" />
        <RootStackScreen name="product/[id]/tutorial" />
        <RootStackScreen name="product/[id]/before-after" />
        <RootStackScreen name="product/[id]/mockup" />
        <RootStackScreen name="product/[id]/pricing" />
        <RootStackScreen name="product/[id]/selling" />
        <RootStackScreen name="expert-dashboard" />
        <RootStackScreen name="notifications" />
        <RootStackScreen name="materials" />
        <RootStackScreen name="ideas" />
        <RootStackScreen name="achievements" />
      </RootStack>
    </ErrorBoundary>
  );
}

import "../global.css";
import { useEffect } from "react";
import { View, ActivityIndicator, Text } from "react-native";
import { StatusBar } from "expo-status-bar";
import {
  useFonts,
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from "@expo-google-fonts/manrope";
import {
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";
import { ErrorBoundary } from "../src/components/ErrorBoundary";
import { seedDemoDataIfNeeded } from "../src/services/demoSeed";
import { RootStack, RootStackScreen } from "../src/navigation/root-stack";

// Manrope's open geometry gives the product flow a warmer, more distinctive voice.
(Text as any).defaultProps = (Text as any).defaultProps || {};
(Text as any).defaultProps.style = { fontFamily: "Manrope_400Regular" };

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
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
      <StatusBar hidden />
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

import React from "react";
import { Pressable, View } from "react-native";
import { Tabs, useRouter } from "expo-router";
import { Camera, History, Home, Leaf, User } from "lucide-react-native";
import { colors, gradients, gradientStyle } from "../../src/theme";
import { useReducedMotion } from "../../src/hooks/useReducedMotion";

function ScanTabButton() {
  const router = useRouter();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Scan sampah"
      onPress={() => router.push("/scan/upload")}
      style={({ pressed }) => ({
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        transform: [{ translateY: -13 }, { scale: pressed ? 0.95 : 1 }],
      })}
    >
      <View
        style={{
          width: 58,
          height: 58,
          borderRadius: 29,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.forest700,
          ...gradientStyle(gradients.tabCamera),
          borderWidth: 2,
          borderColor: "rgba(224,248,190,0.52)",
          boxShadow:
            "inset 0 1px 0 rgba(250,255,241,0.34), 0 5px 4px rgba(0,12,7,0.34), 0 15px 24px rgba(0,8,4,0.52)",
        }}
      >
        <Camera size={24} color={colors.cream50} strokeWidth={2.2} />
      </View>
    </Pressable>
  );
}

export default function TabLayout() {
  const reducedMotion = useReducedMotion();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        animation: reducedMotion ? "none" : "fade",
        tabBarActiveTintColor: colors.cream50,
        tabBarInactiveTintColor: "#91A18E",
        tabBarStyle: {
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: 76,
          paddingTop: 8,
          paddingBottom: 9,
          borderTopWidth: 1,
          borderLeftWidth: 1,
          borderRightWidth: 1,
          borderColor: "rgba(210,239,184,0.2)",
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          borderCurve: "continuous",
          backgroundColor: colors.forest950,
          ...gradientStyle(gradients.tabNavigation),
          boxShadow:
            "inset 0 1px 0 rgba(239,255,224,0.13), 0 -10px 28px rgba(4,20,11,0.18), 0 14px 30px rgba(0,0,0,0.22)",
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontFamily: "Inter_600SemiBold",
          marginTop: 1,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Beranda",
          tabBarIcon: ({ color, size }) => <Home size={size - 1} color={color} strokeWidth={2.2} />,
        }}
      />
      <Tabs.Screen
        name="riwayat"
        options={{
          title: "Riwayat",
          tabBarIcon: ({ color, size }) => <History size={size - 1} color={color} strokeWidth={2.2} />,
        }}
      />
      <Tabs.Screen name="scan" options={{ title: "", tabBarButton: () => <ScanTabButton /> }} />
      <Tabs.Screen
        name="impact"
        options={{
          title: "Dampak",
          tabBarIcon: ({ color, size }) => <Leaf size={size - 1} color={color} strokeWidth={2.2} />,
        }}
      />
      <Tabs.Screen
        name="profil"
        options={{
          title: "Profil",
          tabBarIcon: ({ color, size }) => <User size={size - 1} color={color} strokeWidth={2.2} />,
        }}
      />
      <Tabs.Screen name="login" options={{ href: null } as never} />
      <Tabs.Screen name="register" options={{ href: null } as never} />
    </Tabs>
  );
}

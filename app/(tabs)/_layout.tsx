import React from "react";
import { Pressable, View } from "react-native";
import { Tabs, useRouter } from "expo-router";
import { Camera, History, Home, Leaf, User } from "lucide-react-native";
import { colors, gradients, gradientStyle, shadows } from "../../src/theme";

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
          ...gradientStyle(gradients.cameraMedallion),
          borderWidth: 4,
          borderColor: "rgba(232,239,226,0.56)",
          boxShadow: "0 7px 17px rgba(30, 46, 32, 0.23)",
        }}
      >
        <Camera size={24} color={colors.cream50} strokeWidth={2.2} />
      </View>
    </Pressable>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
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
          borderTopWidth: 0,
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          borderCurve: "continuous",
          backgroundColor: colors.forest950,
          ...gradientStyle(gradients.navigation),
          boxShadow: shadows.navigation,
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

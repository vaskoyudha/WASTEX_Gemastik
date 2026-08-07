import React, { useMemo, useState } from "react";
import { Image, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Award,
  Bell,
  Box,
  ChevronRight,
  Gift,
  Leaf,
  Plus,
  Recycle,
  TrendingUp,
} from "lucide-react-native";
import { EmptyState, LoadingSpinner, PressableScale } from "../../src/components/ui";
import { useImpactData } from "../../src/hooks/useImpactData";
import { gradientStyle } from "../../src/theme";

const palette = {
  forest: "#0B3D25",
  forestDeep: "#07301C",
  forestSoft: "#245A39",
  lime: "#9BD420",
  limePale: "#EAF5D8",
  sage: "#759379",
  sageLight: "#DDE8D9",
  cream: "#FBFCF7",
  ink: "#12331F",
  muted: "#69766D",
  line: "#DDE5DB",
  white: "#FFFFFF",
} as const;

const periods = ["Minggu", "Bulan", "Tahun"] as const;
type Period = (typeof periods)[number];

const achievementLinks = [
  {
    id: "green_start",
    title: "Hijau Awal",
    description: "Memulai perjalanan peduli lingkungan",
    icon: Leaf,
  },
  {
    id: "products_28",
    title: "28 Produk",
    description: "Target produk upcycle berikutnya",
    icon: Award,
  },
  {
    id: "sell_value",
    title: "Nilai Jual",
    description: "Nilai ekonomis yang tercapai",
    icon: Gift,
  },
];

export default function ImpactScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [period, setPeriod] = useState<Period>("Bulan");
  const { summary, loading, error, refresh } = useImpactData();

  const chartData = useMemo(
    () => [
      {
        label: "Sampah",
        unit: "(kg)",
        value: summary.totalWasteProcessed,
        display: `${summary.totalWasteProcessed} kg`,
        color: "linear-gradient(180deg, #2F6842 0%, #12462A 100%)",
      },
      {
        label: "Produk",
        unit: "(dibuat)",
        value: summary.totalProductsMade,
        display: `${summary.totalProductsMade}`,
        color: "linear-gradient(180deg, #91C33D 0%, #6E9E23 100%)",
      },
      {
        label: "Nilai",
        unit: "(Rupiah)",
        value: summary.estimatedEconomicValue / 10000,
        display: `Rp ${summary.estimatedEconomicValue.toLocaleString("id-ID")}`,
        color: "linear-gradient(180deg, #CDE79A 0%, #A8CE5C 100%)",
      },
    ],
    [summary]
  );

  const maxValue = Math.max(...chartData.map((item) => item.value), 1);
  const targetProgress = Math.min(summary.totalWasteProcessed / 10, 1);

  if (loading) {
    return <LoadingSpinner fullScreen message="Memuat dampak WASTEX..." />;
  }

  if (error) {
    return (
      <View style={{ flex: 1, backgroundColor: palette.cream }}>
        <EmptyState
          title="Dampak Gagal Dimuat"
          description="Coba muat ulang data dampak yang tersimpan di perangkat ini."
          actionLabel="Muat Ulang"
          onAction={refresh}
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: palette.cream }}>
      <ScrollView
        contentInsetAdjustmentBehavior="never"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 108 }}
      >
        <View style={{ paddingTop: Math.max(insets.top, 18), paddingBottom: 18 }}>
          <Image
            source={require("../../assets/images/impact-header-bg.png")}
            resizeMode="cover"
            accessibilityIgnoresInvertColors
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: 215,
              borderBottomLeftRadius: 14,
              borderBottomRightRadius: 14,
            }}
          />

          <View
            style={{
              paddingHorizontal: 22,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View
                style={{
                  width: 31,
                  height: 31,
                  borderRadius: 16,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: palette.lime,
                  transform: [{ rotate: "-10deg" }],
                }}
              >
                <Leaf size={20} color={palette.forestDeep} fill={palette.forestDeep} />
              </View>
              <Text
                style={{
                  color: palette.white,
                  fontFamily: "Manrope_800ExtraBold",
                  fontSize: 18,
                  letterSpacing: 0.6,
                }}
              >
                WASTEX
              </Text>
            </View>

            <PressableScale
              accessibilityLabel="Buka notifikasi"
              onPress={() => router.push("/notifications")}
              style={{
                width: 42,
                height: 42,
                borderRadius: 21,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "rgba(4,48,26,0.78)",
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.12)",
                boxShadow: "0 8px 22px rgba(1,25,13,0.24)",
              }}
            >
              <Bell size={21} color={palette.white} strokeWidth={2} />
              <View
                style={{
                  position: "absolute",
                  top: 8,
                  right: 8,
                  width: 7,
                  height: 7,
                  borderRadius: 4,
                  backgroundColor: palette.lime,
                  borderWidth: 1,
                  borderColor: palette.forestDeep,
                }}
              />
            </PressableScale>
          </View>

          <View style={{ paddingHorizontal: 22, paddingTop: 12, gap: 2 }}>
            <Text
              style={{
                color: palette.white,
                fontFamily: "serif",
                fontWeight: "700",
                fontSize: 43,
                lineHeight: 48,
                letterSpacing: -1.2,
              }}
            >
              Dampak
            </Text>
            <Text style={{ color: "rgba(255,255,255,0.9)", fontSize: 13, lineHeight: 18 }}>
              Jejak baik dari setiap proyekmu
            </Text>
          </View>

          <View
            style={{
              height: 190,
              marginHorizontal: 16,
              marginTop: 14,
              borderRadius: 25,
              borderCurve: "continuous",
              overflow: "hidden",
              backgroundColor: palette.white,
              borderWidth: 1,
              borderColor: "rgba(147,170,141,0.5)",
              boxShadow: "0 15px 34px rgba(25,62,35,0.16)",
            }}
          >
            <View
              style={{
                position: "absolute",
                top: 0,
                right: 0,
                width: "51%",
                height: "100%",
                borderTopLeftRadius: 82,
                borderBottomLeftRadius: 82,
                overflow: "hidden",
              }}
            >
              <Image
                source={require("../../assets/images/impact-upcycling-card-bg.png")}
                resizeMode="cover"
                accessibilityIgnoresInvertColors
                style={{
                  position: "absolute",
                  top: 0,
                  bottom: 0,
                  left: "-56%",
                  width: "156%",
                  height: "100%",
                }}
              />
            </View>

            <View style={{ width: "50%", paddingHorizontal: 20, paddingTop: 18 }}>
              <Text style={{ color: palette.ink, fontFamily: "Manrope_500Medium", fontSize: 11 }}>
                Total sampah diolah
              </Text>
              <Text
                selectable
                style={{
                  color: palette.forest,
                  fontFamily: "serif",
                  fontWeight: "700",
                  fontSize: 39,
                  lineHeight: 45,
                  letterSpacing: -1,
                  fontVariant: ["tabular-nums"],
                }}
              >
                {summary.totalWasteProcessed} kg
              </Text>
              <Text style={{ color: palette.ink, fontSize: 10, lineHeight: 14 }}>
                dikonversi menjadi karya baru
              </Text>

              <View
                style={{
                  height: 5,
                  marginTop: 12,
                  borderRadius: 3,
                  overflow: "hidden",
                  backgroundColor: "#E4EBDD",
                }}
              >
                <View
                  style={{
                    width: `${Math.max(targetProgress * 100, 4)}%`,
                    height: 5,
                    borderRadius: 3,
                    backgroundColor: palette.lime,
                    ...gradientStyle("linear-gradient(90deg, #18502E 0%, #9BD420 100%)"),
                  }}
                />
              </View>
            </View>

            <View
              style={{
                position: "absolute",
                left: 18,
                bottom: 15,
                width: "48%",
                flexDirection: "row",
                alignItems: "center",
              }}
            >
              <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 7 }}>
                <View
                  style={{
                    width: 29,
                    height: 29,
                    borderRadius: 15,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: palette.limePale,
                  }}
                >
                  <Box size={15} color={palette.forest} strokeWidth={2.2} />
                </View>
                <View>
                  <Text
                    selectable
                    style={{ color: palette.ink, fontFamily: "Manrope_700Bold", fontSize: 13 }}
                  >
                    {summary.totalProductsMade}
                  </Text>
                  <Text style={{ color: palette.muted, fontSize: 8 }}>Produk dibuat</Text>
                </View>
              </View>
              <View style={{ width: 1, height: 31, backgroundColor: palette.line }} />
              <View style={{ flex: 1, paddingLeft: 10 }}>
                <Text
                  selectable
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  style={{ color: palette.ink, fontFamily: "Manrope_700Bold", fontSize: 12 }}
                >
                  Rp {summary.estimatedEconomicValue.toLocaleString("id-ID")}
                </Text>
                <Text style={{ color: palette.muted, fontSize: 8 }}>Nilai ekonomis</Text>
              </View>
            </View>

            <View
              style={{
                position: "absolute",
                right: 17,
                top: 15,
                width: 39,
                height: 39,
                borderRadius: 20,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "rgba(255,255,255,0.94)",
                boxShadow: "0 7px 16px rgba(3,34,17,0.18)",
              }}
            >
              <Leaf size={20} color={palette.forest} fill={palette.forest} />
            </View>
          </View>
        </View>

        <View style={{ paddingHorizontal: 16, gap: 18 }}>
          <View style={{ gap: 9 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={{ color: palette.ink, fontFamily: "serif", fontWeight: "700", fontSize: 20 }}>
                Ringkasan dampak
              </Text>
              <PressableScale
                onPress={() => router.push("/riwayat")}
                style={{ flexDirection: "row", alignItems: "center", gap: 3 }}
              >
                <Text style={{ color: palette.forest, fontFamily: "Manrope_600SemiBold", fontSize: 11 }}>
                  Lihat detail
                </Text>
                <ChevronRight size={14} color={palette.forest} />
              </PressableScale>
            </View>

            <View style={{ flexDirection: "row", gap: 9 }}>
              {[
                { icon: Recycle, value: `${summary.totalWasteProcessed} kg`, label: "Sampah diolah" },
                { icon: Box, value: `${summary.totalProductsMade}`, label: "Produk dibuat" },
                {
                  icon: TrendingUp,
                  value: `${Math.max(summary.totalProductsMade - 1, 0)}x`,
                  label: "Siklus upcycle",
                },
              ].map((item, index) => (
                <View
                  key={item.label}
                  style={{
                    flex: 1,
                    height: 78,
                    paddingHorizontal: 11,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    borderRadius: 18,
                    borderCurve: "continuous",
                    backgroundColor: index === 0 ? palette.forestSoft : palette.white,
                    borderWidth: 1,
                    borderColor: index === 0 ? "rgba(155,212,32,0.28)" : palette.line,
                    boxShadow: "0 8px 20px rgba(29,61,37,0.08)",
                  }}
                >
                  <View
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 17,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: index === 0 ? "rgba(155,212,32,0.14)" : palette.limePale,
                      borderWidth: index === 0 ? 1 : 0,
                      borderColor: "rgba(155,212,32,0.5)",
                    }}
                  >
                    <item.icon size={18} color={index === 0 ? "#C7EA76" : palette.forest} />
                  </View>
                  <View style={{ flex: 1, gap: 1 }}>
                    <Text
                      selectable
                      numberOfLines={1}
                      style={{
                        color: index === 0 ? palette.white : palette.ink,
                        fontFamily: "serif",
                        fontWeight: "700",
                        fontSize: 18,
                        fontVariant: ["tabular-nums"],
                      }}
                    >
                      {item.value}
                    </Text>
                    <Text
                      numberOfLines={2}
                      style={{ color: index === 0 ? "rgba(255,255,255,0.82)" : palette.muted, fontSize: 8 }}
                    >
                      {item.label}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          <View
            style={{
              padding: 12,
              gap: 10,
              borderRadius: 22,
              borderCurve: "continuous",
              backgroundColor: "rgba(255,255,255,0.96)",
              borderWidth: 1,
              borderColor: palette.line,
              boxShadow: "0 10px 28px rgba(29,61,37,0.08)",
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <Text
                numberOfLines={1}
                style={{ flex: 1, color: palette.ink, fontFamily: "serif", fontWeight: "700", fontSize: 19 }}
              >
                Grafik dampak aktual
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  padding: 2,
                  borderRadius: 16,
                  backgroundColor: "#F5F6F2",
                  borderWidth: 1,
                  borderColor: palette.line,
                }}
              >
                {periods.map((item) => {
                  const active = item === period;
                  return (
                    <PressableScale
                      key={item}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      onPress={() => setPeriod(item)}
                      style={{
                        minWidth: 48,
                        height: 25,
                        paddingHorizontal: 8,
                        borderRadius: 13,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: active ? palette.forest : "transparent",
                        boxShadow: active ? "0 4px 9px rgba(11,61,37,0.2)" : undefined,
                      }}
                    >
                      <Text
                        style={{
                          color: active ? palette.white : palette.ink,
                          fontFamily: active ? "Manrope_600SemiBold" : "Manrope_400Regular",
                          fontSize: 9,
                        }}
                      >
                        {item}
                      </Text>
                    </PressableScale>
                  );
                })}
              </View>
            </View>

            <View
              style={{
                height: 138,
                paddingHorizontal: 14,
                paddingTop: 8,
                borderRadius: 16,
                borderCurve: "continuous",
                borderWidth: 1,
                borderColor: "#E9EEE6",
                backgroundColor: "#FEFFFC",
              }}
            >
              {[0, 1, 2].map((line) => (
                <View
                  key={line}
                  pointerEvents="none"
                  style={{
                    position: "absolute",
                    left: 14,
                    right: 14,
                    top: 25 + line * 32,
                    height: 1,
                    borderTopWidth: 1,
                    borderStyle: "dashed",
                    borderColor: "#E5EAE2",
                  }}
                />
              ))}
              <View style={{ flex: 1, flexDirection: "row", alignItems: "flex-end", gap: 17 }}>
                {chartData.map((item) => {
                  const heightPct = Math.max(Math.round((item.value / maxValue) * 100), 13);
                  return (
                    <View key={item.label} style={{ flex: 1, height: "100%", alignItems: "center", justifyContent: "flex-end" }}>
                      <Text
                        selectable
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        style={{ color: palette.ink, fontFamily: "Manrope_700Bold", fontSize: 9, paddingBottom: 4 }}
                      >
                        {item.display}
                      </Text>
                      <View style={{ flex: 1, width: "72%", justifyContent: "flex-end" }}>
                        <View
                          testID="impact-bar"
                          accessibilityLabel={`${item.label} impact bar`}
                          style={{
                            width: "100%",
                            height: `${heightPct}%`,
                            minHeight: 9,
                            borderTopLeftRadius: 11,
                            borderTopRightRadius: 11,
                            ...gradientStyle(item.color),
                          }}
                        />
                      </View>
                      <Text style={{ color: palette.ink, fontFamily: "Manrope_500Medium", fontSize: 9, paddingTop: 5 }}>
                        {item.label}
                      </Text>
                      <Text style={{ color: palette.muted, fontSize: 7 }}>{item.unit}</Text>
                    </View>
                  );
                })}
              </View>
            </View>

            <View
              style={{
                minHeight: 52,
                paddingHorizontal: 12,
                paddingVertical: 9,
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                borderRadius: 14,
                borderCurve: "continuous",
                backgroundColor: "#F5F9EA",
                borderWidth: 1,
                borderColor: "#CADBA9",
              }}
            >
              <View
                style={{
                  width: 31,
                  height: 31,
                  borderRadius: 16,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: palette.lime,
                  boxShadow: "0 5px 10px rgba(83,126,20,0.2)",
                }}
              >
                <Leaf size={17} color={palette.white} fill={palette.white} />
              </View>
              <View style={{ flex: 1, gap: 1 }}>
                <Text style={{ color: palette.ink, fontFamily: "Manrope_700Bold", fontSize: 10 }}>
                  Keren! Kamu sudah mengolah {summary.totalWasteProcessed} kg sampah {period.toLowerCase()} ini.
                </Text>
                <Text style={{ color: palette.muted, fontSize: 8.5 }}>
                  Terus pertahankan dan ciptakan dampak yang lebih besar!
                </Text>
              </View>
            </View>
          </View>

          <View style={{ gap: 9 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={{ color: palette.ink, fontFamily: "serif", fontWeight: "700", fontSize: 20 }}>
                Pencapaian
              </Text>
              <PressableScale
                onPress={() => router.push("/achievements")}
                style={{ flexDirection: "row", alignItems: "center", gap: 3 }}
              >
                <Text style={{ color: palette.forest, fontFamily: "Manrope_600SemiBold", fontSize: 11 }}>
                  Lihat semua
                </Text>
                <ChevronRight size={14} color={palette.forest} />
              </PressableScale>
            </View>

            <View style={{ flexDirection: "row", gap: 8 }}>
              {achievementLinks.map((item) => (
                <PressableScale
                  key={item.id}
                  onPress={() => router.push(`/achievements?focus=${item.id}`)}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    height: 112,
                    paddingHorizontal: 6,
                    paddingVertical: 11,
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    borderRadius: 17,
                    borderCurve: "continuous",
                    backgroundColor: palette.white,
                    borderWidth: 1,
                    borderColor: palette.line,
                  }}
                >
                  <item.icon size={25} color={palette.forestSoft} strokeWidth={2} />
                  <Text
                    numberOfLines={1}
                    style={{ color: palette.ink, fontFamily: "Manrope_700Bold", fontSize: 9, textAlign: "center" }}
                  >
                    {item.title}
                  </Text>
                  <Text
                    numberOfLines={3}
                    style={{ color: palette.muted, fontSize: 7, lineHeight: 10, textAlign: "center" }}
                  >
                    {item.description}
                  </Text>
                </PressableScale>
              ))}

              <PressableScale
                onPress={() => router.push("/achievements?action=add")}
                style={{
                  flex: 1,
                  minWidth: 0,
                  height: 112,
                  paddingHorizontal: 6,
                  paddingVertical: 11,
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  borderRadius: 17,
                  borderCurve: "continuous",
                  borderWidth: 1,
                  borderStyle: "dashed",
                  borderColor: "#96B872",
                }}
              >
                <View
                  style={{
                    width: 35,
                    height: 35,
                    borderRadius: 18,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: palette.limePale,
                  }}
                >
                  <Plus size={20} color={palette.forestSoft} />
                </View>
                <Text style={{ color: palette.ink, fontFamily: "Manrope_700Bold", fontSize: 9 }}>Tambah</Text>
                <Text style={{ color: palette.muted, fontSize: 7, lineHeight: 10, textAlign: "center" }}>
                  Raih pencapaian berikutnya
                </Text>
              </PressableScale>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

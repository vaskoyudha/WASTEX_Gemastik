import React, { useMemo } from "react";
import { Image, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Award, Gift, Leaf, Plus, Recycle, TrendingUp } from "lucide-react-native";
import { EmptyState, Header, LoadingSpinner, PressableScale } from "../../src/components/ui";
import { useImpactData } from "../../src/hooks/useImpactData";
import { colors, gradients, gradientStyle, radii, shadows } from "../../src/theme";

const achievementLinks = [
  { id: "green_start", title: "Hijau Awal", icon: Leaf },
  { id: "products_28", title: "28 Produk", icon: Award },
  { id: "sell_value", title: "Nilai Jual", icon: Gift },
];

export default function ImpactScreen() {
  const router = useRouter();
  const { history, summary, loading, error, refresh } = useImpactData();

  const chartData = useMemo(
    () => [
      { label: "Sampah", value: summary.totalWasteProcessed, display: `${summary.totalWasteProcessed} kg`, color: "#536D55" },
      { label: "Produk", value: summary.totalProductsMade, display: `${summary.totalProductsMade}`, color: "#839A79" },
      {
        label: "Nilai",
        value: summary.estimatedEconomicValue / 100000,
        display: `Rp ${summary.estimatedEconomicValue.toLocaleString("id-ID")}`,
        color: "#BBD38E",
      },
    ],
    [summary]
  );

  const maxValue = Math.max(...chartData.map((item) => item.value), 1);

  if (loading) {
    return <LoadingSpinner fullScreen message="Memuat dampak WASTEX..." />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.forest900, ...gradientStyle(gradients.home) }}>
      <Header title="Dampak" subtitle="Jejak baik dari setiap proyekmu" />

      {error ? (
        <View style={{ flex: 1, backgroundColor: colors.cream50, borderTopLeftRadius: radii.sheet, borderTopRightRadius: radii.sheet }}>
          <EmptyState
            title="Dampak Gagal Dimuat"
            description="Coba muat ulang data dampak yang tersimpan di perangkat ini."
            actionLabel="Muat Ulang"
            onAction={refresh}
          />
        </View>
      ) : (
        <>
          <View style={{ paddingHorizontal: 18, paddingTop: 14, paddingBottom: 18 }}>
            <View
              style={{
                borderRadius: radii.xl + 1,
                borderCurve: "continuous",
                padding: 1,
                ...gradientStyle(gradients.impactEdge),
                boxShadow: "-5px -5px 20px rgba(197,240,132,0.1), 0 22px 48px rgba(21,37,27,0.14)",
              }}
            >
              <View
                style={{
                padding: 19,
                gap: 16,
                borderRadius: radii.xl,
                borderCurve: "continuous",
                overflow: "hidden",
                backgroundColor: colors.forest900,
                }}
              >
              <Image
                source={require("../../assets/images/impact-upcycling-card-bg.png")}
                resizeMode="cover"
                accessibilityIgnoresInvertColors
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  opacity: 1,
                }}
              />
              <View
                pointerEvents="none"
                style={{
                  position: "absolute",
                  inset: 0,
                  ...gradientStyle(gradients.impactImageGlow),
                }}
              />
              <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
                <View style={{ gap: 4 }}>
                  <Text style={{ color: "rgba(255,255,255,0.7)", fontFamily: "Inter_600SemiBold", fontSize: 10 }}>Total sampah diolah</Text>
                  <Text selectable style={{ color: colors.white, fontFamily: "Inter_700Bold", fontSize: 32, lineHeight: 37, letterSpacing: -1, fontVariant: ["tabular-nums"] }}>
                    {summary.totalWasteProcessed} kg
                  </Text>
                  <Text style={{ color: "rgba(255,255,255,0.72)", fontSize: 11 }}>dikonversi menjadi karya baru</Text>
                </View>
                <View style={{ width: 46, height: 46, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: colors.lime300, ...gradientStyle(gradients.scanButton) }}>
                  <Leaf size={22} color={colors.forest900} fill={colors.forest900} />
                </View>
              </View>

              <View style={{ height: 5, borderRadius: 3, overflow: "hidden", backgroundColor: "rgba(40,59,42,0.34)" }}>
                <View style={{ width: `${Math.max(Math.min(summary.totalWasteProcessed / 15, 1) * 100, 4)}%`, height: 5, borderRadius: 3, backgroundColor: colors.lime300, ...gradientStyle(gradients.scanButton) }} />
              </View>

              <View style={{ flexDirection: "row" }}>
                <View style={{ flex: 1 }}>
                  <Text selectable style={{ color: colors.white, fontFamily: "Inter_700Bold", fontSize: 14 }}>{summary.totalProductsMade}</Text>
                  <Text style={{ color: "rgba(255,255,255,0.62)", fontSize: 9 }}>Produk dibuat</Text>
                </View>
                <View style={{ width: 1, height: 30, backgroundColor: "rgba(255,255,255,0.2)" }} />
                <View style={{ flex: 1, paddingLeft: 18 }}>
                  <Text selectable style={{ color: colors.white, fontFamily: "Inter_700Bold", fontSize: 14 }}>Rp {summary.estimatedEconomicValue.toLocaleString("id-ID")}</Text>
                  <Text style={{ color: "rgba(255,255,255,0.62)", fontSize: 9 }}>Nilai ekonomi</Text>
                </View>
              </View>
              </View>
            </View>
          </View>

          <View style={{ flex: 1, borderTopLeftRadius: radii.sheet, borderTopRightRadius: radii.sheet, borderCurve: "continuous", overflow: "hidden", backgroundColor: colors.cream50, ...gradientStyle(gradients.contentSheet), boxShadow: "0 -8px 26px rgba(43,59,44,0.1)" }}>
            <View style={{ alignSelf: "center", width: 34, height: 6, borderRadius: 3, backgroundColor: "rgba(54,74,55,0.48)" }} />
            <ScrollView contentInsetAdjustmentBehavior="automatic" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 20, paddingBottom: 120, gap: 28 }}>
              <View style={{ gap: 14 }}>
                <Text style={{ color: colors.ink900, fontFamily: "Inter_700Bold", fontSize: 16, letterSpacing: -0.25 }}>Ringkasan dampak</Text>
                <View style={{ flexDirection: "row", gap: 10 }}>
                  {[
                    { icon: Recycle, value: `${summary.totalWasteProcessed} kg`, label: "Diolah" },
                    { icon: Award, value: `${summary.totalProductsMade}`, label: "Produk" },
                    { icon: TrendingUp, value: `${Math.max(summary.totalProductsMade - 1, 0)}x`, label: "Siklus" },
                  ].map((item, index) => (
                    <View key={item.label} style={{ flex: 1, padding: 13, alignItems: "center", gap: 7, borderRadius: 20, borderCurve: "continuous", backgroundColor: index === 0 ? colors.forest800 : "rgba(255,255,255,0.72)", borderWidth: 1, borderColor: index === 0 ? "rgba(255,255,255,0.08)" : colors.mist100, boxShadow: shadows.card }}>
                      <View style={{ width: 36, height: 36, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: index === 0 ? "rgba(220,245,167,0.17)" : colors.mist100 }}>
                        <item.icon size={18} color={index === 0 ? colors.lime300 : colors.forest600} />
                      </View>
                      <Text selectable style={{ color: index === 0 ? colors.white : colors.ink900, fontFamily: "Inter_700Bold", fontSize: 15 }}>{item.value}</Text>
                      <Text style={{ color: index === 0 ? colors.sage200 : colors.ink600, fontSize: 9 }}>{item.label}</Text>
                    </View>
                  ))}
                </View>
              </View>

              <View style={{ gap: 14 }}>
                <Text style={{ color: colors.ink900, fontFamily: "Inter_700Bold", fontSize: 16, letterSpacing: -0.25 }}>Grafik dampak aktual</Text>
                <View style={{ padding: 18, height: 220, borderRadius: 22, borderCurve: "continuous", backgroundColor: "rgba(255,255,255,0.7)", borderWidth: 1, borderColor: colors.mist100, boxShadow: shadows.card }}>
                  <View style={{ flex: 1, flexDirection: "row", alignItems: "flex-end", gap: 14 }}>
                    {chartData.map((item) => {
                      const heightPct = Math.max(Math.round((item.value / maxValue) * 100), 12);
                      return (
                        <View key={item.label} style={{ flex: 1, height: "100%", justifyContent: "flex-end", alignItems: "center" }}>
                          <View style={{ flex: 1, width: "100%", justifyContent: "flex-end" }}>
                            <View testID="impact-bar" accessibilityLabel={`${item.label} impact bar`} style={{ width: "100%", height: `${heightPct}%`, borderTopLeftRadius: 16, borderTopRightRadius: 16, backgroundColor: item.color }} />
                          </View>
                          <Text style={{ color: colors.ink700, fontFamily: "Inter_600SemiBold", fontSize: 10, marginTop: 9 }}>{item.label}</Text>
                          <Text numberOfLines={1} style={{ color: colors.ink400, fontSize: 8, marginTop: 2 }}>{item.display}</Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              </View>

              <View style={{ gap: 14 }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <Text style={{ color: colors.ink900, fontFamily: "Inter_700Bold", fontSize: 16 }}>Pencapaian</Text>
                  <PressableScale onPress={() => router.push("/achievements")} hitSlop={10}>
                    <Text style={{ color: colors.forest600, fontFamily: "Inter_600SemiBold", fontSize: 11 }}>Lihat semua</Text>
                  </PressableScale>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 18 }}>
                  {achievementLinks.map((item) => (
                    <PressableScale key={item.id} onPress={() => router.push(`/achievements?focus=${item.id}`)} style={{ width: 96, height: 94, alignItems: "center", justifyContent: "center", gap: 9, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.72)", borderWidth: 1, borderColor: colors.mist100 }}>
                      <item.icon size={23} color={colors.forest600} />
                      <Text style={{ color: colors.ink700, fontFamily: "Inter_600SemiBold", fontSize: 9, textAlign: "center" }}>{item.title}</Text>
                    </PressableScale>
                  ))}
                  <PressableScale onPress={() => router.push("/achievements?action=add")} style={{ width: 96, height: 94, alignItems: "center", justifyContent: "center", gap: 9, borderRadius: 20, borderWidth: 1, borderStyle: "dashed", borderColor: colors.sage300 }}>
                    <Plus size={22} color={colors.sage500} />
                    <Text style={{ color: colors.ink600, fontFamily: "Inter_600SemiBold", fontSize: 9 }}>Tambah</Text>
                  </PressableScale>
                </ScrollView>
              </View>

              {history.length > 0 ? (
                <View style={{ gap: 12 }}>
                  <Text style={{ color: colors.ink900, fontFamily: "Inter_700Bold", fontSize: 16 }}>Aktivitas terbaru</Text>
                  {history.slice(0, 3).map((project) => (
                    <PressableScale key={project.id} onPress={() => router.push(`/product/${project.product.id}`)} style={{ padding: 14, flexDirection: "row", alignItems: "center", borderRadius: 18, backgroundColor: "rgba(255,255,255,0.72)", borderWidth: 1, borderColor: colors.mist100 }}>
                      <View style={{ flex: 1, gap: 3 }}>
                        <Text numberOfLines={1} style={{ color: colors.ink900, fontFamily: "Inter_700Bold", fontSize: 13 }}>{project.product.name}</Text>
                        <Text numberOfLines={1} style={{ color: colors.ink600, fontSize: 10 }}>{project.material.materialLabel} · Rp {project.product.estimatedCost.toLocaleString("id-ID")}</Text>
                      </View>
                      <Text style={{ color: colors.forest600, fontFamily: "Inter_600SemiBold", fontSize: 10 }}>Lihat</Text>
                    </PressableScale>
                  ))}
                </View>
              ) : null}
            </ScrollView>
          </View>
        </>
      )}
    </View>
  );
}

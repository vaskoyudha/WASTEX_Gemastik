import React from "react";
import { Image, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import {
  Bell,
  Camera,
  ChevronRight,
  Leaf,
  Lightbulb,
  PackageCheck,
  Recycle,
  Store,
  Upload,
} from "lucide-react-native";
import { PressableScale } from "../../src/components/ui";
import { useImpactData } from "../../src/hooks/useImpactData";
import { colors, gradients, gradientStyle, radii, shadows } from "../../src/theme";

const actions = [
  { label: "Scan", icon: Camera, route: "/scan/upload", featured: true },
  { label: "Upload", icon: Upload, route: "/scan/upload", featured: false },
  { label: "Ide", icon: Lightbulb, route: "/ideas", featured: false },
  { label: "Jual", icon: Store, route: "/riwayat", featured: false },
] as const;

const materials = ["PET", "HDPE", "Kardus", "Kaleng", "Kaca"];

function SectionHeader({ title, onPress }: { title: string; onPress?: () => void }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
      <Text style={{ color: colors.ink900, fontFamily: "Inter_700Bold", fontSize: 16 }}>
        {title}
      </Text>
      {onPress ? (
        <PressableScale
          onPress={onPress}
          hitSlop={10}
          style={{ flexDirection: "row", alignItems: "center", gap: 2, paddingVertical: 6 }}
        >
          <Text style={{ color: colors.forest600, fontFamily: "Inter_600SemiBold", fontSize: 12 }}>
            Lihat semua
          </Text>
          <ChevronRight size={15} color={colors.forest600} />
        </PressableScale>
      ) : null}
    </View>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const { history, summary, loading } = useImpactData();
  const compact = width < 360;
  const target = 15;
  const progress = Math.min(summary.totalWasteProcessed / target, 1);
  const progressWidth = `${Math.max(progress * 100, 4)}%` as `${number}%`;

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.forest900,
        overflow: "hidden",
      }}
    >
      <Image
        source={require("../../assets/images/home-hero-bg.png")}
        resizeMode="cover"
        accessibilityIgnoresInvertColors
        style={{
          position: "absolute",
          top: -10,
          left: -10,
          width: "102%",
          height: "84%",
          opacity: 0.7,
        }}
      />
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: "rgba(4,22,16,0.2)",
          ...gradientStyle(gradients.homeImageVeil),
        }}
      />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 126 }}
      >
        <View
          style={{
            minHeight: Math.min(Math.max(Math.round(height * 0.5), 390), 470),
            paddingHorizontal: 18,
            paddingTop: 12,
            paddingBottom: 18,
            justifyContent: "space-between",
            gap: 14,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 11 }}>
              <View
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 19,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: colors.lime300,
                  ...gradientStyle(gradients.scanButton),
                  boxShadow: "0 5px 14px rgba(31,48,33,0.18)",
                }}
              >
                <Recycle size={19} color={colors.forest900} strokeWidth={2.35} />
              </View>
              <View>
                <Text style={{ color: colors.sage200, fontSize: 9, fontFamily: "Inter_500Medium", letterSpacing: 0.1 }}>
                  Selamat datang kembali
                </Text>
                <Text style={{ color: colors.white, fontSize: 14, fontFamily: "Inter_700Bold", marginTop: 1, letterSpacing: -0.2 }}>
                  WASTEX Explorer
                </Text>
              </View>
            </View>
            <PressableScale
              accessibilityLabel="Buka notifikasi"
              onPress={() => router.push("/notifications")}
              style={{
                width: 38,
                height: 38,
                borderRadius: 19,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "rgba(255,255,255,0.08)",
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.07)",
              }}
            >
              <Bell size={18} color={colors.cream50} strokeWidth={1.9} />
              <View
                style={{
                  position: "absolute",
                  right: 8,
                  top: 7,
                  width: 6,
                  height: 6,
                  borderRadius: 4,
                  backgroundColor: colors.danger,
                  borderWidth: 1.5,
                  borderColor: colors.forest900,
                }}
              />
            </PressableScale>
          </View>

          <View
            style={{
              width: compact ? "72%" : "68%",
              maxWidth: 260,
              gap: compact ? 5 : 7,
              paddingVertical: compact ? 2 : 6,
            }}
          >
            <Text
              style={{
                color: "rgba(255,255,255,0.78)",
                fontSize: compact ? 11 : 12,
                fontFamily: "Inter_500Medium",
                letterSpacing: 0.1,
              }}
            >
              Halo, Explorer! 👋
            </Text>
            <Text
              style={{
                color: colors.white,
                fontSize: compact ? 25 : 29,
                lineHeight: compact ? 28 : 32,
                letterSpacing: -1.05,
                fontFamily: "Inter_700Bold",
                textShadowColor: "rgba(0,0,0,0.18)",
                textShadowOffset: { width: 0, height: 2 },
                textShadowRadius: 8,
              }}
            >
              Mari ubah sampah jadi{" "}
              <Text style={{ color: colors.lime300, fontFamily: "Inter_700Bold" }}>peluang.</Text>
            </Text>
            <Text
              style={{
                color: "rgba(255,255,255,0.72)",
                fontSize: compact ? 10 : 11,
                lineHeight: compact ? 15 : 17,
                fontFamily: "Inter_500Medium",
              }}
            >
              Setiap aksi kecilmu memberi dampak besar untuk lingkungan.
            </Text>
          </View>

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
              backgroundColor: colors.forest900,
              borderRadius: radii.xl,
              borderCurve: "continuous",
              padding: compact ? 16 : 18,
              gap: 14,
              overflow: "hidden",
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
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
              <View style={{ gap: 5 }}>
                <Text style={{ color: "rgba(255,255,255,0.72)", fontSize: 10, fontFamily: "Inter_600SemiBold", letterSpacing: 0.1 }}>
                  Dampak keseluruhan
                </Text>
                <Text
                  selectable
                  style={{
                    color: colors.white,
                    fontSize: compact ? 28 : 32,
                    lineHeight: compact ? 33 : 37,
                    letterSpacing: -1.1,
                    fontFamily: "Inter_700Bold",
                    fontVariant: ["tabular-nums"],
                  }}
                >
                  {summary.totalWasteProcessed} kg
                </Text>
                <Text style={{ color: "rgba(255,255,255,0.78)", fontSize: 11 }}>sampah berhasil diolah</Text>
              </View>
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 16,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: colors.lime300,
                  ...gradientStyle(gradients.scanButton),
                  boxShadow: "0 5px 13px rgba(42,63,43,0.16)",
                }}
              >
                <Leaf size={21} color={colors.forest900} fill={colors.forest900} />
              </View>
            </View>

            <View style={{ gap: 8 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: "rgba(255,255,255,0.73)", fontSize: 9, fontFamily: "Inter_500Medium" }}>
                  Target dampak
                </Text>
                <Text style={{ color: colors.white, fontSize: 9, fontFamily: "Inter_600SemiBold" }}>
                  {Math.round(progress * 100)}% dari {target} kg
                </Text>
              </View>
              <View style={{ height: 5, borderRadius: 3, backgroundColor: "rgba(34,54,37,0.4)", overflow: "hidden" }}>
                <View
                  style={{
                    width: progressWidth,
                    height: 5,
                    borderRadius: 3,
                    backgroundColor: colors.lime300,
                    ...gradientStyle(gradients.scanButton),
                  }}
                />
              </View>
            </View>

            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <View style={{ flex: 1 }}>
                <Text selectable style={{ color: colors.white, fontSize: 14, fontFamily: "Inter_700Bold", fontVariant: ["tabular-nums"] }}>
                  {summary.totalProductsMade}
                </Text>
                <Text style={{ color: "rgba(255,255,255,0.65)", fontSize: 9, marginTop: 1 }}>Produk dibuat</Text>
              </View>
              <View style={{ width: 1, height: 29, backgroundColor: "rgba(255,255,255,0.2)" }} />
              <View style={{ flex: 1, paddingLeft: 18 }}>
                <Text selectable style={{ color: colors.white, fontSize: 14, fontFamily: "Inter_700Bold", fontVariant: ["tabular-nums"] }}>
                  Rp {summary.estimatedEconomicValue.toLocaleString("id-ID")}
                </Text>
                <Text style={{ color: "rgba(255,255,255,0.65)", fontSize: 9, marginTop: 1 }}>Nilai ekonomi</Text>
              </View>
            </View>
            </View>
          </View>

          <View
            style={{
              flexDirection: "row",
              gap: compact ? 7 : 9,
            }}
          >
            {actions.map((action) => (
              <View key={action.label} style={{ flex: 1 }}>
                <PressableScale
                  accessibilityLabel={action.label}
                  onPress={() => router.push(action.route)}
                  style={{
                    height: compact ? 94 : 100,
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    borderRadius: 17,
                    borderCurve: "continuous",
                    backgroundColor: "rgba(104,130,101,0.24)",
                    ...gradientStyle(gradients.actionTile),
                    borderWidth: 1,
                    borderColor: "rgba(255,255,255,0.055)",
                    boxShadow: "0 6px 16px rgba(31,47,33,0.08)",
                  }}
                >
                  <View
                    style={{
                      width: compact ? 48 : 52,
                      height: compact ? 48 : 52,
                      borderRadius: 26,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: "rgba(211,225,204,0.13)",
                      ...gradientStyle(gradients.actionIcon),
                      borderWidth: 1,
                      borderColor: "rgba(255,255,255,0.08)",
                    }}
                  >
                    <action.icon size={20} color={colors.cream50} strokeWidth={1.7} />
                  </View>
                  <Text style={{ color: colors.cream50, fontSize: 11, fontFamily: "Inter_500Medium" }}>
                    {action.label}
                  </Text>
                </PressableScale>
              </View>
            ))}
          </View>
        </View>

        <View
          style={{
            minHeight: 430,
            backgroundColor: colors.cream50,
            ...gradientStyle(gradients.contentSheet),
            borderTopLeftRadius: radii.sheet,
            borderTopRightRadius: radii.sheet,
            borderCurve: "continuous",
            paddingHorizontal: 20,
            paddingTop: 24,
            paddingBottom: 36,
            gap: 28,
            boxShadow: "0 -8px 26px rgba(43,59,44,0.1)",
          }}
        >
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: -5,
              alignSelf: "center",
              width: 34,
              height: 7,
              borderRadius: 4,
              backgroundColor: "rgba(54,74,55,0.5)",
            }}
          />
          <View style={{ gap: 16 }}>
            <SectionHeader title="Aktivitas terbaru" onPress={() => router.push("/riwayat")} />
            {loading ? (
              <View style={{ gap: 12 }}>
                {[0, 1].map((item) => (
                  <View key={item} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <View style={{ width: 48, height: 48, borderRadius: 17, backgroundColor: colors.mist100 }} />
                    <View style={{ flex: 1, gap: 7 }}>
                      <View style={{ width: "58%", height: 10, borderRadius: 5, backgroundColor: colors.mist100 }} />
                      <View style={{ width: "42%", height: 8, borderRadius: 4, backgroundColor: colors.mist100 }} />
                    </View>
                  </View>
                ))}
              </View>
            ) : history.length > 0 ? (
              <View style={{ gap: 4 }}>
                {history.slice(0, 3).map((item, index) => (
                  <PressableScale
                    key={item.id}
                    onPress={() => router.push(`/product/${item.product.id}`)}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                      paddingVertical: 10,
                      borderBottomWidth: index === Math.min(history.length, 3) - 1 ? 0 : 1,
                      borderBottomColor: colors.mist100,
                    }}
                  >
                    <Image
                      source={{ uri: item.photoUri }}
                      resizeMode="cover"
                      style={{ width: 48, height: 48, borderRadius: 17, backgroundColor: colors.mist100 }}
                    />
                    <View style={{ flex: 1, gap: 3 }}>
                      <Text numberOfLines={1} style={{ color: colors.ink900, fontSize: 13, fontFamily: "Inter_600SemiBold" }}>
                        {item.product.name}
                      </Text>
                      <Text numberOfLines={1} style={{ color: colors.ink600, fontSize: 10 }}>
                        {item.material.materialLabel} · Produk upcycle
                      </Text>
                    </View>
                    <View style={{ alignItems: "flex-end", gap: 3 }}>
                      <Text selectable style={{ color: colors.forest600, fontSize: 12, fontFamily: "Inter_700Bold", fontVariant: ["tabular-nums"] }}>
                        Rp {item.product.estimatedCost.toLocaleString("id-ID")}
                      </Text>
                      <Text style={{ color: colors.ink400, fontSize: 9 }}>Estimasi</Text>
                    </View>
                  </PressableScale>
                ))}
              </View>
            ) : (
              <PressableScale
                onPress={() => router.push("/scan/upload")}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 13,
                  backgroundColor: colors.mist50,
                  borderRadius: radii.lg,
                  borderCurve: "continuous",
                  padding: 15,
                }}
              >
                <View style={{ width: 46, height: 46, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: colors.sage200 }}>
                  <Camera size={21} color={colors.forest800} />
                </View>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={{ color: colors.ink900, fontSize: 13, fontFamily: "Inter_700Bold" }}>Mulai pemindaian pertama</Text>
                  <Text style={{ color: colors.ink600, fontSize: 11, lineHeight: 16 }}>Foto sampah untuk melihat material dan ide upcycle.</Text>
                </View>
                <ChevronRight size={18} color={colors.forest600} />
              </PressableScale>
            )}
          </View>

          <View style={{ gap: 16 }}>
            <SectionHeader title="Material yang didukung" onPress={() => router.push("/materials")} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingRight: 18 }}>
              {materials.map((material, index) => (
                <PressableScale key={material} onPress={() => router.push("/materials")} style={{ alignItems: "center", gap: 8 }}>
                  <View
                    style={{
                      width: 54,
                      height: 54,
                      borderRadius: 20,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: index === 0 ? colors.forest800 : "rgba(227,234,225,0.9)",
                      ...(index === 0 ? gradientStyle(gradients.materialActive) : null),
                    }}
                  >
                    {index === 0 ? <Recycle size={22} color={colors.lime300} /> : <PackageCheck size={21} color={colors.forest600} />}
                  </View>
                  <Text style={{ color: colors.ink700, fontSize: 10, fontFamily: "Inter_500Medium" }}>{material}</Text>
                </PressableScale>
              ))}
            </ScrollView>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

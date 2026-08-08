import React, { useEffect, useState } from "react";
import { Image, Text, View } from "react-native";
import { Check, ScanLine, ShieldCheck, Sparkles } from "lucide-react-native";
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  FadeOut,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { useReducedMotion } from "../../hooks/useReducedMotion";
import { colors, gradients, gradientStyle, shadows } from "../../theme";

const analysisStages = [
  {
    title: "Mengenali material",
    detail: "Membaca bentuk, warna, dan permukaan objek",
  },
  {
    title: "Memeriksa keamanan",
    detail: "Menilai kondisi dan risiko saat diolah",
  },
  {
    title: "Menyiapkan rekomendasi",
    detail: "Mencocokkan material dengan ide terbaik",
  },
] as const;

interface AnalysisLoadingViewProps {
  photoUri: string | null;
}

export function AnalysisLoadingView({ photoUri }: AnalysisLoadingViewProps) {
  const reducedMotion = useReducedMotion();
  const scanProgress = useSharedValue(0);
  const pulseProgress = useSharedValue(0);
  const [stageIndex, setStageIndex] = useState(0);

  useEffect(() => {
    if (reducedMotion) {
      scanProgress.value = 0.5;
      pulseProgress.value = 0;
      return;
    }

    scanProgress.value = withRepeat(
      withTiming(1, {
        duration: 1700,
        easing: Easing.inOut(Easing.cubic),
      }),
      -1,
      true,
    );
    pulseProgress.value = withRepeat(
      withTiming(1, {
        duration: 1500,
        easing: Easing.inOut(Easing.quad),
      }),
      -1,
      true,
    );

    return () => {
      cancelAnimation(scanProgress);
      cancelAnimation(pulseProgress);
    };
  }, [pulseProgress, reducedMotion, scanProgress]);

  useEffect(() => {
    if (reducedMotion) return;

    const interval = setInterval(() => {
      setStageIndex((current) => Math.min(current + 1, analysisStages.length - 1));
    }, 1350);

    return () => clearInterval(interval);
  }, [reducedMotion]);

  const scanBeamStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scanProgress.value, [0, 0.08, 0.92, 1], [0.35, 1, 1, 0.35]),
    transform: [{ translateY: interpolate(scanProgress.value, [0, 1], [0, 228]) }],
  }));

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulseProgress.value, [0, 1], [0.34, 0.08]),
    transform: [{ scale: interpolate(pulseProgress.value, [0, 1], [0.96, 1.06]) }],
  }));

  const activeStage = analysisStages[stageIndex];

  return (
    <View
      testID="analysis-loading-view"
      accessibilityRole="progressbar"
      accessibilityLabel="Analisis foto sedang berlangsung"
      accessibilityValue={{ text: activeStage.title }}
      style={[
        {
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 22,
          paddingVertical: 28,
          gap: 24,
        },
        gradientStyle(gradients.contentSheet),
      ]}
    >
      <Animated.View
        entering={reducedMotion ? undefined : FadeIn.duration(260)}
        style={{ width: "100%", maxWidth: 318, alignItems: "center", gap: 8 }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 7,
            paddingHorizontal: 11,
            paddingVertical: 7,
            borderRadius: 999,
            backgroundColor: colors.mist100,
            borderWidth: 1,
            borderColor: colors.sage200,
          }}
        >
          <Sparkles size={13} color={colors.forest700} strokeWidth={2} />
          <Text
            style={{
              color: colors.forest700,
              fontFamily: "Manrope_700Bold",
              fontSize: 10,
              letterSpacing: 0.7,
            }}
          >
            WASTEX INTELLIGENCE
          </Text>
        </View>
        <Text
          selectable
          accessibilityRole="header"
          accessibilityLabel="Sedang Memahami Materialmu"
          style={{
            color: colors.ink900,
            fontFamily: "serif",
            fontSize: 26,
            fontWeight: "700",
            lineHeight: 31,
            letterSpacing: -0.45,
            textAlign: "center",
          }}
        >
          Sedang Memahami{"\n"}
          <Text style={{ color: "#3C9A57", fontStyle: "italic" }}>Materialmu</Text>
        </Text>
        <Text
          style={{
            color: colors.ink600,
            fontFamily: "Manrope_400Regular",
            fontSize: 12,
            lineHeight: 18,
            textAlign: "center",
          }}
        >
          AI memeriksa detail foto untuk memberi hasil yang aman dan relevan.
        </Text>
      </Animated.View>

      <View
        style={{
          width: "100%",
          maxWidth: 318,
          height: 304,
          borderRadius: 30,
          borderCurve: "continuous",
          padding: 10,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: "rgba(41,73,54,0.10)",
          boxShadow: shadows.floating,
        }}
      >
        <View
          style={{
            flex: 1,
            borderRadius: 23,
            borderCurve: "continuous",
            overflow: "hidden",
            backgroundColor: colors.forest900,
          }}
        >
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
          ) : (
            <View style={{ flex: 1, ...gradientStyle(gradients.navigation) }} />
          )}

          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              inset: 0,
              ...gradientStyle(
                "linear-gradient(180deg, rgba(16,31,22,0.34) 0%, rgba(16,31,22,0.04) 42%, rgba(16,31,22,0.76) 100%)",
              ),
            }}
          />

          <Animated.View
            pointerEvents="none"
            style={[
              {
                position: "absolute",
                left: 14,
                right: 14,
                top: 17,
                height: 52,
              },
              scanBeamStyle,
            ]}
          >
            <View
              style={{
                flex: 1,
                ...gradientStyle(
                  "linear-gradient(180deg, rgba(220,247,161,0) 0%, rgba(220,247,161,0.14) 72%, rgba(220,247,161,0.3) 100%)",
                ),
              }}
            />
            <View
              style={{
                height: 2,
                borderRadius: 2,
                backgroundColor: colors.lime300,
                boxShadow: "0 0 12px rgba(220,247,161,0.9)",
              }}
            />
          </Animated.View>

          <View
            style={{
              position: "absolute",
              left: 14,
              top: 14,
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              paddingHorizontal: 10,
              paddingVertical: 7,
              borderRadius: 999,
              backgroundColor: "rgba(21,37,27,0.74)",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.16)",
            }}
          >
            <ScanLine size={13} color={colors.lime300} />
            <Text style={{ color: colors.white, fontFamily: "Manrope_600SemiBold", fontSize: 10 }}>
              Pemindaian aktif
            </Text>
          </View>

          <Animated.View
            pointerEvents="none"
            style={[
              {
                position: "absolute",
                right: 18,
                bottom: 20,
                width: 48,
                height: 48,
                borderRadius: 24,
                borderWidth: 1,
                borderColor: colors.lime300,
              },
              pulseStyle,
            ]}
          />
          <View
            style={{
              position: "absolute",
              right: 21,
              bottom: 23,
              width: 42,
              height: 42,
              borderRadius: 21,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(21,37,27,0.78)",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.16)",
            }}
          >
            <ShieldCheck size={19} color={colors.lime300} strokeWidth={1.9} />
          </View>
        </View>
      </View>

      <View
        style={{
          width: "100%",
          maxWidth: 318,
          minHeight: 112,
          paddingHorizontal: 17,
          paddingVertical: 15,
          gap: 13,
          borderRadius: 22,
          borderCurve: "continuous",
          backgroundColor: "rgba(252,253,251,0.82)",
          borderWidth: 1,
          borderColor: colors.mist100,
          boxShadow: shadows.card,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 14,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: colors.forest900,
            }}
          >
            <Sparkles size={16} color={colors.lime300} />
          </View>
          <Animated.View
            key={stageIndex}
            entering={reducedMotion ? undefined : FadeIn.duration(220)}
            exiting={reducedMotion ? undefined : FadeOut.duration(140)}
            style={{ flex: 1, gap: 2 }}
          >
            <Text
              accessibilityLiveRegion="polite"
              style={{ color: colors.ink900, fontFamily: "Manrope_700Bold", fontSize: 13 }}
            >
              {activeStage.title}
            </Text>
            <Text style={{ color: colors.ink600, fontFamily: "Manrope_400Regular", fontSize: 10, lineHeight: 15 }}>
              {activeStage.detail}
            </Text>
          </Animated.View>
        </View>

        <View style={{ flexDirection: "row", gap: 6 }}>
          {analysisStages.map((stage, index) => {
            const completed = index < stageIndex;
            const active = index === stageIndex;

            return (
              <View
                key={stage.title}
                style={{
                  flex: 1,
                  height: 4,
                  borderRadius: 999,
                  overflow: "hidden",
                  backgroundColor: colors.mist100,
                }}
              >
                {(completed || active) && (
                  <View
                    style={{
                      width: "100%",
                      height: "100%",
                      borderRadius: 999,
                      backgroundColor: completed ? colors.forest700 : colors.lime400,
                    }}
                  />
                )}
              </View>
            );
          })}
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Check size={12} color={colors.forest600} />
            <Text style={{ color: colors.ink600, fontFamily: "Manrope_500Medium", fontSize: 9 }}>
              Foto terkirim dengan aman
            </Text>
          </View>
          <Text style={{ color: colors.ink400, fontFamily: "Manrope_500Medium", fontSize: 9 }}>
            Mohon tunggu sebentar
          </Text>
        </View>
      </View>
    </View>
  );
}

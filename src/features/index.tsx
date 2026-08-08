import React from "react";
import { Modal, Text, TouchableOpacity, View } from "react-native";
import { AlertTriangle, ArrowUpRight, Clock, ShieldCheck } from "lucide-react-native";
import { Badge, Card } from "../components/ui";
import { MaterialThumbnail } from "./MaterialThumbnail";
import { DIFFICULTY_META, RISK_META } from "../lib/theme";
import { formatRupiah } from "../lib/format";
import { colors, shadows } from "../theme";
import type {
  ProductRecommendation,
  RiskLevel,
  TutorialStep,
} from "../services/types";

export interface RiskBadgeProps {
  readonly level: RiskLevel;
}

export function RiskBadge({ level }: RiskBadgeProps): React.JSX.Element {
  const meta = RISK_META[level];

  return <Badge label={meta.label} variant={level} />;
}

export interface ProductCardProps {
  readonly product: ProductRecommendation;
  readonly onPress?: () => void;
}

export function ProductCard({ product, onPress }: ProductCardProps): React.JSX.Element {
  const difficulty = DIFFICULTY_META[product.difficulty];

  return (
    <Card
      onPress={onPress}
      className="mb-4 overflow-hidden p-0 border-0"
      style={{ backgroundColor: colors.surface, boxShadow: shadows.card }}
    >
      <View className="flex-row p-2.5">
        <MaterialThumbnail
          product={product}
          style={{ height: 128, width: 116, borderRadius: 18 }}
        />
        <View className="flex-1 py-2 pl-3.5 pr-1">
          <View className="flex-row items-start">
            <Text
              className="text-[15px] font-extrabold flex-1 pr-2"
              style={{ color: colors.ink900, letterSpacing: -0.35 }}
              numberOfLines={2}
            >
            {product.name}
            </Text>
            <View className="w-7 h-7 rounded-full items-center justify-center" style={{ backgroundColor: colors.mist100 }}>
              <ArrowUpRight size={14} color={colors.forest700} />
            </View>
          </View>
          <Text className="mt-1 text-[11px] leading-4" style={{ color: colors.ink600 }} numberOfLines={2}>
            {product.shortDescription}
          </Text>
          <View className="mt-auto flex-row items-center justify-between">
            <Badge label={difficulty.label} variant={product.difficulty} size="sm" />
            <View className="flex-row items-center">
              <Clock size={13} color={colors.ink400} />
              <Text className="ml-1 text-[11px] font-medium" style={{ color: colors.ink600 }}>
                {product.estimatedTimeMinutes} menit
              </Text>
            </View>
          </View>
          <Text className="mt-2 text-sm font-extrabold" style={{ color: colors.forest900, fontVariant: ["tabular-nums"] }}>
            {formatRupiah(product.suggestedPrice)}
          </Text>
        </View>
      </View>
    </Card>
  );
}

export interface TutorialStepCardProps {
  readonly step: TutorialStep;
}

export function TutorialStepCard({ step }: TutorialStepCardProps): React.JSX.Element {
  return (
    <Card className="mb-4">
      <View className="flex-row">
        <View className="mr-3 h-9 w-9 items-center justify-center rounded-full bg-brand-light">
          <Text className="font-bold text-brand-dark">{step.order}</Text>
        </View>
        <View className="flex-1">
          <Text className="text-base font-bold text-slate-900">{step.title}</Text>
          <Text className="mt-1 text-sm leading-5 text-slate-600">{step.description}</Text>
          {step.safetyWarning ? (
            <View className="mt-3 flex-row rounded-xl bg-amber-50 p-3">
              <AlertTriangle size={16} color="#d97706" />
              <Text className="ml-2 flex-1 text-xs leading-4 text-amber-800">
                {step.safetyWarning}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </Card>
  );
}

export interface SafetyModalProps {
  readonly visible: boolean;
  readonly title: string;
  readonly safetyNotes: readonly string[];
  readonly protectiveEquipment: string;
  readonly onContinue: () => void;
  readonly onBack: () => void;
}

export function SafetyModal({
  visible,
  title,
  safetyNotes,
  protectiveEquipment,
  onContinue,
  onBack,
}: SafetyModalProps): React.JSX.Element {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onBack}>
      <View className="flex-1 items-center justify-center bg-black/50 px-6">
        <View className="w-full rounded-3xl bg-white p-6">
          <View className="mb-4 items-center">
            <View className="mb-3 h-14 w-14 items-center justify-center rounded-full bg-amber-50">
              <ShieldCheck size={28} color="#d97706" />
            </View>
            <Text className="text-center text-lg font-bold text-slate-900">{title}</Text>
          </View>
          <View className="mb-3">
            {safetyNotes.map((note) => (
              <Text key={note} className="mb-2 text-sm leading-5 text-slate-600">
                • {note}
              </Text>
            ))}
          </View>
          <Text className="mb-5 rounded-xl bg-emerald-50 p-3 text-sm leading-5 text-emerald-800">
            APD: {protectiveEquipment}
          </Text>
          <View className="flex-row gap-3">
            <TouchableOpacity onPress={onBack} className="flex-1 rounded-xl border border-slate-200 p-3">
              <Text className="text-center font-semibold text-slate-700">Kembali</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onContinue} className="flex-1 rounded-xl bg-brand p-3">
              <Text className="text-center font-semibold text-white">Lanjutkan</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

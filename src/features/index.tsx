import React from "react";
import { Image, Modal, Text, TouchableOpacity, View } from "react-native";
import { AlertTriangle, Clock, ShieldCheck } from "lucide-react-native";
import { Badge, Card } from "../components/ui";
import { DIFFICULTY_META, RISK_META } from "../lib/theme";
import { formatRupiah } from "../lib/format";
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
    <Card onPress={onPress} className="mb-4 overflow-hidden p-0">
      <View className="flex-row">
        <Image
          source={{ uri: product.thumbnailUri }}
          accessibilityLabel={product.name}
          className="h-28 w-28 bg-slate-100"
          resizeMode="cover"
        />
        <View className="flex-1 p-4">
          <Text className="text-base font-bold text-slate-900" numberOfLines={1}>
            {product.name}
          </Text>
          <Text className="mt-1 text-xs leading-4 text-slate-500" numberOfLines={2}>
            {product.shortDescription}
          </Text>
          <View className="mt-3 flex-row items-center justify-between">
            <Badge label={difficulty.label} variant={product.difficulty} size="sm" />
            <View className="flex-row items-center">
              <Clock size={13} color="#64748b" />
              <Text className="ml-1 text-xs font-medium text-slate-500">
                {product.estimatedTimeMinutes} menit
              </Text>
            </View>
          </View>
          <Text className="mt-2 text-sm font-bold text-brand-dark">
            {formatRupiah(product.estimatedCost)}
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

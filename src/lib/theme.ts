import type { Difficulty, RiskLevel } from "../services/types";

export type RiskMeta = {
  readonly label: string;
  readonly color: string;
};

export type DifficultyMeta = {
  readonly label: string;
};

export const RISK_META: Record<RiskLevel, RiskMeta> = {
  aman: { label: "Aman", color: "#16a34a" },
  hati_hati: { label: "Hati-hati", color: "#d97706" },
  berisiko: { label: "Berisiko", color: "#dc2626" },
};

export const DIFFICULTY_META: Record<Difficulty, DifficultyMeta> = {
  mudah: { label: "Mudah" },
  sedang: { label: "Sedang" },
  sulit: { label: "Sulit" },
};

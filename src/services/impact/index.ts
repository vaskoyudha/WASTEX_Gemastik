import AsyncStorage from "@react-native-async-storage/async-storage";
import { ImpactService, ImpactSummary, SavedProject } from "../types";
import { apiClient } from "../api";
import { impactEventFromProject } from "./mapper";

export const HISTORY_STORAGE_KEY = "wastex.history.v1";
const LEGACY_HISTORY_STORAGE_KEY = "@wastex_saved_projects_v1";

const defaultSummary: ImpactSummary = {
  totalWasteProcessed: 0,
  totalProductsMade: 0,
  estimatedEconomicValue: 0,
};

async function readHistory(): Promise<SavedProject[]> {
  try {
    const data = await AsyncStorage.getItem(HISTORY_STORAGE_KEY);
    if (data) return JSON.parse(data) as SavedProject[];

    const legacyData = await AsyncStorage.getItem(LEGACY_HISTORY_STORAGE_KEY);
    if (!legacyData) return [];

    const legacyHistory = JSON.parse(legacyData) as SavedProject[];
    await writeHistory(legacyHistory);
    await AsyncStorage.removeItem(LEGACY_HISTORY_STORAGE_KEY);
    return legacyHistory;
  } catch {
    return [];
  }
}

async function writeHistory(history: SavedProject[]): Promise<void> {
  await AsyncStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
}

export class LocalImpactService implements ImpactService {
  async saveProject(project: SavedProject): Promise<void> {
    const existing = await readHistory();
    await writeHistory([project, ...existing]);

    // Fire-and-forget backend sync (only if not using mocks)
    if (process.env.EXPO_PUBLIC_USE_MOCK === "false") {
      apiClient
        .logImpact(impactEventFromProject(project))
        .catch(() => {
          // Offline-first: backend sync is best-effort, local history is source of truth.
        });
    }
  }

  async getHistory(): Promise<SavedProject[]> {
    return readHistory();
  }

  async getImpactSummary(): Promise<ImpactSummary> {
    const history = await readHistory();

    if (history.length === 0) {
      return defaultSummary;
    }

    // Temporary proxy: AI phase must replace estimatedCost with suggestedSellPrice.
    const estimatedEconomicValue = history.reduce(
      (sum, project) => sum + project.product.estimatedCost,
      0
    );
    const totalProductsMade = history.length;
    const totalWasteProcessed = history.reduce((sum, _project) => sum + 2, 0);

    return {
      totalWasteProcessed,
      totalProductsMade,
      estimatedEconomicValue,
    };
  }

  async deleteProject(id: string): Promise<void> {
    const history = await readHistory();
    await writeHistory(history.filter((project) => project.id !== id));
  }

  async clearAll(): Promise<void> {
    await Promise.all([
      AsyncStorage.removeItem(HISTORY_STORAGE_KEY),
      AsyncStorage.removeItem(LEGACY_HISTORY_STORAGE_KEY),
    ]);
  }
}

export const createImpactService = () => new LocalImpactService();
export const impact = createImpactService();

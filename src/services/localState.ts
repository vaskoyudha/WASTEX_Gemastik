import AsyncStorage from "@react-native-async-storage/async-storage";
import { ProductRecommendation } from "./types";

const KEYS = {
  bookmarks: "@wastex_bookmarks_v1",
  favorites: "@wastex_favorites_v1",
  expertItems: "@wastex_expert_items_v1",
  achievements: "@wastex_achievements_v1",
};

async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

async function writeJson<T>(key: string, value: T): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

function createProductListStore(key: string) {
  return {
    async getAll(): Promise<ProductRecommendation[]> {
      return readJson<ProductRecommendation[]>(key, []);
    },
    async toggle(product: ProductRecommendation): Promise<boolean> {
      const current = await readJson<ProductRecommendation[]>(key, []);
      const exists = current.some((item) => item.id === product.id);
      const updated = exists
        ? current.filter((item) => item.id !== product.id)
        : [product, ...current];

      await writeJson(key, updated);
      return !exists;
    },
    async isSaved(productId: string): Promise<boolean> {
      const current = await readJson<ProductRecommendation[]>(key, []);
      return current.some((item) => item.id === productId);
    },
  };
}

export type ExpertStatus = "menunggu" | "disetujui" | "ditolak";

export interface StoredExpertItem {
  id: string;
  title: string;
  source: string;
  thumbnail: string;
  risk: "Rendah" | "Sedang";
  difficulty: "Mudah" | "Sedang" | "Sulit";
  status: ExpertStatus;
}

export interface CustomAchievement {
  id: string;
  title: string;
  description: string;
  savedAt: string;
}

export const bookmarks = createProductListStore(KEYS.bookmarks);
export const favorites = createProductListStore(KEYS.favorites);

export const expertItems = {
  async getAll(defaultItems: StoredExpertItem[]): Promise<StoredExpertItem[]> {
    return readJson<StoredExpertItem[]>(KEYS.expertItems, defaultItems);
  },
  async saveAll(items: StoredExpertItem[]): Promise<void> {
    await writeJson(KEYS.expertItems, items);
  },
};

export const customAchievements = {
  async getAll(): Promise<CustomAchievement[]> {
    return readJson<CustomAchievement[]>(KEYS.achievements, []);
  },
  async add(title = "Pencapaian Baru"): Promise<CustomAchievement> {
    const current = await readJson<CustomAchievement[]>(KEYS.achievements, []);
    const item = {
      id: Date.now().toString(),
      title,
      description: "Pencapaian manual dari halaman Impact Tracker.",
      savedAt: new Date().toISOString(),
    };
    await writeJson(KEYS.achievements, [item, ...current]);
    return item;
  },
};


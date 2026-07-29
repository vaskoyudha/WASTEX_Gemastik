import AsyncStorage from "@react-native-async-storage/async-storage";
import { HISTORY_STORAGE_KEY } from "./impact";
import { MOCK_RECOMMENDATIONS, MOCK_SCAN_RESULTS } from "../mocks/mockData";
import type { SavedProject } from "./types";

const SEED_MARKER_KEY = "wastex.demoSeeded.v1";

const demoProjects: SavedProject[] = [
  {
    id: "demo_pet_1",
    savedAt: "2026-07-20T09:15:00.000Z",
    material: MOCK_SCAN_RESULTS.plastik_pet,
    product: MOCK_RECOMMENDATIONS.plastik_pet[0],
    photoUri: MOCK_RECOMMENDATIONS.plastik_pet[0].thumbnailUri,
  },
  {
    id: "demo_kaca_1",
    savedAt: "2026-07-18T14:40:00.000Z",
    material: MOCK_SCAN_RESULTS.kaca,
    product: MOCK_RECOMMENDATIONS.kaca[0],
    photoUri: MOCK_RECOMMENDATIONS.kaca[0].thumbnailUri,
  },
  {
    id: "demo_kardus_1",
    savedAt: "2026-07-15T11:05:00.000Z",
    material: MOCK_SCAN_RESULTS.kardus,
    product: MOCK_RECOMMENDATIONS.kardus[0],
    photoUri: MOCK_RECOMMENDATIONS.kardus[0].thumbnailUri,
  },
];

// Dev-only: populate history once so the home Impact + Riwayat sections have
// something to show on a fresh install. Never runs in production builds, and a
// marker prevents re-seeding after the user intentionally clears their data.
export async function seedDemoDataIfNeeded(): Promise<void> {
  if (!__DEV__) return;

  try {
    const [alreadySeeded, existing] = await Promise.all([
      AsyncStorage.getItem(SEED_MARKER_KEY),
      AsyncStorage.getItem(HISTORY_STORAGE_KEY),
    ]);

    if (alreadySeeded || existing) return;

    await AsyncStorage.multiSet([
      [HISTORY_STORAGE_KEY, JSON.stringify(demoProjects)],
      [SEED_MARKER_KEY, "1"],
    ]);
  } catch {
    // Seeding is best-effort; ignore storage failures.
  }
}

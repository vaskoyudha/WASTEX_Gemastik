import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { impact } from "../services";
import { ImpactSummary, SavedProject } from "../services/types";

export const defaultImpactSummary: ImpactSummary = {
  totalWasteProcessed: 0,
  totalProductsMade: 0,
  estimatedEconomicValue: 0,
};

export function useImpactData() {
  const [history, setHistory] = useState<SavedProject[]>([]);
  const [summary, setSummary] = useState<ImpactSummary>(defaultImpactSummary);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [historyData, summaryData] = await Promise.all([
        impact.getHistory(),
        impact.getImpactSummary(),
      ]);

      setHistory(historyData);
      setSummary(summaryData);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const deleteProject = useCallback(
    async (id: string) => {
      await impact.deleteProject(id);
      await load();
    },
    [load]
  );

  const clearAll = useCallback(async () => {
    await impact.clearAll();
    await load();
  }, [load]);

  return {
    history,
    summary,
    loading,
    error,
    refresh: load,
    deleteProject,
    clearAll,
  };
}


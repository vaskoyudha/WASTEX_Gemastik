import { useCallback, useMemo } from "react";
import { recommendation, tutorial, pricing, selling } from "../services";
import { useServiceCall } from "./useServiceCall";
import {
  ProductRecommendation,
  ProductTutorial,
  PricingEstimate,
  SellingKit,
} from "../services/types";

interface ProductDataPayload {
  product: ProductRecommendation | null;
  tutData: ProductTutorial | null;
  priceData: PricingEstimate | null;
}

/**
 * Data halaman produk dibagi dua tahap agar halaman tidak "loading terus":
 * 1. Core (product + tutorial + pricing) cepat & wajib untuk render halaman.
 * 2. Selling kit dihasilkan LLM (bisa ~20 detik) sehingga dimuat di latar
 *    belakang dan tidak boleh memblokir tampilan tutorial.
 */
export function useProductData(id: string | undefined) {
  const loadProductData = useCallback(async (productId: string): Promise<ProductDataPayload> => {
    const found = await recommendation.getProductById(productId);

    if (!found) {
      return {
        product: null,
        tutData: null,
        priceData: null,
      };
    }

    // Tutorial wajib (isi halaman). Pricing opsional: kegagalan tidak boleh
    // menggagalkan seluruh halaman.
    const [t, p] = await Promise.all([
      tutorial.getTutorial(productId),
      pricing.estimatePrice(productId).catch(() => null),
    ]);

    return {
      product: found,
      tutData: t,
      priceData: p,
    };
  }, []);

  const loadSellingKit = useCallback(
    (productId: string): Promise<SellingKit> => selling.getSellingKit(productId),
    []
  );

  const initialArgs = useMemo<[string]>(() => [id || ""], [id]);

  const core = useServiceCall<ProductDataPayload, [string]>(loadProductData, {
    autoCall: Boolean(id),
    initialArgs,
  });

  const sell = useServiceCall<SellingKit, [string]>(loadSellingKit, {
    autoCall: Boolean(id),
    initialArgs,
  });

  const refetch = useCallback(async (): Promise<ProductDataPayload | null> => {
    const [coreResult] = await Promise.all([core.refetch(), sell.refetch()]);
    return coreResult;
  }, [core.refetch, sell.refetch]);

  return {
    product: core.data?.product ?? null,
    tutData: core.data?.tutData ?? null,
    priceData: core.data?.priceData ?? null,
    sellData: sell.data,
    sellingLoading: sell.loading,
    sellingError: sell.error,
    loading: core.loading,
    error: core.error,
    refetch,
  };
}

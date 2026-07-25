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
  sellData: SellingKit | null;
}

export function useProductData(id: string | undefined) {
  const loadProductData = useCallback(async (productId: string): Promise<ProductDataPayload> => {
    const found = await recommendation.getProductById(productId);

    if (!found) {
      return {
        product: null,
        tutData: null,
        priceData: null,
        sellData: null,
      };
    }

    const [t, p, s] = await Promise.all([
      tutorial.getTutorial(productId),
      pricing.estimatePrice(productId),
      selling.getSellingKit(productId),
    ]);

    return {
      product: found,
      tutData: t,
      priceData: p,
      sellData: s,
    };
  }, []);

  const initialArgs = useMemo<[string]>(() => [id || ""], [id]);

  const { data, loading, error, refetch } = useServiceCall<ProductDataPayload, [string]>(loadProductData, {
    autoCall: Boolean(id),
    initialArgs,
  });

  return {
    product: data?.product ?? null,
    tutData: data?.tutData ?? null,
    priceData: data?.priceData ?? null,
    sellData: data?.sellData ?? null,
    loading,
    error,
    refetch,
  };
}

import { useEffect, useState } from "react";
import { recommendation, tutorial, pricing, selling } from "../services";
import {
  ProductRecommendation,
  ProductTutorial,
  PricingEstimate,
  SellingKit,
} from "../services/types";

export function useProductData(id: string | undefined) {
  const [product, setProduct] = useState<ProductRecommendation | null>(null);
  const [tutData, setTutData] = useState<ProductTutorial | null>(null);
  const [priceData, setPriceData] = useState<PricingEstimate | null>(null);
  const [sellData, setSellData] = useState<SellingKit | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!id) return;
      setLoading(true);
      try {
        const found = await recommendation.getProductById(id);
        if (found) {
          setProduct(found);
        }
        const [t, p, s] = await Promise.all([
          tutorial.getTutorial(id),
          pricing.estimatePrice(id),
          selling.getSellingKit(id),
        ]);
        setTutData(t);
        setPriceData(p);
        setSellData(s);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  return { product, tutData, priceData, sellData, loading };
}

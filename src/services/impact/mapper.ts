import { SavedProject } from "../types";

/**
 * Pure function to map a saved project to a backend impact event payload.
 * This is used for fire-and-forget POST /impact calls.
 */
export function impactEventFromProject(project: SavedProject): {
  material: string;
  waste_kg: number;
  est_value_idr: number;
} {
  return {
    material: project.material.materialType,
    waste_kg: 2,
    est_value_idr: project.product.estimatedCost ?? 0,
  };
}

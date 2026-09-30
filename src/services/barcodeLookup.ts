// Open Food Facts is a free, open product database — no API key required.
// https://world.openfoodfacts.org/data
import { getFoodEmoji } from '../utils/foodIcons';

const NUTRISCORE_TO_HEALTH_SCORE: Record<string, number> = {
  a: 9, b: 7, c: 5, d: 3, e: 1,
};

// Scanners and OFF's own database don't always agree on which barcode format
// a product is indexed under — a 12-digit UPC-A is frequently stored as a
// 13-digit EAN with a leading zero, or vice versa. Trying these variants
// meaningfully cuts down "scanned fine but nothing found" false negatives.
function barcodeVariants(code: string): string[] {
  const digits = code.replace(/\D/g, '');
  const variants = new Set<string>([digits]);

  if (digits.length === 12) variants.add('0' + digits);
  if (digits.length === 13 && digits.startsWith('0')) variants.add(digits.slice(1));
  if (digits.length === 8) variants.add('00000' + digits);
  if (digits.length === 13) variants.add('0' + digits);

  return Array.from(variants);
}

async function fetchProduct(barcode: string): Promise<any | null> {
  const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
  const data = await response.json();
  if (data.status !== 1 || !data.product) return null;
  return data.product;
}

export async function lookupBarcodeProduct(barcode: string): Promise<any | null> {
  let p: any = null;
  for (const variant of barcodeVariants(barcode)) {
    p = await fetchProduct(variant);
    if (p) break;
  }
  if (!p) return null;
  const n = p.nutriments || {};
  const grade = (p.nutriscore_grade || '').toLowerCase();

  const harmfulIngredients: string[] = [];
  if (n['saturated-fat_100g'] > 5) harmfulIngredients.push('High in saturated fat');
  if (n.sugars_100g > 22.5) harmfulIngredients.push('High in sugar');
  if (n.salt_100g > 1.5) harmfulIngredients.push('High in salt');

  const foodName = p.product_name || p.generic_name || 'Packaged product';
  // Categories (e.g. "Colas, Sodas") give a much better icon hint than the raw
  // product name alone, especially for products named in a language other than English.
  const lookupText = [foodName, p.categories, (p.categories_tags || []).join(' ')].join(' ');

  return {
    food_name: foodName,
    emoji: getFoodEmoji(lookupText),
    calories: Math.round(n['energy-kcal_100g'] || n['energy-kcal_serving'] || 0),
    protein: Math.round(n.proteins_100g || n.proteins_serving || 0),
    carbs: Math.round(n.carbohydrates_100g || n.carbohydrates_serving || 0),
    fat: Math.round(n.fat_100g || n.fat_serving || 0),
    harmful_ingredients: harmfulIngredients,
    awareness_summary: p.nutrition_grades
      ? `Nutri-Score ${p.nutrition_grades.toUpperCase()} product, values per 100g.`
      : 'Values shown are per 100g as reported by Open Food Facts.',
    recommendation: harmfulIngredients.length > 0
      ? 'Consume in moderation given the flagged nutrients above.'
      : 'Reasonable choice based on its nutrient profile.',
    health_score: NUTRISCORE_TO_HEALTH_SCORE[grade] ?? 5,
    image_type: 'packaged_label',
  };
}

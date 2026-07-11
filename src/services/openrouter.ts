import * as FileSystem from 'expo-file-system/legacy';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

const OPENROUTER_API_KEY = process.env.EXPO_PUBLIC_OPENROUTER_API_KEY;
const BASE_URL = 'https://openrouter.ai/api/v1/chat/completions';
export const MODEL = 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free';

// Resize/compress before upload — full-res camera photos add real latency
// (larger base64 payloads) with no accuracy benefit for this model.
async function imageToBase64(uri: string): Promise<string> {
  const compressed = await manipulateAsync(
    uri,
    [{ resize: { width: 1024 } }],
    { compress: 0.7, format: SaveFormat.JPEG }
  );
  return FileSystem.readAsStringAsync(compressed.uri, { encoding: 'base64' as any });
}

function parseJSON(content: string): any {
  if (!content) return null;
  let cleaned = content
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/```(?:json)?\s*([\s\S]*?)```/gi, '$1')
    .trim();
  try { return JSON.parse(cleaned); } catch (_) {}
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (match) {
    try { return JSON.parse(match[0]); } catch (_) {}
  }
  return null;
}

function coerceNumbers(obj: any): any {
  const numFields = ['calories', 'protein', 'carbs', 'fat', 'health_score'];
  for (const f of numFields) {
    if (obj[f] !== undefined && obj[f] !== null) {
      const n = parseInt(String(obj[f]).replace(/[^\d.-]/g, ''), 10);
      obj[f] = isNaN(n) ? 0 : n;
    }
  }
  if (!Array.isArray(obj.harmful_ingredients)) obj.harmful_ingredients = [];
  return obj;
}

// This model is a "reasoning" variant that thinks before answering. Without
// these guards its chain-of-thought either leaks into `content` verbatim or
// eats the whole token budget before it ever reaches a real answer.
async function callOpenRouter(
  imageBase64: string,
  prompt: string,
  maxTokens: number
): Promise<string | null> {
  const response = await fetch(BASE_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://nutrilens.app',
      'X-Title': 'NutriLens',
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: `data:image/jpeg;base64,${imageBase64}` },
            },
            { type: 'text', text: prompt },
          ],
        },
      ],
      max_tokens: maxTokens,
      reasoning: { effort: 'low', exclude: true },
    }),
  });

  const data = await response.json();
  console.log('=== OpenRouter raw response ===', JSON.stringify(data, null, 2));

  if (data.error) throw new Error(data.error.message || 'OpenRouter API error');

  const txt = data.choices?.[0]?.message?.content?.trim() ?? null;
  console.log('=== Model output ===', txt);
  return txt;
}

// ── Step 1: Classify image ─────────────────────────────────────────────────
export async function classifyImage(
  base64: string
): Promise<'prepared_food' | 'packaged_label'> {
  const prompt = `Is this image showing:
A) A cooked or fresh food item (meal, fruit, vegetable, etc.)
B) A packaged product nutrition label or barcode

Answer with exactly one word: prepared_food OR packaged_label`;

  const content = await callOpenRouter(base64, prompt, 300);
  const answer = (content || '').toLowerCase();
  if (/packaged_label|\bpackaged\b/.test(answer)) return 'packaged_label';
  return 'prepared_food';
}

// ── Step 2A: Analyze prepared food (ate mode) ─────────────────────────────
export async function analyzePreparedFood(
  base64: string,
  extraDetails?: string
): Promise<any> {
  const noteSection = extraDetails
    ? `\nIMPORTANT CONTEXT FROM USER: "${extraDetails}"\nUse this to improve identification and portion accuracy.\n`
    : '';

  const prompt = `Look carefully at this food image.${noteSection}
Identify exactly what food this is and estimate its realistic nutritional values for the visible portion.

Return ONLY a JSON object — no extra text, no markdown:
{
  "food_name": "<actual food name you see>",
  "emoji": "<single emoji for this food>",
  "calories": <realistic kcal for the portion shown>,
  "protein": <grams of protein>,
  "carbs": <grams of carbohydrates>,
  "fat": <grams of fat>,
  "summary": "<one sentence health note about this specific food>"
}`;

  const content = await callOpenRouter(base64, prompt, 700);
  if (!content) throw new Error('No response from AI');

  const parsed = parseJSON(content);
  if (parsed?.food_name && parsed?.calories !== undefined) return coerceNumbers(parsed);

  throw new Error('Could not parse nutrition data');
}

// ── Step 2A variant: Should I eat ────────────────────────────────────────
export async function analyzePreparedFoodShouldEat(
  base64: string,
  extraDetails?: string,
  dietGoal?: string
): Promise<any> {
  const noteSection = extraDetails
    ? `\nIMPORTANT CONTEXT FROM USER: "${extraDetails}"\nUse this to improve identification and health analysis.\n`
    : '';
  const goalSection = dietGoal
    ? `\nThe user's diet goal is "${dietGoal}". Weigh the health_score and recommendation specifically against this goal (e.g. penalize calorie-dense foods more for Weight Loss, reward protein for Muscle Gain, penalize carbs for Low Carb).\n`
    : '';

  const prompt = `Look carefully at this food image.${noteSection}${goalSection}
Identify exactly what food this is and analyze whether it is healthy to eat.

Return ONLY a JSON object — no extra text, no markdown:
{
  "food_name": "<actual food name you see>",
  "emoji": "<single emoji for this food>",
  "calories": <realistic kcal for the portion shown>,
  "protein": <grams of protein>,
  "carbs": <grams of carbohydrates>,
  "fat": <grams of fat>,
  "health_score": <score from 1 to 10 based on nutritional quality>,
  "recommendation": "<clear yes or no recommendation with specific reason>",
  "summary": "<one sentence health note about this specific food>"
}`;

  const content = await callOpenRouter(base64, prompt, 800);
  if (!content) throw new Error('No response from AI');

  const parsed = parseJSON(content);
  if (parsed?.food_name && parsed?.calories !== undefined) return coerceNumbers(parsed);

  throw new Error('Could not parse nutrition data');
}

// ── Step 2B: Packaged food label ──────────────────────────────────────────
export async function analyzePackagedFood(
  base64: string,
  mode: 'ate' | 'should_eat',
  extraDetails?: string,
  dietGoal?: string
): Promise<any> {
  const noteSection = extraDetails
    ? `\nIMPORTANT CONTEXT FROM USER: "${extraDetails}"\nTake this into account when reading the label.\n`
    : '';
  const goalSection = dietGoal
    ? `\nThe user's diet goal is "${dietGoal}". Weigh the health_score and recommendation specifically against this goal (e.g. penalize calorie-dense foods more for Weight Loss, reward protein for Muscle Gain, penalize carbs for Low Carb).\n`
    : '';

  const prompt = `Read this nutrition label carefully.${noteSection}${goalSection}
Extract the exact values printed on the label.

Return ONLY a JSON object — no extra text, no markdown:
{
  "food_name": "<product name from the label>",
  "emoji": "<single emoji that represents this product>",
  "calories": <calories per serving as printed>,
  "protein": <protein grams as printed>,
  "carbs": <total carbohydrate grams as printed>,
  "fat": <total fat grams as printed>,
  "harmful_ingredients": ["<any concerning ingredients found>"],
  "awareness_summary": "<brief health note about the ingredients or nutritional profile>",
  "recommendation": "<should they eat this product and why>",
  "health_score": <score from 1 to 10>
}`;

  const content = await callOpenRouter(base64, prompt, 800);
  if (!content) throw new Error('No response from AI');

  const parsed = parseJSON(content);
  if (parsed?.food_name && parsed?.calories !== undefined) return coerceNumbers(parsed);

  throw new Error('Could not parse label data');
}

// ── Main entry ─────────────────────────────────────────────────────────────
export async function analyzeFood(
  imageUri: string,
  mode: 'ate' | 'should_eat',
  extraDetails?: string,
  dietGoal?: string
) {
  const base64 = await imageToBase64(imageUri);
  const imageType = await classifyImage(base64);
  console.log('Image type:', imageType);

  let result;
  if (imageType === 'packaged_label') {
    result = await analyzePackagedFood(base64, mode, extraDetails, dietGoal);
  } else if (mode === 'should_eat') {
    result = await analyzePreparedFoodShouldEat(base64, extraDetails, dietGoal);
  } else {
    result = await analyzePreparedFood(base64, extraDetails);
  }

  return { ...result, image_type: imageType };
}

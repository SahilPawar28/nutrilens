import * as FileSystem from 'expo-file-system/legacy';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

const OPENROUTER_API_KEY = process.env.EXPO_PUBLIC_OPENROUTER_API_KEY;
const BASE_URL = 'https://openrouter.ai/api/v1/chat/completions';
export const MODEL = 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free';

// Resize/compress before upload — full-res camera photos add real latency
// (larger base64 payloads) with no accuracy benefit for this model.
export async function imageToBase64(uri: string): Promise<string> {
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

// ── Classify + analyze in a single call ────────────────────────────────────
// Previously this was two sequential round-trips (classify the image, then
// analyze it with a type-specific prompt). The model is capable of doing
// both in one pass — asking it to self-classify inside the same JSON
// response halves the latency and API usage per scan with no accuracy loss.
async function analyzeImageUnified(
  base64: string,
  extraDetails?: string,
  dietGoal?: string
): Promise<any> {
  const noteSection = extraDetails
    ? `\nIMPORTANT CONTEXT FROM USER: "${extraDetails}"\nUse this to improve identification and accuracy.\n`
    : '';
  const goalSection = dietGoal
    ? `\nThe user's diet goal is "${dietGoal}". Weigh the health_score and recommendation specifically against this goal (e.g. penalize calorie-dense foods more for Weight Loss, reward protein for Muscle Gain, penalize carbs for Low Carb).\n`
    : '';

  const prompt = `Look at this image carefully.${noteSection}${goalSection}
First determine what the image shows, then respond accordingly:
- "prepared_food": a cooked or fresh food item (meal, fruit, vegetable, etc.) — estimate realistic nutrition for the visible portion.
- "packaged_label": a packaged product's nutrition label or barcode — extract the exact values printed on the label.
- "not_food": anything else — not food or a nutrition label at all (a document, textbook page, screenshot, person, object, etc.). Do not guess or invent data in this case.

Return ONLY a JSON object — no extra text, no markdown:
{
  "image_type": "prepared_food" | "packaged_label" | "not_food",
  "food_name": "<food or product name you see, or empty string if not_food>",
  "emoji": "<single emoji for this food>",
  "calories": <realistic kcal for the portion shown, or as printed on the label; 0 if not_food>,
  "protein": <grams; 0 if not_food>,
  "carbs": <grams; 0 if not_food>,
  "fat": <grams; 0 if not_food>,
  "harmful_ingredients": ["<concerning ingredients if any, else empty array>"],
  "health_score": <score from 1 to 10 based on nutritional quality; 0 if not_food>,
  "recommendation": "<clear yes or no recommendation with specific reason; empty string if not_food>",
  "summary": "<one sentence health note>"
}`;

  const content = await callOpenRouter(base64, prompt, 900);
  if (!content) throw new Error('No response from AI');

  const parsed = parseJSON(content);
  if (!parsed?.image_type) throw new Error('Could not parse response');

  if (parsed.image_type === 'not_food') {
    throw new Error("This doesn't look like food or a nutrition label. Try a clearer photo of a meal or a product label.");
  }
  if (!parsed.food_name || parsed.calories === undefined) throw new Error('Could not parse nutrition data');

  return coerceNumbers(parsed);
}

// ── Main entry ─────────────────────────────────────────────────────────────
export async function analyzeFood(
  imageUri: string,
  extraDetails?: string,
  dietGoal?: string
) {
  const base64 = await imageToBase64(imageUri);
  const result = await analyzeImageUnified(base64, extraDetails, dietGoal);
  console.log('Image type:', result.image_type);
  return result;
}

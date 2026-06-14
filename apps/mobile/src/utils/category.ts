// Maps a food category to an emoji shown next to plant names.
export const CATEGORY_EMOJI: Record<string, string> = {
  fruit: "🍎",
  vegetable: "🥦",
  legume: "🫘",
  grain: "🌾",
  nut: "🥜",
  seed: "🌻",
  mushroom: "🍄",
};

export function categoryEmoji(category?: string | null): string {
  return (category && CATEGORY_EMOJI[category]) || "🌱";
}

export const MESSAGES = {
  high: [ // >= 90%
    "This is what discipline looks like when nobody's watching. Keep the streak alive.",
    "You showed up and you finished. That's the whole game, over and over again.",
    "Today went the way you planned it. That's not luck, that's the plan working.",
    "Clean day. Bank it and move on to the next one.",
    "You did what you said you'd do. Most people don't.",
  ],
  mid: [ // 80-89%
    "Solid day. A few things slipped, but the bulk of the work got done.",
    "Good progress. Close the loop on what's left tomorrow instead of letting it pile up.",
    "You kept your word to yourself for most of today. That counts.",
    "Not perfect, but you moved forward. Tomorrow, finish what's left.",
  ],
  low: [ // < 80%
    "Go watch that manhwa. Have fun. Just don't reach the end of the year saying 'I could've done it' when you know you chose not to.",
    "You didn't run out of time. You spent it somewhere else. Remember that when you look at what you wanted by the end of the year.",
    "Nobody took today from you. You handed it over. That's a different thing entirely.",
    "The plan wasn't wrong. You just didn't follow it. Be honest about which one it was.",
    "This is the version of today you chose. Make sure it's the version you meant to choose.",
  ],
};

const STORAGE_KEY = 'usedMotivationIds';

function tierFor(pct) {
  if (pct >= 90) return 'high';
  if (pct >= 80) return 'mid';
  return 'low';
}

// Avoids repeating a message until the tier's pool is exhausted, then resets.
export function pickMessage(pct, usedIds = []) {
  const tier = tierFor(pct);
  const pool = MESSAGES[tier];
  const tierIds = pool.map((_, i) => `${tier}:${i}`);
  let available = tierIds.filter((id) => !usedIds.includes(id));
  if (available.length === 0) available = tierIds;
  const chosenId = available[Math.floor(Math.random() * available.length)];
  const [, idxStr] = chosenId.split(':');
  return { id: chosenId, text: pool[Number(idxStr)], tier };
}
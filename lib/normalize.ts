const COMPANY_SUFFIXES = [
  "ltd",
  "limited",
  "plc",
  "llp",
  "group",
  "uk",
  "co",
  "company",
  "holdings"
];

export function normalizeCompanyName(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[\u2018\u2019']/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const words = base.split(" ").filter(Boolean);
  while (words.length && COMPANY_SUFFIXES.includes(words[words.length - 1])) {
    words.pop();
  }

  return words.join(" ");
}

export function similarityScore(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;

  const aSet = new Set(a.split(" "));
  const bSet = new Set(b.split(" "));
  const intersection = [...aSet].filter((word) => bSet.has(word)).length;
  const union = new Set([...aSet, ...bSet]).size;

  return union === 0 ? 0 : intersection / union;
}

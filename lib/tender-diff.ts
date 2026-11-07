export type TenderTextComparison = {
  addedCount: number;
  removedCount: number;
  addedSamples: string[];
  removedSamples: string[];
  summary: string;
};

function splitIntoSegments(value: string): string[] {
  const text = value.trim();
  if (!text) return [];

  const sentences = text
    .replace(/([.!?;:])\s+/g, (_match, punctuation: string) => punctuation + "\n")
    .replace(/\s+\|\s+|\s+-->\s+/g, "\n")
    .split(/\r?\n/)
    .map((part) => part.trim())
    .filter(Boolean);

  const segments: string[] = [];

  for (const sentence of sentences) {
    if (sentence.length <= 320) {
      segments.push(sentence);
      continue;
    }

    const words = sentence.match(/\S+/g) || [];

    for (let index = 0; index < words.length; index += 40) {
      segments.push(words.slice(index, index + 40).join(" "));
    }
  }

  return segments;
}

function countSegments(segments: string[]): Map<string, number> {
  const counts = new Map<string, number>();

  for (const segment of segments) {
    counts.set(segment, (counts.get(segment) || 0) + 1);
  }

  return counts;
}

export function compareTenderText(
  previousText: string,
  currentText: string
): TenderTextComparison {
  const previous = countSegments(splitIntoSegments(previousText));
  const current = countSegments(splitIntoSegments(currentText));

  const addedSamples: string[] = [];
  const removedSamples: string[] = [];
  let addedCount = 0;
  let removedCount = 0;

  current.forEach((count, segment) => {
    const difference = count - (previous.get(segment) || 0);

    if (difference > 0) {
      addedCount += difference;

      if (addedSamples.length < 12) {
        addedSamples.push(segment.slice(0, 240));
      }
    }
  });

  previous.forEach((count, segment) => {
    const difference = count - (current.get(segment) || 0);

    if (difference > 0) {
      removedCount += difference;

      if (removedSamples.length < 12) {
        removedSamples.push(segment.slice(0, 240));
      }
    }
  });

  let summary: string;

  if (addedCount > 0 && removedCount > 0) {
    summary = `Possible page-text change: ${addedCount} text segment(s) added and ${removedCount} removed. Review the evidence below to assess whether this affects the tender.`;
  } else if (addedCount > 0) {
    summary = `Possible page-text change: ${addedCount} text segment(s) added. Review the evidence below to assess whether this affects the tender.`;
  } else if (removedCount > 0) {
    summary = `Possible page-text change: ${removedCount} text segment(s) removed. Review the evidence below to assess whether this affects the tender.`;
  } else {
    summary = "The monitored page text differs from the previous successful snapshot. Review the page to determine whether this represents a tender amendment.";
  }

  return {
    addedCount,
    removedCount,
    addedSamples,
    removedSamples,
    summary,
  };
}
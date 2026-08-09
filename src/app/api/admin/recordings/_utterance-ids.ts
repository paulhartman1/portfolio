import { randomUUID } from 'crypto';

export interface RawUtterance {
  start: number;
  end: number;
  speaker: number;
  transcript: string;
  provider_speaker_key?: string;
  confidence?: number;
}

export interface Utterance extends RawUtterance {
  id: string;
}

type UtteranceKey = `speaker:${number}|start:${number}|end:${number}|text:${string}`;

function utteranceKey(u: RawUtterance): UtteranceKey {
  return `speaker:${u.speaker}|start:${u.start}|end:${u.end}|text:${u.transcript}`;
}

export function reconcileUtteranceIds(
  freshUtterances: RawUtterance[],
  previousUtterances: Utterance[] | null
): Utterance[] {
  const idPool = new Map<UtteranceKey, string[]>();

  if (previousUtterances) {
    for (const u of previousUtterances) {
      const key = utteranceKey(u);
      const arr = idPool.get(key) || [];
      arr.push(u.id);
      idPool.set(key, arr);
    }
  }

  const result: Utterance[] = [];

  for (const fresh of freshUtterances) {
    const key = utteranceKey(fresh);
    const pool = idPool.get(key);
    let id: string;

    if (pool && pool.length > 0) {
      id = pool.shift()!;
    } else {
      id = randomUUID();
    }

    result.push({ ...fresh, id });
  }

  return result;
}
/**
 * 分析フレーズから figure を起こす。
 *
 * 「おと「し」て「し」まう」のように、注目する音を「」で囲んだ一行を渡すと、
 * フレーズ全体を units に並べ、「」で囲まれていた位置を highlight にする。
 * 前後の文脈ごと並べるのは、対称がフレーズのどこで起きているかを図に残すため。
 *
 * 同じフレーズに呼応が二組あるときは、二組目を〈〉、三組目を〔〕で囲む。
 * 括弧の種類がそのまま組になり、図では組ごとに色が変わって別々の弧で結ばれる。
 *
 * 規則で決まる変換なので、書き手が figure の座標や添字を考える必要はない。
 */

import { normalizeHighlight, type Figure, type Highlight } from './figure';

/** 直前の音に結合する文字（拗音・小書き仮名・長音符） */
const COMBINING = /[ゃゅょャュョぁぃぅぇぉァィゥェォヵヶーｰ]/;

/** 囲みの種類。並び順がそのまま呼応の組になる */
const BRACKETS: ReadonlyArray<readonly [string, string]> = [
  ['「', '」'],
  ['〈', '〉'],
  ['〔', '〕'],
];

/** units の上限。著作権上のガードレールなので緩めない */
const MAX_UNITS = 8;

export class PhraseError extends Error {}

export interface ParsedPhrase {
  figure: Figure;
  /** 上限に収めるために落とした文脈の音数 */
  trimmed: { head: number; tail: number };
}

interface Token {
  text: string;
  /** 何組目の囲みか。囲みの外なら null */
  group: number | null;
}

/**
 * 囲みの中を 1 枠、囲みの外は 1 音 1 枠として並べる。
 * どの組も囲みが 2 つ未満なら、何と何が呼応しているのか決まらないのでエラーにする。
 */
export function parsePhrase(phrase: string): ParsedPhrase {
  const tokens = tokenize(phrase);

  const used = [...new Set(tokens.flatMap((t) => (t.group === null ? [] : [t.group])))].sort(
    (a, b) => a - b,
  );
  if (used.length === 0) {
    throw new PhraseError('注目する音を「」で囲んでください（例: おと「し」て「し」まう）');
  }
  for (const group of used) {
    if (tokens.filter((t) => t.group === group).length < 2) {
      const [open, close] = BRACKETS[group];
      throw new PhraseError(
        `${open}${close}で囲んだ音が1つしかありません。呼応する相手も同じ括弧で囲んでください`,
      );
    }
  }

  const first = tokens.findIndex((t) => t.group !== null);
  const last = tokens.findLastIndex((t) => t.group !== null);

  // 上限を超えるぶんは、呼応している範囲を必ず残したまま、外側の文脈から削る
  let start = 0;
  let end = tokens.length - 1;
  while (end - start + 1 > MAX_UNITS) {
    const head = first - start;
    const tail = end - last;
    if (head === 0 && tail === 0) {
      throw new PhraseError(
        `呼応している範囲そのものが${end - start + 1}音あり、上限の${MAX_UNITS}音に収まりません。` +
          '（長い連続は歌詞の再現に近づくため、囲む範囲を狭めてください）',
      );
    }
    if (head >= tail) start++;
    else end--;
  }

  const scoped = tokens.slice(start, end + 1);
  const units = scoped.map((t) => t.text);

  const tooLong = units.find((u) => [...u].length > 4);
  if (tooLong !== undefined) {
    throw new PhraseError(`「${tooLong}」は1枠に収まりません（1枠は4文字まで）`);
  }

  const byGroup = new Map<number, number[]>();
  scoped.forEach((token, index) => {
    if (token.group === null) return;
    const positions = byGroup.get(token.group) ?? [];
    positions.push(index);
    byGroup.set(token.group, positions);
  });
  const ordered = [...byGroup.entries()].sort(([a], [b]) => a - b).map(([, positions]) => positions);

  // 一組だけなら [2, 4] の平たい形にする（読みやすさのため）
  const highlight: Highlight = ordered.length === 1 ? ordered[0] : ordered;

  return {
    figure: { kind: 'symmetry', units, highlight },
    trimmed: { head: start, tail: tokens.length - 1 - end },
  };
}

function tokenize(phrase: string): Token[] {
  const tokens: Token[] = [];
  let open: number | null = null;
  let buffer = '';

  for (const ch of phrase) {
    const opening = BRACKETS.findIndex(([o]) => o === ch);
    const closing = BRACKETS.findIndex(([, c]) => c === ch);

    if (opening !== -1) {
      if (open !== null) {
        throw new PhraseError(`${BRACKETS[open][0]}が${BRACKETS[open][1]}で閉じられていません`);
      }
      open = opening;
      buffer = '';
      continue;
    }
    if (closing !== -1) {
      if (open === null) throw new PhraseError(`${ch}に対応する${BRACKETS[closing][0]}がありません`);
      if (open !== closing) {
        throw new PhraseError(`${BRACKETS[open][0]}を${ch}で閉じています（括弧の種類が揃いません）`);
      }
      if (buffer !== '') tokens.push({ text: buffer, group: open });
      buffer = '';
      open = null;
      continue;
    }
    if (open !== null) {
      buffer += ch;
      continue;
    }

    // 囲みの外は1音ずつ。空白と読点は区切りとして捨てる
    if (/[\s、,]/.test(ch)) continue;
    const prev = tokens.at(-1);
    if (prev && prev.group === null && COMBINING.test(ch)) {
      prev.text += ch;
    } else {
      tokens.push({ text: ch, group: null });
    }
  }

  if (open !== null) {
    throw new PhraseError(`${BRACKETS[open][0]}が${BRACKETS[open][1]}で閉じられていません`);
  }
  return tokens;
}

/** frontmatter にそのまま貼れる YAML を組み立てる */
export function toYaml(figure: Figure): string {
  const units = figure.units.map((u) => `"${u}"`).join(', ');
  const groups = normalizeHighlight(figure.highlight);
  const highlight =
    groups.length <= 1
      ? `[${(groups[0] ?? []).join(', ')}]`
      : `[${groups.map((g) => `[${g.join(', ')}]`).join(', ')}]`;

  return [
    'figure:',
    `  kind: ${figure.kind}`,
    `  units: [${units}]`,
    `  highlight: ${highlight}`,
  ].join('\n');
}

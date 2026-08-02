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

import {
  normalizeHighlight,
  type ConsonantFigure,
  type Highlight,
  type PivotFigure,
  type SingleFigure,
} from './figure';

import { COMBINING } from './text';

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
  figure: SingleFigure;
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
    figure: { kind: 'single', units, highlight },
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

/**
 * ピボットでは**点の数を制限しない**（2026-08-02、やおき指摘）。
 *
 * single の上限 8 は「連続した音が並ぶと歌詞の再現に近づく」ことによる制約である。
 * ピボットの点は伏せ字を挟んで散在するので、何点あっても歌詞にならない。
 * 効くのは下の総枠数（レイアウト都合）と、1 枠 4 文字（連なりを畳むと歌詞の断片が出る）。
 */
/**
 * 1 行に置ける枠の総数。著作権ではなくレイアウト上の都合。
 * 24 枠で 1 枠あたり約 32px になり、カードページでは明瞭に読めるが（実測）、
 * SNS で 1/3 に縮むと 11px 前後で苦しい。16 枠までが快適圏。
 */
const MAX_PIVOT_LENGTH = 24;

/**
 * ピボット用のフレーズを読む。
 *
 * 書き方は single と同じで、軸となる音を「」で囲む。違うのは囲みの外の扱いで、
 * single が文字を並べるのに対し、こちらは**伏せる**（図には印だけが出て文字は出ない）。
 * そのため上限 8 は総枠数ではなく、囲んだ音の数に掛かる。
 *
 * 行をまたいで続くピボットは、行ごとに分けて渡す（最大 2 行）。
 * これは離れた 2 箇所の対比（pair）ではなく、1 箇所が改行を含むという意味である。
 */
export function parsePivotPhrase(lines: string[], axis: string): PivotFigure {
  if (axis.trim() === '') {
    throw new PhraseError('軸のラベルを指定してください（例: --pivot カ行子音）');
  }
  if (lines.length === 0 || lines.length > 2) {
    throw new PhraseError(`行は 1〜2 行です（${lines.length} 行が渡されました）`);
  }

  const rows = lines.map((line) => {
    const tokens = tokenize(line);
    if (tokens.length > MAX_PIVOT_LENGTH) {
      throw new PhraseError(
        `1 行が ${tokens.length} 枠あり、上限の ${MAX_PIVOT_LENGTH} 枠を超えます。` +
          '（枠が細くなりすぎて、SNS で縮んだときに読めなくなります）',
      );
    }
    const pivots = tokens.flatMap((token, index) =>
      token.group === null ? [] : [{ at: index, unit: token.text }],
    );
    if (pivots.length === 0) {
      throw new PhraseError('軸となる音を「」で囲んでください（例: いつ「か」「か」ならず「か」）');
    }
    // 1 枠に押し込める文字数の上限は single と同じ。ここを緩めると、
    // 伏せた枠の間に長い連なりが現れて「伏せているから歌詞ではない」が崩れる
    const tooLong = pivots.find((p) => [...p.unit].length > 4);
    if (tooLong !== undefined) {
      throw new PhraseError(
        `「${tooLong.unit}」は1枠に収まりません（1枠は4文字まで）。` +
          'ピボットは1音ずつ散らばる様子を見る図なので、連なりを1枠に畳むなら single を使ってください',
      );
    }
    return { length: tokens.length, pivots };
  });

  return { kind: 'pivot', axis, rows };
}

/** ピボットの YAML。frontmatter にそのまま貼れる */
export function toPivotYaml(figure: PivotFigure): string {
  const lines = ['figure:', `  kind: ${figure.kind}`, `  axis: "${figure.axis}"`, '  rows:'];
  for (const row of figure.rows) {
    lines.push(`    - length: ${row.length}`);
    lines.push('      pivots:');
    for (const p of row.pivots) {
      lines.push(`        - { at: ${p.at}, unit: "${p.unit}" }`);
    }
  }
  return lines.join('\n');
}

/**
 * 子音の並びを、歌詞に対応づけて読む。
 *
 * 歌詞の側はカード本文の <LyricQuote> をそのまま渡せる（記号を振る範囲が「」で
 * 囲まれている）。記号の側は本文に書いた並びをそのまま渡せる。
 *
 *   parseConsonantPhrase(
 *     ['そこからながれ「ていけ」るようなせ「かい」をみ「つけたい」'],
 *     ['tΦk kΦ tktΦ'],
 *   )
 *
 * 囲みの数と記号の群の数、囲んだ音の数と群の文字数が一致していなければ止める。
 * ずれたまま図にすると、どの音がどの子音かという対応そのものが嘘になるため。
 */
export function parseConsonantPhrase(
  lines: string[],
  markLines: string[],
  fold = false,
  subLines: string[] = [],
): ConsonantFigure {
  if (lines.length === 0 || lines.length > 4) {
    throw new PhraseError(`行は 1〜4 行です（${lines.length} 行が渡されました）`);
  }
  if (markLines.length !== lines.length) {
    throw new PhraseError(
      `歌詞が ${lines.length} 行、記号が ${markLines.length} 行あります。数を合わせてください`,
    );
  }

  const rows = lines.map((line, rowIndex) => {
    // 既定では囲みの中も 1 音ずつ枠にする。どの音がどの記号かを 1 対 1 で
    // 見せるのがこの図の目的だから。
    //
    // fold のときは囲みを 1 枠に畳む。2 モーラで 1 つの音節をなしていること
    // 自体が観察である場合（シラブル化）は、畳んだ形が主張そのものになる。
    // 畳んだ枠には描画側が括りを付ける
    const units: string[] = [];
    const marked: number[] = [];
    let open = false;
    let buffer = '';
    for (const ch of line) {
      if (ch === '「') {
        if (open) throw new PhraseError('「が」で閉じられていません');
        open = true;
        buffer = '';
        continue;
      }
      if (ch === '」') {
        if (!open) throw new PhraseError('」に対応する「がありません');
        open = false;
        if (fold) {
          if (buffer === '') throw new PhraseError('「」の中が空です');
          units.push(buffer);
          marked.push(units.length - 1);
          buffer = '';
        }
        continue;
      }
      if (/[\s、,]/.test(ch)) continue;
      if (open && fold) {
        buffer += ch;
        continue;
      }
      const prev = units.length - 1;
      if (prev >= 0 && COMBINING.test(ch)) {
        units[prev] += ch;
        continue;
      }
      units.push(ch);
      if (open) marked.push(units.length - 1);
    }
    if (open) throw new PhraseError('「が」で閉じられていません');

    // fold では群がそのまま 1 記号（CVV など）。既定では群の 1 文字が 1 記号
    const groups = markLines[rowIndex]
      .trim()
      .split(/\s+/)
      .filter((g) => g !== '');
    const symbols = fold ? groups : groups.flatMap((group) => [...group]);
    if (symbols.length !== marked.length) {
      throw new PhraseError(
        `${rowIndex + 1} 行目: 囲んだ音が ${marked.length} 個、記号が ${symbols.length} 個です。` +
          '数が合わないと、どの音がどの子音かという対応が嘘になります',
      );
    }
    // 下の段。渡されていれば上の段と同じ規則で割る
    const subGroups = (subLines[rowIndex] ?? '')
      .trim()
      .split(/\s+/)
      .filter((g) => g !== '');
    const subs = fold ? subGroups : subGroups.flatMap((group) => [...group]);
    if (subs.length > 0 && subs.length !== marked.length) {
      throw new PhraseError(
        `${rowIndex + 1} 行目: 囲んだ音が ${marked.length} 個、下の段の記号が ${subs.length} 個です`,
      );
    }
    return {
      units,
      marks: marked.map((at, i) => ({
        at,
        symbol: symbols[i],
        ...(subs.length > 0 ? { sub: subs[i] } : {}),
      })),
    };
  });

  return { kind: 'consonant', rows };
}

/** 子音の並びの YAML */
export function toConsonantYaml(figure: ConsonantFigure): string {
  const lines = ['figure:', `  kind: ${figure.kind}`, '  rows:'];
  for (const row of figure.rows) {
    lines.push(`    - units: [${row.units.map((u) => `"${u}"`).join(', ')}]`);
    lines.push('      marks:');
    if (row.marks.length === 0) lines[lines.length - 1] = '      marks: []';
    for (const m of row.marks) {
      const sub = m.sub === undefined ? '' : `, sub: "${m.sub}"`;
      lines.push(`        - { at: ${m.at}, symbol: "${m.symbol}"${sub} }`);
    }
  }
  return lines.join('\n');
}

/** frontmatter にそのまま貼れる YAML を組み立てる */
export function toYaml(figure: SingleFigure): string {
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

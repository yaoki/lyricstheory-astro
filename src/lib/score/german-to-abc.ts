/**
 * ドイツ音名を ABC notation に変換する。
 *
 * やおきは譜例をドイツ音名で書く（`Des-C-As`）。ABC は英米音名なので、
 * H = B / B = B♭ の取り違えがここで必ず起きる。人手で変換せず、この関数を通す。
 *
 * オクターブは省略できる。省略時は direction（下行 / 上行）に従い、
 * 直前の音から最も近いものを取る。最初の音だけは startOctave で決まる。
 */

/** 音名（幹音）→ 半音位置 */
const STEP_SEMITONE: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, H: 11 };

/** ドイツ音名の幹音 → ABC（英米）の綴り。H だけがずれる */
const STEP_ABC: Record<string, string> = { C: 'C', D: 'D', E: 'E', F: 'F', G: 'G', A: 'A', H: 'B' };

export type Direction = 'down' | 'up' | 'near';

interface ParsedNote {
  step: string;
  alter: number;
  octave: number | null;
}

/**
 * 1音を解析する。`Des` `Es` `As` `Fis` `H` `B` `Des5` などを受ける。
 *
 * ドイツ音名の綴りは変化形が2通りある。母音で終わる幹音は `s` だけを足し
 * （E→Es、A→As）、それ以外は `es` を足す（D→Des、G→Ges）。B は H の変化形で、
 * `Hes` とは書かない。
 */
function parseNote(raw: string): ParsedNote {
  const token = raw.trim();
  const m = token.match(/^([CDEFGAHB])([a-z]*)(\d*)$/);
  if (!m) throw new Error(`音名として読めません: "${raw}"`);

  const [, letter, suffix, octaveText] = m;
  let step = letter;
  let alter = 0;

  if (letter === 'B' && suffix === '') {
    // ドイツ音名の B は H の半音下。英米の B（＝ドイツの H）ではない
    step = 'H';
    alter = -1;
  } else if (letter === 'B') {
    throw new Error(`B に接尾辞は付きません: "${raw}"（H の変化形は B 単独で書く）`);
  } else if (suffix === '') {
    alter = 0;
  } else if (suffix === 'is') {
    alter = 1;
  } else if (suffix === 'isis') {
    alter = 2;
  } else if (suffix === 'es' || suffix === 's') {
    alter = -1;
  } else if (suffix === 'eses' || suffix === 'ses') {
    alter = -2;
  } else {
    throw new Error(`変化記号として読めません: "${raw}"（is / isis / es / eses）`);
  }

  return { step, alter, octave: octaveText ? Number(octaveText) : null };
}

/** MIDI 番号（C4 = 60）。オクターブ推定の比較に使うだけで、出力には現れない */
function midiOf(step: string, alter: number, octave: number): number {
  return (octave + 1) * 12 + STEP_SEMITONE[step] + alter;
}

/**
 * オクターブの省略を埋める。
 *
 * direction が down なら直前の音より下、up なら上で、いちばん近いものを取る。
 * near は上下を問わず最も近いもの（同度は上を採る）。
 */
function resolveOctaves(
  notes: ParsedNote[],
  direction: Direction,
  startOctave: number,
): Array<ParsedNote & { octave: number }> {
  const out: Array<ParsedNote & { octave: number }> = [];
  let prevMidi: number | null = null;

  for (const note of notes) {
    let octave: number;

    if (note.octave !== null) {
      octave = note.octave;
    } else if (prevMidi === null) {
      octave = startOctave;
    } else {
      const candidates: number[] = [];
      for (let o = 0; o <= 9; o++) {
        const midi = midiOf(note.step, note.alter, o);
        if (direction === 'down' && midi < prevMidi) candidates.push(o);
        else if (direction === 'up' && midi > prevMidi) candidates.push(o);
        else if (direction === 'near') candidates.push(o);
      }
      if (candidates.length === 0) {
        throw new Error(`${direction === 'down' ? '下行' : '上行'}で置ける音がありません: ${note.step}`);
      }
      // 直前の音にいちばん近いものを選ぶ
      octave = candidates.reduce((best, o) =>
        Math.abs(midiOf(note.step, note.alter, o) - prevMidi!) <
        Math.abs(midiOf(note.step, note.alter, best) - prevMidi!)
          ? o
          : best,
      );
    }

    prevMidi = midiOf(note.step, note.alter, octave);
    out.push({ ...note, octave });
  }

  return out;
}

/**
 * ABC の音符表記に直す。
 * ABC のオクターブは大小文字で切り替わる（C = C4 の段、c = C5 の段）。
 */
function toAbcNote(note: ParsedNote & { octave: number }): string {
  const accidental =
    note.alter === 2 ? '^^' : note.alter === 1 ? '^' : note.alter === -1 ? '_' : note.alter === -2 ? '__' : '';
  const letter = STEP_ABC[note.step];

  if (note.octave >= 5) {
    return accidental + letter.toLowerCase() + "'".repeat(note.octave - 5);
  }
  return accidental + letter + ','.repeat(4 - note.octave);
}

export interface ScoreInput {
  /** ドイツ音名。`Des-C-As` / `Des C As` / `Des5 C5 As4` */
  notes: string;
  /** 歌詞。音符と同数。`む う ど` */
  lyrics?: string;
  /** オクターブ省略時の解決方向 */
  direction?: Direction;
  /** 最初の音のオクターブ（省略時 5 = 中央ハの1つ上の段） */
  startOctave?: number;
}

/**
 * ドイツ音名 → ABC notation。
 *
 * Verovio の ABC インポータには2つの制約がある（2026-08-02、6.2.0 で実測）。
 * どちらも外すと音符が1つも読まれない。
 *   1. 音符行の末尾に小節線 `|` が要る
 *   2. 改行は LF のみ（CRLF は不可）
 */
export function germanToAbc({ notes, lyrics, direction = 'near', startOctave = 5 }: ScoreInput): string {
  const tokens = notes.trim().split(/[\s-]+/).filter(Boolean);
  if (tokens.length === 0) throw new Error('音名が空です');

  const parsed = tokens.map(parseNote);
  const resolved = resolveOctaves(parsed, direction, startOctave);
  const body = resolved.map(toAbcNote).join('');

  const syllables = lyrics ? lyrics.trim().split(/\s+/).filter(Boolean) : [];
  if (syllables.length > 0 && syllables.length !== tokens.length) {
    throw new Error(`歌詞の数が音符と合いません（音符 ${tokens.length} / 歌詞 ${syllables.length}）`);
  }

  const lines = [
    'X:1',
    // 拍子記号は CSS で隠す。M: を落とすと Verovio が既定の 4/4 を当てるため、
    // 音符数に合わせておかないと余った拍ぶんの休符が描かれる
    `M:${tokens.length}/4`,
    'L:1/4',
    'K:C',
    `${body}|`,
  ];
  if (syllables.length > 0) lines.push(`w:${syllables.join(' ')}`);

  return lines.join('\n') + '\n';
}

/**
 * SVG テキストの整形。
 *
 * resvg は <text> を自動折り返ししないため、行分割を自前で行う（仕様書 §5.5）。
 * 幅は、全角を 1em、ASCII をフォントの実測値（下の ASCII_ADVANCE）、半角カナを 0.5em で見積もる。
 */

/**
 * 行頭に置かない文字（終わり括弧・句読点・長音・小書き仮名・波ダッシュ）。
 *
 * 波ダッシュ（〜 / ～）は JIS X 4051 のハイフン類で、行頭禁則にあたる。
 * 抜けていたため「（1-B 1」／「〜2行目）」と範囲の途中で折れていた（2026-09-14、figure-critic 判定）
 */
const NO_LINE_START = '、。，．：；？！ー・…‥）〕］｝〉》」』】〙〗’”ゝゞヽヾっゃゅょぁぃぅぇぉッャュョァィゥェォ〜～';

/** 行末に置かない文字（始め括弧） */
const NO_LINE_END = '（〔［｛〈《「『【〘〖‘“';

/** 半角カナは半角幅として扱う */
const HALF_WIDTH_KANA = /[｡-ﾟ]/;

/**
 * ASCII（U+0020〜U+007E）の送り幅。1000 分の 1em 単位。
 *
 * fonts/NotoSansJP-{Bold,Regular}.ttf の hmtx を fontTools で読み、字ごとに太いほうを採った
 * （2026-09-15）。題は Bold、手がかりは Regular で描くので、どちらに使っても狭く見積もらない。
 * **フォントを差し替えたら測り直すこと。**
 *
 * それまでは ASCII を一律 0.5em としていた。Noto Sans JP の英数字はプロポーショナルで、
 * 大文字の太字は 0.6〜0.9em ある。「BUMP OF CHICKEN」は見積もり 7.5em に対し実測 9.21em で、
 * 車輪の唄の題が右の版面（x=1120）を越えて x=1183 まで伸びていた（2026-09-14、figure-critic 判定）。
 * 2026-09-15 に全 178 枚を画素で走査すると、題が x=1120 を越えていたのは 69 枚（うちピボット図 37 枚）。
 * 逆に空白は 0.227em しかない
 */
// prettier-ignore
const ASCII_ADVANCE = [
  227, 370, 575, 589, 589, 963, 739, 325, 378, 378, 506, 589, 325, 370, 325, 392, //  !"#$%&'()*+,-./
  589, 589, 589, 589, 589, 589, 589, 589, 589, 589, 325, 325, 589, 589, 589, 514, // 0123456789:;<=>?
  1007, 641, 681, 657, 714, 615, 585, 717, 757, 330, 568, 686, 578, 854, 749, 770, // @ABCDEFGHIJKLMNO
  667, 770, 682, 624, 625, 748, 618, 915, 627, 581, 613, 378, 392, 378, 589, 567, // PQRSTUVWXYZ[\]^_
  626, 591, 644, 527, 644, 581, 372, 597, 640, 304, 306, 605, 315, 964, 641, 626, // `abcdefghijklmno
  644, 644, 436, 495, 420, 637, 576, 863, 562, 574, 511, 378, 296, 378, 589, // pqrstuvwxyz{|}~
];

export function charWidthEm(ch: string): number {
  const code = ch.codePointAt(0)!;
  if (code >= 0x20 && code <= 0x7e) return ASCII_ADVANCE[code - 0x20] / 1000;
  return HALF_WIDTH_KANA.test(ch) ? 0.5 : 1;
}
// 2026-08-04: 小書き仮名（ゃゅょ・っ）と長音記号を 0.55em として扱った時期があるが、
// 撤回した。fonts/NotoSansJP-Bold.ttf の送り幅を実測すると、これらは「あ」「か」と
// 同じ 1em である。0.55 は過小評価で、枠幅より広く描かれることになる。
// 「りゅ」を含む行で字が細っていた問題は、ここではなく pivot 側の
// 「枠の見積もりで字の大きさを割っていた」ことが原因だった（そちらで解決済み）。

/** 直前の音に結合する文字（拗音・小書き仮名・長音符）。1 音として数えない */
export const COMBINING = /[ゃゅょャュョぁぃぅぇぉァィゥェォヵヶーｰ]/;

/**
 * 1 枠が何モーラぶんか。
 *
 * 「しゃ」は 2 文字だが 1 モーラ、「かな」は 2 文字で 2 モーラ。
 * 図で「複数の音を 1 枠に畳んである」ことを示すかどうかの判定に使う
 * （畳んだ枠には括りを付けるが、拗音には付けない）。
 */
export function moraCount(unit: string): number {
  return [...unit].filter((ch) => !COMBINING.test(ch)).length;
}

export function widthEm(text: string): number {
  return [...text].reduce((sum, ch) => sum + charWidthEm(ch), 0);
}

/** 空白を除く ASCII。連なりを 1 語にする */
const ASCII_WORD = /[\x21-\x7e]/;
const ALNUM = /[A-Za-z0-9]/;
/** 英数字に挟まれたときだけ語に入れる文字（「1〜2」） */
const INNER_JOINER = /[〜～]/;
const KATAKANA = /[\p{Script=Katakana}ー]/u;
const HAN = /\p{Script=Han}/u;
/** 英数字に続けて 1 語にする漢字の数。助数詞（「2行目」「4連続」「5度」）を割らない長さ */
const HAN_TAIL_MAX = 2;
/** カタカナ 1 字に続けて 1 語にする字。五十音の行と段（「タ行」「オ段」） */
const GOJUON_SUFFIX = /[行段]/;
const HIRAGANA = /\p{Script=Hiragana}/u;
/** 2 つ以上続けて使い、あいだで割らない記号（JIS X 4051 の分離禁止文字） */
const INSEPARABLE = /[─—―…‥]/;

/**
 * 折り返しの単位に切る。分かち書きの解析はしない。字の種類の切り替わりだけを見て、次のものを 1 語にまとめる。
 * それ以外（語の頭に立つひらがな、記号）は 1 文字ずつになる。
 *
 * - 空白を除く ASCII の連なり（「ABA」「1-A'」「Mr.Children」「/t/」）。英数字に挟まれた
 *   波ダッシュも含める（「1〜2」）
 * - カタカナの連なり（「ピボット」「ラストサビ」）。英数字またはハイフンの直後なら、
 *   その語に続ける（「1-サビ」）。カタカナ 1 字に「行」「段」が続けば、それも含める（「タ行」「オ段」）。
 *   数と助数詞が続けば、それも含める（「ア6連続」）
 * - 漢字の連なり（「子音」「密集」）。英数字の直後なら 2 字までをその語に続ける（「1〜2行目」「4連続」「CV反復」）。
 *   ハイフンの直後なら全部を続ける（「-愛のある場所-」の「-愛のある」）
 * - 同じ分離禁止文字の連なり（「──」「……」）
 *
 * 漢字語・カタカナ語の直後に続くひらがなの連なりは、その語に付ける（「タ行の」「保たれる」「愛のある」）。
 * 送り仮名と付属語は前の自立語に付くので、折るなら文節の境目で折る（CLAUDE.md「図の決めごと」の
 * 自動落としと同じ考え方）。括弧書きに続くひらがなは groupBrackets が付ける（「「たぱ」から」）。
 * ひらがなだけの語が続けば、それも前の語に付いてしまう（語が長くなって早めに折れるだけで、語の途中では折れない）
 *
 * 英数字の連なりしか 1 語にしていなかったため、題の括弧内が「（1-サ」／「ビ 1〜2行目）」の
 * ように語の途中で折れていた（2026-09-14、figure-critic 判定）。題の形は
 * 「アーティスト『曲名』：観察名（節 行目）」なので、節と行目がそれぞれ割れなければ、
 * 折れるのは括弧の手前か、節と行目のあいだの空白になる。
 *
 * 漢字・「タ行」・続くひらがなをまとめるのは、幅の見積もりを実測値にしたあと、折れ目が
 * 「子音／ピボット」から「子／音ピボット」へ、「愛の／ある」から「愛のあ／る」へ、「から」が「か／ら」へ
 * 移ったため（2026-09-15、figure-critic 判定）
 */
function segments(text: string): string[] {
  const chars = [...text];
  const out: string[] = [];
  let i = 0;
  const takeWhile = (test: (ch: string) => boolean, limit = Infinity): string => {
    let taken = '';
    for (let n = 0; n < limit && i < chars.length && test(chars[i]); n++) taken += chars[i++];
    return taken;
  };
  const withKanaTail = (word: string): string => {
    const last = [...word].at(-1) ?? '';
    return HAN.test(last) || KATAKANA.test(last) ? word + takeWhile((c) => HIRAGANA.test(c)) : word;
  };

  while (i < chars.length) {
    const ch = chars[i];
    if (ASCII_WORD.test(ch)) {
      const word = takeWhile(
        (c) =>
          ASCII_WORD.test(c) ||
          (INNER_JOINER.test(c) && ALNUM.test(chars[i - 1]) && ALNUM.test(chars[i + 1] ?? '')),
      );
      const last = word.at(-1)!;
      const next = chars[i] ?? '';
      let tail = '';
      if (ALNUM.test(last) || last === '-') {
        if (KATAKANA.test(next)) tail = takeWhile((c) => KATAKANA.test(c));
        // ハイフンの後ろの漢字は、区切りなしに続く副題の頭なので全部つなぐ（「-愛のある場所-」の「-愛のある」）
        else if (HAN.test(next)) tail = takeWhile((c) => HAN.test(c), last === '-' ? Infinity : HAN_TAIL_MAX);
      }
      out.push(withKanaTail(word + tail));
    } else if (KATAKANA.test(ch)) {
      const kana = takeWhile((c) => KATAKANA.test(c));
      const suffix = [...kana].length === 1 ? takeWhile((c) => GOJUON_SUFFIX.test(c), 1) : '';
      // カタカナに続く数と助数詞もつなぐ（「ア6連続」）
      const count = suffix === '' ? takeWhile((c) => /[0-9]/.test(c)) : '';
      const counter = count === '' ? '' : takeWhile((c) => HAN.test(c), HAN_TAIL_MAX);
      out.push(withKanaTail(kana + suffix + count + counter));
    } else if (HAN.test(ch)) {
      out.push(withKanaTail(takeWhile((c) => HAN.test(c))));
    } else if (INSEPARABLE.test(ch)) {
      out.push(takeWhile((c) => c === ch));
    } else {
      out.push(ch);
      i++;
    }
  }
  return out;
}

const BRACKET_PAIRS: Record<string, string> = {
  '（': '）',
  '「': '」',
  '『': '』',
  '〔': '〕',
  '［': '］',
  '【': '】',
  '〈': '〉',
  '《': '》',
};
/** 括弧でくくった範囲を 1 語にする上限。行幅に対する比 */
const BRACKET_GROUP_MAX_RATIO = 0.75;

/**
 * 括弧でくくった範囲が短ければ、括弧ごと 1 語にする（「（1-サビ 1〜2行目）」「（AB → AXB）」「『糸』」）。
 *
 * 語の単位を細かくするだけでは、括弧の中で折れることは止まらない。禁則を追い出しにすると、
 * 閉じ括弧は直前の 1 字を連れて次の行へ移るので「（を／」／「も）」「（三」／「度）」になる
 * （2026-09-15、全カードの題を折り返して確認）。括弧の中身は題の中でひとまとまりの注記なので、
 * 行に収まる長さなら割らずに次の行へ送る。
 *
 * 上限を設けるのは、長い括弧をまとめて送ると前の行が大きく空き、残りが行数に収まらなくなるため。
 * 上限を超える括弧は、中の語の単位で折る。はじめ行幅の半分にしていたが、18em の括弧書き
 * 「（ア4連続・促音を挟む・1回目のサビ）」が中で割れた（2026-09-15、figure-critic 判定）ので 3/4 に上げた。
 * 行数に収まらなくなったときは wrapText がまとめずに組み直す
 */
function groupBrackets(segs: string[], maxGroupEm: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < segs.length; i++) {
    const close = BRACKET_PAIRS[segs[i]];
    if (close !== undefined) {
      let depth = 0;
      let j = i;
      for (; j < segs.length; j++) {
        if (segs[j] === segs[i]) depth++;
        else if (segs[j] === close && --depth === 0) break;
      }
      const group = segs.slice(i, j + 1).join('');
      if (j < segs.length && widthEm(group) <= maxGroupEm) {
        // 閉じ括弧に続くひらがなは括弧書きに付ける（「「たぱ」から」）
        let tail = '';
        while (j + 1 < segs.length && [...segs[j + 1]].every((c) => HIRAGANA.test(c))) tail += segs[++j];
        out.push(group + tail);
        i = j;
        continue;
      }
    }
    out.push(segs[i]);
  }
  return out;
}

/**
 * 行末に来たとき、字の右に空く幅（em）。閉じ括弧と句読点は字の形が em の左側にしかないので、
 * 行に収まるかはこの空白を引いた幅で判定する（JIS X 4051 の行末の半角取りと同じ考え方）。
 *
 * 値は fonts/NotoSansJP-{Bold,Regular}.ttf の字の外接矩形を fontTools で測り、狭いほうを採った（2026-09-15）。
 *
 * 追い出しに切り替えた直後は空白を数えていなかったため、「171『インターセクション』：シ の CV反復（語中に5度）」
 * （26.08em、行幅 26em）が 2 行に落ち、題が 25px 上がって図との隙間が 43px から 19px に詰まった。
 * 一律 0.5em で数えた版では「キャンディーズ『年下の男の子』：母音の保続（オ6連続）」（26.59em）が 2 行に落ちた。
 * どちらも字の右端はもとの 1 行のままで x=1120 に収まっている（2026-09-15、画素で実測と figure-critic 判定）
 */
const TRAILING_BLANK_EM: Record<string, number> = {
  '）': 0.66, '〕': 0.69, '］': 0.71, '｝': 0.68, '〉': 0.56, '》': 0.51,
  '」': 0.64, '』': 0.59, '】': 0.66, '、': 0.63, '。': 0.64, '，': 0.6, '．': 0.61,
};

/** 行に置いたときの幅。行末の約物の右の空白は数えない */
function lineWidthEm(text: string): number {
  return widthEm(text) - (TRAILING_BLANK_EM[[...text].at(-1) ?? ''] ?? 0);
}

/** 行頭に置けない語か。語の先頭の字で決まる */
const startsForbidden = (seg: string): boolean => NO_LINE_START.includes([...seg][0]);
/** 行末に置けない語か。語の末尾の字で決まる */
const endsForbidden = (seg: string): boolean => NO_LINE_END.includes([...seg].at(-1)!);

/**
 * text を maxWidthEm 幅・maxLines 行以内に分割する。
 * 収まりきらない場合は最終行の末尾を「…」に詰める。
 *
 * 禁則は**追い出し**で処理する。行頭に置けない語があふれたら、直前の語ごと次の行へ送る。
 * 行末に置けない語（始め括弧）が行末に残ったら、それも送る。
 *
 * 2026-09-15 までは、行頭に置けない字を右マージンへ 1em までぶら下げていた。ぶら下げた分だけ
 * 題の右端が矢印とクレジットの右端（x=1120）を越え、左の余白と釣り合わない。さらに小書き仮名が
 * ぶら下がると、続く 1 字だけが次の行へ落ちた（「系子音ピボッ」／「ト」）
 */
export function wrapText(text: string, maxWidthEm: number, maxLines: number): string[] {
  // 1 行に収まらない語は、語として扱わず 1 文字ずつに戻す
  const words = segments(text.trim()).flatMap((seg) => (widthEm(seg) > maxWidthEm ? [...seg] : [seg]));
  // 単位を大きく取るほど、行が早く折れて行数に収まりにくくなる。収まらなければ単位を細かくして組み直す。
  // - 括弧ごと送ったせいで収まらない: ryo『初めての恋が終わる時』（『』ごと 2 行目へ送ると 2 行目があふれる）
  // - 語ごと送ったせいで収まらない: the brilliant green『There will be love there -愛のある場所-』：
  //   /t/ と /k/ の交替（スコープを広げた見方）。語に付けたひらがなを先頭の助詞の直後で切ると
  //   「-愛の」／「ある場所-』…」で収まる。いきなり 1 字ずつに戻すと「愛のあ」／「る」と語の途中で折れた
  //   （2026-09-15、figure-critic 判定）
  // - それでも収まらなければ和文を 1 字ずつに戻す。語の途中で折れるが、題が欠けるよりよい
  const attempts = [
    groupBrackets(words, maxWidthEm * BRACKET_GROUP_MAX_RATIO),
    words,
    words.flatMap((seg) => {
      const m = seg.match(PARTICLE_SPLIT);
      return m ? [m[1], m[2]] : [seg];
    }),
    words.flatMap((seg) => (/[^\x20-\x7e]/.test(seg) ? [...seg] : [seg])),
  ];
  let lines: string[] = [];
  for (const segs of attempts) {
    lines = breakLines(segs, maxWidthEm, maxLines);
    if (!truncated(lines)) return lines;
  }
  return lines;
}

const truncated = (lines: string[]): boolean => lines.at(-1)?.endsWith('…') ?? false;

/** 漢字・カタカナで終わる語＋1 字の助詞 ／ 続くひらがな、に割る（「-愛の」「ある」） */
const PARTICLE_SPLIT = /^(.*[\p{Script=Han}\p{Script=Katakana}ー][のがをにはでとへも])(\p{Script=Hiragana}+)$/u;

function breakLines(segs: string[], maxWidthEm: number, maxLines: number): string[] {
  const lines: string[] = [];
  let line: string[] = [];

  for (let i = 0; i < segs.length; i++) {
    const seg = segs[i];
    // 空白で折れたとき、次の行の頭に空白を残さない（字下げに見える）
    if (line.length === 0 && seg === ' ') continue;

    if (line.length > 0 && lineWidthEm(line.join('') + seg) > maxWidthEm) {
      const carry: string[] = [];
      while (line.length > 0 && startsForbidden(carry[0] ?? seg)) carry.unshift(line.pop()!);
      while (line.length > 0 && (endsForbidden(line.at(-1)!) || line.at(-1) === ' ')) {
        const popped = line.pop()!;
        if (popped !== ' ') carry.unshift(popped);
      }
      // 送れる語が無い（行全体が禁則の連なり）ときは、禁則を破って折る
      if (line.length === 0) {
        line = carry.splice(0);
      }
      lines.push(line.join('').trimEnd());
      if (lines.length >= maxLines) return truncateLast(lines, [...carry, ...segs.slice(i)], maxWidthEm);
      line = carry[0] === ' ' ? carry.slice(1) : carry;
      if (line.length === 0 && seg === ' ') continue;
    }

    line.push(seg);
  }

  if (line.length > 0) lines.push(line.join('').trimEnd());
  return lines;
}

/** 行数上限に達したのに残りがある場合、最終行の末尾を「…」に置き換える（rest は残りの折り返し単位） */
function truncateLast(lines: string[], rest: string[], maxWidthEm: number): string[] {
  if (rest.length === 0) return lines;
  const last = [...lines[lines.length - 1]];
  const ellipsisEm = charWidthEm('…');
  let width = widthEm(lines[lines.length - 1]);
  while (last.length > 0 && width + ellipsisEm > maxWidthEm) {
    width -= charWidthEm(last.pop()!);
  }
  lines[lines.length - 1] = last.join('') + '…';
  return lines;
}

const XML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
};

export function escapeXml(text: string): string {
  return text.replace(/[&<>"']/g, (ch) => XML_ENTITIES[ch]);
}

/**
 * 行頭に来たとき、左半分が空白になる始め括弧。字の形は em の右半分にしかない
 * （NotoSansJP-Bold の「（」は 0.663em から始まる。英字の「B」は 0.091em）。
 */
const LEADING_HALF_BLANK = '（〔［｛〈《「『【〘〖';

/**
 * 折り返した行を <text> ブロックにする。
 * baseline は 1 行目のベースライン。dominant-baseline は resvg での挙動が読めないため使わない。
 *
 * 始め括弧で始まる行は、半角ぶん左へ寄せる（行頭の始め括弧の半角取り）。寄せずにいたため、
 * 2 行目が「（1-サビ 1〜2行目）」で始まる題は、字の左端が 1 行目より約 23px 右に出て、
 * 字下げしたように見えた（2026-09-15、figure-critic 判定）
 */
export function textBlock(
  lines: string[],
  opts: {
    x: number;
    baseline: number;
    fontSize: number;
    lineHeight: number;
    fill: string;
    fontFamily: string;
    fontWeight?: number;
  },
): string {
  const weight = opts.fontWeight ? ` font-weight="${opts.fontWeight}"` : '';
  const tspans = lines
    .map((line, i) => {
      const dy = i === 0 ? '' : ` dy="${opts.lineHeight}"`;
      const x = LEADING_HALF_BLANK.includes([...line][0] ?? '') ? opts.x - opts.fontSize / 2 : opts.x;
      return `<tspan x="${x}"${dy}>${escapeXml(line)}</tspan>`;
    })
    .join('');
  return `<text x="${opts.x}" y="${opts.baseline}" font-family="${opts.fontFamily}" font-size="${opts.fontSize}" fill="${opts.fill}"${weight}>${tspans}</text>`;
}

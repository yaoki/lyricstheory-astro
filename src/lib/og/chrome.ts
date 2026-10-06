/**
 * 図の外枠。どのテンプレートでも同じ位置に同じものが出るように、ここに集約する。
 *
 * - 左上: 分析のフレーム（C反復 / V反復 / CV反復）
 * - 左下: 署名
 * - 右下: 作詞者（引用の体裁。画像は単体で流通するため図の側にも添える）
 */
import {
  ACCENTS,
  CANVAS,
  COLORS,
  FONT_FAMILY,
  FRAME_BADGE,
  MARGIN_X,
  REPETITION_LABELS,
  SIGNATURE,
} from './layout';
import type { FigureContext } from './figure';
import { escapeXml, textBlock, widthEm, wrapText } from './text';

/** tags.repetition を配列にそろえる（schema は配列に正規化するが、npm run figure は文字列で渡す） */
export function framesOf(repetition: string | readonly string[] | undefined): string[] {
  if (repetition === undefined) return [];
  return typeof repetition === 'string' ? [repetition] : [...repetition];
}

/**
 * 分析のフレームを左上に掲げる。図を読み始める前に、どの枠で見ているかを知らせる。
 * tags.repetition を持たないカードでは何も描かない。
 *
 * 二つの類型が組み合わさるカード（E213「CV反復とC反復の組み合わせ」）は、書いた順に
 * 横へ並べる（2026-10-06、やおき「バッジを二つつければ？」）。1つしか掲げないと、
 * 題が名指すもう一方の類型を図が否定して見える。
 */
export function frameBadge(repetition: string | readonly string[] | undefined): string {
  const labels = framesOf(repetition)
    .map((r) => REPETITION_LABELS[r])
    .filter((l): l is string => Boolean(l));
  const { x, y, width, height, radius, fontSize, gap } = FRAME_BADGE;
  return labels
    .map((label, i) => {
      const bx = x + i * (width + gap);
      // i 番目のバッジは i 番目の組の色。一色だと二つの類型がどちらも青の組の話に読める
      // （2026-10-06、figure-critic）。類型と組の数が揃うことは check-cards の検査11 が見る
      const color = ACCENTS[i % ACCENTS.length].stroke;
      return (
        `<rect x="${bx}" y="${y}" width="${width}" height="${height}" rx="${radius}" fill="none" ` +
        `stroke="${color}" stroke-width="2" />` +
        `<text x="${bx + width / 2}" y="${y + height / 2 + fontSize * 0.35}" font-family="${FONT_FAMILY}" ` +
        `font-size="${fontSize}" font-weight="700" fill="${color}" ` +
        `text-anchor="middle">${escapeXml(label)}</text>`
      );
    })
    .join('');
}

/**
 * タイアップの行（2026-09-27 追加）。題の直下に独立した 1 行で置く。
 *
 * 右下の作詞者の隣に並べた版を figure-critic に落とされた。27 字を署名の右の残りへ押し込むと
 * 字が縮み、SNS で 1/3 になると作品名が画面でいちばん弱い字になる。作品名で曲を覚えている
 * 読者がまず探すのはそこなので、題に次ぐ強さで出す。
 */
export const TIEUP = {
  fontSize: 30,
  /** 題の最終行のベースラインから、この行のベースラインまで */
  offset: 48,
  /** 署名の字の上端から、この行のベースラインまで最低限あける */
  clearance: 10,
  /** 題を 1 行に収めるために縮めてよい下限 */
  minTitleFontSize: 32,
  fill: '#334155',
} as const;

export interface TitleSpec {
  titleCenterY: number;
  titleFontSize: number;
  titleLineHeight: number;
  titleMaxLines: number;
  siteY: number;
  siteFontSize: number;
}

/**
 * 題（と、あればタイアップの行）を組む。どのテンプレートでも題は版面の全幅を使う。
 *
 * タイアップがあるとき、題が 2 行になるなら 1 行に収まるまで字を縮める（下限 minTitleFontSize）。
 * 縮めても収まらないときは**ビルドを止める**。右下へ退避させる版を作ったが、縮小すると
 * 「作詞：」とつながって一字も読めず、figure-critic に落とされた（2026-09-27）。
 * 読めない場所に置くくらいなら、題を短くしてもらうほうがよい。
 *
 * 返す baseline は題の 1 行目のベースライン。ピボットは図の下限をここから決める。
 */
export function titleBlock(ctx: FigureContext, spec: TitleSpec): { svg: string; baseline: number } {
  const available = CANVAS.width - MARGIN_X * 2;
  let fontSize: number = spec.titleFontSize;
  let lineHeight: number = spec.titleLineHeight;
  let lines = wrapText(ctx.title, available / fontSize, spec.titleMaxLines);

  if (ctx.tieup && lines.length > 1) {
    const fit = Math.floor(available / widthEm(ctx.title));
    if (fit < TIEUP.minTitleFontSize) {
      throw new Error(
        `タイアップのあるカードは、題が 1 行（${TIEUP.minTitleFontSize}px 以上）に収まる長さでなければならない: ` +
          `「${ctx.title}」。題の下にタイアップの行を置く余地が無い。観察名を短くすること`,
      );
    }
    fontSize = Math.min(fontSize, fit);
    lineHeight = Math.round((spec.titleLineHeight * fontSize) / spec.titleFontSize);
    lines = [ctx.title];
  }

  const baseline = spec.titleCenterY - ((lines.length - 1) * lineHeight) / 2;
  const title = textBlock(lines, {
    x: MARGIN_X,
    baseline,
    fontSize,
    lineHeight,
    fill: COLORS.text,
    fontFamily: FONT_FAMILY,
    fontWeight: 700,
  });
  if (!ctx.tieup) return { svg: title, baseline };

  const tieupBaseline = baseline + TIEUP.offset;
  if (tieupBaseline > spec.siteY - spec.siteFontSize - TIEUP.clearance) {
    throw new Error(`タイアップの行が署名とぶつかる（テンプレートの titleCenterY を見直すこと）: 「${ctx.title}」`);
  }
  const size = Math.min(TIEUP.fontSize, Math.floor(available / widthEm(ctx.tieup)));
  return {
    svg:
      title +
      `<text x="${MARGIN_X}" y="${tieupBaseline}" font-family="${FONT_FAMILY}" ` +
      `font-size="${size}" font-weight="700" fill="${TIEUP.fill}">${escapeXml(ctx.tieup)}</text>`,
    baseline,
  };
}

/** 左下の署名と、取れていれば右下の作詞者 */
export function footer(baseline: number, fontSize: number, lyricist?: string): string {
  const signature = textBlock([SIGNATURE], {
    x: MARGIN_X,
    baseline,
    fontSize,
    lineHeight: fontSize,
    fill: COLORS.muted,
    fontFamily: FONT_FAMILY,
  });
  if (!lyricist) return signature;
  return (
    signature +
    `<text x="${CANVAS.width - MARGIN_X}" y="${baseline}" font-family="${FONT_FAMILY}" ` +
    `font-size="${fontSize}" fill="${COLORS.muted}" text-anchor="end">作詞：${escapeXml(lyricist)}</text>`
  );
}

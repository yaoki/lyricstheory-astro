import { Resvg } from '@resvg/resvg-js';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { CANVAS, FONT_FAMILY } from './layout';

/**
 * SVG 文字列を PNG にする。
 *
 * フォントはリポジトリ直下の fonts/ から読む。public/ に置かないのは、
 * ビルド時にしか使わない 9MB 超が dist/ にコピーされて配信されるのを避けるため。
 */
const FONT_FILES = ['NotoSansJP-Regular.ttf', 'NotoSansJP-Bold.ttf'].map((name) =>
  path.join(process.cwd(), 'fonts', name),
);

let checked = false;

/**
 * フォントが無いまま生成すると日本語が豆腐（□□□）になり、
 * 気づかないまま本番に出る。ビルドを止めて知らせる。
 */
function assertFonts(): void {
  if (checked) return;
  const missing = FONT_FILES.filter((file) => !existsSync(file));
  if (missing.length > 0) {
    throw new Error(
      `OG 画像用のフォントが見つかりません:\n  ${missing.join('\n  ')}\n` +
        'fonts/ に Noto Sans JP の ttf を配置してください（README の OG 画像の節を参照）。',
    );
  }
  checked = true;
}

/**
 * width を引数化してあるのは、サムネ生成（/og/thumb/）が同じ SVG を
 * 320px で直接描き直すため。既定値は従来どおり CANVAS.width（1200）で、
 * 呼び出し側を変えない限り出力は変わらない。
 */
export function renderPng(svg: string, width: number = CANVAS.width): Buffer {
  assertFonts();
  const resvg = new Resvg(svg, {
    font: {
      fontFiles: FONT_FILES,
      loadSystemFonts: false,
      defaultFontFamily: FONT_FAMILY,
    },
    fitTo: { mode: 'width', value: width },
  });
  return resvg.render().asPng();
}

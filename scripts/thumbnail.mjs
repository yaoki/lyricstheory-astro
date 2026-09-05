// @ts-check
/**
 * PNG を縮小して別ファイルに書き出す。
 *
 * figure-critic の手順1（「縮小して見る」）で使う。もとは `sips -Z 400` を使っていたが、
 * sips は macOS 専用コマンドで、クラウドセッション（Linux VM）では動かない。
 * 図の判定は公開が起きる場所で効かなければ意味がないので、依存を増やさずに
 * 両方で動く形に置き換えた（2026-08-12）。
 *
 * 縮小は resvg で行う。PNG を data URI として SVG に載せ、目的の幅で描き直す。
 * 画像デコード用のライブラリを新たに入れずに済ませるための書き方である。
 *
 *   node scripts/thumbnail.mjs dist/og/natsu-no-mamono-mt-sequenz.png
 *   node scripts/thumbnail.mjs <入力.png> <出力.png> <幅>
 */
import fs from 'node:fs';
import path from 'node:path';
import { Resvg } from '@resvg/resvg-js';

const DEFAULT_WIDTH = 400;

/**
 * 出力先の既定。**入力のファイル名を混ぜる**（2026-09-05 変更）。
 *
 * それまでは固定パス `/tmp/figure-check-small.png` だった。figure-critic を 2 本
 * 並行で走らせると縮小版を互いに上書きし、**別のカードの図を読んだまま判定が進む**。
 * 2026-09-05 に実測——`toshishita-no-otokonoko-cv-repetition-tono` の判定が
 * `-aba-ko` の縮小版を読んでいた（判定側がハッシュ照合で検出。結論は出し直した）。
 *
 * 「並行で走らせない」という運用で塞がないのは、**判定が 1 枚ずつとは限らない**ため。
 * カードを 2 枚同時に足す場面は普通にあり、そのたびに手順を思い出すことに賭けられない。
 *
 * @param {string} input 縮小する PNG のパス
 * @returns {string}
 */
const defaultOutFor = (input) => `/tmp/figure-check-${path.basename(input, '.png')}-small.png`;

/**
 * PNG の IHDR チャンクから幅と高さを読む。
 * @param {Buffer} buffer
 * @returns {{ width: number, height: number }}
 */
function readPngSize(buffer) {
  const signature = buffer.subarray(0, 8).toString('hex');
  if (signature !== '89504e470d0a1a0a') {
    throw new Error('PNG ではありません（シグネチャが違います）。');
  }
  // 8..12 = IHDR の長さ, 12..16 = "IHDR", 16..20 = 幅, 20..24 = 高さ
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

/**
 * PNG を指定幅に縮小した PNG を返す。
 * @param {Buffer} input
 * @param {number} targetWidth
 * @returns {Buffer}
 */
export function shrinkPng(input, targetWidth) {
  const { width, height } = readPngSize(input);
  const targetHeight = Math.round((height / width) * targetWidth);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${targetWidth}" height="${targetHeight}" ` +
    `viewBox="0 0 ${width} ${height}">` +
    `<image href="data:image/png;base64,${input.toString('base64')}" ` +
    `width="${width}" height="${height}" />` +
    `</svg>`;
  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: targetWidth } });
  return Buffer.from(resvg.render().asPng());
}

const [, , inputArg, outArg, widthArg] = process.argv;

if (!inputArg) {
  console.error(
    '使い方: node scripts/thumbnail.mjs <入力.png> [出力.png] [幅]\n' +
      `  出力先の既定は /tmp/figure-check-<入力名>-small.png、幅の既定は ${DEFAULT_WIDTH}px`,
  );
  process.exit(1);
}

const outPath = outArg || defaultOutFor(inputArg);
const width = Number(widthArg) || DEFAULT_WIDTH;
const input = fs.readFileSync(inputArg);
const output = shrinkPng(input, width);
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, output);
console.log(`${inputArg} → ${outPath}（幅 ${width}px）`);

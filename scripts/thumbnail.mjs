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
const DEFAULT_OUT = '/tmp/figure-check-small.png';

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
      `  出力先の既定は ${DEFAULT_OUT}、幅の既定は ${DEFAULT_WIDTH}px`,
  );
  process.exit(1);
}

const outPath = outArg || DEFAULT_OUT;
const width = Number(widthArg) || DEFAULT_WIDTH;
const input = fs.readFileSync(inputArg);
const output = shrinkPng(input, width);
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, output);
console.log(`${inputArg} → ${outPath}（幅 ${width}px）`);

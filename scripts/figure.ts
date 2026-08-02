#!/usr/bin/env node
/**
 * 分析フレーズから figure の YAML を起こし、その場でプレビュー PNG を開く。
 *
 *   npm run figure -- 'あかさた「し」て「し」な'
 *   npm run figure -- --title '椎名林檎『シドと白昼夢』：一音を挟む対称形（ABA）' 'おと「し」て「し」まう'
 *
 * 出た YAML をカードの frontmatter に貼れば、次のビルドで OG 画像がその図になる。
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  PhraseError,
  parseConsonantRows,
  parsePhrase,
  parsePivotPhrase,
  toConsonantYaml,
  toPivotYaml,
  toYaml,
} from '../src/lib/og/phrase';
import { renderPng } from '../src/lib/og/render';
import { consonant } from '../src/lib/og/templates/consonant';
import { pivot } from '../src/lib/og/templates/pivot';
import { single } from '../src/lib/og/templates/single';

const USAGE = `
使い方:
  npm run figure -- '<フレーズ>' [--title '<カードのタイトル>'] [--out <出力先.png>] [--no-open]

フレーズは、呼応する音を「」で囲んで書きます。
前後の文脈もそのまま枠に並びます（最大8音。超えた分は外側から落ちます）。

  例) npm run figure -- 'おと「し」て「し」まう'
      → units: ["お","と","し","て","し","ま","う"] / highlight: [2, 4]

同じフレーズに呼応が二組あるときは、二組目を〈〉、三組目を〔〕で囲みます。
組ごとに色が変わり、それぞれ別の弧で結ばれます。

  例) npm run figure -- 'あの「ひ」と「び」〈だ〉し〈た〉'
      → highlight: [[2, 4], [5, 7]]

--repetition で分析のフレームを切り替えます（c | v | cv、既定は cv）。
図の左上にそのフレームが掲げられ、呼応の色が変わります。

  例) npm run figure -- --repetition v '「き」も「ち」'

--pivot <軸ラベル> を付けると子音ピボットの図になります。
書き方は同じですが、囲みの外は**伏せた印**になり文字が出ません。
そのため囲む数に上限はありません（伏せ字を挟むかぎり歌詞にならないため）。
1行は24枠までで、1枠は4文字までです。
行をまたいで続くピボットは、行ごとに分けて渡します（最大2行）。

  例) npm run figure -- --pivot 'カ行子音' --repetition c \\
        'いつ「か」「か」ならず「か」なうって「き」め「こ」んで'
  例) npm run figure -- --pivot 'タ行子音' --repetition c \\
        'い「つ」かかならずかなうっ「て」きめこん「で」' 'ろ「と」うにまよっ「た」いのり'

--consonant は子音の並びそのものを描きます。空白が群の区切り、1文字が1記号です。
仮名を使わないので枠数の上限はありません。記号ごとに色が変わり、Φ だけ背景色になります。

  例) npm run figure -- --consonant --repetition c 'tΦk kΦ tktΦ' 'Φtk ΦktΦtΦ'
`;

function main(): void {
  const args = process.argv.slice(2);
  let title = '';
  let out: string | undefined;
  let shouldOpen = true;
  // カードの tags.repetition にあたる。図の左上に掲げる分析のフレーム
  let repetition = 'cv';
  // 子音ピボットの軸ラベル。指定すると囲みの外を伏せる図になる
  let pivotAxis: string | undefined;
  // 子音の並びそのものを描くモード
  let consonantMode = false;
  const positional: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--title') title = args[++i] ?? '';
    else if (arg === '--out') out = args[++i];
    else if (arg === '--no-open') shouldOpen = false;
    else if (arg === '--repetition') repetition = args[++i] ?? 'cv';
    else if (arg === '--pivot') pivotAxis = args[++i] ?? '';
    else if (arg === '--consonant') consonantMode = true;
    else if (arg === '-h' || arg === '--help') return console.log(USAGE);
    else positional.push(arg);
  }

  // 子音の並び。空白が群の区切りで、1 文字が 1 記号
  if (consonantMode) {
    const lines = positional.map((l) => l.trim()).filter((l) => l !== '');
    if (lines.length === 0) {
      console.error(USAGE);
      process.exit(1);
    }
    let figure;
    try {
      figure = parseConsonantRows(lines);
    } catch (error) {
      if (error instanceof PhraseError) {
        console.error(`\n  ${error.message}\n`);
        process.exit(1);
      }
      throw error;
    }
    console.log(`\n${toConsonantYaml(figure)}\n`);
    const file = out ?? path.join(tmpdir(), 'lyricstheory-figure-preview.png');
    writeFileSync(file, renderPng(consonant(figure, { title, repetition })));
    console.log(`プレビュー: ${file}`);
    if (shouldOpen && process.platform === 'darwin') execFileSync('open', [file]);
    return;
  }

  // ピボットは行ごとに渡すので、positional を連結せずそのまま行として扱う
  if (pivotAxis !== undefined) {
    const lines = positional.map((line) => line.trim()).filter((line) => line !== '');
    if (lines.length === 0) {
      console.error(USAGE);
      process.exit(1);
    }
    let figure;
    try {
      figure = parsePivotPhrase(lines, pivotAxis);
    } catch (error) {
      if (error instanceof PhraseError) {
        console.error(`\n  ${error.message}\n`);
        process.exit(1);
      }
      throw error;
    }
    console.log(`\n${toPivotYaml(figure)}\n`);
    const file = out ?? path.join(tmpdir(), 'lyricstheory-figure-preview.png');
    writeFileSync(file, renderPng(pivot(figure, { title, repetition })));
    console.log(`プレビュー: ${file}`);
    if (shouldOpen && process.platform === 'darwin') execFileSync('open', [file]);
    return;
  }

  const phrase = positional.join(' ').trim();
  if (phrase === '') {
    console.error(USAGE);
    process.exit(1);
  }

  let parsed;
  try {
    parsed = parsePhrase(phrase);
  } catch (error) {
    if (error instanceof PhraseError) {
      console.error(`\n  ${error.message}\n`);
      process.exit(1);
    }
    throw error;
  }

  const { figure, trimmed } = parsed;
  console.log(`\n${toYaml(figure)}\n`);
  if (trimmed.head > 0 || trimmed.tail > 0) {
    const parts = [
      trimmed.head > 0 ? `前を${trimmed.head}音` : '',
      trimmed.tail > 0 ? `後ろを${trimmed.tail}音` : '',
    ].filter(Boolean);
    console.log(`※ 8音に収めるため、文脈の${parts.join('・')}落としました\n`);
  }

  const file = out ?? path.join(tmpdir(), 'lyricstheory-figure-preview.png');
  writeFileSync(file, renderPng(single(figure, { title, repetition })));
  console.log(`プレビュー: ${file}`);

  if (shouldOpen && process.platform === 'darwin') {
    execFileSync('open', [file]);
  }
}

main();

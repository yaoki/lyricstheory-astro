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
import { PhraseError, parsePhrase, toYaml } from '../src/lib/og/phrase';
import { renderPng } from '../src/lib/og/render';
import { symmetry } from '../src/lib/og/templates/symmetry';

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
`;

function main(): void {
  const args = process.argv.slice(2);
  let title = '';
  let out: string | undefined;
  let shouldOpen = true;
  const positional: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--title') title = args[++i] ?? '';
    else if (arg === '--out') out = args[++i];
    else if (arg === '--no-open') shouldOpen = false;
    else if (arg === '-h' || arg === '--help') return console.log(USAGE);
    else positional.push(arg);
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
  writeFileSync(file, renderPng(symmetry(figure, title)));
  console.log(`プレビュー: ${file}`);

  if (shouldOpen && process.platform === 'darwin') {
    execFileSync('open', [file]);
  }
}

main();

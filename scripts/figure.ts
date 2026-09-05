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
import { readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  PhraseError,
  parseConsonantPhrase,
  parsePhrase,
  parsePivotPhrase,
  resolvePhrases,
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
前後の文脈もそのまま枠に並びます（最大12音。超えた分は外側から落ちます）。

  例) npm run figure -- 'おと「し」て「し」まう'
      → units: ["お","と","し","て","し","ま","う"] / highlight: [2, 4]

同じフレーズに呼応が二組あるときは、二組目を〈〉、三組目を〔〕で囲みます。
組ごとに色が変わり、それぞれ別の弧で結ばれます。

  例) npm run figure -- 'あの「ひ」と「び」〈だ〉し〈た〉'
      → highlight: [[2, 4], [5, 7]]

--repetition で分析のフレームを切り替えます（c | v | cv、既定は cv）。
図の左上にそのフレームが掲げられ、呼応の色が変わります。

  例) npm run figure -- --repetition v '「き」も「ち」'

--phrases <語>,<語> を付けると、弧を語と語のあいだに1本だけ張ります。
色は音ごとに残るので、「何が増えたか」と「どの語とどの語が対応するか」を
一つの図で同時に見せられます。語を1枠に畳むと中身が見えなくなるための逃げ道です。
渡すのは語そのものなので、位置を数える必要はありません。

  例) npm run figure -- --phrases 'つみ,つつみ' '「つ」〈み〉を「つ」「つ」〈み〉こんで'

--no-arcs を付けると弧を引かず、呼応を色だけで示します。
弧の向きと重なりは操作（倒置／並行）の記法なので、四操作が当たらないカード
——単独の音の反復が二組あるもの——で引くと、図が本文と食い違います。

  例) npm run figure -- --repetition cv --no-arcs 'としした「の」おと〈こ〉「の」〈こ〉'

--pivot <軸ラベル> を付けると子音ピボットの図になります。
書き方は同じですが、囲みの外は**伏せた印**になり文字が出ません。
そのため囲む数に上限はありません（伏せ字を挟むかぎり歌詞にならないため）。
1行は24枠までで、1枠は4文字までです。
行をまたいで続くピボットは、行ごとに分けて渡します（最大2行）。

  例) npm run figure -- --pivot 'カ行子音' --repetition c \\
        'いつ「か」「か」ならず「か」なうって「き」め「こ」んで'
  例) npm run figure -- --pivot 'タ行子音' --repetition c \\
        'い「つ」かかならずかなうっ「て」きめこん「で」' 'ろ「と」うにまよっ「た」いのり'

--marks <記号の並び> を付けると、歌詞の音の上に子音記号を振る図になります。
記号を振る範囲を「」で囲み、--marks に対応する記号を渡します（空白は群の区切り）。
囲んだ音の数と記号の数が合わないと止まります（対応が嘘になるため）。
行ごとに --marks を1つずつ、歌詞と同じ順で渡します。

  例) npm run figure -- --repetition c \\
        --marks 'tΦk kΦ tktΦ' --marks 'Φtk ΦktΦtΦ' \\
        'そこからながれ「ていけ」るようなせ「かい」をみ「つけたい」' \\
        '「いつか」はだれかのために「いきていたい」'

歌詞に**中黒「・」**を書くと、そこに分節線が入ります。半シラブル化のように
切れ目そのものが観察の本体になる図で使います。中黒は音ではないので枠を作らず、
その位置に縦線が引かれるだけです。位置を数字で渡す形にしていないのは、音数を
数えさせると必ずずれるためです（--phrases と同じ考え方）。
記号（--marks）に音素のローマ字を振ると、何がどう閉じるかが図に出ます。
**分節線を持つ図では記号の色が1色に揃います**（分類は記号の側が語るため）。

  例) npm run figure -- --repetition c --fold \\
        --marks 'at ta' --marks 'naz ze' --marks 'zit te' \\
        '「あ」・「た」らしい' '「な」・「ぜ」かせつ' '「じ」・「て」んしゃで'

--card <slug> を付けると、出た YAML をそのカードの frontmatter に**直接書き込みます**。
既に figure があれば差し替えます。タイトルもカードから読むので --title は要りません。
貼り付けの手間が消えるぶん速く、貼り間違いも起きません。

  例) npm run figure -- --card esora-k-pivot-chorus \\
        --pivot 'カ行子音' '「き」お「く」「か」ら「け」すために'
`;

const CARDS_DIR = 'src/content/elements';

/** カードの .mdx の場所。--card はスラッグだけ受け取る */
function cardPath(slug: string): string {
  return path.join(process.cwd(), CARDS_DIR, `${slug}.mdx`);
}

/**
 * 出た YAML をカードの frontmatter に書き込む。
 * 既存の figure ブロック（次のトップレベルキーの手前まで）があれば差し替え、
 * なければ created: の直前に挿す（schema の並び順に合わせる）。
 */
function writeToCard(slug: string, yaml: string): void {
  const file = cardPath(slug);
  const source = readFileSync(file, 'utf-8');
  const block = `${yaml.trimEnd()}\n`;
  const existing = /^figure:\n(?:[ \t-].*\n)*/m;
  const hasFigure = existing.test(source);
  const next = hasFigure
    ? source.replace(existing, block)
    : source.replace(/^created:/m, `${block}created:`);
  // 差し込めたかは「文字列が変わったか」では測れない。同じ図を作り直すと変わらないため
  if (!hasFigure && next === source) {
    console.error(`\n  ${slug} に figure を差し込めませんでした（created: が見つかりません）\n`);
    process.exit(1);
  }
  writeFileSync(file, next);
  console.log(`書き込み: ${CARDS_DIR}/${slug}.mdx`);
}

/** 図に載せるタイトルはカードの title と同じでよい。二重に書かせない */
function readCardTitle(slug: string): string {
  const match = readFileSync(cardPath(slug), 'utf-8').match(/^title:\s*["'](.+)["']\s*$/m);
  return match?.[1] ?? '';
}

/** YAML を出し、必要ならカードに書き込み、プレビュー PNG を作る */
function emit(
  yaml: string,
  svg: string,
  opts: { out?: string; card?: string; shouldOpen: boolean },
): void {
  console.log(`\n${yaml}\n`);
  if (opts.card) writeToCard(opts.card, yaml);
  const file = opts.out ?? path.join(tmpdir(), 'lyricstheory-figure-preview.png');
  writeFileSync(file, renderPng(svg));
  console.log(`プレビュー: ${file}`);
  if (opts.shouldOpen && process.platform === 'darwin') execFileSync('open', [file]);
}

function main(): void {
  const args = process.argv.slice(2);
  let title = '';
  let out: string | undefined;
  let shouldOpen = true;
  // カードの tags.repetition にあたる。図の左上に掲げる分析のフレーム
  let repetition = 'cv';
  // 子音ピボットの軸ラベル。指定すると囲みの外を伏せる図になる
  let pivotAxis: string | undefined;
  // 子音の並び。歌詞の行と、それに振る記号の行を別々に受け取る
  const markLines: string[] = [];
  // 囲みを 1 枠に畳む。2 モーラで 1 つの音節をなすこと自体が観察のときに使う
  let fold = false;
  // 下の段（動くもの）。--marks と同じ数だけ渡す
  const subLines: string[] = [];
  // 書き込み先のカード。指定すると frontmatter に直接入る
  let card: string | undefined;
  // 語のまとまり。弧を語どうしで結び、色は音ごとに残したいときに渡す
  let phraseWords: string[] = [];
  // 弧を引かない。順序の軸が立たないカード（単独の音の反復が二組あるもの）で使う
  let noArcs = false;
  const positional: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--title') title = args[++i] ?? '';
    else if (arg === '--out') out = args[++i];
    else if (arg === '--no-open') shouldOpen = false;
    else if (arg === '--no-arcs') noArcs = true;
    else if (arg === '--repetition') repetition = args[++i] ?? 'cv';
    else if (arg === '--pivot') pivotAxis = args[++i] ?? '';
    else if (arg === '--marks') markLines.push(args[++i] ?? '');
    else if (arg === '--fold') fold = true;
    else if (arg === '--subs') subLines.push(args[++i] ?? '');
    else if (arg === '--card') card = args[++i];
    else if (arg === '--phrases')
      phraseWords = (args[++i] ?? '')
        .split(',')
        .map((word) => word.trim())
        .filter((word) => word !== '');
    else if (arg === '-h' || arg === '--help') return console.log(USAGE);
    else positional.push(arg);
  }

  // 図のタイトルはカードの title と同じでよい。--title を書いたときだけそちらを使う
  if (title === '' && card !== undefined) title = readCardTitle(card);

  // 子音の並びを歌詞に振る。--marks を行数ぶん渡す
  if (markLines.length > 0) {
    const lines = positional.map((l) => l.trim()).filter((l) => l !== '');
    if (lines.length === 0) {
      console.error(USAGE);
      process.exit(1);
    }
    let figure;
    try {
      figure = parseConsonantPhrase(lines, markLines, fold, subLines);
    } catch (error) {
      if (error instanceof PhraseError) {
        console.error(`\n  ${error.message}\n`);
        process.exit(1);
      }
      throw error;
    }
    emit(toConsonantYaml(figure), consonant(figure, { title, repetition }), {
      out,
      card,
      shouldOpen,
    });
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
    emit(toPivotYaml(figure), pivot(figure, { title, repetition }), { out, card, shouldOpen });
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
  if (noArcs) figure.arcs = false;
  if (trimmed.head > 0 || trimmed.tail > 0) {
    const parts = [
      trimmed.head > 0 ? `前を${trimmed.head}音` : '',
      trimmed.tail > 0 ? `後ろを${trimmed.tail}音` : '',
    ].filter(Boolean);
    console.log(`\n※ 12音に収めるため、文脈の${parts.join('・')}落としました`);
  }

  // 弧は語と語のあいだに張るので、語が 1 つでは相手がいない
  if (phraseWords.length === 1) {
    console.error('\n  --phrases は語を2つ以上渡してください（弧は語と語のあいだに張るため）\n');
    process.exit(1);
  }
  if (phraseWords.length >= 2) {
    try {
      figure.phrases = resolvePhrases(figure.units, phraseWords);
    } catch (error) {
      if (error instanceof PhraseError) {
        console.error(`\n  ${error.message}\n`);
        process.exit(1);
      }
      throw error;
    }
  }

  emit(toYaml(figure), single(figure, { title, repetition }), { out, card, shouldOpen });
}

main();

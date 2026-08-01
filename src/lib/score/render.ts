/**
 * 譜例を SVG に焼く。ビルド時にだけ走る。
 *
 * Verovio（LGPL）を使う。C++ を WebAssembly にしたものなので DOM を必要とせず、
 * Node のビルドプロセスからそのまま呼べる。abcjs は音符の幅を測るのに DOM が要り、
 * jsdom を挟む必要があるため採らなかった（2026-08-02 検討）。
 *
 * 入力は ABC notation。ドイツ音名からの変換は `german-to-abc.ts` が受け持つ。
 */
import createVerovioModule from 'verovio/wasm';
import { VerovioToolkit } from 'verovio/esm';

let toolkitPromise: Promise<VerovioToolkit> | null = null;

/** WASM の初期化は重い。ビルド全体で1つだけ作って使い回す */
async function getToolkit(): Promise<VerovioToolkit> {
  if (!toolkitPromise) {
    toolkitPromise = createVerovioModule().then((module) => new VerovioToolkit(module));
  }
  return toolkitPromise;
}

const OPTIONS = {
  inputFrom: 'abc',
  // 内容にぴったり合わせる。譜例なので固定のページサイズは要らない
  adjustPageHeight: true,
  adjustPageWidth: true,
  breaks: 'none',
  header: 'none',
  footer: 'none',
  pageMarginTop: 0,
  pageMarginBottom: 0,
  pageMarginLeft: 0,
  pageMarginRight: 0,
  scale: 30,
  // viewBox を持たせて、CSS 側で幅に追従させる
  svgViewBox: true,
  svgHtml5: true,
  svgRemoveXlink: true,
  font: 'Leipzig',
};

export async function renderAbcToSvg(abc: string): Promise<string> {
  const toolkit = await getToolkit();
  toolkit.setOptions(OPTIONS);

  const loaded = toolkit.loadData(abc);
  if (!loaded) throw new Error(`ABC を読み込めませんでした:\n${abc}`);

  const svg = toolkit.renderToSVG(1);

  // 音符が1つも無いまま静かに空の絵が出るのがいちばん危ない。
  // Verovio の ABC インポータは小節線が無いと音符を落とすが、loadData は成功を返す
  if (!/class="note"/.test(svg)) {
    throw new Error(`音符が1つも描かれませんでした。小節線 | と LF 改行を確認してください:\n${abc}`);
  }

  return svg;
}

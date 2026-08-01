/**
 * Verovio の型宣言。
 *
 * 本体は C++ を WebAssembly にしたもので、npm パッケージに .d.ts が入っていない
 * （6.2.0 時点）。ここで使うぶんだけ宣言する。
 */

declare module 'verovio/wasm' {
  /** WASM モジュールを初期化する。戻り値は VerovioToolkit に渡すだけで中身は触らない */
  const createVerovioModule: () => Promise<unknown>;
  export default createVerovioModule;
}

declare module 'verovio/esm' {
  export class VerovioToolkit {
    constructor(module: unknown);
    /** 未知のオプション名は無視されず [Error] としてログに出る */
    setOptions(options: Record<string, unknown>): void;
    /** 読めたかどうかを返す。ただし内容が空でも true が返ることがある */
    loadData(data: string): boolean;
    renderToSVG(page: number, options?: Record<string, unknown>): string;
    getPageCount(): number;
    getMEI(options?: Record<string, unknown>): string;
    getLog(): string;
    getVersion(): string;
  }
}

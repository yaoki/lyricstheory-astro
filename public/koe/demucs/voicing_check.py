#!/usr/bin/env python3
"""
無声化の検算スクリプト。

音源の一区間について「声帯が振動しているか」をフレームごとに判定し、
時間軸に並べて出す。無声化は声帯振動の消失そのものなので、
ここで声の帯が切れていれば落ちている。

    pip3 install numpy
    python3 voicing_check.py vocals.wav --start 61.2 --end 63.0

    # モーラの切れ目を耳で取ったら、境界を渡すと区間ごとに集計する
    python3 voicing_check.py vocals.wav --start 61.2 --end 63.0 \
        --marks 'た:61.20,ち:61.38,つ:61.52,く:61.66,し:61.80,た:61.94'

wav は ffmpeg 無しで読める（demucs の出力はこれ）。
m4a・mp3 等を直接渡すときだけ ffmpeg が要る（brew install ffmpeg）。

**伴奏が入ったままの音源にかけても意味が無い。** 低域比はベースとキックが
埋め、自己相関はベースラインの周期に食いつくので、無声化している区間まで
有声と出る。demucs 等でボーカルを抜いてからかけること。

出力は判定ではなく測定値である。閾値の当否は耳で確かめること。

**誤りは無声の側へ倒れる。** 耳に聞こえている声が無声と出たときは、まず
このスクリプトを疑うこと。逆（無声の音を有声と出す）は起きにくい。

変更履歴
    2026-08-17  有声の条件から低域比を外した。500Hz 固定の境界は F0 が
                250Hz を超える歌唱では基音しか含まず、明瞭な母音でも
                0.1 を下回る。旧版はスピッツ「ロビンソン」の歌い出しを
                全区間「無声」と誤って出していた。あわせて diagnose() を
                足し、旧版が誤ったはずのフレーム数と、F0 が探索範囲の端に
                張り付いた回数を実行のたびに出すようにした。
"""

import argparse
import shutil
import subprocess
import sys
import tempfile
import wave
from pathlib import Path

try:
    import numpy as np
except ImportError:
    sys.exit("numpy が要ります:  pip3 install numpy")

SR = 16000          # 解析用サンプリング周波数
FRAME = 0.025       # 25 ms
HOP = 0.005         # 5 ms（モーラは短いので細かめに取る）
F0_MIN, F0_MAX = 60, 500


# ---------------------------------------------------------------- 読み込み

def lowpass(x: np.ndarray, sr: int, cutoff: float, taps: int = 101) -> np.ndarray:
    """窓関数法の FIR ローパス。間引く前の折り返し防止に使う。"""
    n = np.arange(taps) - (taps - 1) / 2
    h = np.sinc(2 * cutoff / sr * n) * np.hamming(taps)
    return np.convolve(x, h / h.sum(), mode="same")


def resample(x: np.ndarray, sr_in: int, sr_out: int) -> np.ndarray:
    if sr_in == sr_out:
        return x
    if sr_in > sr_out:
        x = lowpass(x, sr_in, 0.45 * sr_out)
    m = int(len(x) * sr_out / sr_in)
    return np.interp(np.arange(m) / sr_out, np.arange(len(x)) / sr_in, x)


def load_wav(path: Path, start: float, end: float) -> np.ndarray:
    """wav を 16k モノラルにして返す。ステレオは平均、レートは変換する。

    ここを素通りさせると、44.1k ステレオの列を 16k モノラルとして
    解釈してしまい、周期性も F0 も無意味な値になる。
    """
    with wave.open(str(path), "rb") as w:
        ch, sw, sr, n = (w.getnchannels(), w.getsampwidth(),
                         w.getframerate(), w.getnframes())
        s0 = max(0, min(int((start or 0) * sr), n))
        s1 = max(s0, min(int(end * sr), n)) if end else n
        w.setpos(s0)
        raw = w.readframes(s1 - s0)

    dtype = {1: np.uint8, 2: np.int16, 4: np.int32}.get(sw)
    if dtype is None:
        sys.exit(f"対応していないビット深度です（{sw*8}bit）")
    x = np.frombuffer(raw, dtype=dtype).astype(np.float64)
    if sw == 1:                       # 8bit wav は符号なし
        x -= 128.0
    x /= float(2 ** (8 * sw - 1))
    if ch > 1:                        # ステレオはモノラルに畳む
        x = x.reshape(-1, ch).mean(axis=1)
    return resample(x, sr, SR)


def load_via_ffmpeg(src: Path, start: float, end: float) -> np.ndarray:
    ff = shutil.which("ffmpeg")
    if not ff:
        sys.exit("ffmpeg が見つかりません（brew install ffmpeg）。\n"
                 "wav を渡せば ffmpeg 無しで動きます。")
    out = Path(tempfile.mkdtemp()) / "seg.wav"
    cmd = [ff, "-v", "error", "-y", "-i", str(src)]
    if start is not None:
        cmd += ["-ss", str(start)]
    if end is not None:
        cmd += ["-to", str(end)]
    cmd += ["-ac", "1", "-ar", str(SR), str(out)]
    subprocess.run(cmd, check=True)
    return load_wav(out, None, None)


# ------------------------------------------------------------------ 解析

def analyse(x: np.ndarray):
    """フレームごとに (時刻, RMS, 周期性, 零交差率, 低域比, F0) を返す。"""
    fl, hl = int(FRAME * SR), int(HOP * SR)
    win = np.hanning(fl)
    lo_lag, hi_lag = SR // F0_MAX, SR // F0_MIN
    freqs = np.fft.rfftfreq(fl, 1 / SR)

    rows = []
    for i in range(0, max(0, len(x) - fl), hl):
        f = x[i:i + fl]
        rms = float(np.sqrt(np.mean(f ** 2)))
        zcr = float(np.mean(np.abs(np.diff(np.sign(f))) > 0))

        fw = (f - f.mean()) * win
        ac = np.correlate(fw, fw, mode="full")[fl - 1:]
        if ac[0] <= 1e-12:
            period, f0 = 0.0, 0.0
        else:
            seg = ac[lo_lag:hi_lag]
            if len(seg) == 0:
                period, f0 = 0.0, 0.0
            else:
                k = int(np.argmax(seg))
                period = float(seg[k] / ac[0])
                f0 = SR / (lo_lag + k)

        spec = np.abs(np.fft.rfft(fw)) ** 2
        total = float(spec.sum())
        low = float(spec[freqs < 500].sum() / total) if total > 0 else 0.0

        rows.append((i / SR, rms, period, zcr, low, f0))
    return rows


def voiced(row, floor):
    """有声か。

    低域比（low）は 2026-08-17 に条件から外した。500Hz 固定の境界は、
    F0 が 250Hz を超える歌唱だと基音しか含まない。「あ」のように第1
    フォルマントが 700Hz 前後の母音では、明瞭に鳴っていても低域比が
    0.1 を下回る。無声摩擦音を落とす役目は period と zcr が担うので、
    この条件は冗長なうえに、歌声で構造的な偽陰性を作っていた。

    測定値としては残してある（下の diagnose と区間集計に出る）。
    """
    _, rms, period, zcr, _low, _ = row
    return rms > floor and period > 0.45 and zcr < 0.30


def diagnose(rows, floor):
    """判定そのものが壊れていないかを見る。

    条件を満たすかどうか以前に、条件が当の音源に対して働いているかを疑う。
    ここに数字が出たときは、帯より先にこちらを読むこと。
    """
    v = [r for r in rows if voiced(r, floor)]
    if not v:
        return

    notes = []

    edge = [r for r in v if r[5] >= F0_MAX * 0.95 or r[5] <= F0_MIN * 1.05]
    if len(edge) > len(v) * 0.05:
        notes.append(
            f"F0 が探索範囲（{F0_MIN}〜{F0_MAX}Hz）の端に張り付いたフレーム "
            f"{len(edge)}／{len(v)}。範囲の外へ出た声は下位倍音に食いつくので、"
            "F0 の値を信用しないこと")

    lowband = [r for r in v if r[4] <= 0.30]
    if lowband:
        notes.append(
            f"低域比 0.30 以下で有声としたフレーム {len(lowband)}／{len(v)}。"
            "2026-08-17 より前の版は、ここを無声と誤って出していた")

    if notes:
        print("\n  判定の外側から（自己診断）")
        for n in notes:
            print(f"    - {n}")


# -------------------------------------------------------------------- 出力

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("audio")
    ap.add_argument("--start", type=float, default=None, help="開始（秒）")
    ap.add_argument("--end", type=float, default=None, help="終了（秒）")
    ap.add_argument("--marks", default="", help="'かな:秒,かな:秒,...'")
    args = ap.parse_args()

    src = Path(args.audio)
    if not src.exists():
        sys.exit(f"見つかりません: {src}")

    if src.suffix.lower() == ".wav":
        x = load_wav(src, args.start, args.end)
    else:
        x = load_via_ffmpeg(src, args.start, args.end)

    rows = analyse(x)
    if not rows:
        sys.exit("区間が短すぎます（0.05 秒以上を渡してください）")

    peak = max(r[1] for r in rows)
    floor = peak * 0.06          # 無音との切り分け

    print(f"\n長さ {len(x)/SR:.2f}s / {len(rows)} フレーム（{HOP*1000:.0f}ms 刻み）")
    print("有声＝周期性>0.45 かつ 零交差率<0.30\n")

    strip = "".join("|" if voiced(r, floor) else ("." if r[1] > floor else " ")
                    for r in rows)
    print("  | = 有声   . = 無声（音はある）   空白 = 無音")
    for i in range(0, len(strip), 100):
        print(f"  {(args.start or 0) + i*HOP:7.2f}s {strip[i:i+100]}")

    diagnose(rows, floor)

    if args.marks:
        print("\n区間ごとの集計")
        print(f"  {'区間':6} {'長さ':>7} {'有声率':>7} {'周期性':>7} {'F0中央':>8} "
              f"{'零交差':>7} {'低域比':>7}")
        base = args.start or 0.0
        marks = []
        for part in args.marks.split(","):
            name, _, t = part.strip().partition(":")
            marks.append((name, float(t)))
        tail = args.end if args.end else base + len(x) / SR
        bounds = [t for _, t in marks] + [tail]
        for idx, (name, _) in enumerate(marks):
            s, e = bounds[idx] - base, bounds[idx + 1] - base
            seg = [r for r in rows if s <= r[0] < e]
            if not seg:
                print(f"  {name:6} （フレームなし）")
                continue
            vr = sum(voiced(r, floor) for r in seg) / len(seg)
            per = float(np.median([r[2] for r in seg]))
            zc = float(np.median([r[3] for r in seg]))
            f0s = [r[5] for r in seg if voiced(r, floor)]
            f0 = float(np.median(f0s)) if f0s else 0.0
            lw = float(np.median([r[4] for r in seg]))
            flag = "  ← 無声化の疑い" if vr < 0.4 else ""
            print(f"  {name:6} {e-s:6.3f}s {vr*100:6.0f}% {per:7.2f} "
                  f"{f0:7.0f}Hz {zc:6.2f} {lw:6.2f}{flag}")

    print("\nこれは測定であって判定ではない。数値と耳が食い違ったら耳を採ること。")


if __name__ == "__main__":
    main()

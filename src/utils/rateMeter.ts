class RateMeter {
  private windowSizeMs: number;
  private events: { time: number; value: number }[] = [];
  private startIndex = 0;
  private totalValue = 0;
  private absoluteTotalValue = 0;
  private fastStart: boolean;
  private startTime: number;

  /**
   * @param windowSizeMs - 集計する時間窓の長さ（ミリ秒単位）
   * @param fastStart - 最初の時間窓が経過するまで、経過時間に基づいてレートを計算するかどうか
   */
  constructor(windowSizeMs: number, fastStart: boolean = false) {
    if (windowSizeMs <= 0) {
      throw new Error('windowSizeMs must be a positive number');
    }
    this.windowSizeMs = windowSizeMs;
    this.fastStart = fastStart;
    this.startTime = Date.now();
  }

  /**
   * イベントの増分値を記録
   * @param value - 増分値（例: ダウンロードしたバイト数）
   */
  increment(value: number): void {
    if (value < 0) {
      throw new Error('Increment value cannot be negative');
    }
    const now = Date.now();
    this.events.push({ time: now, value });
    this.absoluteTotalValue += value;
    this.totalValue += value;
    this.removeOldEvents(now);
  }

  /**
   * 現在のレートを取得（値/秒）
   * @returns 単位時間（秒）あたりの平均値
   */
  getRate(): number {
    const now = Date.now();
    this.removeOldEvents(now);

    if (this.totalValue === 0 || this.startIndex >= this.events.length) {
      return 0;
    }

    let actualWindowMs: number;
    if (this.fastStart) {
      const elapsedTime = now - this.startTime;
      actualWindowMs = Math.min(elapsedTime, this.windowSizeMs);
    } else {
      actualWindowMs = this.windowSizeMs;
    }

    // 時間窓を秒単位に変換してレートを計算
    const windowInSeconds = actualWindowMs / 1000;
    return windowInSeconds > 0 ? this.totalValue / windowInSeconds : 0;
  }

  /**
   * 古いイベントを削除（内部メソッド）
   * @param now - 現在時刻（ミリ秒）
   */
  private removeOldEvents(now: number): void {
    const windowStart = now - this.windowSizeMs;

    // 時間窓外のイベントを先頭から削除
    while (this.startIndex < this.events.length && this.events[this.startIndex]!.time < windowStart) {
      this.totalValue -= this.events[this.startIndex]!.value;
      this.startIndex++;
    }

    // メモリ効率化のため、不要な要素を定期的に切り詰め
    if (this.startIndex > 0 && this.startIndex >= this.events.length / 2) {
      this.events = this.events.slice(this.startIndex);
      this.startIndex = 0;
    }
  }

  /**
   * 計測状態をリセット
   */
  reset(): void {
    this.events = [];
    this.startIndex = 0;
    this.totalValue = 0;
    this.startTime = Date.now();
    this.absoluteTotalValue = 0;
  }

  /**
   * 計測を終了し、インスタンス作成からの総計結果を返す
   * @returns {{startTime: number, endTime: number, rate: number}}
   */
  finalize(): {
    startTime: number;
    endTime: number;
    rate: number;
  } {
    const endTime = Date.now();
    const durationMs = endTime - this.startTime;
    const durationSec = durationMs / 1000;
    const rate = durationSec > 0 ? this.absoluteTotalValue / durationSec : 0;

    const result = { startTime: this.startTime, endTime, durationMs, rate };
    this.reset();
    return result;
  }
}

export default {
  RateMeter,
};

// 使用例（ダウンロード速度計測）
/*
const downloadMeter = new RateMeter(1000); // 1秒間の平均を計測

// ダウンロードイベントのシミュレーション（100msごとに1MB追加）
const interval = setInterval(() => {
  downloadMeter.increment(1_000_000); // 1MB
  const mbPerSec = downloadMeter.getRate() / (1024 * 1024);
  console.log(`Download speed: ${mbPerSec.toFixed(2)} MB/s`);
}, 100);

setTimeout(() => {
  clearInterval(interval);
  downloadMeter.reset();
}, 5000);
*/

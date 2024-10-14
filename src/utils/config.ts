import fs from 'fs';

type Freeze<T> = Readonly<{
  [P in keyof T]: T[P] extends object ? Freeze<T[P]> : T[P];
}>;
type AllRequired<T> = Required<{
  [P in keyof T]: T[P] extends object ? Freeze<T[P]> : T[P];
}>;

type ConfigType = AllRequired<
  Freeze<{
    file: {
      outputDir: string;
    };
    network: {
      asmrApi: {
        baseDomain: {
          latest: string;
          original: string;
          mirror1: string;
          mirror2: string;
          mirror3: string;
        };
        apiPath: string;
        refererUrl: string;
      };
      userAgent: {
        chromeWindows: string;
        curl: string;
        curlUnity: string;
        ios: string;
      };
      timeout: number;
      threadCount: number;
      adapterName: string;
    };
    logger: {
      logLevel: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';
      progressBarConfig: {
        barCompleteChar: string;
        barIncompleteChar: string;
        hideCursor: boolean;
        barsize: number;
        fps: number;
        clearOnComplete: boolean;
      };
    };
  }>
>;

const config: ConfigType = JSON.parse(await fs.promises.readFile('config/config.json', 'utf-8'));

export default config;

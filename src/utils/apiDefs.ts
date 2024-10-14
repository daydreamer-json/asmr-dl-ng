import appConfig from './config.js';
import argvUtils from './argv.js';

interface Type_AsmrApi {
  sort: 'asc' | 'desc';
  order:
    | 'release'
    | 'create_date'
    | 'rating'
    | 'dl_count'
    | 'price'
    | 'rate_average_2dp'
    | 'review_count'
    | 'id'
    | 'nsfw'
    | 'random';
  subtitle: boolean;
  coverType: 'main' | '240x240' | 'sam';
}

const apiDefs = {
  health() {
    const baseDomain = (appConfig.network.asmrApi.baseDomain as Record<string, string> as Record<string, string>)[
      argvUtils.getArgv().server
    ];
    return {
      endpoint: `https://${baseDomain}${appConfig.network.asmrApi.apiPath}/health`,
      params: {},
    };
  },
  worksListing(
    page: number,
    sort: Type_AsmrApi['sort'] = 'asc',
    order: Type_AsmrApi['order'] = 'create_date',
    subtitle: Type_AsmrApi['subtitle'] = false,
  ) {
    const baseDomain = (appConfig.network.asmrApi.baseDomain as Record<string, string>)[argvUtils.getArgv().server];
    return {
      endpoint: `https://${baseDomain}${appConfig.network.asmrApi.apiPath}/works`,
      params: {
        order: order,
        sort: sort,
        subtitle: subtitle ? 1 : 0,
        page: page,
      },
    };
  },
  search(
    query: string,
    page: number,
    sort: Type_AsmrApi['sort'] = 'asc',
    order: Type_AsmrApi['order'] = 'create_date',
    subtitle: Type_AsmrApi['subtitle'] = false,
  ) {
    const baseDomain = (appConfig.network.asmrApi.baseDomain as Record<string, string>)[argvUtils.getArgv().server];
    return {
      endpoint: `https://${baseDomain}${appConfig.network.asmrApi.apiPath}/search/${encodeURIComponent(query)}`,
      params: {
        order: order,
        sort: sort,
        subtitle: subtitle ? 1 : 0,
        page: page,
      },
    };
  },
  workInfoUser(workId: number) {
    const baseDomain = (appConfig.network.asmrApi.baseDomain as Record<string, string>)[argvUtils.getArgv().server];
    return {
      endpoint: `https://${baseDomain}${appConfig.network.asmrApi.apiPath}/work/${workId}`,
      params: {},
    };
  },
  workInfo(workId: number) {
    const baseDomain = (appConfig.network.asmrApi.baseDomain as Record<string, string>)[argvUtils.getArgv().server];
    return {
      endpoint: `https://${baseDomain}${appConfig.network.asmrApi.apiPath}/workInfo/${workId}`,
      params: {},
    };
  },
  workFolderStructure(workId: number) {
    const baseDomain = (appConfig.network.asmrApi.baseDomain as Record<string, string>)[argvUtils.getArgv().server];
    return {
      endpoint: `https://${baseDomain}${appConfig.network.asmrApi.apiPath}/tracks/${workId}`,
      params: {},
    };
  },
  redirectStream(workId: number, trackId: number) {
    const baseDomain = (appConfig.network.asmrApi.baseDomain as Record<string, string>)[argvUtils.getArgv().server];
    return {
      endpoint: `https://${baseDomain}${appConfig.network.asmrApi.apiPath}/media/stream/${workId}/${trackId}`,
      params: {},
    };
  },
  coverImage(workId: number, type: Type_AsmrApi['coverType'] = 'main') {
    const baseDomain = (appConfig.network.asmrApi.baseDomain as Record<string, string>)[argvUtils.getArgv().server];
    return {
      endpoint: `https://${baseDomain}${appConfig.network.asmrApi.apiPath}/cover/${workId}.jpg`,
      params: {
        type: type,
      },
    };
  },
};

const defaultApiConnectionHeader = {
  'User-Agent': appConfig.network.userAgent.chromeWindows,
  // 'Content-Type': 'application/json',
  // Referer: 'https://' + appConfig.network.asmrApi.refererUrl,
  'Cache-Control': 'no-cache',
};

export default {
  apiDefs,
  defaultApiConnectionHeader,
};

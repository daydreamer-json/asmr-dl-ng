import ky from 'ky';
import * as uuid from 'uuid';
import * as TypesApi from '../types/Api.js';
import * as TypesApiEndpoint from '../types/ApiEndpoint.js';
import * as TypesApiFiles from '../types/ApiFiles.js';
import appConfig from './config.js';
import stringUtils from './string.js';

let BASE_URI = ``;
const defaultKySettings = {
  headers: {
    'User-Agent': appConfig.network.userAgent.chromeWindows,
  },
  timeout: appConfig.network.timeout,
  retry: { limit: appConfig.network.retryCount },
};

export default {
  defaultKySettings,
  setBaseUri: (server: TypesApi.ServerName) => {
    BASE_URI = `https://${appConfig.network.asmrApi.baseDomain[server]}/${appConfig.network.asmrApi.apiPath}`;
  },
  apiDlsite: {
    work: {
      info: async (source_id: string): Promise<any> => {
        const rsp = await ky
          .get(atob('aHR0cHM6Ly93d3cuZGxzaXRlLmNvbQ==') + '/maniax/product/info/ajax', {
            ...defaultKySettings,
            searchParams: {
              product_id: source_id,
              cdn_cache_min: 1,
            },
          })
          .json();
        return (rsp as any)[source_id] ?? rsp;
      },
    },
  },
  api: {
    health: async (): Promise<{ available: boolean; message: string }> => {
      const rsp = await ky.get(`${BASE_URI}/health`, defaultKySettings).text();
      return { available: rsp.includes('OK'), message: rsp };
    },
    auth: {
      status: async (token: string | null = null): Promise<TypesApiEndpoint.RspAuthMeGet> => {
        const rsp = await ky
          .get(`${BASE_URI}/auth/me`, {
            ...defaultKySettings,
            headers:
              token !== null
                ? {
                    ...defaultKySettings.headers,
                    Authorization: 'Bearer ' + token,
                  }
                : defaultKySettings.headers,
          })
          .json();
        return rsp as TypesApiEndpoint.RspAuthMeGet;
      },
      login: async (reqBody: TypesApiEndpoint.ReqAuthMePost): Promise<TypesApiEndpoint.RspAuthMePost> => {
        const rsp = await ky
          .post(`${BASE_URI}/auth/me`, {
            ...defaultKySettings,
            json: reqBody,
          })
          .json();
        return rsp as TypesApiEndpoint.RspAuthMePost;
      },
    },
    works: {
      list: async (
        order: TypesApi.OrderName,
        sort: 'asc' | 'desc',
        page: number,
        pageSize: number,
        subtitle: 0 | 1 = 0,
        seed: number = 0, // for order 'random'
      ): Promise<TypesApiEndpoint.RspWorks> => {
        if (page < 1) throw new Error('Invalid page number');
        if (pageSize < 1 || pageSize > 999) throw new Error('Invalid pageSize number');
        const rsp = await ky
          .get(`${BASE_URI}/works`, {
            ...defaultKySettings,
            searchParams: { order, sort, page, pageSize, subtitle, seed },
          })
          .json();
        return rsp as TypesApiEndpoint.RspWorks;
      },
    },
    work: {
      info: async (workId: number): Promise<TypesApiEndpoint.RspWorkInfoSanitized> => {
        const rsp: TypesApiEndpoint.RspWorkInfo = await ky
          .get(`${BASE_URI}/workInfo/${workId}`, defaultKySettings)
          .json();
        return (() => {
          const { samCoverUrl, thumbnailCoverUrl, mainCoverUrl, ...rest } = rsp;
          if (!(rsp.circle_id === rsp.circle.id && rsp.name === rsp.circle.name)) {
            throw new Error('workInfo API response sanitize error');
          } else {
            const { circle_id, name, ...rest2 } = rest;
            return rest2;
          }
        })();
      },
      fileEntry: async (
        workId: number,
      ): Promise<{
        raw: TypesApiFiles.FilesystemEntry[];
        transformed: TypesApiFiles.FilesystemEntryTransformed[];
      }> => {
        const rsp = await ky.get(`${BASE_URI}/tracks/${workId}`, defaultKySettings).json();
        return {
          raw: rsp as TypesApiFiles.FilesystemEntry[],
          transformed: (() => {
            const convertFilesystemEntries = (
              entries: TypesApiFiles.FilesystemEntry[],
            ): TypesApiFiles.FilesystemEntryTransformed[] => {
              const result: TypesApiFiles.FilesystemEntryTransformed[] = [];

              let refWorkStr: string | null = null;
              let refWorkTitle: string | null = null;

              const traverse = (items: TypesApiFiles.FilesystemEntry[], currentPath: string[]) => {
                for (const item of items) {
                  if (item.type === 'folder') {
                    traverse(item.children, [...currentPath, item.title]);
                  } else {
                    const currentWorkStr = JSON.stringify(item.work);

                    if (refWorkStr === null) {
                      refWorkStr = currentWorkStr;
                      refWorkTitle = item.workTitle;
                    } else if (currentWorkStr !== refWorkStr || item.workTitle !== refWorkTitle) {
                      throw new Error(
                        `Inconsistent work or workTitle found at: ${[...currentPath, item.title].join('/')}`,
                      );
                    }

                    const { title, work, workTitle, ...rest } = item;

                    result.push({
                      path: [...currentPath, title],
                      uuid: uuid.v4(),
                      ...rest,
                    });
                  }
                }
              };

              traverse(entries, []);
              return result;
            };
            return convertFilesystemEntries(rsp as TypesApiFiles.FilesystemEntry[]);
          })(),
        };
      },
    },
    media: {
      coverImage: async (workId: number, type: 'main' | 'thumb' | 'icon'): Promise<ArrayBuffer> => {
        const rsp = await ky
          .get(`${BASE_URI}/cover/${workId}.jpg`, {
            ...defaultKySettings,
            searchParams: {
              type: stringUtils.replaceMultiPatterns(
                [
                  [/thumb/, '240x240'],
                  [/icon/, 'sam'],
                ],
                type,
              ),
            },
          })
          .arrayBuffer();
        return rsp;
      },
    },
  },
};

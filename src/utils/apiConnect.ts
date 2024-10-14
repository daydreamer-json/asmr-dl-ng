import appConfig from './config.js';
import logger from './logger.js';
import axios from 'axios';
import apiDefsModule from './apiDefs.js';
import argvUtils from './argv.js';

async function apiConnect(
  url: string,
  params: object,
  headers: object = apiDefsModule.defaultApiConnectionHeader,
): Promise<any> {
  let connectionTimer = process.hrtime();
  try {
    const response = await axios({
      method: 'get',
      url: url,
      params: params,
      headers: { ...apiDefsModule.defaultApiConnectionHeader, ...headers },
      timeout: appConfig.network.timeout,
    });
    let connectionTimeResult = process.hrtime(connectionTimer);
    // logger.trace(`Connection: https://${response.request.host}${response.request.path} (${(connectionTimeResult[0] * 1e9 + connectionTimeResult[1]) / 1e6} ms)`);
    return response.data;
  } catch (error: any) {
    let connectionTimeResult = process.hrtime(connectionTimer);
    argvUtils.getArgv().noShowProgress === true ? logger.error(`Error connecting to API: ${error.message}`) : null;
    throw error;
  }
}

async function apiConnectBinary(
  url: string,
  params: object,
  headers: object = apiDefsModule.defaultApiConnectionHeader,
): Promise<any> {
  let connectionTimer = process.hrtime();
  try {
    const response = await axios({
      method: 'get',
      url: url,
      params: params,
      headers: { ...apiDefsModule.defaultApiConnectionHeader, ...headers },
      timeout: appConfig.network.timeout,
      responseType: 'arraybuffer',
    });
    let connectionTimeResult = process.hrtime(connectionTimer);
    // logger.trace(`Connection: https://${response.request.host}${response.request.path} (${(connectionTimeResult[0] * 1e9 + connectionTimeResult[1]) / 1e6} ms)`);
    return response.data;
  } catch (error: any) {
    let connectionTimeResult = process.hrtime(connectionTimer);
    argvUtils.getArgv().noShowProgress === true ? logger.error(`Error connecting to API: ${error.message}`) : null;
    throw error;
  }
}

async function apiHeadConnect(
  url: string,
  params: object,
  headers: object = apiDefsModule.defaultApiConnectionHeader,
): Promise<any> {
  let connectionTimer = process.hrtime();
  try {
    const response = await axios({
      method: 'head',
      url: url,
      params: params,
      headers: { ...apiDefsModule.defaultApiConnectionHeader, ...headers },
      timeout: appConfig.network.timeout,
    });
    let connectionTimeResult = process.hrtime(connectionTimer);
    // logger.trace(`Connection: https://${response.request.host}${response.request.path} (${(connectionTimeResult[0] * 1e9 + connectionTimeResult[1]) / 1e6} ms)`);
    return response.headers;
  } catch (error: any) {
    let connectionTimeResult = process.hrtime(connectionTimer);
    argvUtils.getArgv().noShowProgress === true ? logger.error(`Error connecting to API: ${error.message}`) : null;
    throw error;
  }
}

export default {
  apiConnect,
  apiConnectBinary,
  apiHeadConnect,
};

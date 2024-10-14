import { DateTime, Duration } from 'luxon';
import childProcess from 'child_process';
import util from 'util';
import appConfig from './config.js';
import logger from './logger.js';
import argvUtils from './argv.js';
import apiConnect from './apiConnect.js';
const execPromise = util.promisify(childProcess.exec);

interface NetshCmdRspNetshIpv6AddrIF {
  address: string;
  interfaceLuid: string;
  scopeId: string;
  validUntil: {
    datetime: DateTime | number;
    second: number;
  };
  preferredUntil: {
    datetime: DateTime | number;
    second: number;
  };
  dadState: string;
  addressType: 'Temporary' | 'Public' | 'Manual' | 'Other' | string;
  skipAsSource: boolean;
}
interface NetshCmdRspNetshIpv6PrivacyIF {
  useTemporaryAddress: boolean;
  duplicateAddressDetectionAttempts: number;
  maxValidLifetimeSec: number;
  maxPreferredLifetimeSec: number;
  regenerateTimeSec: number;
  maxRandomTimeSec: number;
  randomTimeSec: number;
}
interface NetshCmdRspObjIF {
  netshIpv6Addr: Array<NetshCmdRspNetshIpv6AddrIF>;
  netshIpv6Privacy: NetshCmdRspNetshIpv6PrivacyIF;
}

async function getNetshInfo() {
  interface RawCmdRspObjIF {
    netshIpv6Addr: string;
    netshIpv6Privacy: string;
  }
  const rawCmdRspObj: RawCmdRspObjIF = {
    netshIpv6Addr: await (async () => {
      const rsp = await execPromise(`netsh interface ipv6 show addresses interface="${appConfig.network.adapterName}"`);
      return rsp.stdout.replace(/\r\n/g, '\n').trim();
    })(),
    netshIpv6Privacy: await (async () => {
      const rsp = await execPromise(`netsh interface ipv6 show privacy`);
      return rsp.stdout.replace(/\r\n/g, '\n').trim();
    })(),
  };

  const nowDateTime = DateTime.now();

  const cmdRspObj: NetshCmdRspObjIF = {
    netshIpv6Addr: (() => {
      const outarr = new Array();
      rawCmdRspObj.netshIpv6Addr.split('\n\n').forEach((addrEl) => {
        const splitOneline = addrEl.split('\n');
        const outobj: NetshCmdRspNetshIpv6AddrIF = {
          address: (() => {
            const evalres = splitOneline[0].match(/^Address (.*) Parameters$/);
            if (evalres === null) {
              throw new Error('regexp not matched');
            } else {
              return evalres[1];
            }
          })(),
          interfaceLuid: splitOneline[2].substring(21, Infinity),
          scopeId: splitOneline[3].substring(21, Infinity),
          validUntil: (() => {
            const tempVdLtUnp = splitOneline[4].substring(21, Infinity);
            if (tempVdLtUnp.includes('infinite')) {
              return { datetime: Infinity, second: Infinity };
            } else {
              let durObj = Duration.fromObject({
                days: parseInt(tempVdLtUnp.match(/(\d{1,2})d/i)?.[1] ?? '0'),
                hours: parseInt(tempVdLtUnp.match(/(\d{1,2})h/i)?.[1] ?? '0'),
                minutes: parseInt(tempVdLtUnp.match(/(\d{1,2})m/i)?.[1] ?? '0'),
                seconds: parseInt(tempVdLtUnp.match(/(\d{1,2})s/i)?.[1] ?? '0'),
              });
              return { datetime: nowDateTime.plus(durObj), second: durObj.as('seconds') };
            }
          })(),
          preferredUntil: (() => {
            const tempVdLtUnp = splitOneline[5].substring(21, Infinity);
            if (tempVdLtUnp.includes('infinite')) {
              return { datetime: Infinity, second: Infinity };
            } else {
              let durObj = Duration.fromObject({
                days: parseInt(tempVdLtUnp.match(/(\d{1,2})d/i)?.[1] ?? '0'),
                hours: parseInt(tempVdLtUnp.match(/(\d{1,2})h/i)?.[1] ?? '0'),
                minutes: parseInt(tempVdLtUnp.match(/(\d{1,2})m/i)?.[1] ?? '0'),
                seconds: parseInt(tempVdLtUnp.match(/(\d{1,2})s/i)?.[1] ?? '0'),
              });
              return { datetime: nowDateTime.plus(durObj), second: durObj.as('seconds') };
            }
          })(),
          dadState: splitOneline[6].substring(21, Infinity),
          addressType: splitOneline[7].substring(21, Infinity),
          skipAsSource: splitOneline[8].substring(21, Infinity) === 'true' ? true : false,
        };
        outarr.push(outobj);
      });
      return outarr;
    })(),
    netshIpv6Privacy: (() => {
      const tmpIpv6PrvcSplit = rawCmdRspObj.netshIpv6Privacy.split('\n').map((str) => str.substring(38, Infinity));
      const tmpFunc = (idx: number) => {
        if (tmpIpv6PrvcSplit[idx].includes('infinite')) {
          return Infinity;
        } else {
          let tmpDurObj = Duration.fromObject({
            days: parseInt(tmpIpv6PrvcSplit[idx].match(/(\d{1,2})d/i)?.[1] ?? '0'),
            hours: parseInt(tmpIpv6PrvcSplit[idx].match(/(\d{1,2})h/i)?.[1] ?? '0'),
            minutes: parseInt(tmpIpv6PrvcSplit[idx].match(/(\d{1,2})m/i)?.[1] ?? '0'),
            seconds: parseInt(tmpIpv6PrvcSplit[idx].match(/(\d{1,2})s/i)?.[1] ?? '0'),
          });
          return tmpDurObj.as('seconds');
        }
      };
      const outobj: NetshCmdRspNetshIpv6PrivacyIF = {
        useTemporaryAddress: tmpIpv6PrvcSplit[4] === 'enabled' ? true : false,
        duplicateAddressDetectionAttempts: parseInt(tmpIpv6PrvcSplit[5]),
        maxValidLifetimeSec: tmpFunc(6),
        maxPreferredLifetimeSec: tmpFunc(7),
        regenerateTimeSec: tmpFunc(8),
        maxRandomTimeSec: tmpFunc(9),
        randomTimeSec: tmpFunc(10),
      };
      return outobj;
    })(),
  };
  return cmdRspObj;
}

async function refreshIpv6() {}

async function checkIsUsingTempIpv6(netshCmdRspObj: NetshCmdRspObjIF) {
  let isUsingTempIpv6 = false;
  let ipv6ApiRsp = null;
  try {
    logger.trace('Testing IPv6 connection ...');
    ipv6ApiRsp = await apiConnect.apiConnect('https://api6.ipify.org/', {}, {});
  } catch (error) {
    logger.warn('Your network does not seem to support IPv6; continue the connection with IPv4');
    ipv6ApiRsp = null;
  } finally {
    if (
      typeof ipv6ApiRsp === 'string' &&
      ipv6ApiRsp.match(
        /^([0-9a-f]{0,4}):([0-9a-f]{0,4}):([0-9a-f]{0,4}):([0-9a-f]{0,4}):([0-9a-f]{0,4}):([0-9a-f]{0,4}):([0-9a-f]{0,4}):([0-9a-f]{0,4})$/,
      ) !== null &&
      netshCmdRspObj.netshIpv6Addr.find((obj) => obj.addressType === 'Temporary')?.address === ipv6ApiRsp
    ) {
      isUsingTempIpv6 = true;
      logger.debug('Connection is possible with a IPv6 temporary address');
    }
  }
}

export default {
  getNetshInfo,
  refreshIpv6,
  checkIsUsingTempIpv6,
};

import updaterUtils from '../updater/updater.js';

async function mainCmdHandler() {
  await updaterUtils.checkAppUpdate();
}

export default mainCmdHandler;

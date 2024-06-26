import shell from 'shelljs';
import { API } from 'ssm-shared-lib';
import { v4 as uuidv4 } from 'uuid';
import User from '../../data/database/model/User';
import AnsibleTaskRepo from '../../data/database/repository/AnsibleTaskRepo';
import DeviceAuthRepo from '../../data/database/repository/DeviceAuthRepo';
import logger from '../../logger';
import AnsibleGalaxyCmd from '../ansible/AnsibleGalaxyCmd';
import Inventory from '../ansible/utils/InventoryTransformer';
import { Ansible } from '../../types/typings';
import ansibleCmd from '../ansible/AnsibleCmd';

export const ANSIBLE_PATH = '/server/src/ansible/';

function timeout(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function executePlaybook(
  playbook: string,
  user: User,
  target?: string[],
  extraVars?: API.ExtraVars,
) {
  logger.info('[SHELL]-[ANSIBLE] - executePlaybook - Starting...');

  let inventoryTargets: (Ansible.All & Ansible.HostGroups) | undefined;
  if (target) {
    logger.info(`[SHELL]-[ANSIBLE] - executePlaybook - called with target: ${target}`);
    const devicesAuth = await DeviceAuthRepo.findManyByDevicesUuid(target);
    if (!devicesAuth || devicesAuth.length === 0) {
      logger.error(`[SHELL]-[ANSIBLE] - executePlaybook - Target not found`);
      throw new Error('Exec failed, no matching target');
    }
    inventoryTargets = Inventory.inventoryBuilderForTarget(devicesAuth);
  }
  return await executePlaybookOnInventory(playbook, user, inventoryTargets, extraVars);
}

async function executePlaybookOnInventory(
  playbook: string,
  user: User,
  inventoryTargets?: Ansible.All & Ansible.HostGroups,
  extraVars?: API.ExtraVars,
) {
  if (!playbook.endsWith('.yml')) {
    playbook += '.yml';
  }
  shell.cd(ANSIBLE_PATH);
  shell.rm('/server/src/ansible/inventory/hosts');
  shell.rm('/server/src/ansible/env/_extravars');
  const uuid = uuidv4();
  const result = await new Promise<string | null>((resolve) => {
    const cmd = ansibleCmd.buildAnsibleCmd(playbook, uuid, inventoryTargets, user, extraVars);
    logger.info(`[SHELL]-[ANSIBLE] - executePlaybook - Executing ${cmd}`);
    const child = shell.exec(cmd, {
      async: true,
    });
    child.stdout?.on('data', function (data) {
      resolve(data);
    });
    child.on('exit', function () {
      resolve(null);
    });
  });
  logger.info('[SHELL]-[ANSIBLE] - executePlaybook - launched');
  if (result) {
    logger.info(`[SHELL]-[ANSIBLE] - executePlaybook - ExecId is ${uuid}`);
    await AnsibleTaskRepo.create({ ident: uuid, status: 'created', cmd: `playbook ${playbook}` });
    return result;
  } else {
    logger.error('[SHELL]-[ANSIBLE] - executePlaybook - Result was not properly set');
    throw new Error('Exec failed');
  }
}

async function listPlaybooks() {
  try {
    logger.info('[SHELL]-[ANSIBLE] - listPlaybook - Starting...');
    shell.cd(ANSIBLE_PATH);
    const listOfPlaybooks: string[] = [];
    shell.ls('*.yml').forEach(function (file) {
      listOfPlaybooks.push(file);
    });
    logger.info('[SHELL]-[ANSIBLE] - listPlaybook - ended');
    return listOfPlaybooks;
  } catch (error) {
    logger.error('[SHELL]-[ANSIBLE] - listPlaybook');
    throw new Error('listPlaybooks failed');
  }
}

async function readPlaybook(playbook: string) {
  try {
    logger.info(`[SHELL]-[ANSIBLE] - readPlaybook - ${playbook}  - Starting...`);
    shell.cd(ANSIBLE_PATH);
    return shell.cat(playbook).toString();
  } catch (error) {
    logger.error('[SHELL]-[ANSIBLE] - readPlaybook');
    throw new Error('readPlaybook failed');
  }
}

async function readPlaybookConfiguration(playbookConfigurationFile: string) {
  try {
    logger.info(
      `[SHELL]-[ANSIBLE] - readPlaybookConfiguration - ${playbookConfigurationFile} - Starting...`,
    );
    shell.cd(ANSIBLE_PATH);
    if (!shell.test('-f', ANSIBLE_PATH + playbookConfigurationFile)) {
      logger.info(`[SHELL]-[ANSIBLE] - readPlaybookConfiguration - not found`);
      return undefined;
    }
    return shell.cat(playbookConfigurationFile).toString();
  } catch (error) {
    logger.error('[SHELL]-[ANSIBLE] - readPlaybookConfiguration');
    throw new Error('readPlaybookConfiguration failed');
  }
}

async function editPlaybook(playbook: string, content: string) {
  try {
    logger.info('[SHELL]-[ANSIBLE] - editPlaybook - Starting...');
    shell.cd(ANSIBLE_PATH);
    shell.ShellString(content).to(playbook);
  } catch (error) {
    logger.error('[SHELL]-[ANSIBLE] - editPlaybook');
    throw new Error('editPlaybook failed');
  }
}

async function newPlaybook(playbook: string) {
  try {
    logger.info('[SHELL]-[ANSIBLE] - newPlaybook - Starting...');
    shell.cd(ANSIBLE_PATH);
    shell.touch(playbook + '.yml');
  } catch (error) {
    logger.error('[SHELL]-[ANSIBLE] - newPlaybook');
    throw new Error('newPlaybook failed');
  }
}

async function deletePlaybook(playbook: string) {
  try {
    logger.info('[SHELL]-[ANSIBLE] - newPlaybook - Starting...');
    shell.cd(ANSIBLE_PATH);
    shell.rm(playbook);
  } catch (error) {
    logger.error('[SHELL]-[ANSIBLE] - newPlaybook');
    throw new Error('deletePlaybook failed');
  }
}

async function getAnsibleVersion() {
  try {
    logger.info('[SHELL] - getAnsibleVersion - Starting...');
    return shell.exec('ansible --version').toString();
  } catch (error) {
    logger.error('[SHELL]- - getAnsibleVersion');
  }
}

async function saveSshKey(key: string, uuid: string) {
  try {
    logger.info('[SHELL] - vaultSshKey Starting...');
    if (shell.exec(`echo '${key}' > /tmp/${uuid}.key`).code !== 0) {
      throw new Error('[SHELL] - vaultSshKey - Error creating tmp file');
    }
    if (shell.chmod(600, `/tmp/${uuid}.key`).code !== 0) {
      throw new Error('[SHELL] - vaultSshKey - Error chmoding file');
    }
  } catch (error) {
    logger.error('[SHELL] - vaultSshKey');
    throw error;
  }
}

async function installAnsibleGalaxyCollection(name: string, namespace: string) {
  try {
    logger.info('[SHELL] - installAnsibleGalaxyCollection Starting...');
    const result = shell.exec(AnsibleGalaxyCmd.getInstallCollectionCmd(name, namespace));
    if (result.code !== 0) {
      throw new Error('[SHELL] - installAnsibleGalaxyCollection has failed');
    }
    let collectionList = '';
    let i = 0;
    while (!collectionList.includes(`${namespace}.${name}`) && i++ < 60) {
      await timeout(2000);
      const resultList = shell.exec(
        AnsibleGalaxyCmd.getListCollectionsCmd(name, namespace) +
          ' > /tmp/ansible-collection-output.tmp.txt',
      );
      await timeout(2000);
      collectionList = shell.cat('/tmp/ansible-collection-output.tmp.txt').toString();
    }
    if (!collectionList.includes(`${namespace}.${name}`)) {
      throw new Error('[SHELL] - installAnsibleGalaxyCollection has failed');
    }
  } catch (error) {
    logger.error('[SHELL] - installAnsibleGalaxyCollection');
    throw error;
  }
}

export default {
  executePlaybook,
  listPlaybooks,
  readPlaybook,
  editPlaybook,
  newPlaybook,
  deletePlaybook,
  readPlaybookConfiguration,
  getAnsibleVersion,
  saveSshKey,
  executePlaybookOnInventory,
  installAnsibleGalaxyCollection,
};

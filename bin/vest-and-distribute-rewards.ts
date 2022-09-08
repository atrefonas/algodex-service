#!/usr/bin/env node
const args = require('minimist')(process.argv.slice(2));
const getAlgod = require('../src/algod');
const getDatabases = require('../src/db/get-databases');
const getIndexer = require('../src/get-indexer');
const distributeRewards =
  require('../src/rewards/distribute/vest-distribute-rewards');
const algosdk = require('algosdk');

import {DistributeRewardsInput} from '../src/rewards/distribute/vest-distribute-rewards-schema';

/* Usage
 *
 * ./vest-and-distribute-rewards --inputFile=<file>
 *                      --epoch=<epoch> --accrualNetwork=<testnet|mainnet>
 */

const initAndDistribute = async () => {
  const algodClient = getAlgod();
  const inputFile = args.inputFile;
  const distributeNetwork = process.env.ALGORAND_NETWORK;
  const mnemonic = process.env.REWARDS_WALLET_MNEMONIC;
  const assetId = process.env.ALGX_ASSET_ID;
  const epoch = args.epoch;
  const dryRunWithDBSave = args.dryRunWithDBSave;

  if (!inputFile) {
    throw new Error('No input file defined!');
  }
  if (!distributeNetwork) {
    throw new Error('No distribute network defined!');
  }
  if (!epoch) {
    throw new Error('no epoch defined');
  }
  if (!mnemonic) {
    throw new Error('no mnemonic defined');
  }
  if (!assetId) {
    throw new Error('no assetId defined');
  }
  const account = algosdk.mnemonicToSecretKey(mnemonic);
  const indexer = getIndexer();

  const config:DistributeRewardsInput = {epoch, algodClient,
    distributeNetwork, indexer,
    dryRunWithDBSave,
    fromAccount: account, sendAssetId: parseInt(assetId)};

  printIntro(config);
  distributeRewards(config);
};

const printIntro = config => {
  const copy = JSON.parse(JSON.stringify(config));
  delete copy.rewardsDB;
  delete copy.indexer;
  delete copy.wallets;
  copy.fromWallet = copy.fromAccount.addr;
  delete copy.fromAccount;
  console.log('ALGODEX REWARDS DISTRIBUTION');
  console.log('CONFIG:', JSON.stringify(copy));
};


process.on('SIGINT', async function() {
  console.log('Caught interrupt signal');
  globalThis.isGloballyShuttingDown = true;
});


initAndDistribute();

export {};

#!/usr/bin/env node

/*
 * Usage:
 *
 * bin/run-end-to-end-test --mode=[light|heavy] --doNotRunService=[serviceName]
 *
 */
/* eslint-disable max-len */
/* eslint-disable require-jsdoc */

const childProcess = require('child_process');
let isGloballyShuttingDown = false;

const dotenv = require('dotenv');
const fs = require('fs');
const sleep = require('../src/sleep');
const getQueues = require('../src/queues');
const getDatabases = require('../src/db/get-databases');
const args = require('minimist')(process.argv.slice(2));

process.env.INTEGRATION_TEST_MODE = '1';


const getFile = async file => {
  return await new Promise( resolve => {
    fs.readFile(file, 'utf8', (err, data) => {
      console.log(data);
      resolve(data);
    });
  });
};

const getConfig = async () => {
  const envContents = await getFile('./.testnet.localhost.env');
  const buf = Buffer.from(envContents);
  const config = dotenv.parse(buf);
  return config;
};

const processToAppContext = new Map();

async function runScript(scriptPath, appContext='', args=null) {
  // keep track of whether callback has been invoked to prevent multiple invocations
  const envConfig = await getConfig();
  // const out = fs.openSync(`./integration_test/log/${appContext}_out.log`, 'a');
  // const err = fs.openSync(`./integration_test/log/${appContext}_out.log`, 'a');

  const options = {env: {...envConfig,
    'APP_CONTEXT': appContext,
    'INTEGRATION_TEST_MODE': 1,
  },
  // stdio: [ 'pipe', out, err ],
  };

  return new Promise(resolve => {
    let invoked = false;
    // console.log({envConfig});
    console.log('STARTING: ' + scriptPath + ' ' + appContext);

    const process = childProcess.spawn(scriptPath, args ? args : [], options);
    if (!process.pid) {
      throw new Error('no pid can be found!');
    }
    processToAppContext.set(process.pid, appContext);
    // listen for errors as they may prevent the exit event from firing
    process.on('error', function(err) {
      if (invoked) return;
      invoked = true;
      process.kill();
      resolve(err);
    });

    // execute the callback once the process has finished running
    process.on('exit', function(code) {
      if (invoked) return;
      invoked = true;
      const err = code === 0 ? null : new Error('exit code ' + code);
      process.kill();
      resolve(err);
    });

    let intervalID = null;
    function checkShouldExit() {
      if (isGloballyShuttingDown) {
        console.log(appContext + ' EXITING....');
        clearInterval(intervalID);
        invoked = true;
        process.kill();
        resolve(null);
      }
    }

    intervalID = setInterval(checkShouldExit, 200);

    process.stdout.setEncoding('utf8');
    process.stdout.on('data', function(data) {
      const context = processToAppContext.get(process.pid);
      console.log(`${context}: `, data);
    });
    process.stderr.setEncoding('utf8');
    process.stderr.on('data', function(data) {
      const context = processToAppContext.get(process.pid);
      console.error(`${context}: `, data);
    });
    // process.stderr.setEncoding('utf8');
    // process.stderr.on('data', function(data) {
    //   console.log(appContext + ' stderr: ' + data);

    //   data=data.toString();
    //   scriptOutput+=data;
    // });


    // setTimeout(() => {
    //   console.log('killing sub process!');
    //   isShuttingDown = true;
    //   process.kill();
    // }, 5000);
  });
}

const startServices = async services => {
  services.forEach(service => {
    runScript('./server.js', service);
    // runScript('./bin/mytest', service);
  });
  await sleep(1000);
};

const clearQueues = async () => {
  const queues = getQueues();
  while (queues.connection.status === 'connecting') {
    await sleep(100);
  }
  const keys = await queues.connection.keys('*integration_test__*');
  if (keys?.length) {
    await queues.connection.del(keys);
  }
  while (await getActiveCounts() > 0) {
    console.log('active counts still above 0... sleeping');
    await sleep(200);
  }
  return;
  // const deletePromises = keys.map(key => {
  //   return queues.connection.del(key);
  // });
  // await Promise.all(deletePromises);
};

const getActiveCounts = async () => {
  const queueObj = getQueues();
  const queues = queueObj.queueNames.map(key => queueObj[key]);
  const countPromises =
    queues.map(queue => queue.getJobCounts('wait', 'active', 'delayed'));
  const countResults = await Promise.all(countPromises);
  const counts = countResults.reduce((totalResults, countResults) => {
    return Object.keys(countResults).reduce((sum, key) =>
      sum + countResults[key], 0) + totalResults;
  }, 0);
  console.log('job counts: ' + counts);
  return counts;
};

const initEnv = async () => {
  const config = await getConfig();
  Object.keys(config).forEach(configKey => {
    process.env[configKey] = config[configKey];
  });
};

const getLightModeRemovalString = databases => {
  const preserveDBs = new Set(['blocks', 'assets', 'indexed_escrow']);
  const removeStr = Object.keys(databases).filter(name => !preserveDBs.has(name)).join(',');
  return '--removeExtra='+removeStr;
};

const runScripts = async () => {
  console.log('here51');

  await initEnv();
  await clearQueues();
  const databases = await getDatabases();

  const removeArg = args.mode === 'light' ?
    getLightModeRemovalString(databases) : '--removeAll';
  console.log({removeArg});

  await runScript('./bin/remove-and-create-databases.js', 'remove-and-create-databases',
      [removeArg]).then(err => {
    if (err && !isGloballyShuttingDown) {
      throw err;
    }
    console.log('Finished remove-and-create-databases');
  });

  await runScript('./bin/add-views.js', 'add-views').then(err => {
    if (err && !isGloballyShuttingDown) {
      throw err;
    }
    console.log('Finished add-views');
  });
  const doNotRunService = args.doNotRunService;
  const services = [
    'algx-balance-worker',
    'asset-worker',
    'block-worker',
    'formatted-order-worker',
    'order-worker',
    'trade-history-worker',
    'broker',
  ].filter(service => service !== doNotRunService);
  console.log('starting service:', services);
  await startServices(services);

  // await runScript('./bin/sync-sequential', 'sync-sequential').then(err => {
  //   if (err && !isGloballyShuttingDown) {
  //     throw err;
  //   }
  //   console.log('Finished sync-sequential');
  //   // resolve('Completed Integration Test');
  // });
  // const lastSyncedRound = 16583454 - 1;
  const maxSyncedRoundInTestMode = 16583654;
  const blocksDB = databases.blocks;
  do {
    try {
      await blocksDB.get(maxSyncedRoundInTestMode);
      break;
    } catch (e) {
      console.log(`${maxSyncedRoundInTestMode} block not yet stored in DB!`, e);
      await sleep(250);
    }
  } while (1);

  do {
    await sleep(250);
  } while (await getActiveCounts() > 0);

  // wait for all processes to shut down
  console.log('starting shutdown...');
  await sleep(250);

  const docs = await Promise.all(
      Object.keys(databases).map(dbName => databases[dbName])
          .map(db => db.allDocs({include_docs: true}).then(result => {
            return {result, name: db.dbName};
          },
          )));

  const testDataDir = './integration_test/test_data';
  if (!fs.existsSync('./integration_test/test_data')) {
    fs.mkdirSync(testDataDir, {recursive: true});
  }
  docs.forEach(doc => {
    const json = JSON.stringify(doc.result.rows.map(row => row.doc), null, 2);
    const filename = `./integration_test/test_data/${doc.name}.txt`;
    fs.writeFile(filename, json, err => {
      if (err) {
        console.error(err);
      }
      // file written successfully
    });
    console.log('Wrote ' + filename);
  });
  console.log({docs});

  isGloballyShuttingDown = true;
  await sleep(1000);
  process.exit();
};

process.on('SIGINT', async function() {
  console.log('Caught interrupt signal');
  isGloballyShuttingDown = true;
  await sleep(1000);
  process.exit();
});

runScripts();
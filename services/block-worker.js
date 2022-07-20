const bullmq = require('bullmq');
const Worker = bullmq.Worker;
const convertQueueURL = require('../src/convert-queue-url');
const sleep = require('../src/sleep');
const getDirtyAccounts = require('../src/get-dirty-accounts');
const withSchemaCheck = require('../src/schema/with-db-schema-check');
const sleepWhileWaitingForQueues =
  require('../src/sleep-while-waiting-for-queues');
const checkBlockNotSynced = require('./block-worker/checkBlockNotSynced');
const addBlockToDB = require('./block-worker/addBlockToDB');
const getOrdersPromise = require('./block-worker/getOrdersPromise');

module.exports = ({queues, databases}) =>{
  const syncedBlocksDB = databases.synced_blocks;
  const blocksDB = databases.blocks;

  const blocks = new Worker(convertQueueURL('blocks'), async job=>{
    console.debug({
      msg: 'Received block',
      round: job.data.rnd,
    });

    await sleepWhileWaitingForQueues(['tradeHistory', 'assets',
      'orders', 'algxBalance']);

    await checkBlockNotSynced(blocksDB, job.data.rnd);

    await addBlockToDB(job.data.rnd);

    // eslint-disable-next-line max-len
    const dirtyAccounts = getDirtyAccounts(job.data).map( account => [account] );

    return Promise.all( [getOrdersPromise({databases, queues,
      dirtyAccounts, blockData: job.data}),
    // The trade history is always from orders that previously existed
    // in other blocks, so we can queue it in parallel
    // to adding them to orders
    queues.tradeHistory.add('tradeHistory', {block: `${job.data.rnd}`},
        {removeOnComplete: true}).then(function() {
    }).catch(function(err) {
      console.error('error adding to trade history queue:', {err} );
      throw err;
    }),
    queues.algxBalance.add('algxBalance', {...job.data},
        {removeOnComplete: true}).then(function() {
    }).catch(function(err) {
      console.error('error adding to ALGX balance queue:', {err} );
      throw err;
    }),
    // eslint-disable-next-line max-len
    syncedBlocksDB.post(withSchemaCheck('synced_blocks', {_id: `${job.data.rnd}`}))
        .then(function() { }).catch(function(err) {
          if (err.error === 'conflict') {
            console.error('Block was already synced! Not supposed to happen');
          } else {
            throw err;
          }
        }),

    ]);
  }, {connection: queues.connection, concurrency: 50});

  blocks.on('error', err => {
    console.error( {err} );
  });
};


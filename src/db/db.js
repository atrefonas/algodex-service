const {InvalidConfiguration} = require('../Errors');
const PouchDB = require('pouchdb-node');
const convertURL = require('./convert-db-url');

const db = [];

module.exports = function(dbUrl) {
  const url = convertURL(dbUrl);
  console.log({url});
  if (
    typeof url === 'undefined'
  ) {
    throw new InvalidConfiguration('Couchdb not configured!');
  }

  if (!db.hasOwnProperty(url)) {
    const username = process.env.COUCHDB_USERNAME || 'admin';
    const password = process.env.COUCHDB_PASSWORD || 'dex';
    const options = {auth: {
      username, password,
    }};
    db[url] = new PouchDB(url, options);
  }
  return db[url];
};

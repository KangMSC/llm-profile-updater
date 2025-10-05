const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { database } = require('./config');

let db;

function connect() {
  const absoluteDbPath = path.resolve(database.path);
  db = new sqlite3.Database(absoluteDbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
    if (err) {
      console.error('Error connecting to the database:', err.message);
    } else {
      console.log('Connected to the SQLite database.');
    }
  });
}

function getActorUUID(actorName, callback) {
  const query = `SELECT id, CAST(uuid AS TEXT) AS uuid FROM main.uuid_mappings WHERE actor_name = ? ORDER BY updated_at DESC LIMIT 1`;
  db.get(query, [actorName], (err, row) => {
    if (err) {
      console.error(`Error fetching UUID for ${actorName}:`, err.message);
      return callback(err, null);
    }
    callback(null, row ? row.uuid : null);
  });
}

function getCharacterMemories(actorUUID, callback) {
  const query = `SELECT * FROM memories WHERE actor_uuid = ? ORDER BY creation_time DESC`;
  db.all(query, [actorUUID], (err, rows) => {
    if (err) {
      console.error('Error fetching memories:', err.message);
      return callback(err, null);
    }
    callback(null, rows);
  });
}

function close() {
    db.close((err) => {
        if (err) {
            console.error(err.message);
        }
        console.log('Closed the database connection.');
    });
}

module.exports = {
  connect,
  getActorUUID,
  getCharacterMemories,
  close,
};

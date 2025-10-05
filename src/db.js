const sqlite3 = require('sqlite3').verbose();
const { database } = require('./config');

let db;

function connect() {
  db = new sqlite3.Database(database.path, sqlite3.OPEN_READONLY, (err) => {
    if (err) {
      console.error('Error connecting to the database:', err.message);
    } else {
      console.log('Connected to the SQLite database.');
    }
  });
}

function getCharacterMemories(characterId, callback) {
  const query = `SELECT * FROM memories WHERE character_id = ? ORDER BY timestamp DESC`;
  db.all(query, [characterId], (err, rows) => {
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
  getCharacterMemories,
  close,
};

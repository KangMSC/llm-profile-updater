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

function getCharacterEvents(actorUUID, callback) {
  const query = `SELECT * FROM events WHERE originating_actor_UUID = ? ORDER BY game_time DESC`;
  db.all(query, [actorUUID], (err, rows) => {
    if (err) {
      console.error('Error fetching events:', err.message);
      return callback(err, null);
    }
    callback(null, rows);
  });
}

function getEventsForDiary(actorUUID, callback) {
  const lastDayQuery = `
    SELECT game_time_str
    FROM events
    WHERE originating_actor_UUID = ?
    ORDER BY game_time DESC
    LIMIT 1
  `;

  db.get(lastDayQuery, [actorUUID], (err, lastEvent) => {
    if (err) {
      console.error('Error fetching last event for diary:', err.message);
      return callback(err, null);
    }
    if (!lastEvent) {
      return callback(null, []); // No events for this actor
    }

    const lastDayStr = lastEvent.game_time_str.substring(lastEvent.game_time_str.indexOf(',') + 2);

    const previousDayQuery = `
      SELECT game_time_str
      FROM events
      WHERE originating_actor_UUID = ? AND SUBSTR(game_time_str, INSTR(game_time_str, ',') + 2) != ?
      ORDER BY game_time DESC
      LIMIT 1
    `;

    db.get(previousDayQuery, [actorUUID, lastDayStr], (err, previousEvent) => {
      if (err) {
        console.error('Error fetching previous day event for diary:', err.message);
        return callback(err, null);
      }
      if (!previousEvent) {
        return callback(null, []); // Only one day of events exists
      }

      const previousDayStr = previousEvent.game_time_str.substring(previousEvent.game_time_str.indexOf(',') + 2);

      const diaryEventsQuery = `
        SELECT *
        FROM events
        WHERE originating_actor_UUID = ? AND SUBSTR(game_time_str, INSTR(game_time_str, ',') + 2) = ?
        ORDER BY game_time ASC
      `;

      db.all(diaryEventsQuery, [actorUUID, previousDayStr], (err, events) => {
        if (err) {
          console.error('Error fetching diary events:', err.message);
          return callback(err, null);
        }
        callback(null, events);
      });
    });
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
  getCharacterEvents,
  getEventsForDiary,
  close,
};

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
  const query = `SELECT id, CAST(uuid AS TEXT) AS uuid FROM main.uuid_mappings WHERE actor_name = ? ORDER BY updated_at ASC LIMIT 1`;
  db.get(query, [actorName], (err, row) => {
    if (err) {
      console.error(`Error fetching UUID for ${actorName}:`, err.message);
      return callback(err, null);
    }
    callback(null, row ? row.uuid : null);
  });
}

function getCharacterEvents(actorUUID, callback) {
  // Step 1: Find the timestamp of the character's most recent event to establish a reference point.
  const latestTimestampQuery = `
    SELECT MAX(game_time) AS latest_time
    FROM events
    WHERE CAST(originating_actor_UUID AS TEXT) = ? OR CAST(target_actor_UUID AS TEXT) = ?`;

  db.get(latestTimestampQuery, [actorUUID, actorUUID], (err, row) => {
    if (err || !row || !row.latest_time) {
      console.log(`[DB] No events found for actor ${actorUUID} to set a time window. Returning empty.`);
      return callback(null, []);
    }

    const latestTimestamp = row.latest_time;
    const twoDaysInGameSeconds = 2 * 86400; // 48 hours in seconds

    // Simplified time window: Get all events in the 48 hours leading up to the last event.
    const endOfWindow = latestTimestamp;
    const startOfWindow = endOfWindow - twoDaysInGameSeconds;

    // Step 2: Fetch all events where the character is involved (or it's narration) within the new window.
    const eventsQuery = `
      SELECT *
      FROM events
      WHERE ((CAST(originating_actor_UUID AS TEXT) = ? OR CAST(target_actor_UUID AS TEXT) = ?) OR event_type = 'direct_narration')
        AND game_time >= ?
        AND game_time <= ?
      ORDER BY game_time ASC`;

    db.all(eventsQuery, [actorUUID, actorUUID, startOfWindow, endOfWindow], (err, rows) => {
      if (err) {
        console.error('Error fetching events for the last two days:', err.message);
        return callback(err, null);
      }
      console.log(`[DB] Found ${rows.length} events in the last 48 hours for actor ${actorUUID}.`);
      callback(null, rows);
    });
  });
}

function getEventsForDiary(actorUUID, callback) {
  const condition = `(CAST(originating_actor_UUID AS TEXT) = ? OR CAST(target_actor_UUID AS TEXT) = ?)`;

  const lastDayQuery = `
    SELECT game_time_str
    FROM events
    WHERE ${condition}
    ORDER BY game_time DESC
    LIMIT 1
  `;

  db.get(lastDayQuery, [actorUUID, actorUUID], (err, lastEvent) => {
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
      WHERE ${condition} AND SUBSTR(game_time_str, INSTR(game_time_str, ',') + 2) != ?
      ORDER BY game_time DESC
      LIMIT 1
    `;

    db.get(previousDayQuery, [actorUUID, actorUUID, lastDayStr], (err, previousEvent) => {
      if (err) {
        console.error('Error fetching previous day event for diary:', err.message);
        return callback(err, null);
      }
      if (!previousEvent) {
        console.log(`[DB] Only one day of events found for actor ${actorUUID}. Cannot generate diary for a 'previous' day.`);
        return callback(null, []); // Only one day of events exists
      }

      const previousDayStr = previousEvent.game_time_str.substring(previousEvent.game_time_str.indexOf(',') + 2);

      const diaryEventsQuery = `
        SELECT *
        FROM events
        WHERE (${condition} OR event_type = 'direct_narration') AND SUBSTR(game_time_str, INSTR(game_time_str, ',') + 2) = ?
        ORDER BY game_time ASC
      `;

      db.all(diaryEventsQuery, [actorUUID, actorUUID, previousDayStr], (err, events) => {
        if (err) {
          console.error('Error fetching diary events:', err.message);
          return callback(err, null);
        }
        console.log(`[DB] Found ${events.length} events for diary on day '${previousDayStr}' for actor ${actorUUID}.`);
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

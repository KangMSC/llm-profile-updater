const fs = require('fs').promises;
const path = require('path');

const LOG_DIR = path.join(__dirname, '..', 'logs', 'llm-io');

/**
 * Ensures that the log directory for a specific character exists.
 * @param {string} characterName - The name of the character.
 * @returns {Promise<string>} The path to the character's log directory.
 */
async function ensureLogDirectory(characterName) {
  const characterLogDir = path.join(LOG_DIR, characterName);
  await fs.mkdir(characterLogDir, { recursive: true });
  return characterLogDir;
}

/**
 * Logs a specific piece of information (prompt or error) for a character's action.
 * @param {string} characterName - The name of the character.
 * @param {'prompt' | 'error'} type - The type of log.
 * @param {string} action - The action being performed (e.g., 'update_profile', 'generate_diary').
 * @param {string} content - The content to log.
 */
async function writeLog(characterName, type, action, content) {
  try {
    const characterLogDir = await ensureLogDirectory(characterName);
    const logFile = path.join(characterLogDir, `${action}_${type}.log`);
    await fs.writeFile(logFile, content, 'utf-8');
  } catch (error) {
    console.error(`Failed to write LLM log for ${characterName} [${action}_${type}]`, error);
  }
}

/**
 * Clears a specific log file.
 * @param {string} characterName - The name of the character.
 * @param {'prompt' | 'error'} type - The type of log.
 * @param {string} action - The action being performed.
 */
async function clearLog(characterName, type, action) {
  try {
    const characterLogDir = await ensureLogDirectory(characterName);
    const logFile = path.join(characterLogDir, `${action}_${type}.log`);
    await fs.unlink(logFile);
  } catch (error) {
    if (error.code !== 'ENOENT') { // Ignore error if file doesn't exist
      console.error(`Failed to clear LLM log for ${characterName} [${action}_${type}]`, error);
    }
  }
}

/**
 * Reads a specific log file.
 * @param {string} characterName - The name of the character.
 * @param {'prompt' | 'error'} type - The type of log.
 * @param {string} action - The action being performed.
 * @returns {Promise<string|null>} The content of the log file, or null if it doesn't exist.
 */
async function readLog(characterName, type, action) {
    try {
        const logFile = path.join(LOG_DIR, characterName, `${action}_${type}.log`);
        return await fs.readFile(logFile, 'utf-8');
    } catch (error) {
        if (error.code === 'ENOENT') {
            return null; // File doesn't exist, return null
        }
        console.error(`Failed to read LLM log for ${characterName} [${action}_${type}]`, error);
        return 'Error reading log file.'; // Return error message on other errors
    }
}


module.exports = { writeLog, clearLog, readLog };

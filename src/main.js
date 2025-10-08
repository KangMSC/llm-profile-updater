const fs = require('fs/promises');
const path = require('path');
const db = require('./db');
const llm = require('./llm');
const { charactersToUpdate } = require('./config');

const PROFILES_DIR = path.join(__dirname, '..', 'profiles');

const DEFAULT_PROFILE = {
  summary: '정보 없음',
  appearance: '정보 없음',
  likesAndDislikes: '정보 없음',
};

async function processCharacter(actorName) {
  const profilePath = path.join(PROFILES_DIR, `${actorName}.json`);

  return new Promise(async (resolve) => {
    console.log(`[Updater] Processing character: ${actorName}`);

    let existingProfile = { ...DEFAULT_PROFILE };
    try {
      const fileContent = await fs.readFile(profilePath, 'utf-8');
      existingProfile = JSON.parse(fileContent);
      console.log(`[Updater] Loaded existing profile for ${actorName}.`);
    } catch (error) {
      console.log(`[Updater] No existing profile found for ${actorName}. Using default.`);
    }

    db.getActorUUID(actorName, (err, actorUUID) => {
      if (err || !actorUUID) {
        console.error(`[Updater] Could not find UUID for ${actorName}. Skipping.`);
        return resolve();
      }

      db.getCharacterEvents(actorUUID, async (err, events) => {
        if (err || !events || events.length === 0) {
          console.log(`[Updater] No new events found for ${actorName}. Skipping LLM update.`);
          return resolve();
        }

        try {
          console.log(`[Updater] Found ${events.length} events. Updating profile with LLM...`);
          const llmResponse = await llm.updateCharacterProfile(actorName, events, JSON.stringify(existingProfile, null, 2));
          
          const updatedProfile = JSON.parse(llmResponse);
          console.log(`[Updater] Successfully updated profile for ${actorName}.`);

          await fs.writeFile(profilePath, JSON.stringify(updatedProfile, null, 2), 'utf-8');
          console.log(`[Updater] Saved updated profile to ${profilePath}`);

        } catch (error) {
          console.error(`[Updater] Failed to update character profile for ${actorName}:`, error);
        } finally {
          resolve();
        }
      });
    });
  });
}

async function main() {
  if (!charactersToUpdate || charactersToUpdate.length === 0) {
    console.log('[Updater] No characters to update. Please set CHARACTER_NAMES in your .env file.');
    return;
  }

  try {
    await fs.mkdir(PROFILES_DIR, { recursive: true });
  } catch (error) {
    console.error('[Updater] Could not create profiles directory', error);
    return;
  }

  console.log(`[Updater] Starting profile update for ${charactersToUpdate.length} character(s).`);
  db.connect();

  for (const actorName of charactersToUpdate) {
    await processCharacter(actorName.trim());
  }

  db.close();
  console.log('[Updater] All characters processed. Shutting down.');
}

// If this script is run directly, execute the main function
if (require.main === module) {
  main();
}

module.exports = { processCharacter };

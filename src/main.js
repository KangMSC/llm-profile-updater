const db = require('./db');
const llm = require('./llm');
const { charactersToUpdate } = require('./config');

async function processCharacter(actorName) {
  return new Promise((resolve, reject) => {
    console.log(`Processing character: ${actorName}`);
    db.getActorUUID(actorName, (err, actorUUID) => {
      if (err || !actorUUID) {
        console.error(`Could not find UUID for ${actorName}. Skipping.`);
        return resolve(); // Resolve to continue with the next character
      }

      console.log(`Found UUID ${actorUUID} for ${actorName}. Fetching memories...`);
      db.getCharacterMemories(actorUUID, async (err, memories) => {
        if (err) {
          console.error(`Error fetching memories for ${actorName}.`);
          return resolve(); // Resolve to continue
        }

        if (!memories || memories.length === 0) {
          console.log(`No memories found for ${actorName}.`);
          return resolve();
        }

        try {
          console.log(`Found ${memories.length} memories. Generating new profile with LLM...`);
          const newProfile = await llm.generateCharacterProfile(actorName, memories);
          console.log(`\n--- New Profile for ${actorName} ---`);
          console.log(newProfile);
          console.log('-----------------------------------\n');

          // TODO: Save the new profile to the database
          // e.g., db.updateCharacterProfile(actorUUID, newProfile);
          console.log(`Profile generation complete for ${actorName}.`);

        } catch (error) {
          console.error(`Failed to generate character profile for ${actorName}.`);
        } finally {
          resolve();
        }
      });
    });
  });
}

async function main() {
  if (!charactersToUpdate || charactersToUpdate.length === 0) {
    console.log('No characters to update. Please set CHARACTER_NAMES in your .env file.');
    return;
  }

  console.log(`Starting profile update for ${charactersToUpdate.length} character(s).`);
  db.connect();

  for (const actorName of charactersToUpdate) {
    await processCharacter(actorName);
  }

  db.close();
  console.log('All characters processed. Shutting down.');
}

main();

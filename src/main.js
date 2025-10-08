const fs = require('fs/promises');
const path = require('path');
const db = require('./db');
const llm = require('./llm');
const { charactersToUpdate } = require('./config');

const PROFILES_DIR = path.join(__dirname, '..', 'profiles');
const GENERATED_PROFILES_DIR = path.join(__dirname, '..', 'generated-profiles');
const LOGS_DIR = path.join(__dirname, '..', 'logs', 'failed_responses');

const INSTRUCTIONS_PATH = path.join(__dirname, '..', 'profile-instructions.json');

// Updated to the new 10-field structure
const DEFAULT_PROFILE = {
  summary: "정보 없음",
  interject_summary: "정보 없음",
  background: "정보 없음",
  personality: "정보 없음",
  appearance: "정보 없음",
  aspirations: [],
  relationships: [],
  occupation: "정보 없음",
  skills: [],
  speech_style: "정보 없음"
};

/**
 * Formats a profile JSON object into a string with {% block %} tags.
 * @param {object} profile - The character profile object.
 * @returns {string} - The formatted string.
 */
function formatProfileToTxt(profile) {
  let txtContent = '';
  // Iterate over the actual profile keys, not just the default ones.
  for (const key of Object.keys(profile)) {
    if (profile.hasOwnProperty(key)) {
      txtContent += `{% block ${key} %}`;
      const value = profile[key];
      if (Array.isArray(value)) {
        // Format arrays as bulleted lists, ensuring proper spacing and handling empty lists
        txtContent += value.length > 0 ? '\n- ' + value.join('\n- ') + '\n' : '';
      } else {
        txtContent += value;
      }
      txtContent += `{% endblock %}\n\n`;
    }
  }
  return txtContent.trim();
}


async function processCharacter(actorName) {
  const profilePath = path.join(PROFILES_DIR, `${actorName}.json`);
  const generatedTxtPath = path.join(GENERATED_PROFILES_DIR, `${actorName}.txt`);

  return new Promise(async (resolve) => {
    console.log(`[Updater] Processing character: ${actorName}`);

    let existingProfile = { ...DEFAULT_PROFILE };
    try {
      const fileContent = await fs.readFile(profilePath, 'utf-8');
      // Ensure all keys from default profile are present
      existingProfile = { ...DEFAULT_PROFILE, ...JSON.parse(fileContent) };
      console.log(`[Updater] Loaded existing profile for ${actorName}.`);
    } catch (error) {
      console.log(`[Updater] No existing profile found for ${actorName}. Using default.`);
    }

    let allInstructions = {};
    try {
        const instructionsContent = await fs.readFile(INSTRUCTIONS_PATH, 'utf-8');
        allInstructions = JSON.parse(instructionsContent);
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.log('[Updater] No instructions file found. Proceeding without specific instructions.');
        } else {
            console.warn('[Updater] Could not read or parse instructions file. Proceeding without.', error);
        }
    }
    const characterInstructions = allInstructions[actorName];

    // Prime the profile with custom fields from instructions
    if (characterInstructions) {
        for (const key in characterInstructions) {
            if (!existingProfile.hasOwnProperty(key)) {
                console.log(`[Updater] Found new custom field '${key}' from instructions.`);
                // Add the new key with a default value so the LLM knows about it.
                const instructionValue = characterInstructions[key];
                if (typeof instructionValue === 'string' && (instructionValue.includes('array') || instructionValue.includes('list'))) {
                     existingProfile[key] = [];
                } else {
                     existingProfile[key] = '정보 없음';
                }
            }
        }
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
          if (characterInstructions) {
            console.log(`[Updater] Found specific instructions for ${actorName}.`);
          }
          const llmResponse = await llm.updateCharacterProfile(actorName, events, JSON.stringify(existingProfile, null, 2), characterInstructions);

          let updatedProfile;
          try {
            // First, try to strip markdown ```json ... ``` if it exists
            const cleanResponse = llmResponse.replace(/^```json\n/, '').replace(/\n```$/, '');
            updatedProfile = JSON.parse(cleanResponse);
          } catch (parseError) {
            console.error(`[Updater] Failed to parse LLM response for ${actorName}. It was not valid JSON.`);
            
            // Log the failed response to a file
            await fs.mkdir(LOGS_DIR, { recursive: true });
            const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
            const logPath = path.join(LOGS_DIR, `${actorName}-${timestamp}.log`);
            await fs.writeFile(logPath, `Failed LLM Response for ${actorName} at ${new Date()}:\n\n${llmResponse}`);
            console.log(`[Updater] The invalid response has been saved to ${logPath}`);
            
            // Since we can't proceed, we resolve the promise to move to the next character.
            return resolve(); 
          }

          console.log(`[Updater] Successfully updated profile for ${actorName}.`);

          // Save the updated JSON profile
          await fs.writeFile(profilePath, JSON.stringify(updatedProfile, null, 2), 'utf-8');
          console.log(`[Updater] Saved updated profile to ${profilePath}`);

          // Format and save the .txt version
          const txtContent = formatProfileToTxt(updatedProfile);
          await fs.mkdir(path.dirname(generatedTxtPath), { recursive: true });
          await fs.writeFile(generatedTxtPath, txtContent, 'utf-8');
          console.log(`[Updater] Saved generated .txt profile to ${generatedTxtPath}`);

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
    // Ensure both directories exist
    await fs.mkdir(PROFILES_DIR, { recursive: true });
    await fs.mkdir(GENERATED_PROFILES_DIR, { recursive: true });
  } catch (error) {
    console.error('[Updater] Could not create directories', error);
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
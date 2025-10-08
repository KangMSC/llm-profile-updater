const fs = require('fs/promises');
const path = require('path');
const db = require('./db');
const llm = require('./llm');
const { charactersToUpdate } = require('./config');

const DIARIES_DIR = path.join(__dirname, '..', 'diaries');

function getDiaryDate(events) {
    if (!events || events.length === 0) {
        return 'unknown_date';
    }
    // Extract date part from a string like "9:58 AM, Sundas, 17th of Last Seed, 4E 201"
    const gameDateStr = events[0].game_time_str;
    const datePart = gameDateStr.substring(gameDateStr.indexOf(',') + 2);
    // Sanitize for filename
    return datePart.replace(/, /g, '_').replace(/ /g, '_');
}


async function processCharacterForDiary(actorName) {
  return new Promise((resolve) => {
    console.log(`[Diary] Processing character: ${actorName}`);

    db.getActorUUID(actorName, (err, actorUUID) => {
      if (err || !actorUUID) {
        console.error(`[Diary] Could not find UUID for ${actorName}. Skipping.`);
        return resolve();
      }

      console.log(`[Diary] Found UUID ${actorUUID} for ${actorName}. Fetching events...`);
      db.getEventsForDiary(actorUUID, async (err, events) => {
        if (err) {
            console.error(`[Diary] Error fetching events for ${actorName}:`, err);
            return resolve();
        }
        
        if (!events || events.length === 0) {
          console.log(`[Diary] Not enough event data to generate a diary for ${actorName}. Skipping.`);
          return resolve();
        }

        console.log(`[Diary] Found ${events.length} events for ${actorName}. Generating diary with LLM...`);

        try {
          const diaryDate = getDiaryDate(events);
          const diaryFileName = `${actorName}_${diaryDate}.md`;
          const diaryPath = path.join(DIARIES_DIR, diaryFileName);

          const diaryContent = await llm.generateCharacterDiary(actorName, events);
          
          if (!diaryContent) {
              console.error(`[Diary] LLM returned no content for ${actorName}. Skipping file write.`);
              return resolve();
          }

          const fileHeader = `> **${actorName}'s Diary**\n> **Date:** ${diaryDate.replace(/_/g, ' ' )}\n\n---\n\n`;
          await fs.writeFile(diaryPath, fileHeader + diaryContent, 'utf-8');
          console.log(`[Diary] Saved diary for ${actorName} to ${diaryPath}`);

        } catch (error) {
          console.error(`[Diary] Failed to generate or save diary for ${actorName}:`, error);
        } finally {
          resolve();
        }
      });
    });
  });
}

async function main() {
  const characterArg = process.argv[2];
  const characters = characterArg ? [characterArg] : charactersToUpdate;

  if (!characters || characters.length === 0) {
    console.log('[Diary] No characters specified. Please set CHARACTER_NAMES in your .env file or provide a character name as an argument.');
    return;
  }

  try {
    await fs.mkdir(DIARIES_DIR, { recursive: true });
  } catch (error) {
    console.error('[Diary] Could not create diaries directory', error);
    return;
  }

  console.log(`[Diary] Starting diary generation for: ${characters.join(', ')}`);
  db.connect();

  for (const actorName of characters) {
    await processCharacterForDiary(actorName.trim());
  }

  db.close();
  console.log('[Diary] Diary generation complete. Shutting down.');
}

main();

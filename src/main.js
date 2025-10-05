const fs = require('fs/promises');
const path = require('path');
const db = require('./db');
const llm = require('./llm');
const { charactersToUpdate } = require('./config');

const PROFILES_DIR = path.join(__dirname, '..', 'profiles');
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

const DEFAULT_PROFILE = {
  summary: '정보 없음',
  appearance: '정보 없음',
  likesAndDislikes: '정보 없음',
};

async function processCharacter(actorName) {
  const profilePath = path.join(PROFILES_DIR, `${actorName}.json`);
  const htmlPath = path.join(PUBLIC_DIR, `${actorName}.html`);

  return new Promise(async (resolve) => {
    console.log(`Processing character: ${actorName}`);

    let existingProfile = { ...DEFAULT_PROFILE };
    try {
      const fileContent = await fs.readFile(profilePath, 'utf-8');
      existingProfile = JSON.parse(fileContent);
      console.log(`Loaded existing profile for ${actorName}.`);
    } catch (error) {
      console.log(`No existing profile found for ${actorName}. Using default.`);
    }

    db.getActorUUID(actorName, (err, actorUUID) => {
      if (err || !actorUUID) {
        console.error(`Could not find UUID for ${actorName}. Skipping.`);
        return resolve();
      }

      db.getCharacterMemories(actorUUID, async (err, memories) => {
        if (err || !memories || memories.length === 0) {
          console.log(`No new memories found for ${actorName}. Skipping LLM update.`);
          // Even if there are no new memories, we still generate the HTML
          await generateCharacterHtml(actorName, existingProfile);
          return resolve(actorName);
        }

        try {
          console.log(`Found ${memories.length} memories. Updating profile with LLM...`);
          const llmResponse = await llm.updateCharacterProfile(actorName, memories, JSON.stringify(existingProfile, null, 2));
          
          const updatedProfile = JSON.parse(llmResponse);
          console.log(`Successfully updated profile for ${actorName}.`);

          await fs.writeFile(profilePath, JSON.stringify(updatedProfile, null, 2), 'utf-8');
          console.log(`Saved updated profile to ${profilePath}`);

          await generateCharacterHtml(actorName, updatedProfile);

        } catch (error) {
          console.error(`Failed to update character profile for ${actorName}:`, error);
        } finally {
          resolve(actorName);
        }
      });
    });
  });
}

async function generateCharacterHtml(actorName, profile) {
  const htmlPath = path.join(PUBLIC_DIR, `${actorName}.html`);

  const likesAndDislikesHtml = () => {
    if (typeof profile.likesAndDislikes === 'object' && profile.likesAndDislikes !== null && !Array.isArray(profile.likesAndDislikes)) {
      const likes = profile.likesAndDislikes.likes?.map(item => `<li>${item}</li>`).join('') || '<li>정보 없음</li>';
      const dislikes = profile.likesAndDislikes.dislikes?.map(item => `<li>${item}</li>`).join('') || '<li>정보 없음</li>';
      return `<h3>Likes</h3><ul>${likes}</ul><h3>Dislikes</h3><ul>${dislikes}</ul>`;
    }
    return `<p>${profile.likesAndDislikes}</p>`;
  };

  const template = `
    <!DOCTYPE html>
    <html lang="ko">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${actorName} - Character Profile</title>
        <link rel="stylesheet" href="style.css">
    </head>
    <body>
        <div class="container">
            <h1>${actorName}</h1>
            <div class="profile-section">
                <h2>Summary</h2>
                <p>${profile.summary}</p>
            </div>
            <div class="profile-section">
                <h2>Appearance</h2>
                <p>${profile.appearance}</p>
            </div>
            <div class="profile-section">
                <h2>Likes and Dislikes</h2>
                ${likesAndDislikesHtml()}
            </div>
            <a href="index.html" class="back-link">Back to Character List</a>
        </div>
    </body>
    </html>
  `;
  await fs.writeFile(htmlPath, template, 'utf-8');
  console.log(`Generated HTML for ${actorName} at ${htmlPath}`);
}

async function generateIndexHtml(processedCharacters) {
    const indexPath = path.join(PUBLIC_DIR, 'index.html');
    const listItems = processedCharacters.map(name => `
        <li><a href="${name}.html">${name}</a></li>`).join('');

    const template = `
    <!DOCTYPE html>
    <html lang="ko">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Character Profiles</title>
        <link rel="stylesheet" href="style.css">
    </head>
    <body>
        <div class="container">
            <h1>Generated Character Profiles</h1>
            <ul class="character-list">
                ${listItems}
            </ul>
        </div>
    </body>
    </html>
  `;
  await fs.writeFile(indexPath, template, 'utf-8');
  console.log(`Generated index.html at ${indexPath}`);
}

async function main() {
  if (!charactersToUpdate || charactersToUpdate.length === 0) {
    console.log('No characters to update. Please set CHARACTER_NAMES in your .env file.');
    return;
  }

  try {
    await fs.mkdir(PROFILES_DIR, { recursive: true });
    await fs.mkdir(PUBLIC_DIR, { recursive: true });
  } catch (error) {
    console.error('Could not create directories', error);
    return;
  }

  console.log(`Starting profile update for ${charactersToUpdate.length} character(s).`);
  db.connect();

  const processedCharacters = [];
  for (const actorName of charactersToUpdate) {
    const processedName = await processCharacter(actorName.trim());
    if (processedName) {
        processedCharacters.push(processedName);
    }
  }
  
  if(processedCharacters.length > 0) {
    await generateIndexHtml(processedCharacters);
  }

db.close();
  console.log('All characters processed. Shutting down.');
}

main();
const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const db = require('./src/db');
const { charactersToUpdate } = require('./src/config');
const { processCharacterForDiary } = require('./src/diary');
const { processCharacter } = require('./src/main');
const { generateCharacterImage } = require('./src/llm');

const app = express();
const PORT = 3001;

const PROFILES_DIR = path.join(__dirname, 'profiles');
const PUBLIC_DIR = path.join(__dirname, 'public');

// Middleware
app.use(express.json());
app.use(express.static(PUBLIC_DIR)); // Serve static files like style.css
app.use('/diaries', express.static(path.join(__dirname, 'diaries'))); // Serve diary html files

// --- Dynamic Page Rendering ---

// Home page: List all characters
app.get('/', async (req, res) => {
    try {
        // Simplified: Always link to the character page
        const listItems = charactersToUpdate.map(name => {
            return `<li><a href="/characters/${name}">${name}</a></li>`;
        }).join('');

        const template = `
            <!DOCTYPE html>
            <html lang="ko">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Character Profiles</title>
                <link rel="stylesheet" href="/style.css">
            </head>
            <body>
                <div class="container">
                    <h1>Character Profiles</h1>
                    <ul class="character-list">${listItems}</ul>
                </div>
            </body>
            </html>
        `;
        res.send(template);
    } catch (error) {
        console.error("Error creating character list:", error);
        res.status(500).send("Error loading character list.");
    }
});

// Character detail page: Rendered dynamically, handles missing profiles
app.get('/characters/:characterName', async (req, res) => {
    const { characterName } = req.params;
    const profilePath = path.join(PROFILES_DIR, `${characterName}.json`);
    let profile;
    let profileExists = false;

    try {
        // Check if profile exists and read it
        await fs.access(profilePath);
        const profileJson = await fs.readFile(profilePath, 'utf-8');
        profile = JSON.parse(profileJson);
        profileExists = true;
    } catch (error) {
        // If profile doesn't exist, create a shell profile
        if (error.code === 'ENOENT') {
            profile = {
                summary: '프로필이 아직 생성되지 않았습니다. "Update Profile" 버튼을 눌러 생성을 시작하세요.',
            };
        } else {
            // For other errors, send a generic error page
            console.error(`Error processing profile for ${characterName}:`, error);
            return res.status(500).send("Error loading profile data.");
        }
    }

    // Check for character image
    const imageName = `${characterName}.png`;
    const imagePath = `/images/characters/${imageName}`; // URL path for the browser
    const imageFilePath = path.join(PUBLIC_DIR, 'images', 'characters', imageName); // Filesystem path to check existence

    let imageExists = false;
    try {
        await fs.access(imageFilePath);
        imageExists = true;
    } catch (error) {
        // It's okay if the image doesn't exist.
    }

    const imageBlockHtml = `
        <div class="character-image-container">
            ${imageExists
                ? `<img id="character-image" src="${imagePath}?v=${new Date().getTime()}" alt="${characterName}'s image">`
                : `<div class="image-placeholder"><span>No Image</span></div>`
            }
        </div>
        <button id="regenerate-image-btn">Regenerate Image</button>
    `;


    // Helper to render the full profile, including custom fields
    const renderProfileHtml = (profile, exists) => {
        if (!exists) {
            return `<div class="profile-section"><h2>프로필</h2><p>${profile.summary}</p></div>`;
        }

        const FIELD_LABELS = {
            summary: "요약",
            interject_summary: "난입/말참견 요약",
            background: "배경",
            personality: "성격",
            appearance: "외모",
            aspirations: "목표/열망",
            relationships: "관계",
            occupation: "직업",
            skills: "기술",
            speech_style: "말투"
        };

        const formatArrayValueToHtml = (value) => {
            // Check if the array contains objects
            if (value.length > 0 && typeof value[0] === 'object' && value[0] !== null) {
                return value.map(item => {
                    let content;
                    // Specifically format 'relationships' style objects
                    if (item.name && item.status) {
                        content = `<strong>${item.name}:</strong> ${item.status}`;
                    } else {
                        // Fallback for other object structures
                        content = JSON.stringify(item);
                    }
                    return `<li>${content}</li>`;
                }).join('');
            }
            // Handle arrays of strings
            return value.map(item => `<li>${item}</li>`).join('');
        };

        let html = '';
        // Iterate over the actual keys of the profile object to include custom fields
        for (const key of Object.keys(profile)) {
            // Generate a label: use predefined label or create one from the key
            const label = FIELD_LABELS[key] || key.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
            const value = profile[key];

            html += `<div class="profile-section"><h2>${label}</h2>`;
            if (Array.isArray(value)) {
                if (value.length > 0) {
                    html += '<ul>' + formatArrayValueToHtml(value) + '</ul>';
                } else {
                    html += '<p>정보 없음</p>';
                }
            } else if (value) {
                // Replace newlines with <br> for display
                html += `<p>${String(value).replace(/\n/g, '<br>')}</p>`;
            } else {
                html += '<p>정보 없음</p>';
            }
            html += '</div>';
        }
        return html;
    };

    const profileHtml = renderProfileHtml(profile, profileExists);

    const template = `
        <!DOCTYPE html>
        <html lang="ko">
        <head>
            <meta charset="UTF-8">
            <title>${characterName} - Profile</title>
            <link rel="stylesheet" href="/style.css">
            <style>
                .character-image-container {
                    width: 100%;
                    aspect-ratio: 1 / 1;
                    border: 1px solid #ccc;
                    margin-bottom: 1rem;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background-color: #f0f0f0;
                    border-radius: 8px;
                    overflow: hidden;
                }
                .character-image-container img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }
                .image-placeholder {
                    color: #888;
                    font-size: 1.2rem;
                    text-align: center;
                }
                #regenerate-image-btn {
                    width: 100%;
                    margin-bottom: 1.5rem; /* Add more space below the button */
                }
            </style>
        </head>
        <body data-character-name='${characterName}'>
            <div class="container">
                <h1>${characterName}</h1>
                <div class="main-content">
                    <div class="profile-column">
                        ${imageBlockHtml}
                        ${profileHtml}
                    </div>
                    <div class="diary-column">
                        <h2>Actions</h2>
                        <button id="update-profile-btn">Update Profile</button>
                         <div id="profile-status"></div>
                        <button id="generate-diary-btn">Generate Today's Diary</button>
                        <div id="diary-status"></div>
                        <h2>Diary</h2>
                        <div id="diary-list"></div>
                    </div>
                </div>
                <a href="/" class="back-link">Back to Character List</a>
            </div>

            <!-- Diary Modal -->
            <div id="diary-modal" class="modal-overlay">
                <div class="modal-content">
                    <span class="modal-close">&times;</span>
                    <div id="modal-body"></div>
                </div>
            </div>

            <script src="/js/character-page.js?v=${new Date().getTime()}"></script>
        </body>
        </html>
    `;
    res.send(template);
});

// --- API Endpoints ---

app.post('/api/profiles/:characterName/update', async (req, res) => {
    const { characterName } = req.params;
    try {
        db.connect();
        await processCharacter(characterName);
        res.json({ message: `Profile update completed successfully.` });
    } catch (error) {
        console.error('Profile update failed:', error);
        res.status(500).json({ message: 'Profile update failed.' });
    } finally {
        db.close();
    }
});

app.get('/api/diaries/:characterName', async (req, res) => {
    const { characterName } = req.params;
    const diaryDir = path.join(__dirname, 'diaries', characterName);
    try {
        const files = await fs.readdir(diaryDir);
        const htmlFiles = files.filter(file => file.endsWith('.html')).reverse();
        res.json(htmlFiles);
    } catch (error) {
        if (error.code === 'ENOENT') res.json([]);
        else res.status(500).json({ message: 'Error reading diary directory.' });
    }
});

app.post('/api/diaries/:characterName/generate', async (req, res) => {
    const { characterName } = req.params;
    try {
        db.connect();
        await processCharacterForDiary(characterName);
        res.json({ message: `Diary generation completed successfully.` });
    } catch (error) {
        res.status(500).json({ message: 'Diary generation failed.' });
    } finally {
        db.close();
    }
});

app.post('/api/images/:characterName/generate', async (req, res) => {
    const { characterName } = req.params;
    const profilePath = path.join(PROFILES_DIR, `${characterName}.json`);
    const imageDir = path.join(PUBLIC_DIR, 'images', 'characters');
    const imagePath = path.join(imageDir, `${characterName}.png`);

    try {
        // 1. Read profile to create a prompt
        const profileJson = await fs.readFile(profilePath, 'utf-8');
        const profile = JSON.parse(profileJson);

        // 2. Create a simplified prompt (in English for the model) to avoid safety filters.
        const prompt = `A fantasy character portrait of ${characterName}. ` +
                       `Appearance: ${profile.appearance || 'Not specified'}.`;

        console.log(`[Image Gen] Using simplified prompt: "${prompt}"`);

        // 3. Generate image from prompt
        const base64Data = await generateCharacterImage(prompt);

        // 4. Save the image
        await fs.mkdir(imageDir, { recursive: true });
        await fs.writeFile(imagePath, base64Data, 'base64');

        console.log(`[Image Gen] Successfully saved image to ${imagePath}`);
        res.json({ message: 'Image generated successfully.', imagePath: `/images/characters/${characterName}.png` });

    } catch (error) {
        if (error.code === 'ENOENT') {
            console.error(`[Image Gen] Profile not found for ${characterName}.`);
            return res.status(404).json({ message: 'Profile not found. Please create a profile first.' });
        }
        console.error(`[Image Gen] Failed to generate image for ${characterName}:`, error);
        res.status(500).json({ message: 'Image generation failed.' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}/`);
});
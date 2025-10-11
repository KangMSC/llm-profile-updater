const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const multer = require('multer');
const db = require('./src/db');
const { charactersToUpdate } = require('./src/config');
const { processCharacterForDiary } = require('./src/diary');
const { processCharacter } = require('./src/main');
const { generateSdPrompt } = require('./src/llm');

const app = express();
const PORT = 3001;

const PROFILES_DIR = path.join(__dirname, 'profiles');
const PUBLIC_DIR = path.join(__dirname, 'public');

// Multer setup for file uploads
const storage = multer.diskStorage({
    destination: async function (req, file, cb) {
        const characterName = req.params.characterName; // Get character name from URL params
        const dest = path.join(PUBLIC_DIR, 'images', 'characters', characterName);
        await fs.mkdir(dest, { recursive: true }); // Ensure directory exists
        cb(null, dest);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now();
        const extension = path.extname(file.originalname);
        cb(null, `${uniqueSuffix}${extension}`); // Filename is just timestamp.ext
    }
});
const upload = multer({ storage: storage });


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


    // Helper function to find the first existing image path
    async function findExistingImagePath(paths) {
        for (const p of paths) {
            if (!p) continue;
            const fullPath = path.join(PUBLIC_DIR, p);
            try {
                await fs.access(fullPath);
                return p;
            } catch (error) {
                // File does not exist, continue to next
            }
        }
        return null; // No existing image found
    }

        // Determine current image and history by scanning the character's image directory
        const characterImageDir = path.join(PUBLIC_DIR, 'images', 'characters', characterName);
        let imageFiles = [];
        try {
            const files = await fs.readdir(characterImageDir);
            imageFiles = files.filter(file => /\.(png|jpe?g|gif|webp)$/i.test(file));
            // Sort by timestamp (which is the filename without extension) in descending order (newest first)
            imageFiles.sort((a, b) => parseInt(b.split('.')[0]) - parseInt(a.split('.')[0]));
        } catch (error) {
            // Directory might not exist yet, which is fine
            if (error.code !== 'ENOENT') {
                console.error(`Error reading image directory for ${characterName}:`, error);
            }
        }
    
        let currentImageToDisplay = null;
        let imageHistoryForDisplay = [];
    
        if (imageFiles.length > 0) {
            currentImageToDisplay = `/images/characters/${characterName}/${imageFiles[0]}`;
            imageHistoryForDisplay = imageFiles.slice(1).map(file => `/images/characters/${characterName}/${file}`);
        }
    
        const imageBlockHtml = `
            <div class="character-image-container">
                ${currentImageToDisplay
                    ? `<img id="character-image" src="${currentImageToDisplay}?v=${new Date().getTime()}" alt="${characterName}'s image">`
                    : ``
                }
            </div>
        `;
    
        const profileHtml = renderProfileHtml(profile, profileExists);
    const template = `
        <!DOCTYPE html>
        <html lang="ko">
        <head>
            <meta charset="UTF-8">
            <title>${characterName} - Profile</title>
            <link rel="stylesheet" href="/style.css">
            <style>
                body {
                    min-width: 1200px; /* Ensure minimum width for the 3-column layout */
                }
                .container {
                    max-width: 1600px; /* Wider container */
                    margin: 20px auto; /* Center the container */
                    padding: 20px;
                    background-color: #fff;
                    border-radius: 8px;
                    box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
                }
                .main-content-3-col {
                    display: flex;
                    gap: 20px; /* Space between columns */
                    margin-top: 20px;
                }
                .image-column {
                    flex: 0 0 300px; /* Fixed width for image column */
                    display: flex;
                    flex-direction: column;
                    gap: 15px;
                }
                .profile-column {
                    flex: 1; /* Takes remaining space */
                    min-width: 400px; /* Ensure profile column has enough space */
                }
                .diary-column {
                    flex: 0 0 350px; /* Fixed width for diary/actions column */
                    display: flex;
                    flex-direction: column;
                    gap: 15px;
                }
                .character-image-container {
                    width: 100%;
                    border: 1px solid #ccc;
                    margin-bottom: 0; /* Adjusted margin */
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background-color: #f0f0f0;
                    border-radius: 8px;
                    overflow: hidden;
                }
                .character-image-container img {
                    max-width: 100%;
                    max-height: 100%;
                    object-fit: contain;
                }
                .upload-section {
                    margin-bottom: 0; /* Adjusted margin */
                }
                .upload-section form {
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                }
                .upload-section input[type="file"] {
                    padding: 5px;
                    border: 1px solid #ccc;
                    border-radius: 4px;
                }
                .upload-section button {
                    padding: 8px 12px;
                    background-color: #4CAF50;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 1rem;
                }
                .upload-section button:hover {
                    background-color: #45a049;
                }
                #generated-prompt-area {
                    width: 100%;
                    margin-top: 0; /* Adjusted margin */
                    font-family: monospace;
                    font-size: 0.9rem;
                    padding: 8px;
                    border-radius: 4px;
                    border: 1px solid #ccc;
                    background-color: #f9f9f9;
                    resize: vertical;
                }
                .image-history-gallery {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(80px, 1fr)); /* Smaller thumbnails */
                    gap: 8px;
                    margin-top: 0; /* Adjusted margin */
                    max-height: 300px; /* Limit height for scroll */
                    overflow-y: auto;
                    padding-right: 5px; /* Space for scrollbar */
                }
                .image-history-gallery img {
                    width: 100%;
                    height: auto; /* Maintain aspect ratio */
                    object-fit: cover;
                    border-radius: 4px;
                    cursor: pointer;
                    border: 1px solid #eee;
                }
                h1, h2 {
                    color: #333;
                    border-bottom: 1px solid #eee;
                    padding-bottom: 5px;
                    margin-bottom: 15px;
                }
                .profile-section h2 {
                    font-size: 1.2rem;
                    margin-top: 1rem;
                    margin-bottom: 0.5rem;
                    border-bottom: none;
                }
                .profile-section p, .profile-section ul {
                    font-size: 0.95rem;
                    line-height: 1.5;
                    margin-bottom: 10px;
                }
                .profile-section ul {
                    padding-left: 20px;
                }
                .profile-section li {
                    margin-bottom: 5px;
                }
                .back-link {
                    display: block;
                    margin-top: 20px;
                    text-align: center;
                    color: #007bff;
                    text-decoration: none;
                }
                .back-link:hover {
                    text-decoration: underline;
                }
                button {
                    padding: 10px 15px;
                    background-color: #007bff;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 1rem;
                    margin-bottom: 10px;
                }
                button:hover {
                    background-color: #0056b3;
                }
                button:disabled {
                    background-color: #cccccc;
                    cursor: not-allowed;
                }
                #profile-status, #diary-status {
                    margin-top: -5px;
                    margin-bottom: 10px;
                    font-size: 0.9rem;
                    color: #555;
                }
                #diary-list ul {
                    list-style: none;
                    padding: 0;
                }
                #diary-list li a {
                    display: block;
                    padding: 8px;
                    background-color: #f8f8f8;
                    border: 1px solid #eee;
                    border-radius: 4px;
                    margin-bottom: 5px;
                    text-decoration: none;
                    color: #333;
                }
                #diary-list li a:hover {
                    background-color: #e9e9e9;
                }
                .modal-overlay {
                    display: none; /* Hidden by default */
                    position: fixed; /* Stay in place */
                    z-index: 1; /* Sit on top */
                    left: 0;
                    top: 0;
                    width: 100%; /* Full width */
                    height: 100%; /* Full height */
                    overflow: auto; /* Enable scroll if needed */
                    background-color: rgba(0,0,0,0.4); /* Black w/ opacity */
                    align-items: center;
                    justify-content: center;
                }
                .modal-content {
                    background-color: #fefefe;
                    margin: auto;
                    padding: 20px 0; /* Vertical padding only, horizontal padding handled by wrapper */
                    border: 1px solid #888;
                    width: 80%;
                    max-width: 800px;
                    border-radius: 8px;
                    position: relative;
                    max-height: 90vh;
                    display: flex; /* Use flexbox for internal layout */
                    flex-direction: column;
                }
                #modal-body-wrapper {
                    flex-grow: 1; /* Allow wrapper to take available space */
                    overflow-y: auto; /* Make only the content scrollable */
                    padding: 0 50px; /* Horizontal padding for text, creating space for buttons */
                }
                .modal-content .nav-button {
                    position: absolute;
                    top: 50%;
                    transform: translateY(-50%);
                    background-color: rgba(0, 0, 0, 0.5);
                    color: white;
                    border: none;
                    padding: 10px 15px;
                    cursor: pointer;
                    font-size: 1.5rem;
                    border-radius: 5px;
                    z-index: 1000; /* Ensure buttons are above content */
                }
                .modal-content .diary-prev-button {
                    left: 10px;
                }
                .modal-content .diary-next-button {
                    right: 10px;
                }
            </style>
        </head>
        <body data-character-name='${characterName}'>
            <div class="container">
                <h1>${characterName}</h1>
                <div class="main-content-3-col">
                    <div class="image-column">
                        ${imageBlockHtml}
                        <div class="upload-section">
                            <form action="/api/characters/${characterName}/upload-image" method="post" enctype="multipart/form-data">
                                <input type="file" name="profileImage" accept="image/*" required>
                                <button type="submit">Upload New Image</button>
                            </form>
                        </div>
                        <h2 style="margin-top: 1rem;">Image History</h2>
                        <div class="image-history-gallery" data-image-history='${JSON.stringify(imageHistoryForDisplay)}'>
                            ${imageHistoryForDisplay.map(imgPath => `<img src="${imgPath}" alt="Past image">`).join('')}
                        </div>
                    </div>
                    <div class="profile-column">
                        ${profileHtml}
                    </div>
                    <div class="diary-column">
                        <h2>Actions</h2>
                        <button id="update-profile-btn">Update Profile</button>
                        <div id="profile-status"></div>
                        <button id="generate-diary-btn">Generate Today's Diary</button>
                        <div id="diary-status"></div>

                        <h2 style="margin-top: 2rem;">Initial Profile Generation</h2>
                        <textarea id="initial-profile-prompt" rows="5" placeholder="Enter a brief description or keywords for the character..."></textarea>
                        <button id="generate-initial-profile-btn">Generate Initial Profile</button>
                        <div id="initial-profile-status"></div>

                        <h2 style="margin-top: 2rem;">Stable Diffusion</h2>
                        <button id="generate-prompt-btn">Generate SD Prompt</button>
                        <textarea id="generated-prompt-area" rows="6" placeholder="Generated Stable Diffusion prompt will appear here..."></textarea>

                        <h2 style="margin-top: 2rem;">Diary</h2>
                        <div id="diary-list"></div>
                    </div>
                </div>
                <a href="/" class="back-link">Back to Character List</a>
            </div>

            <!-- Diary Modal -->
            <div id="diary-modal" class="modal-overlay">
                <div class="modal-content">
                    <span class="modal-close diary-modal-close">&times;</span>
                    <button class="nav-button prev-button diary-prev-button">&lt;</button>
                    <div id="modal-body-wrapper">
                        <div id="modal-body"></div>
                    </div>
                    <button class="nav-button next-button diary-next-button">&gt;</button>
                </div>
            </div>

            <!-- Image Gallery Modal -->
            <div id="image-gallery-modal" class="modal-overlay">
                <div class="modal-content image-modal-content">
                    <span class="modal-close image-modal-close">&times;</span>
                    <button class="nav-button prev-button">&lt;</button>
                    <img id="modal-image" src="" alt="Full size image">
                    <button class="nav-button next-button">&gt;</button>
                </div>
            </div>

            <script src="/js/character-page.js?v=${new Date().getTime()}"></script>
        </body>
        </html>
    `;
    res.send(template);
});

// --- API Endpoints ---

app.post('/api/characters/:characterName/upload-image', upload.single('profileImage'), async (req, res) => {
    const { characterName } = req.params;

    if (!req.file) {
        return res.status(400).send('No file uploaded.');
    }

    try {
        // Image is already saved by multer to the correct character folder
        // No need to update JSON profile for image paths anymore
        res.redirect(`/characters/${characterName}`);
    } catch (error) {
        console.error(`Error uploading image for ${characterName}:`, error);
        res.status(500).send('Error processing image upload.');
    }
});


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

app.post('/api/profiles/:characterName/generate', async (req, res) => {
    const { characterName } = req.params;
    const { prompt } = req.body;

    if (!prompt) {
        return res.status(400).json({ message: 'Prompt is required.' });
    }

    try {
        // This function will be created in the next step
        const { generateInitialProfile } = require('./src/llm');
        const newProfile = await generateInitialProfile(characterName, prompt);

        const profilePath = path.join(PROFILES_DIR, `${characterName}.json`);
        await fs.mkdir(PROFILES_DIR, { recursive: true }); // Ensure the directory exists
        await fs.writeFile(profilePath, JSON.stringify(newProfile, null, 2));

        res.json({ message: `Initial profile for ${characterName} generated successfully.` });

    } catch (error) {
        console.error(`Failed to generate initial profile for ${characterName}:`, error);
        res.status(500).json({ message: error.message || 'Failed to generate initial profile.' });
    }
});

app.get('/api/diaries/:characterName', async (req, res) => {
    const { characterName } = req.params;
    const diaryDir = path.join(__dirname, 'diaries', characterName);
    try {
        const files = await fs.readdir(diaryDir);
        const diaryEntriesWithStats = await Promise.all(files.filter(file => file.endsWith('.html')).map(async file => {
            const filePath = path.join(diaryDir, file);
            const stats = await fs.stat(filePath);
            return { file, birthtime: stats.birthtimeMs };
        }));

        // Sort by birthtime (oldest to newest)
        diaryEntriesWithStats.sort((a, b) => a.birthtime - b.birthtime);

        res.json(diaryEntriesWithStats.map(entry => entry.file));
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



app.get('/api/prompts/:characterName/generate', async (req, res) => {
    const { characterName } = req.params;
    const profilePath = path.join(PROFILES_DIR, `${characterName}.json`);

    try {
        const profileJson = await fs.readFile(profilePath, 'utf-8');
        const prompt = await generateSdPrompt(profileJson);
        res.json({ prompt });
    } catch (error) {
        if (error.code === 'ENOENT') {
            return res.status(404).json({ message: 'Profile not found.' });
        }
        console.error(`[Prompt Gen] Failed to generate prompt for ${characterName}:`, error);
        res.status(500).json({ message: 'Prompt generation failed.' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}/`);
});

document.addEventListener('DOMContentLoaded', () => {
    const characterName = document.body.dataset.characterName;

    // Profile elements
    const updateProfileBtn = document.getElementById('update-profile-btn');
    const profileStatus = document.getElementById('profile-status');

    // Diary elements
    const diaryList = document.getElementById('diary-list');
    const generateDiaryBtn = document.getElementById('generate-diary-btn');
    const diaryStatus = document.getElementById('diary-status');
    const diaryModal = document.getElementById('diary-modal');
    const diaryModalBody = document.getElementById('modal-body');
    const diaryModalClose = document.querySelector('.diary-modal-close');
    const diaryPrevButton = document.querySelector('.diary-prev-button');
    const diaryNextButton = document.querySelector('.diary-next-button');

    let diaryEntries = []; // Stores sorted diary file names
    let currentDiaryIndex = 0;

    // Media elements
    const mediaHistoryGallery = document.querySelector('.image-history-gallery');
    const mediaGalleryModal = document.getElementById('image-gallery-modal');
    const mediaModalClose = document.querySelector('.image-modal-close');
    const modalMediaImage = document.getElementById('modal-image');
    const modalMediaVideo = document.getElementById('modal-video');
    const prevButton = mediaGalleryModal.querySelector('.prev-button');
    const nextButton = mediaGalleryModal.querySelector('.next-button');

    let mediaHistory = [];
    let currentMediaIndex = 0;

    // SD Prompt elements
    const generatePromptBtn = document.getElementById('generate-prompt-btn');
    const promptArea = document.getElementById('generated-prompt-area');

    // Initialize media history from data attribute
    if (mediaHistoryGallery && mediaHistoryGallery.dataset.mediaHistory) {
        try {
            mediaHistory = JSON.parse(mediaHistoryGallery.dataset.mediaHistory);
        } catch (e) {
            console.error("Error parsing media history data:", e);
        }
    }

    async function loadDiaries() {
        try {
            const response = await fetch('/api/diaries/' + characterName + '?t=' + new Date().getTime());
            diaryEntries = await response.json(); // Get sorted file names

            if (diaryEntries.length === 0) {
                diaryList.innerHTML = '<p>No diary entries found.</p>';
                return;
            }
            const fileLinks = diaryEntries.map((file, index) => {
                const displayName = file.replace(/_/g, ' ').replace('.html', '');
                return `<li><a href="javascript:void(0)" data-diary-index="${index}">${displayName}</a></li>`;
            }).join('');
            diaryList.innerHTML = `<ul>${fileLinks}</ul>`;
        } catch (error) {
            diaryList.innerHTML = '<p>Could not load diary entries.</p>';
        }
    }

    // --- Diary Modal Logic ---
    async function openDiaryModal(index) {
        currentDiaryIndex = index;
        const file = diaryEntries[currentDiaryIndex];
        const diaryPath = '/diaries/' + characterName + '/' + file;
        try {
            const response = await fetch(diaryPath);
            const diaryHtml = await response.text();
            diaryModalBody.innerHTML = diaryHtml;
            diaryModal.style.display = 'flex';
            updateDiaryNavButtons();
        } catch (error) {
            diaryModalBody.innerHTML = '<p>Could not load diary content.</p>';
            diaryModal.style.display = 'flex';
        }
    }

    function navigateDiary(direction) {
        currentDiaryIndex += direction;
        openDiaryModal(currentDiaryIndex);
    }

    function updateDiaryNavButtons() {
        diaryPrevButton.disabled = currentDiaryIndex === 0;
        diaryNextButton.disabled = currentDiaryIndex === diaryEntries.length - 1;
    }

    diaryList.addEventListener('click', async (e) => {
        if (e.target.tagName === 'A') {
            e.preventDefault();
            const index = parseInt(e.target.dataset.diaryIndex);
            if (!isNaN(index)) {
                openDiaryModal(index);
            }
        }
    });

    diaryModalClose.addEventListener('click', () => { diaryModal.style.display = 'none'; });
    diaryModal.addEventListener('click', (e) => { if (e.target === diaryModal) { diaryModal.style.display = 'none'; } });
    diaryPrevButton.addEventListener('click', () => navigateDiary(-1));
    diaryNextButton.addEventListener('click', () => navigateDiary(1));

    // --- Media Gallery Logic ---
    function openMediaModal(index) {
        currentMediaIndex = index;
        const mediaPath = mediaHistory[currentMediaIndex];
        const isVideo = mediaPath.toLowerCase().endsWith('.mp4');

        // Pause any playing media before switching
        modalMediaImage.src = '';
        modalMediaVideo.pause();
        modalMediaVideo.src = '';

        if (isVideo) {
            modalMediaImage.style.display = 'none';
            modalMediaVideo.style.display = 'block';
            modalMediaVideo.src = mediaPath;
            modalMediaVideo.play();
        } else {
            modalMediaVideo.style.display = 'none';
            modalMediaImage.style.display = 'block';
            modalMediaImage.src = mediaPath;
        }
        
        mediaGalleryModal.style.display = 'flex';
        updateMediaNavButtons();
    }

    function navigateMedia(direction) {
        const newIndex = currentMediaIndex + direction;
        if (newIndex >= 0 && newIndex < mediaHistory.length) {
            openMediaModal(newIndex);
        }
    }

    function updateMediaNavButtons() {
        prevButton.disabled = currentMediaIndex === 0;
        nextButton.disabled = currentMediaIndex === mediaHistory.length - 1;
    }

    mediaHistoryGallery.addEventListener('click', (e) => {
        const clickedItem = e.target.closest('img, .video-thumb');
        if (clickedItem) {
            // Find the index of the clicked item by its position in the gallery
            const allItems = Array.from(mediaHistoryGallery.children);
            const index = allItems.indexOf(clickedItem);
            if (index !== -1) {
                openMediaModal(index);
            }
        }
    });

    function closeMediaModal() {
        mediaGalleryModal.style.display = 'none';
        modalMediaVideo.pause(); // Stop video playback on close
    }

    prevButton.addEventListener('click', () => navigateMedia(-1));
    nextButton.addEventListener('click', () => navigateMedia(1));
    mediaModalClose.addEventListener('click', closeMediaModal);
    mediaGalleryModal.addEventListener('click', (e) => { 
        if (e.target === mediaGalleryModal) { 
            closeMediaModal(); 
        }
    });

    // --- Action Buttons Logic ---
    generateDiaryBtn.addEventListener('click', async () => {
        generateDiaryBtn.disabled = true;
        diaryStatus.textContent = 'Generating diary...';
        try {
            const response = await fetch('/api/diaries/' + characterName + '/generate', { method: 'POST' });
            if (!response.ok) throw new Error((await response.json()).message || 'Failed to generate diary.');
            diaryStatus.textContent = 'Diary generated successfully!';
            await loadDiaries();
        } catch (error) {
            diaryStatus.textContent = 'Error: ' + error.message;
        } finally {
            generateDiaryBtn.disabled = false;
            setTimeout(() => diaryStatus.textContent = '', 5000);
        }
    });

    updateProfileBtn.addEventListener('click', async () => {
        updateProfileBtn.disabled = true;
        profileStatus.textContent = 'Updating profile...';
        try {
            const response = await fetch('/api/profiles/' + characterName + '/update', { method: 'POST' });
            if (!response.ok) throw new Error((await response.json()).message || 'Failed to update profile.');
            profileStatus.textContent = 'Profile updated successfully! Reloading...';
            setTimeout(() => location.reload(), 2000);
        } catch (error) {
            profileStatus.textContent = 'Error: ' + error.message;
        }
    });

    const generateInitialProfileBtn = document.getElementById('generate-initial-profile-btn');
    const initialProfilePrompt = document.getElementById('initial-profile-prompt');
    const initialProfileStatus = document.getElementById('initial-profile-status');

    if (generateInitialProfileBtn) {
        generateInitialProfileBtn.addEventListener('click', async () => {
            const prompt = initialProfilePrompt.value;
            if (!prompt.trim()) {
                initialProfileStatus.textContent = 'Please enter a description for the character.';
                return;
            }

            generateInitialProfileBtn.disabled = true;
            initialProfileStatus.textContent = 'Generating initial profile...';

            try {
                const response = await fetch(`/api/profiles/${characterName}/generate`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ prompt: prompt })
                });

                if (!response.ok) {
                    const result = await response.json();
                    throw new Error(result.message || 'Failed to generate initial profile.');
                }

                initialProfileStatus.textContent = 'Profile generated successfully! Reloading...';
                setTimeout(() => location.reload(), 2000);

            } catch (error) {
                initialProfileStatus.textContent = `Error: ${error.message}`;
                generateInitialProfileBtn.disabled = false;
            }
        });
    }

    if (generatePromptBtn) {
        generatePromptBtn.addEventListener('click', async () => {
            generatePromptBtn.disabled = true;
            promptArea.value = 'Generating prompt...';
            try {
                const response = await fetch(`/api/prompts/${characterName}/generate`);
                const result = await response.json();
                if (!response.ok) {
                    throw new Error(result.message || 'Failed to generate prompt.');
                }
                promptArea.value = result.prompt;
            } catch (error) {
                promptArea.value = `Error: ${error.message}`;
            } finally {
                generatePromptBtn.disabled = false;
            }
        });
    }

    loadDiaries();
});

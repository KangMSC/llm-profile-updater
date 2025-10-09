
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
    const diaryModalClose = document.querySelector('#diary-modal .modal-close');

    // Image elements
    const imageContainer = document.querySelector('.character-image-container');
    const imageHistoryGallery = document.querySelector('.image-history-gallery');
    const imageGalleryModal = document.getElementById('image-gallery-modal');
    const imageModalClose = document.querySelector('.image-modal-close');
    const modalImage = document.getElementById('modal-image');
    const prevButton = document.querySelector('.nav-button.prev-button');
    const nextButton = document.querySelector('.nav-button.next-button');

    let imageHistory = [];
    let currentImageIndex = 0;

    // SD Prompt elements
    const generatePromptBtn = document.getElementById('generate-prompt-btn');
    const promptArea = document.getElementById('generated-prompt-area');

    // Initialize image history from data attribute
    if (imageHistoryGallery && imageHistoryGallery.dataset.imageHistory) {
        try {
            imageHistory = JSON.parse(imageHistoryGallery.dataset.imageHistory);
        } catch (e) {
            console.error("Error parsing image history data:", e);
        }
    }

    async function loadDiaries() {
        try {
            const response = await fetch('/api/diaries/' + characterName + '?t=' + new Date().getTime());
            const files = await response.json();
            if (files.length === 0) {
                diaryList.innerHTML = '<p>No diary entries found.</p>';
                return;
            }
            const fileLinks = files.map(file => {
                const displayName = file.replace(/_/g, ' ').replace('.html', '');
                const diaryPath = '/diaries/' + characterName + '/' + file;
                return `<li><a href="javascript:void(0)" data-diary-path="${diaryPath}">${displayName}</a></li>`;
            }).join('');
            diaryList.innerHTML = `<ul>${fileLinks}</ul>`;
        } catch (error) {
            diaryList.innerHTML = '<p>Could not load diary entries.</p>';
        }
    }

    // --- Diary Modal Logic ---
    diaryList.addEventListener('click', async (e) => {
        if (e.target.tagName === 'A') {
            e.preventDefault();
            const path = e.target.dataset.diaryPath;
            try {
                const response = await fetch(path);
                const diaryHtml = await response.text();
                diaryModalBody.innerHTML = diaryHtml;
                diaryModal.style.display = 'flex';
            } catch (error) {
                diaryModalBody.innerHTML = '<p>Could not load diary content.</p>';
                diaryModal.style.display = 'flex';
            }
        }
    });

    diaryModalClose.addEventListener('click', () => { diaryModal.style.display = 'none'; });
    diaryModal.addEventListener('click', (e) => { if (e.target === diaryModal) { diaryModal.style.display = 'none'; } });

    // --- Image Gallery Logic ---
    function openImageModal(index) {
        currentImageIndex = index;
        modalImage.src = imageHistory[currentImageIndex];
        imageGalleryModal.style.display = 'flex';
        updateImageNavButtons();
    }

    function navigateImage(direction) {
        currentImageIndex += direction;
        modalImage.src = imageHistory[currentImageIndex];
        updateImageNavButtons();
    }

    function updateImageNavButtons() {
        prevButton.disabled = currentImageIndex === 0;
        nextButton.disabled = currentImageIndex === imageHistory.length - 1;
    }

    imageHistoryGallery.addEventListener('click', (e) => {
        if (e.target.tagName === 'IMG') {
            const clickedSrc = e.target.src;
            // Remove the base URL to match the stored paths
            const baseUrl = window.location.origin;
            const relativeSrc = clickedSrc.replace(baseUrl, '').split('?')[0]; // Remove cache-busting param
            const index = imageHistory.indexOf(relativeSrc);
            if (index !== -1) {
                openImageModal(index);
            }
        }
    });

    prevButton.addEventListener('click', () => navigateImage(-1));
    nextButton.addEventListener('click', () => navigateImage(1));
    imageModalClose.addEventListener('click', () => imageGalleryModal.style.display = 'none');
    imageGalleryModal.addEventListener('click', (e) => { if (e.target === imageGalleryModal) { imageGalleryModal.style.display = 'none'; } });

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
        } finally {
            // Page reloads, so no need to re-enable the button
        }
    });

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

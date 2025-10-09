
document.addEventListener('DOMContentLoaded', () => {
    const characterName = document.body.dataset.characterName;

    // Profile elements
    const updateProfileBtn = document.getElementById('update-profile-btn');
    const profileStatus = document.getElementById('profile-status');

    // Diary elements
    const diaryList = document.getElementById('diary-list');
    const generateDiaryBtn = document.getElementById('generate-diary-btn');
    const diaryStatus = document.getElementById('diary-status');
    const modal = document.getElementById('diary-modal');
    const modalBody = document.getElementById('modal-body');
    const modalClose = document.querySelector('.modal-close');

    // Image elements
    const imageContainer = document.querySelector('.character-image-container');

    // SD Prompt elements
    const generatePromptBtn = document.getElementById('generate-prompt-btn');
    const promptArea = document.getElementById('generated-prompt-area');

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

    diaryList.addEventListener('click', async (e) => {
        if (e.target.tagName === 'A') {
            e.preventDefault();
            const path = e.target.dataset.diaryPath;
            try {
                const response = await fetch(path);
                const diaryHtml = await response.text();
                modalBody.innerHTML = diaryHtml;
                modal.style.display = 'flex';
            } catch (error) {
                modalBody.innerHTML = '<p>Could not load diary content.</p>';
                modal.style.display = 'flex';
            }
        }
    });

    modalClose.addEventListener('click', () => { modal.style.display = 'none'; });
    modal.addEventListener('click', (e) => { if (e.target === modal) { modal.style.display = 'none'; } });

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

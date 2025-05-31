document.addEventListener('DOMContentLoaded', () => {
    const mediaViewerContainer = document.getElementById('media-viewer-container');
    const backToGridBtn = document.getElementById('back-to-grid-btn');
    const recommendationsGrid = document.getElementById('recommendations-grid');

    let currentFilePath = null;
    let currentFileType = null;

    function clearMediaViewer() {
        mediaViewerContainer.innerHTML = ''; // Clear previous media
    }

    function clearRecommendations() {
        recommendationsGrid.innerHTML = '';
    }

    function loadMedia(filePath, fileType) {
        currentFilePath = filePath;
        currentFileType = fileType;

        clearMediaViewer();
        clearRecommendations(); // Clear old recommendations

        // Update URL without navigating, for bookmarking or refresh
        const newUrl = `media.html?filePath=${encodeURIComponent(filePath)}&fileType=${encodeURIComponent(fileType)}`;
        history.pushState({ path: newUrl }, '', newUrl);


        if (!filePath || !fileType) {
            const errorMessage = document.createElement('p');
            errorMessage.textContent = 'Media file path or type not provided.';
            mediaViewerContainer.appendChild(errorMessage);
            console.error('Media file path or type not provided for loadMedia.');
            return;
        }

        console.log(`Displaying media: ${fileType} - ${filePath}`);
        const safeFilePath = filePath.startsWith('file://') ? filePath : `file://${filePath}`;

        if (fileType === 'video') {
            const video = document.createElement('video');
            video.src = safeFilePath;
            video.controls = true;
            video.autoplay = true;
            mediaViewerContainer.appendChild(video);
        } else if (fileType === 'image') {
            const img = document.createElement('img');
            img.src = safeFilePath;
            img.alt = `Image: ${filePath}`;
            mediaViewerContainer.appendChild(img);
        } else if (fileType === 'html') {
            const iframe = document.createElement('iframe');
            iframe.src = safeFilePath;
            mediaViewerContainer.appendChild(iframe);
        } else {
            const errorMessage = document.createElement('p');
            errorMessage.textContent = `Unsupported file type: ${fileType}`;
            mediaViewerContainer.appendChild(errorMessage);
        }

        // After loading media, get recommendations
        if (window.electronAPI) {
            console.log(`Requesting recommendations for: ${filePath}`);
            window.electronAPI.send('get-recommendations', { filePath, fileType });
        }
    }

    function displayRecommendations(recommendedFiles) {
        clearRecommendations();
        if (!recommendedFiles || recommendedFiles.length === 0) {
            const noRecsMessage = document.createElement('p');
            noRecsMessage.textContent = 'No recommendations found.';
            recommendationsGrid.appendChild(noRecsMessage);
            return;
        }

        recommendedFiles.forEach(file => {
            const item = document.createElement('div');
            item.classList.add('recommended-item'); // Use new class for styling

            const img = document.createElement('img');
            if (file.thumbnailPath) {
                let thumbnailUrl = file.thumbnailPath.startsWith('file://') ? file.thumbnailPath : `file://${file.thumbnailPath}`;
                img.src = thumbnailUrl;
            } else {
                img.alt = `${file.fileType} (no thumbnail)`;
            }
            img.onerror = () => { img.alt = 'Failed to load'; };

            const filename = document.createElement('p');
            filename.textContent = file.filePath.split(/\/|\\/).pop();

            item.appendChild(img);
            item.appendChild(filename);

            item.addEventListener('click', () => {
                console.log(`Clicked recommended item: ${file.filePath}`);
                loadMedia(file.filePath, file.fileType); // Load new media and get its recommendations
            });
            recommendationsGrid.appendChild(item);
        });
    }

    // Initial Load
    const params = new URLSearchParams(window.location.search);
    const initialFilePath = params.get('filePath');
    const initialFileType = params.get('fileType');

    const loadingMessage = document.getElementById('media-loading-message');
    if (loadingMessage) loadingMessage.remove();

    if (initialFilePath && initialFileType) {
        loadMedia(initialFilePath, initialFileType);
    } else {
        clearMediaViewer();
        const errorMessage = document.createElement('p');
        errorMessage.textContent = 'Media file path or type not provided in URL.';
        mediaViewerContainer.appendChild(errorMessage);
        console.error('Initial media file path or type not provided.');
    }

    // IPC listener for recommendations
    if (window.electronAPI) {
        window.electronAPI.on('recommendations-loaded', (recommendedFiles) => {
            console.log('Received recommendations:', recommendedFiles);
            displayRecommendations(recommendedFiles);
        });
    }

    // Back button
    backToGridBtn.addEventListener('click', () => {
        window.location.href = 'index.html';
    });
});

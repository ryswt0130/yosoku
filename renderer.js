const selectDirBtn = document.getElementById('select-dir-btn');
const mediaGrid = document.getElementById('media-grid');
const statusMessage = document.getElementById('status-message');

selectDirBtn.addEventListener('click', async () => {
    mediaGrid.innerHTML = ''; // Clear existing grid
    statusMessage.textContent = 'Scanning directory...';
    try {
        const directoryPath = await window.electronAPI.invoke('dialog:openDirectory');
        if (directoryPath) {
            statusMessage.textContent = `Scanning ${directoryPath}... please wait. This might take a while for large directories.`;
            console.log(`Selected directory: ${directoryPath}`);
            window.electronAPI.send('scan-directory', directoryPath);
        } else {
            statusMessage.textContent = 'No directory selected.';
            console.log('No directory selected');
        }
    } catch (error) {
        console.error('Error selecting directory:', error);
        statusMessage.textContent = `Error: ${error.message}`;
    }
});

window.electronAPI.on('media-files-loaded', (files) => {
    console.log('Received media files:', files);
    mediaGrid.innerHTML = ''; // Clear existing grid (e.g. "Scanning..." message)

    if (!files || files.length === 0) {
        statusMessage.textContent = 'No media files found in the selected directory.';
        return;
    }

    statusMessage.textContent = `Found ${files.length} media items.`;

    files.forEach(file => {
        const item = document.createElement('div');
        item.classList.add('media-item');
        item.setAttribute('data-filepath', file.filePath); // Store full path for later use
        item.setAttribute('data-filetype', file.fileType);

        const img = document.createElement('img');
        // Use file:// protocol for local thumbnail paths.
        // Ensure thumbnailPath is not null and is properly URI encoded.
        if (file.thumbnailPath) {
            // Convert to file:/// URL. Note: on Windows, path.resolve will keep C:\
            // Forcing file:/// protocol for consistency.
            let thumbnailUrl = file.thumbnailPath.startsWith('file://') ? file.thumbnailPath : `file://${file.thumbnailPath}`;
            try {
                img.src = thumbnailUrl;
            } catch (e) {
                console.error("Error setting img.src", e, "for path", thumbnailUrl);
                img.alt = 'Error loading thumbnail'; // Fallback
            }
        } else {
            img.alt = `${file.fileType} (no thumbnail)`; // Fallback if no thumbnail
            // Optionally, add a placeholder image or icon
        }
        img.onerror = () => {
            // This might catch issues if the file path is malformed or image is corrupted
            console.error(`Error loading image: ${img.src}`);
            img.alt = 'Failed to load thumbnail';
            // You could replace img.src with a placeholder error image here
        };


        const filename = document.createElement('p');
        filename.textContent = file.filePath.split(/\/|\\/).pop(); // Show only filename

        item.appendChild(img);
        item.appendChild(filename);

        item.addEventListener('click', () => {
            console.log(`Requesting to open media: ${file.fileType} - ${file.filePath}`);
            window.electronAPI.send('open-media', { filePath: file.filePath, fileType: file.fileType });
        });

        mediaGrid.appendChild(item);
    });
});

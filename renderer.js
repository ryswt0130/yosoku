const selectDirBtn = document.getElementById('select-dir-btn');
const mediaGrid = document.getElementById('media-grid');
const statusMessage = document.getElementById('status-message');
const masterVolumeSlider = document.getElementById('master-volume');
const toggleFavoritesViewBtn = document.getElementById('toggle-favorites-view');
const toggleHistoryViewBtn = document.getElementById('toggle-history-view');

let currentAllMediaItems = []; // Store the full list of media items
let showingOnlyFavorites = false;
let showingOnlyHistory = false;

// Initialize and handle master volume
function initializeVolume() {
    const savedVolume = localStorage.getItem('masterVolume');
    let currentVolume = 0.5; // Default volume
    if (savedVolume !== null) {
        currentVolume = parseFloat(savedVolume);
    }
    masterVolumeSlider.value = currentVolume;
    // Apply this volume to any relevant audio/video elements if needed on this page (none here)
    // Send initial volume to main process if other windows might need it (optional)
    // window.electronAPI.send('master-volume-changed', currentVolume);
}

masterVolumeSlider.addEventListener('input', () => {
    const newVolume = parseFloat(masterVolumeSlider.value);
    localStorage.setItem('masterVolume', newVolume.toString());
    console.log(`Master volume changed to: ${newVolume}`);
    if (window.electronAPI) {
        window.electronAPI.send('master-volume-changed', newVolume);
    }
});

function populateMediaGrid(filesToDisplay, messagePrefix = "Found") {
    mediaGrid.innerHTML = ''; // Clear existing grid

    if (!filesToDisplay || filesToDisplay.length === 0) {
        if (showingOnlyHistory) {
            statusMessage.textContent = 'No items in history. View some media to populate history.';
        } else if (showingOnlyFavorites) {
            statusMessage.textContent = 'No favorite items found. Click "Show All" to see all media or mark some items as favorites.';
        } else if (messagePrefix === "Found" || messagePrefix === "Loaded" || messagePrefix === "Displaying") {
            statusMessage.textContent = 'No media files found. Select a directory to scan.';
        } else {
            statusMessage.textContent = 'Select a directory to view media.';
        }
        return;
    }

    let currentViewMessage = `${messagePrefix} ${filesToDisplay.length} media items.`;
    if (showingOnlyFavorites) {
        currentViewMessage += ' (Showing Favorites)';
    } else if (showingOnlyHistory) {
        currentViewMessage += ' (Showing History - Most Recent First)';
    }
    statusMessage.textContent = currentViewMessage;


    filesToDisplay.forEach(file => {
        const item = document.createElement('div');
        item.classList.add('media-item');
        item.setAttribute('data-filepath', file.filePath);
        item.setAttribute('data-filetype', file.fileType);
        // item.style.position = 'relative'; // Needed if favorite button is absolutely positioned within item

        const favButton = document.createElement('button');
        favButton.classList.add('favorite-btn');
        favButton.innerHTML = file.isFavorite ? '★' : '☆'; // Filled star if favorite, outline if not
        favButton.setAttribute('aria-label', file.isFavorite ? 'Unmark as favorite' : 'Mark as favorite');

        favButton.addEventListener('click', async (e) => {
            e.stopPropagation(); // Prevent triggering media item click
            const filePath = file.filePath; // Ensure filePath is captured correctly
            console.log(`Toggling favorite for: ${filePath}`);
            try {
                const newIsFavorite = await window.electronAPI.invoke('toggle-favorite', filePath);
                favButton.innerHTML = newIsFavorite ? '★' : '☆';
                favButton.setAttribute('aria-label', newIsFavorite ? 'Unmark as favorite' : 'Mark as favorite');

                // Update the status in the master list
                const masterListItem = currentAllMediaItems.find(item => item.filePath === filePath);
                if (masterListItem) {
                    masterListItem.isFavorite = newIsFavorite;
                }
                file.isFavorite = newIsFavorite; // Also update the item in the potentially filtered list

                console.log(`New favorite status for ${filePath}: ${newIsFavorite}`);

                // If showing only favorites and an item is un-favorited, re-render the grid
                if (showingOnlyFavorites && !newIsFavorite) {
                    renderMediaGrid();
                }
            } catch (error) {
                console.error('Error toggling favorite:', error);
            }
        });
        item.appendChild(favButton);

        const img = document.createElement('img');
        if (file.thumbnailPath) {
            let thumbnailUrl = file.thumbnailPath.startsWith('file://') ? file.thumbnailPath : `file://${file.thumbnailPath}`;
            try {
                img.src = thumbnailUrl;
            } catch (e) {
                console.error("Error setting img.src", e, "for path", thumbnailUrl);
                img.alt = 'Error loading thumbnail';
            }
        } else {
            img.alt = `${file.fileType} (no thumbnail)`;
        }
        img.onerror = () => {
            console.error(`Error loading image: ${img.src}`);
            img.alt = 'Failed to load thumbnail';
        };

        const filename = document.createElement('p');
        filename.textContent = file.filePath.split(/\/|\\/).pop();

        item.appendChild(img);
        item.appendChild(filename);

        item.addEventListener('click', () => {
            console.log(`Requesting to open media: ${file.fileType} - ${file.filePath}`);
            window.electronAPI.send('open-media', { filePath: file.filePath, fileType: file.fileType });
        });
        mediaGrid.appendChild(item);
    });
}

selectDirBtn.addEventListener('click', async () => {
    mediaGrid.innerHTML = '';
    statusMessage.textContent = 'Scanning directory...';
    try {
        const directoryPath = await window.electronAPI.invoke('dialog:openDirectory');
        if (directoryPath) {
            statusMessage.textContent = `Scanning ${directoryPath}... please wait. This might take a while for large directories.`;
            console.log(`Selected directory: ${directoryPath}`);
            window.electronAPI.send('scan-directory', directoryPath);
        } else {
            statusMessage.textContent = 'No directory selected. Previous media list (if any) retained.';
            // If a previous list was loaded, it will remain. If not, grid is empty.
            // To explicitly re-load or ensure message consistency:
            // window.electronAPI.send('get-current-media-list');
            // For now, do nothing, let existing grid (if any) persist or stay empty.
        }
    } catch (error) {
        console.error('Error selecting directory:', error);
        statusMessage.textContent = `Error: ${error.message}`;
    }
});

// Function to decide what to render based on the current filter
async function renderMediaGrid() { // Made async to handle potential await for history
    let itemsToDisplay = currentAllMediaItems; // Default to all items
    let messagePrefix = "Loaded";

    if (showingOnlyHistory) {
        if (window.electronAPI) {
            try {
                console.log('Requesting history items...');
                itemsToDisplay = await window.electronAPI.invoke('get-history-items');
                messagePrefix = "Displaying";
            } catch (error) {
                console.error('Error fetching history items:', error);
                statusMessage.textContent = 'Error loading history.';
                itemsToDisplay = []; // Show empty on error
            }
        } else {
            itemsToDisplay = []; // Should not happen if API is available
        }
    } else if (showingOnlyFavorites) {
        itemsToDisplay = currentAllMediaItems.filter(file => file.isFavorite);
        messagePrefix = "Displaying";
    }

    populateMediaGrid(itemsToDisplay, messagePrefix);
}

// Event listener for the toggle favorites view button
toggleFavoritesViewBtn.addEventListener('click', () => {
    showingOnlyFavorites = !showingOnlyFavorites;
    if (showingOnlyFavorites) {
        showingOnlyHistory = false; // Deactivate history view if activating favorites view
        toggleHistoryViewBtn.textContent = 'Show History';
    }
    toggleFavoritesViewBtn.textContent = showingOnlyFavorites ? 'Show All Media' : 'Show Favorites';
    renderMediaGrid();
});

// Event listener for the toggle history view button
toggleHistoryViewBtn.addEventListener('click', async () => {
    showingOnlyHistory = !showingOnlyHistory;
    if (showingOnlyHistory) {
        showingOnlyFavorites = false; // Deactivate favorites view if activating history view
        toggleFavoritesViewBtn.textContent = 'Show Favorites';
    }
    toggleHistoryViewBtn.textContent = showingOnlyHistory ? 'Show All Media' : 'Show History';
    await renderMediaGrid(); // Await because it might fetch history
});

// Listener for newly scanned files
window.electronAPI.on('media-files-loaded', (files) => {
    console.log('Received newly scanned media files:', files);
    currentAllMediaItems = files; // Store the full list
    renderMediaGrid(); // Render based on current filter
});

// Listener for currently stored media list on page load
window.electronAPI.on('current-media-list-loaded', (files) => {
    console.log('Received current media list from main process:', files);
    currentAllMediaItems = files; // Store the full list
    renderMediaGrid(); // Render based on current filter
});

// On DOMContentLoaded, request the current media list
document.addEventListener('DOMContentLoaded', () => {
    initializeVolume();
    toggleFavoritesViewBtn.textContent = showingOnlyFavorites ? 'Show All Media' : 'Show Favorites';
    toggleHistoryViewBtn.textContent = showingOnlyHistory ? 'Show All Media' : 'Show History';

    // Get App Name from query params and set header
    const params = new URLSearchParams(window.location.search);
    const appName = params.get('appName') || "My Media Browser"; // Fallback
    const appTitleHeader = document.getElementById('app-title-header');
    if (appTitleHeader) {
        appTitleHeader.textContent = appName;
        appTitleHeader.addEventListener('click', () => {
            // Navigate home - for index.html, this might mean resetting filters or just a simple reload
            // For simplicity, just navigate to index.html (will effectively reload with default state if no query params are preserved by this simple navigation)
            window.location.href = 'index.html';
        });
    }

    if (window.electronAPI) {
        console.log('Requesting current media list from main process...');
        window.electronAPI.send('get-current-media-list');
    }
});

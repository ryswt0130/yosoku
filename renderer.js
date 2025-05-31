const selectDirBtn = document.getElementById('select-dir-btn');
const mediaGrid = document.getElementById('media-grid');
const statusMessage = document.getElementById('status-message');
const masterVolumeSlider = document.getElementById('master-volume');
const toggleFavoritesViewBtn = document.getElementById('toggle-favorites-view');
const toggleHistoryViewBtn = document.getElementById('toggle-history-view');
const manageFoldersBtn = document.getElementById('manage-folders-btn');
const manageFoldersModal = document.getElementById('manage-folders-modal');
const modalCloseBtn = manageFoldersModal.querySelector('.modal-close-btn');
const registeredFoldersList = document.getElementById('registered-folders-list');
const modalStatusMessage = document.getElementById('modal-status-message');


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
        // Use index from forEach for a unique ID. filesToDisplay is the array being iterated.
        const uniqueImgId = `thumb-img-${filesToDisplay.indexOf(file)}-${Date.now()}`; // Add timestamp for more uniqueness if list re-renders fast
        img.id = uniqueImgId;

        if (file.thumbnailPath) {
            img.src = `file://${file.thumbnailPath}`; // Assuming thumbnailPath is already a full, valid path
            img.alt = file.filePath.split(/\/|\\/).pop();
        } else {
            img.classList.add('thumbnail-loading');
            img.alt = "Loading thumbnail...";
            // console.log(`No thumbnail for ${file.filePath}, requesting on-demand. ID: ${uniqueImgId}`);

            (async () => {
                try {
                    if (!window.electronAPI) {
                        console.error("electronAPI not found for on-demand thumbnail.");
                        throw new Error("electronAPI not available");
                    }
                    // Request thumbnail generation
                    const response = await window.electronAPI.invoke('get-thumbnail-for-file', {
                        filePath: file.filePath,
                        fileType: file.fileType,
                        imgIdForRenderer: uniqueImgId // Send the ID to main process
                    });

                    // The element might have been removed if grid re-rendered quickly
                    const imgToUpdate = document.getElementById(response.originalImgId);

                    if (imgToUpdate) {
                        imgToUpdate.classList.remove('thumbnail-loading');
                        if (response.generatedThumbnailPath) {
                            imgToUpdate.src = `file://${response.generatedThumbnailPath}`;
                            imgToUpdate.alt = file.filePath.split(/\/|\\/).pop();
                        } else {
                            imgToUpdate.classList.add('thumbnail-error');
                            imgToUpdate.alt = `Thumbnail error: ${response.error || 'Generation failed'}`;
                            console.error(`Thumbnail generation failed for ${file.filePath}:`, response.error);
                        }
                    } else {
                        // console.log(`Image element ${response.originalImgId} not found for update, likely re-rendered.`);
                    }
                } catch (error) {
                    console.error('Error requesting/processing on-demand thumbnail for', file.filePath, error);
                    const imgToUpdateStill = document.getElementById(uniqueImgId); // Try to find it by originally assigned ID
                    if (imgToUpdateStill) {
                        imgToUpdateStill.classList.remove('thumbnail-loading');
                        imgToUpdateStill.classList.add('thumbnail-error');
                        imgToUpdateStill.alt = "Error loading thumbnail";
                    }
                }
            })();
        }

        // Common onerror for successfully loaded src or if it fails after setting
        img.onerror = () => {
            if (!img.classList.contains('thumbnail-error') && !img.classList.contains('thumbnail-loading')) {
                 // Only log if it's not an error/loading state already handled
                console.error(`Error loading image src: ${img.src}`);
                img.classList.add('thumbnail-error'); // Add error class if src fails to load
                img.alt = 'Failed to load image';
            }
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
            window.location.href = 'index.html';
        });
    }

    // Modal event listeners
    if (manageFoldersBtn) { // Ensure button exists
        manageFoldersBtn.addEventListener('click', async () => {
            if (window.electronAPI) {
                try {
                    modalStatusMessage.textContent = ''; // Clear previous messages
                    const folders = await window.electronAPI.invoke('get-scanned-folders');
                    displayRegisteredFolders(folders);
                    manageFoldersModal.style.display = 'block';
                } catch (error) {
                    console.error('Error fetching scanned folders:', error);
                    modalStatusMessage.textContent = 'Error loading folder list.';
                    displayRegisteredFolders([]); // Display empty list on error
                    manageFoldersModal.style.display = 'block';
                }
            }
        });
    }

    if (modalCloseBtn) { // Ensure button exists
        modalCloseBtn.addEventListener('click', () => {
            manageFoldersModal.style.display = 'none';
        });
    }

    window.addEventListener('click', (event) => { // Click outside modal to close
        if (event.target == manageFoldersModal) {
            manageFoldersModal.style.display = 'none';
        }
    });

    if (window.electronAPI) {
        console.log('Requesting current media list from main process...');
        window.electronAPI.send('get-current-media-list');
    }
});

// Helper function to display registered folders in the modal
function displayRegisteredFolders(foldersArray) {
    registeredFoldersList.innerHTML = ''; // Clear existing list

    if (!foldersArray || foldersArray.length === 0) {
        const li = document.createElement('li');
        li.textContent = 'No folders have been added yet. Add one using the "Select Media Directory" button.';
        registeredFoldersList.appendChild(li);
        return;
    }

    foldersArray.forEach(folderPath => {
        const li = document.createElement('li');

        const pathSpan = document.createElement('span');
        pathSpan.textContent = folderPath;
        li.appendChild(pathSpan);

        const removeBtn = document.createElement('button');
        removeBtn.classList.add('remove-folder-btn');
        removeBtn.textContent = 'Remove';
        removeBtn.setAttribute('data-folderpath', folderPath);

        removeBtn.addEventListener('click', async (e) => {
            const pathToRemove = e.target.getAttribute('data-folderpath');
            if (!pathToRemove) return;

            removeBtn.disabled = true;
            removeBtn.textContent = 'Removing...';
            modalStatusMessage.textContent = `Attempting to remove folder: ${pathToRemove}...`;

            try {
                const response = await window.electronAPI.invoke('remove-scanned-folder', pathToRemove);
                if (response.success) {
                    modalStatusMessage.textContent = `Folder "${pathToRemove}" removed. Library updating...`;
                    displayRegisteredFolders(response.updatedFolders); // Update the modal list

                    currentAllMediaItems = response.updatedMedia; // Update the master list
                    await renderMediaGrid(); // Refresh the main grid view, applying current filters

                    // Clear message after a delay
                    setTimeout(() => {
                        if (modalStatusMessage.textContent === `Folder "${pathToRemove}" removed. Library updating...`) {
                            modalStatusMessage.textContent = '';
                        }
                    }, 3000);
                } else {
                    modalStatusMessage.textContent = `Error removing folder: ${response.message || 'Unknown error'}`;
                    removeBtn.disabled = false;
                    removeBtn.textContent = 'Remove';
                }
            } catch (error) {
                console.error('Error invoking remove-scanned-folder:', error);
                modalStatusMessage.textContent = `Error: ${error.message || 'Failed to communicate with main process.'}`;
                removeBtn.disabled = false;
                removeBtn.textContent = 'Remove';
            }
        });

        li.appendChild(removeBtn);
        registeredFoldersList.appendChild(li);
    });

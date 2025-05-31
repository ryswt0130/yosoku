const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const url = require('url');
const appPackage = require('./package.json');
const { scanDirectory } = require('./fileScanner');
const { generateThumbnail, THUMBNAILS_DIR, generateExpectedThumbnailFilename } = require('./thumbnailGenerator'); // Import new items

const APP_NAME = appPackage.productName || "My Media Browser";
const HISTORY_LIMIT = 100; // Max number of history items to store
let allScannedMediaFiles = []; // To store all scanned media files with their details

let favoritesFilePath;
let historyFilePath;
let scannedFoldersPath;

function ensureUserDataDirExists() {
    const userDataPath = app.getPath('userData');
    if (!fs.existsSync(userDataPath)) {
        fs.mkdirSync(userDataPath, { recursive: true });
        console.log(`Created userData directory: ${userDataPath}`);
    }
    return userDataPath;
}

function ensureFavoritesFileInitialized() {
    if (!favoritesFilePath) {
        const userDataPath = ensureUserDataDirExists();
        favoritesFilePath = path.join(userDataPath, 'favorites.json');
        console.log(`Favorites file path initialized to: ${favoritesFilePath}`);
    }
}

function ensureHistoryFileInitialized() {
    if (!historyFilePath) {
        const userDataPath = ensureUserDataDirExists();
        historyFilePath = path.join(userDataPath, 'history.json');
        console.log(`History file path initialized to: ${historyFilePath}`);
    }
}

function ensureScannedFoldersFileInitialized() {
    if (!scannedFoldersPath) {
        const userDataPath = ensureUserDataDirExists();
        scannedFoldersPath = path.join(userDataPath, 'scannedFolders.json');
        console.log(`Scanned folders file path initialized to: ${scannedFoldersPath}`);
    }
}

// Scanned Folders helper functions
function getScannedFolders() {
    ensureScannedFoldersFileInitialized();
    try {
        if (fs.existsSync(scannedFoldersPath)) {
            const fileContent = fs.readFileSync(scannedFoldersPath, 'utf8');
            if (fileContent) {
                return JSON.parse(fileContent);
            }
        }
    } catch (error) {
        console.error('Error reading or parsing scannedFolders.json:', error);
    }
    return [];
}

function saveScannedFolders(foldersArray) {
    ensureScannedFoldersFileInitialized();
    try {
        const jsonData = JSON.stringify(foldersArray, null, 2);
        fs.writeFileSync(scannedFoldersPath, jsonData, 'utf8');
    } catch (error) {
        console.error('Error writing scannedFolders.json:', error);
    }
}

// Favorites helper functions (using JSON file)
function getFavorites() {
    ensureFavoritesFileInitialized();
    try {
        if (fs.existsSync(favoritesFilePath)) {
            const fileContent = fs.readFileSync(favoritesFilePath, 'utf8');
            if (fileContent) {
                return JSON.parse(fileContent);
            }
        }
    } catch (error) {
        console.error('Error reading or parsing favorites.json:', error);
    }
    return []; // Default to empty array if file doesn't exist, is empty, or parsing fails
}

function saveFavorites(favoritesArray) {
    ensureFavoritesFileInitialized();
    try {
        const jsonData = JSON.stringify(favoritesArray, null, 2);
        fs.writeFileSync(favoritesFilePath, jsonData, 'utf8');
    } catch (error) {
        console.error('Error writing favorites.json:', error);
    }
}

function addFavorite(filePath) {
    const favorites = getFavorites();
    if (!favorites.includes(filePath)) {
        favorites.push(filePath);
        saveFavorites(favorites);
        console.log(`Added to favorites (JSON): ${filePath}`);
    }
}

function removeFavorite(filePath) {
    let favorites = getFavorites();
    if (favorites.includes(filePath)) {
        favorites = favorites.filter(fav => fav !== filePath);
        saveFavorites(favorites);
        console.log(`Removed from favorites (JSON): ${filePath}`);
    }
}

function isFavorite(filePath) {
    const favorites = getFavorites();
    return favorites.includes(filePath);
}

// History helper functions (using JSON file)
function getHistory() {
    ensureHistoryFileInitialized();
    try {
        if (fs.existsSync(historyFilePath)) {
            const fileContent = fs.readFileSync(historyFilePath, 'utf8');
            if (fileContent) {
                return JSON.parse(fileContent);
            }
        }
    } catch (error) {
        console.error('Error reading or parsing history.json:', error);
    }
    return [];
}

function saveHistory(historyArray) {
    ensureHistoryFileInitialized();
    try {
        const jsonData = JSON.stringify(historyArray, null, 2);
        fs.writeFileSync(historyFilePath, jsonData, 'utf8');
    } catch (error) {
        console.error('Error writing history.json:', error);
    }
}

function addHistoryItem(filePath, fileType) {
    let history = getHistory();
    // Remove existing entry for this filePath to move it to the top
    history = history.filter(item => item.filePath !== filePath);

    // Add new item to the beginning
    history.unshift({
        filePath: filePath,
        fileType: fileType,
        lastViewed: new Date().toISOString() // Store timestamp in ISO format
    });

    // Enforce history limit (ensure HISTORY_LIMIT is defined, it is from previous step)
    if (history.length > HISTORY_LIMIT) {
        history = history.slice(0, HISTORY_LIMIT);
    }

    saveHistory(history);
    console.log(`Added to history (JSON): ${filePath}, new history length: ${history.length}`);
}


function createWindow () {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  // Pass APP_NAME as a query parameter to index.html
  const indexPath = path.join(__dirname, 'index.html');
  const indexUrl = url.format({
      pathname: indexPath,
      protocol: 'file:',
      slashes: true,
      query: { appName: APP_NAME }
  });
  win.loadURL(indexUrl);
  // win.webContents.openDevTools();
}

app.whenReady().then(() => {
  createWindow();

  // Handle app-command for mouse back/forward buttons (primarily Windows)
  app.on('app-command', (e, cmd) => {
    const focusedWindow = BrowserWindow.getFocusedWindow();
    if (focusedWindow) {
      if (cmd === 'browser-backward') {
        if (focusedWindow.webContents.canGoBack()) {
          console.log('Navigating back via app-command');
          focusedWindow.webContents.goBack();
        }
      } else if (cmd === 'browser-forward') {
        if (focusedWindow.webContents.canGoForward()) {
          console.log('Navigating forward via app-command');
          focusedWindow.webContents.goForward();
        }
      }
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Handle directory selection dialog
ipcMain.handle('dialog:openDirectory', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openDirectory']
  });
  if (canceled) {
    return null;
  } else {
    return filePaths[0];
  }
});

// New core function to load all media
async function loadAllMediaFromRegisteredFolders() {
    const foldersToScan = getScannedFolders();
    if (foldersToScan.length === 0) {
        console.log('No folders registered for scanning.');
        allScannedMediaFiles = [];
        return [];
    }

    console.log('Loading media from registered folders:', foldersToScan);
    let consolidatedMediaFiles = [];
    const uniqueFilePaths = new Set();

    for (const folderPath of foldersToScan) {
        console.log(`Scanning directory: ${folderPath}`);
        const filesInFolder = scanDirectory(folderPath); // This is synchronous
        console.log(`Found ${filesInFolder.length} media files in ${folderPath}.`);

        for (const file of filesInFolder) {
            if (!uniqueFilePaths.has(file.filePath)) {
                uniqueFilePaths.add(file.filePath);
                consolidatedMediaFiles.push(file);
            }
        }
    }

    console.log(`Total unique media files found: ${consolidatedMediaFiles.length}`);

    // Process files to check for existing thumbnails and add favorite status
    const processedFiles = consolidatedMediaFiles.map(file => {
        const expectedFilename = generateExpectedThumbnailFilename(file.filePath);
        const expectedThumbnailPath = path.join(THUMBNAILS_DIR, expectedFilename);
        let thumbnailPath = null;

        if (fs.existsSync(expectedThumbnailPath)) {
            thumbnailPath = expectedThumbnailPath;
        } else {
            // console.log(`Thumbnail not found for ${file.filePath}, will need on-demand generation.`);
        }

        return {
            ...file,
            thumbnailPath: thumbnailPath, // Path if exists, null otherwise
            isFavorite: isFavorite(file.filePath)
        };
    });

    allScannedMediaFiles = processedFiles;
    console.log(`Updated allScannedMediaFiles with ${allScannedMediaFiles.length} items. On-demand thumbnail generation will be used if path is null.`);
    return allScannedMediaFiles; // Return the list with thumbnailPath set to existing or null
}


// Handle scan directory request (now "add and rescan all")
ipcMain.on('scan-directory', async (event, directoryPath) => {
  if (directoryPath) { // A new directory was selected to be added
    const currentFolders = getScannedFolders();
    if (!currentFolders.includes(directoryPath)) {
        currentFolders.push(directoryPath);
        saveScannedFolders(currentFolders);
        console.log(`Added new scan directory: ${directoryPath}. Current folders:`, currentFolders);
    } else {
        console.log(`Directory already in scan list: ${directoryPath}`);
    }
  }
  // Always reload all media from all registered folders
  const loadedFiles = await loadAllMediaFromRegisteredFolders();
  event.sender.send('media-files-loaded', loadedFiles);
});

// Handle request to open a specific media file
ipcMain.on('open-media', (event, { filePath, fileType }) => { // isFavorite status will be determined by mediaRenderer
  const win = BrowserWindow.getFocusedWindow();
  if (win) {
    win.loadFile(path.join(__dirname, 'media.html'), {
      query: {
        filePath: filePath,
        fileType: fileType,
        isFavorite: isFavorite(filePath), // Pass favorite status directly
        appName: APP_NAME // Pass app name
      }
    });
  }
});

// Handle request for recommendations
ipcMain.on('get-recommendations', (event, { filePath: currentFilePath, fileType: currentFileType }) => {
  if (!allScannedMediaFiles || allScannedMediaFiles.length === 0) {
    event.sender.send('recommendations-loaded', []);
    return;
  }

  const currentFileDir = path.dirname(currentFilePath);

  let recommendations = allScannedMediaFiles.filter(file => {
    // Exclude the current file itself
    if (file.filePath === currentFilePath) return false;

    // Prioritize files in the same directory
    return path.dirname(file.filePath) === currentFileDir;
  });

  // If not enough from the same directory, you could add other strategies here.
  // For now, we'll just limit the same-directory results.

  const MAX_RECOMMENDATIONS = 5;
  recommendations = recommendations.slice(0, MAX_RECOMMENDATIONS);

  console.log(`Sending ${recommendations.length} recommendations for ${currentFilePath}`);
  event.sender.send('recommendations-loaded', recommendations);
});

// Handle request for the current media list (e.g., on startup or returning to index.html)
ipcMain.on('get-current-media-list', async (event) => {
    if (!allScannedMediaFiles || allScannedMediaFiles.length === 0) {
        // If allScannedMediaFiles is empty (e.g. first app start), load them from persisted folders
        console.log('allScannedMediaFiles is empty, attempting to load from registered folders for get-current-media-list.');
        await loadAllMediaFromRegisteredFolders();
        // loadAllMediaFromRegisteredFolders updates allScannedMediaFiles internally
    } else {
        // If list exists, just ensure favorite statuses are up-to-date before sending
        console.log('Refreshing favorite status for current media list.');
        allScannedMediaFiles = allScannedMediaFiles.map(file => ({
            ...file,
            isFavorite: isFavorite(file.filePath)
        }));
    }
    console.log(`Sending current media list of ${allScannedMediaFiles.length} items to renderer.`);
    event.sender.send('current-media-list-loaded', allScannedMediaFiles);
});

// IPC handler for removing a scanned folder
ipcMain.handle('remove-scanned-folder', async (event, folderPathToRemove) => {
    console.log(`Request to remove scanned folder: ${folderPathToRemove}`);
    let currentFolders = getScannedFolders();
    const initialLength = currentFolders.length;
    currentFolders = currentFolders.filter(folder => folder !== folderPathToRemove);

    if (currentFolders.length < initialLength) {
        saveScannedFolders(currentFolders);
        console.log(`Removed ${folderPathToRemove}. Updated folders:`, currentFolders);
        // After removing, reload all media from the remaining registered folders
        // This will also update allScannedMediaFiles and send 'media-files-loaded'
        const loadedFiles = await loadAllMediaFromRegisteredFolders();
        // Send an event to indicate success or the new list.
        // The renderer might expect 'media-files-loaded' or a direct response.
        // For now, the main purpose is to update the backend list and trigger a rescan.
        // The UI part (next subtask) will handle refreshing the view.
        return { success: true, newFolderList: currentFolders, newMediaList: loadedFiles };
    }
    return { success: false, message: "Folder not found in list." };
});

// IPC handler for toggling favorite
ipcMain.handle('toggle-favorite', async (event, filePath) => {
  if (isFavorite(filePath)) {
    removeFavorite(filePath);
    return false; // New status: not favorite
  } else {
    addFavorite(filePath);
    return true; // New status: favorite
  }
});

// IPC handler for adding to history
ipcMain.on('add-to-history', (event, { filePath, fileType }) => {
    if (filePath && fileType) {
        addHistoryItem(filePath, fileType);
    } else {
        console.warn('Attempted to add to history with invalid filePath or fileType.');
    }
});

// IPC handler for getting the list of scanned folders
ipcMain.handle('get-scanned-folders', async () => {
    return getScannedFolders();
});

// IPC handler for getting history items
ipcMain.handle('get-history-items', async () => {
    const rawHistory = getHistory(); // Gets { filePath, fileType, lastViewed }
    if (!allScannedMediaFiles || allScannedMediaFiles.length === 0) {
        // If we don't have the main media list, we can't easily get thumbnails.
        // Send raw history, renderer can display placeholders or just file paths.
        console.warn('get-history-items: allScannedMediaFiles is empty. History items may lack thumbnails.');
        return rawHistory.map(item => ({ ...item, thumbnailPath: null, isFavorite: isFavorite(item.filePath) }));
    }

    const augmentedHistory = rawHistory.map(historyItem => {
        const scannedFile = allScannedMediaFiles.find(sf => sf.filePath === historyItem.filePath);
        return {
            ...historyItem,
            thumbnailPath: scannedFile ? scannedFile.thumbnailPath : null,
            // isFavorite status is already part of allScannedMediaFiles, but ensure it's current
            isFavorite: scannedFile ? isFavorite(historyItem.filePath) : isFavorite(historyItem.filePath)
        };
    });
    console.log(`Returning ${augmentedHistory.length} augmented history items.`);
    return augmentedHistory;
});


// Handle master volume changes
ipcMain.on('master-volume-changed', (event, newVolume) => {
  console.log(`Master volume changed to ${newVolume}, broadcasting to all windows.`);
  // Broadcast to all windows
  BrowserWindow.getAllWindows().forEach(win => {
    // Optionally, you could check if the window is media.html or if it's not the sender
    // if (win.webContents !== event.sender) { // Avoid sending back to the source if not needed
    // }
    win.webContents.send('apply-master-volume', newVolume);
  });
});

// IPC handler for on-demand thumbnail generation
ipcMain.handle('get-thumbnail-for-file', async (event, { filePath, fileType, imgIdForRenderer }) => {
    if (!filePath || !fileType || !imgIdForRenderer) {
        console.error('Invalid parameters for get-thumbnail-for-file:', { filePath, fileType, imgIdForRenderer });
        return { originalImgId: imgIdForRenderer, generatedThumbnailPath: null, error: 'Invalid parameters' };
    }
    try {
        console.log(`On-demand thumbnail request for: ${filePath} (imgId: ${imgIdForRenderer})`);
        // generateThumbnail will check if thumbnail already exists.
        // If it exists, it returns the path. If not, it generates, saves, and returns the path.
        const thumbnailPath = await generateThumbnail(filePath, fileType);

        // Update allScannedMediaFiles with the new thumbnail path if generation was successful
        // This ensures that if the list is requested again, it has the path.
        if (thumbnailPath) {
            const fileIndex = allScannedMediaFiles.findIndex(file => file.filePath === filePath);
            if (fileIndex !== -1) {
                allScannedMediaFiles[fileIndex].thumbnailPath = thumbnailPath;
                // console.log(`Updated thumbnailPath for ${filePath} in allScannedMediaFiles.`);
            }
        }
        return { originalImgId: imgIdForRenderer, generatedThumbnailPath: thumbnailPath, error: null };
    } catch (error) {
        console.error(`Error generating thumbnail on-demand for ${filePath}: ${error.message}`);
        return { originalImgId: imgIdForRenderer, generatedThumbnailPath: null, error: error.message || 'Unknown error during generation' };
    }
});

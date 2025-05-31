const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const url = require('url'); // Needed for formatting URL with query
const appPackage = require('./package.json');
// const Store = require('electron-store'); // Was removed
const { scanDirectory } = require('./fileScanner');
const { generateThumbnail } = require('./thumbnailGenerator');

const APP_NAME = appPackage.productName || "My Media Browser";
// const store = new Store(); // Was removed
const HISTORY_LIMIT = 100; // Max number of history items to store
let allScannedMediaFiles = []; // To store all scanned media files with their details

let favoritesFilePath;
let historyFilePath;

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

// Handle scan directory request
ipcMain.on('scan-directory', async (event, directoryPath) => {
  if (!directoryPath) {
    event.reply('media-files-loaded', []); // Send empty if no path
    return;
  }

  console.log(`Scanning directory: ${directoryPath}`);
  const files = scanDirectory(directoryPath);
  console.log(`Found ${files.length} media files.`);

  const filesWithThumbnails = [];
  for (const file of files) {
    try {
      console.log(`Generating thumbnail for ${file.filePath} (${file.fileType})`);
      const thumbnailPath = await generateThumbnail(file.filePath, file.fileType);
      if (thumbnailPath) {
        filesWithThumbnails.push({ ...file, thumbnailPath });
      } else {
        filesWithThumbnails.push({ ...file, thumbnailPath: null }); // Explicitly set null if no thumbnail
        console.log(`No thumbnail generated for ${file.filePath}`);
      }
    } catch (error) {
      console.error(`Error during thumbnail generation for ${file.filePath}:`, error);
      filesWithThumbnails.push({ ...file, thumbnailPath: null });
    }
  }
  console.log(`Sending ${filesWithThumbnails.length} files with thumbnail info to renderer.`);
  // Augment files with favorite status before sending
  const filesWithFavoriteStatus = filesWithThumbnails.map(file => ({
    ...file,
    isFavorite: isFavorite(file.filePath)
  }));
  allScannedMediaFiles = filesWithFavoriteStatus; // Store the full list with favorite status
  event.sender.send('media-files-loaded', filesWithFavoriteStatus);
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

// Handle request for the current media list
ipcMain.on('get-current-media-list', (event) => {
  if (allScannedMediaFiles && allScannedMediaFiles.length > 0) {
    // Ensure this list also has up-to-date favorite status if it can change elsewhere
     const currentFilesWithFavoriteStatus = allScannedMediaFiles.map(file => ({
      ...file,
      isFavorite: isFavorite(file.filePath) // Re-check favorite status
    }));
    console.log(`Sending current media list of ${currentFilesWithFavoriteStatus.length} items to renderer.`);
    event.sender.send('current-media-list-loaded', currentFilesWithFavoriteStatus);
  } else {
    console.log('No current media list to send, sending empty array.');
    event.sender.send('current-media-list-loaded', []);
  }
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

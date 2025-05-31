const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { scanDirectory } = require('./fileScanner');
const { generateThumbnail } = require('./thumbnailGenerator');

let allScannedMediaFiles = []; // To store all scanned media files with their details

function createWindow () {
  const win = new BrowserWindow({
    width: 1200, // Increased width for better display
    height: 800, // Increased height
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false // Recommended for security
    }
  })

  win.loadFile('index.html')
  // Open DevTools automatically - useful for development
  // win.webContents.openDevTools();
}

app.whenReady().then(createWindow);

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
  allScannedMediaFiles = filesWithThumbnails; // Store the full list
  event.sender.send('media-files-loaded', filesWithThumbnails);
});

// Handle request to open a specific media file
ipcMain.on('open-media', (event, { filePath, fileType }) => {
  const win = BrowserWindow.getFocusedWindow();
  if (win) {
    // Use loadFile with query parameters. The renderer (mediaRenderer.js) will pick these up.
    win.loadFile(path.join(__dirname, 'media.html'), {
      query: { filePath: filePath, fileType: fileType }
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

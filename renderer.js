const { ipcRenderer } = require('electron');

const selectFileButton = document.getElementById('select-file-button');
const fileDisplayArea = document.getElementById('file-display-area');

if (selectFileButton) {
  selectFileButton.addEventListener('click', () => {
    console.log('Select File button clicked'); // Debug log
    ipcRenderer.send('open-file-dialog');
  });
} else {
  console.error('Select File button not found'); // Debug log
}

ipcRenderer.on('selected-file', (event, filePath) => {
  fileDisplayArea.innerHTML = ''; // Clear previous content

  const extension = filePath.split('.').pop().toLowerCase();

  if (['mp4', 'webm', 'ogv'].includes(extension)) {
    const video = document.createElement('video');
    video.src = filePath;
    video.controls = true;
    video.width = 600; // Or use CSS
    fileDisplayArea.appendChild(video);
  } else if (['jpg', 'jpeg', 'png', 'gif'].includes(extension)) {
    const img = document.createElement('img');
    img.src = filePath;
    img.alt = 'Selected File';
    img.style.maxWidth = '100%'; // Basic styling
    img.style.maxHeight = '600px'; // Basic styling
    fileDisplayArea.appendChild(img);
  } else if (['html', 'htm'].includes(extension)) {
    const iframe = document.createElement('iframe');
    iframe.src = filePath;
    iframe.width = '100%';
    iframe.height = '600px';
    iframe.frameBorder = '0';
    fileDisplayArea.appendChild(iframe);
  } else {
    fileDisplayArea.innerText = `Unsupported file type: ${filePath}`;
  }
});

// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// All of the Node.js APIs are available in this process.
console.log('Hello from renderer.js');

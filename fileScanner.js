const fs = require('fs');
const path = require('path');

const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.avi', '.mkv', '.webm'];
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
const HTML_EXTENSIONS = ['.html', '.htm'];

function scanDirectory(directoryPath) {
    const mediaFiles = [];

    if (!fs.existsSync(directoryPath) || !fs.lstatSync(directoryPath).isDirectory()) {
        console.error(`Error: Directory not found or is not a directory: ${directoryPath}`);
        return []; // Return empty array or throw error as preferred
    }

    try {
        const files = fs.readdirSync(directoryPath);

        for (const file of files) {
            const filePath = path.join(directoryPath, file);
            const stat = fs.lstatSync(filePath);

            if (stat.isDirectory()) {
                mediaFiles.push(...scanDirectory(filePath)); // Recursively scan subdirectories
            } else if (stat.isFile()) {
                const ext = path.extname(file).toLowerCase();
                let fileType = null;

                if (VIDEO_EXTENSIONS.includes(ext)) {
                    fileType = 'video';
                } else if (IMAGE_EXTENSIONS.includes(ext)) {
                    fileType = 'image';
                } else if (HTML_EXTENSIONS.includes(ext)) {
                    fileType = 'html';
                }

                if (fileType) {
                    mediaFiles.push({ filePath, fileType });
                }
            }
        }
    } catch (error) {
        console.error(`Error reading directory ${directoryPath}: ${error.message}`);
        // Optionally, re-throw the error or handle it as needed
    }

    return mediaFiles;
}

module.exports = { scanDirectory };

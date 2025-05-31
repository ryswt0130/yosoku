const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const ffmpeg = require('fluent-ffmpeg');

// Ensure the thumbnails directory exists
const THUMBNAILS_DIR = path.join(__dirname, 'thumbnails');
if (!fs.existsSync(THUMBNAILS_DIR)) {
    fs.mkdirSync(THUMBNAILS_DIR, { recursive: true });
}

const THUMBNAIL_WIDTH = 200;
const THUMBNAIL_HEIGHT = 150;

async function generateThumbnail(filePath, fileType) {
    const fileName = path.basename(filePath);
    const thumbnailFileName = `${path.parse(fileName).name}.png`; // Always save as png for consistency
    const outputPath = path.join(THUMBNAILS_DIR, thumbnailFileName);

    // Check if thumbnail already exists
    if (fs.existsSync(outputPath)) {
        // console.log(`Thumbnail already exists for ${filePath} at ${outputPath}`);
        return outputPath;
    }

    try {
        if (fileType === 'image') {
            await sharp(filePath)
                .resize(THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT, {
                    fit: sharp.fit.inside, // Preserves aspect ratio, fitting within dimensions
                    withoutEnlargement: true // Don't enlarge if image is smaller than thumbnail size
                })
                .toFile(outputPath);
            // console.log(`Generated image thumbnail for ${filePath} at ${outputPath}`);
            return outputPath;
        } else if (fileType === 'video') {
            return new Promise((resolve, reject) => {
                ffmpeg(filePath)
                    .on('end', () => {
                        // console.log(`Generated video thumbnail for ${filePath} at ${outputPath}`);
                        resolve(outputPath);
                    })
                    .on('error', (err) => {
                        console.error(`Error generating video thumbnail for ${filePath}: ${err.message}`);
                        reject(err);
                    })
                    .screenshots({
                        timestamps: ['1'], // Capture frame at 1 second
                        filename: thumbnailFileName,
                        folder: THUMBNAILS_DIR,
                        size: `${THUMBNAIL_WIDTH}x${THUMBNAIL_HEIGHT}`, // Aspect ratio might be an issue, ffmpeg might pad
                    });
            });
        } else {
            // console.warn(`Unsupported file type for thumbnail generation: ${fileType} for file ${filePath}`);
            return null; // Or throw an error
        }
    } catch (error) {
        console.error(`Failed to generate thumbnail for ${filePath}: ${error.message}`);
        // Depending on the error, you might want to delete a partially created file if any
        if (fs.existsSync(outputPath)) {
            fs.unlinkSync(outputPath);
        }
        return null; // Or re-throw
    }
}

module.exports = { generateThumbnail, THUMBNAILS_DIR };

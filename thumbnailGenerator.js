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
            // For images with sharp:
            return new Promise((resolve, reject) => {
                sharp(filePath)
                    .resize(THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT, {
                        fit: 'contain', // Preserves aspect ratio, letterboxing if needed
                        background: { r: 0, g: 0, b: 0, alpha: 1 }, // Black background
                        withoutEnlargement: true
                    })
                    .toFile(outputPath, (err_sharp) => {
                        if (err_sharp) {
                            console.error(`Error generating image thumbnail for ${filePath} with sharp: ${err_sharp.message}`);
                            // Attempt to delete potentially incomplete thumbnail file
                            if (fs.existsSync(outputPath)) {
                                try { fs.unlinkSync(outputPath); } catch (e) { console.error(`Failed to delete incomplete thumbnail ${outputPath}`, e); }
                            }
                            reject(err_sharp);
                        } else {
                            // console.log(`Generated image thumbnail for ${filePath} at ${outputPath}`);
                            resolve(outputPath);
                        }
                    });
            });
        } else if (fileType === 'video') {
            // For videos with fluent-ffmpeg:
            return new Promise((resolve, reject) => {
                ffmpeg.ffprobe(filePath, (err_probe, metadata) => {
                    let seekInputOption = '1'; // Default to 1 second

                    if (err_probe) {
                        console.error(`Error probing video ${filePath}: ${err_probe.message}. Falling back to default seek time.`);
                    } else if (metadata && metadata.format && metadata.format.duration) {
                        const duration = parseFloat(metadata.format.duration);
                        if (!isNaN(duration) && duration > 0) {
                            seekInputOption = (duration / 2).toString();
                            console.log(`Video duration for ${filePath}: ${duration}s, taking thumbnail at ${seekInputOption}s.`);
                        } else {
                            console.warn(`Invalid duration for ${filePath}: ${metadata.format.duration}. Falling back to default seek time.`);
                        }
                    } else {
                        console.warn(`Could not get duration for ${filePath}. Falling back to default seek time.`);
                    }

                    const filterString = `scale=w=${THUMBNAIL_WIDTH}:h=${THUMBNAIL_HEIGHT}:force_original_aspect_ratio=decrease,pad=w=${THUMBNAIL_WIDTH}:h=${THUMBNAIL_HEIGHT}:x=(ow-iw)/2:y=(oh-ih)/2:color=black`;

                    ffmpeg(filePath)
                        .setStartTime(seekInputOption) // Seek to the chosen timestamp
                        .frames(1) // Extract a single frame
                        .videoFilter(filterString) // Apply scaling and padding
                        // .size(`${THUMBNAIL_WIDTH}x${THUMBNAIL_HEIGHT}`) // Output canvas size, should be handled by pad
                        .output(outputPath) // Specify full output path (was thumbnailFileName before, now full outputPath)
                        .on('end', () => {
                            console.log(`Generated video thumbnail for ${filePath} at ${seekInputOption}s, saved to ${outputPath}`);
                            resolve(outputPath);
                        })
                        .on('error', (err_ffmpeg) => {
                            console.error(`Error generating video thumbnail for ${filePath}: ${err_ffmpeg.message}`);
                            if (fs.existsSync(outputPath)) {
                                try { fs.unlinkSync(outputPath); } catch (e) { console.error(`Failed to delete incomplete thumbnail ${outputPath}`, e); }
                            }
                            reject(err_ffmpeg);
                        })
                        .run();
                });
            });
        } else {
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

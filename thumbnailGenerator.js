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
        return { generatedThumbnailPath: outputPath, error: null, details: null }; // Return object
    }

    try {
        if (fileType === 'image') {
            return new Promise((resolve) => { // Always resolve
                sharp(filePath)
                    .resize(THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT, {
                        fit: 'contain',
                        background: { r: 0, g: 0, b: 0, alpha: 1 },
                        withoutEnlargement: true
                    })
                    .toFile(outputPath, (err_sharp) => {
                        if (err_sharp) {
                            console.error(`Error generating image thumbnail for ${filePath} with sharp: ${err_sharp.message}`);
                            if (fs.existsSync(outputPath)) {
                                try { fs.unlinkSync(outputPath); } catch (e) { console.error(`Failed to delete incomplete thumbnail ${outputPath}`, e); }
                            }
                            resolve({ generatedThumbnailPath: null, error: 'image_processing_error', details: err_sharp.message });
                        } else {
                            resolve({ generatedThumbnailPath: outputPath, error: null, details: null });
                        }
                    });
            });
        } else if (fileType === 'video') {
            return new Promise((resolve) => { // Always resolve
                ffmpeg.ffprobe(filePath, (err_probe, metadata) => {
                    let seekInputOption = '1';

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
                            resolve({ generatedThumbnailPath: outputPath, error: null, details: null });
                        })
                        .on('error', (err_ffmpeg) => {
                            let errorType = 'ffmpeg_error_unknown';
                            if (err_ffmpeg.message && /Invalid data|moov atom not found|Segment not found|Error while decoding/i.test(err_ffmpeg.message)) {
                                errorType = 'video_corrupt_or_unreadable';
                            }
                            console.error(`Error generating video thumbnail for ${filePath} (${errorType}): ${err_ffmpeg.message}`);
                            if (fs.existsSync(outputPath)) {
                                try { fs.unlinkSync(outputPath); } catch (e) { console.error(`Failed to delete incomplete thumbnail ${outputPath}`, e); }
                            }
                            resolve({ generatedThumbnailPath: null, error: errorType, details: err_ffmpeg.message });
                        })
                        .run();
                });
            });
        } else if (fileType === 'html') {
            return new Promise(async (resolve) => { // Made async for await sharp
                try {
                    let title = path.basename(filePath, path.extname(filePath));
                    // Basic sanitization: replace hyphens/underscores with spaces
                    title = title.replace(/-/g, ' ').replace(/_/g, ' ');

                    // Attempt to make title more readable if it's camelCase or PascalCase
                    title = title.replace(/([A-Z])/g, ' $1').replace(/^ /, ''); // Add space before caps, remove leading space
                    title = title.charAt(0).toUpperCase() + title.slice(1); // Capitalize first letter

                    const displayTitle = title.substring(0, 50); // Limit length for display

                    const backgroundColor = '#4A5568'; // Tailwind Slate 600
                    const textColor = '#E2E8F0';     // Tailwind Slate 200
                    const fontSize = 24;             // Increased font size
                    const fontFamily = 'Arial, Helvetica, sans-serif';

                    let line1 = displayTitle;
                    let line2 = '';
                    const MAX_CHARS_PER_LINE = 18; // Heuristic based on 200px width and font size

                    if (displayTitle.length > MAX_CHARS_PER_LINE) {
                        let breakPoint = -1;
                        // Try to find a space to break near the middle or MAX_CHARS_PER_LINE
                        for (let i = MAX_CHARS_PER_LINE; i > 5; i--) { // Don't break too early
                            if (displayTitle[i] === ' ') {
                                breakPoint = i;
                                break;
                            }
                        }
                        if (breakPoint !== -1) {
                            line1 = displayTitle.substring(0, breakPoint);
                            line2 = displayTitle.substring(breakPoint + 1);
                        } else { // No good space, just split
                            line1 = displayTitle.substring(0, MAX_CHARS_PER_LINE);
                            line2 = displayTitle.substring(MAX_CHARS_PER_LINE);
                        }
                    }

                    // Trim and add ellipsis if lines are still too long (second line specifically)
                    if (line1.length > MAX_CHARS_PER_LINE + 2) line1 = line1.substring(0, MAX_CHARS_PER_LINE -1) + '...';
                    if (line2.length > MAX_CHARS_PER_LINE + 2) line2 = line2.substring(0, MAX_CHARS_PER_LINE -1) + '...';


                    const svgContent = `
                      <svg width="${THUMBNAIL_WIDTH}" height="${THUMBNAIL_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
                        <rect width="100%" height="100%" fill="${backgroundColor}" />
                        <text x="50%" y="${line2 ? '40%' : '50%'}" dominant-baseline="middle" text-anchor="middle"
                              font-family="${fontFamily}" font-size="${fontSize}" fill="${textColor}">
                          ${line1}
                        </text>
                        ${line2 ? `
                        <text x="50%" y="60%" dominant-baseline="middle" text-anchor="middle"
                              font-family="${fontFamily}" font-size="${fontSize}" fill="${textColor}">
                          ${line2}
                        </text>` : ''}
                      </svg>
                    `;

                    // outputPath is already defined at the start of generateThumbnail
                    const svgBuffer = Buffer.from(svgContent);
                    await sharp(svgBuffer).png().toFile(outputPath);
                    console.log(`Generated HTML title thumbnail for ${filePath}`);
                    resolve({ generatedThumbnailPath: outputPath, error: null, details: null });

                } catch (genError) {
                    console.error(`Error generating HTML thumbnail for ${filePath}:`, genError);
                    resolve({ generatedThumbnailPath: null, error: 'html_thumb_generation_error', details: genError.message });
                }
            });
        } else {
            console.warn(`Unsupported file type for thumbnail generation: ${fileType} for file ${filePath}`);
            return Promise.resolve({ generatedThumbnailPath: null, error: 'unsupported_file_type', details: `File type ${fileType} is not supported for thumbnail generation.` });
        }
    } catch (error) { // Catch synchronous errors from initial setup (e.g., path parsing)
        console.error(`Failed to generate thumbnail (outer catch) for ${filePath}: ${error.message}`);
        // This outputPath might not be correctly defined if error is very early
        // but try to clean up if it was.
        try {
            if (outputPath && fs.existsSync(outputPath)) {
                fs.unlinkSync(outputPath);
            }
        } catch(e) {/*ignore cleanup error*/}
        // Return a Promise that resolves to the error object structure
        return Promise.resolve({ generatedThumbnailPath: null, error: 'setup_error', details: error.message });
    }
}

function generateExpectedThumbnailFilename(originalFilePath) {
    // Generates the base filename for the thumbnail, e.g., "myvideo.png"
    // Consistent with how generateThumbnail names files.
    return `${path.parse(path.basename(originalFilePath)).name}.png`;
}

module.exports = { generateThumbnail, THUMBNAILS_DIR, generateExpectedThumbnailFilename };

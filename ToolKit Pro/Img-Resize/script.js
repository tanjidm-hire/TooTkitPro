document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const imageLoader = document.getElementById('imageLoader');
    const fileNameElement = document.getElementById('fileName');
    const originalDimensionsElement = document.getElementById('originalDimensions');
    const statusMessageElement = document.getElementById('statusMessage');
    const imagePreview = document.getElementById('imagePreview');
    const previewPlaceholder = document.getElementById('previewPlaceholder');

    // Control Elements
    const resizeWidthInput = document.getElementById('resizeWidth');
    const resizeHeightInput = document.getElementById('resizeHeight');
    const aspectRatioCheckbox = document.getElementById('aspectRatio');
    const resizePercentInput = document.getElementById('resizePercent');
    const downloadFormatSelect = document.getElementById('downloadFormat');
    const outputFilenameInput = document.getElementById('outputFilename');
    const downloadBtn = document.getElementById('downloadBtn');
    const yearSpan = document.getElementById('year');

    // State Variables
    let originalImage = null; // Stores the loaded Image object
    let originalWidth = 0;
    let originalHeight = 0;
    let originalFileName = 'image'; // Default filename base

    // Set current year in footer
    if (yearSpan) {
        yearSpan.textContent = new Date().getFullYear();
    }

    // --- Event Listeners ---

    imageLoader.addEventListener('change', handleImageUpload);
    resizeWidthInput.addEventListener('input', () => handleDimensionChange('width'));
    resizeHeightInput.addEventListener('input', () => handleDimensionChange('height'));
    aspectRatioCheckbox.addEventListener('change', () => handleDimensionChange('width')); // Recalc on checkbox change too
    resizePercentInput.addEventListener('input', handlePercentageChange);
    downloadBtn.addEventListener('click', handleDownload);


    // --- Functions ---

    function handleImageUpload(event) {
        const file = event.target.files[0];
        if (!file) {
            setStatus('No file selected.', true);
            return;
        }
        if (!file.type.match('image/png') && !file.type.match('image/jpeg') && !file.type.match('image/webp')) {
             setStatus('Please select a PNG, JPG, or WEBP image file.', true);
             resetUI();
             return;
        }

        originalFileName = file.name.split('.').slice(0, -1).join('.') || 'image'; // Get filename without extension
        fileNameElement.textContent = `Selected: ${file.name}`;
        setStatus('Loading image...');
        disableControls(); // Disable while loading

        const reader = new FileReader();
        reader.onload = (e) => {
            originalImage = new Image();
            originalImage.onload = () => {
                // Successfully loaded
                originalWidth = originalImage.width;
                originalHeight = originalImage.height;

                // Display preview
                imagePreview.src = e.target.result;
                imagePreview.style.display = 'block';
                previewPlaceholder.style.display = 'none';
                originalDimensionsElement.textContent = `Original: ${originalWidth} x ${originalHeight} px`;

                // Set initial values in controls
                resizeWidthInput.value = originalWidth;
                resizeHeightInput.value = originalHeight;
                resizePercentInput.value = 100;
                outputFilenameInput.value = `resized-${originalFileName}`;

                enableControls();
                setStatus(''); // Clear status
            };
            originalImage.onerror = () => {
                setStatus('Error loading image data. The file might be corrupt.', true);
                resetUI();
            };
            originalImage.src = e.target.result; // Start loading the image object
        };
        reader.onerror = () => {
             setStatus('Error reading file.', true);
             resetUI();
        }
        reader.readAsDataURL(file); // Read file for preview src
    }

    // Recalculates dimensions based on aspect ratio lock or percentage change
    function handleDimensionChange(changedDimension) {
        if (!originalImage) return;

        const aspectRatio = originalWidth / originalHeight;
        let width = parseInt(resizeWidthInput.value, 10);
        let height = parseInt(resizeHeightInput.value, 10);

        if (aspectRatioCheckbox.checked) {
            if (changedDimension === 'width' && !isNaN(width) && width > 0) {
                height = Math.round(width / aspectRatio);
                resizeHeightInput.value = height;
            } else if (changedDimension === 'height' && !isNaN(height) && height > 0) {
                width = Math.round(height * aspectRatio);
                resizeWidthInput.value = width;
            } else {
                // If one input is cleared or invalid, reset the other if lock is on
                 if (isNaN(width) || width <= 0) resizeHeightInput.value = '';
                 if (isNaN(height) || height <= 0) resizeWidthInput.value = '';
                 width = NaN; // Prevent percentage update below if dimensions invalid
            }
        }

         // Update percentage input based on pixel dimensions (if valid)
        if (!isNaN(width) && width > 0 && originalWidth > 0) {
             const percentW = Math.round((width / originalWidth) * 100);
             // Check if height calculation matches to avoid conflicting updates
             if (!aspectRatioCheckbox.checked || Math.round(width / aspectRatio) === height) {
                 resizePercentInput.value = percentW;
             }
        } else if (!aspectRatioCheckbox.checked && !isNaN(height) && height > 0 && originalHeight > 0) {
             // Update based on height if aspect ratio not locked and width is invalid
             const percentH = Math.round((height / originalHeight) * 100);
             resizePercentInput.value = percentH;
        } else if (isNaN(width) || width <=0 || isNaN(height) || height <=0) {
             // Clear percentage if dimensions are invalid
             resizePercentInput.value = '';
        }
    }

    function handlePercentageChange() {
        if (!originalImage) return;

        const percent = parseInt(resizePercentInput.value, 10);
        if (!isNaN(percent) && percent > 0) {
            const newWidth = Math.round(originalWidth * (percent / 100));
            const newHeight = Math.round(originalHeight * (percent / 100));
            resizeWidthInput.value = newWidth;
            resizeHeightInput.value = newHeight; // Aspect ratio is inherently maintained
        } else {
             // Clear pixel inputs if percentage is invalid
             resizeWidthInput.value = '';
             resizeHeightInput.value = '';
        }
    }

    function handleDownload() {
        if (!originalImage) {
             setStatus('Please upload an image first.', true);
             return;
        }

        const width = parseInt(resizeWidthInput.value, 10);
        const height = parseInt(resizeHeightInput.value, 10);
        const format = downloadFormatSelect.value; // e.g., 'image/png'
        const quality = 0.92; // Quality for JPEG/WEBP (0.0 to 1.0)
        const fileExtension = format.split('/')[1]; // 'png', 'jpeg', 'webp'
        let filename = (outputFilenameInput.value.trim() || `resized-${originalFileName}`) + `.${fileExtension}`;
        // Basic filename sanitization (replace spaces, remove invalid chars)
        filename = filename.replace(/\s+/g, '_').replace(/[\\/:*?"<>|]/g, '');


        if (isNaN(width) || isNaN(height) || width <= 0 || height <= 0) {
            setStatus('Please enter valid positive dimensions.', true);
            return;
        }

        setStatus('Processing and preparing download...', false);

        // Use a temporary canvas to draw the resized image
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        canvas.width = width;
        canvas.height = height;

        // Draw the original image onto the canvas, scaling it
        // Setting smoothing based on whether downscaling or upscaling can improve quality
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = (width < originalWidth || height < originalHeight) ? 'medium' : 'high'; // 'low', 'medium', 'high'
        ctx.drawImage(originalImage, 0, 0, width, height);

        // Generate the data URL
        try {
            const dataURL = canvas.toDataURL(format, quality);

             // Create a temporary link element for download
             const link = document.createElement('a');
             link.href = dataURL;
             link.download = filename;

             // Trigger download
             document.body.appendChild(link); // Required for Firefox
             link.click();
             document.body.removeChild(link); // Clean up

             setStatus(`Resized image (${width}x${height}) downloaded as ${filename}.`, false, true); // Mark as success

        } catch (error) {
            console.error("Canvas toDataURL error:", error);
            setStatus(`Error creating downloadable image. Format: ${format}, Size: ${width}x${height}. Try a smaller size or different format.`, true);
        }
    }

    function enableControls() {
        resizeWidthInput.disabled = false;
        resizeHeightInput.disabled = false;
        aspectRatioCheckbox.disabled = false;
        resizePercentInput.disabled = false;
        downloadFormatSelect.disabled = false;
        outputFilenameInput.disabled = false;
        downloadBtn.disabled = false;
    }

    function disableControls() {
        resizeWidthInput.disabled = true;
        resizeHeightInput.disabled = true;
        aspectRatioCheckbox.disabled = true;
        resizePercentInput.disabled = true;
        downloadFormatSelect.disabled = true;
        outputFilenameInput.disabled = true;
        downloadBtn.disabled = true;
    }

    function resetUI() {
         originalImage = null;
         originalWidth = 0;
         originalHeight = 0;
         fileNameElement.textContent = 'No image selected';
         originalDimensionsElement.textContent = '';
         imagePreview.src = '#';
         imagePreview.style.display = 'none';
         previewPlaceholder.style.display = 'block';
         resizeWidthInput.value = '';
         resizeHeightInput.value = '';
         resizePercentInput.value = 100;
         outputFilenameInput.value = '';
         disableControls(); // Keep controls disabled
    }

    function setStatus(message, isError = false, isSuccess = false) {
        statusMessageElement.textContent = message;
        statusMessageElement.classList.remove('error', 'success'); // Remove previous classes
        if (isError) {
            statusMessageElement.classList.add('error');
        } else if (isSuccess) {
             statusMessageElement.classList.add('success');
        }
    }

    // Initial state
    resetUI();

    // --- AdSense Integration Reminder ---
    console.log("AdSense Integration Reminder: Ensure you replace 'ca-pub-YOUR_PUBLISHER_ID' and 'YOUR_..._SLOT_ID' placeholders in the index.html file with your actual Google AdSense IDs.");


}); // End DOMContentLoaded
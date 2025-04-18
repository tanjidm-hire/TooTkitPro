document.addEventListener('DOMContentLoaded', () => {
    const imageInput = document.getElementById('image-input');
    const cropperImage = document.getElementById('cropper-image');
    const countrySelect = document.getElementById('country-select');
    const dimensionDisplay = document.getElementById('dimension-display');
    const cropButton = document.getElementById('crop-button');
    const downloadLink = document.getElementById('download-link');
    const downloadLinkPng = document.getElementById('download-link-png');
    const previewElement = document.querySelector('.img-preview');
    const outputResolutionDisplay = document.getElementById('output-resolution');
    const yearSpan = document.getElementById('year');

    let cropper = null;
    let currentAspectRatio = null;
    let currentOutputWidthMM = 0;
    let currentOutputHeightMM = 0;
    const DPI = 300; // Standard print resolution

    // --- Passport Size Data (Width x Height in mm) ---
    // **IMPORTANT**: This is a sample list. You MUST research and expand this list
    // for the countries you want to support. Requirements can change!
    // Source: Official government websites are the best source. Wikipedia can be a starting point but verify.
    const passportSizes = {
        "USA": { width: 51, height: 51 },
        "UK": { width: 35, height: 45 },
        "Canada": { width: 50, height: 70 },
        "Australia": { width: 35, height: 45 },
        "Bangladesh": { width: 40, height: 50 }, // Often 2x2 inch
        "Germany": { width: 35, height: 45 },
        "France": { width: 35, height: 45 },
        "China": { width: 33, height: 48 },
        "Japan": { width: 35, height: 45 },
        "Schengen Visa": { width: 35, height: 45 },
        // Add more countries here...
        // Example: "Brazil": { width: 50, height: 70 },
        // "Custom": { width: 0, height: 0 } // Future feature maybe?
    };

    // --- Populate Country Select ---
    function populateCountries() {
        const sortedCountries = Object.keys(passportSizes).sort();
        sortedCountries.forEach(country => {
            const option = document.createElement('option');
            option.value = country;
            option.textContent = country;
            countrySelect.appendChild(option);
        });
    }

    // --- Initialize Cropper ---
    function initCropper(aspectRatio = NaN) { // NaN means free aspect ratio initially
        if (cropper) {
            cropper.destroy();
        }
        cropper = new Cropper(cropperImage, {
            aspectRatio: aspectRatio,
            viewMode: 1, // Restrict crop box to canvas
            dragMode: 'move',
            background: true, // Show checkerboard background
            responsive: true,
            autoCropArea: 0.8, // Initial crop area size (80%)
            guides: true,
            center: true,
            movable: true,
            zoomable: true,
            rotatable: false, // Rotation can complicate things, disable for simplicity
            scalable: false, // Scaling box vs image zoom
            preview: previewElement, // Link preview element

            ready() {
                // Enable crop button once Cropper is ready and a country is selected
                cropButton.disabled = !currentAspectRatio;
                 console.log("Cropper ready");
            },
             crop(event) {
                // You could potentially show live crop data here if needed
                // console.log(event.detail.x);
            }
        });
    }

    // --- Convert MM to Pixels at given DPI ---
    function mmToPixels(mm, dpi) {
        return Math.round((mm / 25.4) * dpi);
    }

    // --- Event Listener: Country Selection ---
    countrySelect.addEventListener('change', (e) => {
        const selectedCountry = e.target.value;
        if (selectedCountry && passportSizes[selectedCountry]) {
            const dimensions = passportSizes[selectedCountry];
            currentOutputWidthMM = dimensions.width;
            currentOutputHeightMM = dimensions.height;
            currentAspectRatio = dimensions.width / dimensions.height;

            dimensionDisplay.textContent = `(${dimensions.width}mm x ${dimensions.height}mm)`;

            // Update cropper aspect ratio if an image is loaded
            if (cropper) {
                cropper.setAspectRatio(currentAspectRatio);
                cropButton.disabled = false; // Enable crop button
            } else {
                 cropButton.disabled = true; // Disable if no image loaded yet
            }
             // Reset previous results
             resetDownloadLinks();

        } else {
            dimensionDisplay.textContent = '';
            currentAspectRatio = null;
            currentOutputWidthMM = 0;
            currentOutputHeightMM = 0;
            if (cropper) {
                cropper.setAspectRatio(NaN); // Free aspect ratio
            }
            cropButton.disabled = true; // Disable crop button if no country selected
             resetDownloadLinks();
        }
    });

    // --- Event Listener: Image File Input ---
    imageInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (event) => {
                cropperImage.src = event.target.result;
                // Initialize Cropper AFTER the image has loaded
                cropperImage.onload = () => {
                     initCropper(currentAspectRatio); // Use current aspect ratio if country already selected
                     resetDownloadLinks(); // Reset download links on new image
                };
                cropperImage.onerror = () => {
                    alert("Error loading image.");
                     resetCropperAndButtons();
                };
            };
            reader.readAsDataURL(file);
        } else {
            alert("Please select a valid image file (JPG, PNG, WEBP).");
            resetCropperAndButtons();
        }
    });

     // --- Reset Cropper and Buttons ---
     function resetCropperAndButtons() {
         if (cropper) {
             cropper.destroy();
             cropper = null;
         }
         cropperImage.src = '#'; // Clear image source or show placeholder
         cropButton.disabled = true;
         resetDownloadLinks();
         outputResolutionDisplay.textContent = '';
         imageInput.value = ''; // Clear the file input
     }

    // --- Event Listener: Crop Button ---
    cropButton.addEventListener('click', () => {
        if (!cropper || !currentOutputWidthMM || !currentOutputHeightMM) {
            alert("Please select a country and upload an image first.");
            return;
        }

        // Calculate target dimensions in pixels
        const targetWidthPx = mmToPixels(currentOutputWidthMM, DPI);
        const targetHeightPx = mmToPixels(currentOutputHeightMM, DPI);

        outputResolutionDisplay.textContent = `Output: ${targetWidthPx}px x ${targetHeightPx}px (${DPI} DPI)`;

        // Get cropped canvas data with specified dimensions
        const croppedCanvas = cropper.getCroppedCanvas({
            width: targetWidthPx,
            height: targetHeightPx,
            imageSmoothingEnabled: true,
            imageSmoothingQuality: 'high', // Use 'high' for better quality
        });

        if (croppedCanvas) {
            // Generate JPG
            const jpgUrl = croppedCanvas.toDataURL('image/jpeg', 0.92); // Quality 0.92 (adjust as needed)
            downloadLink.href = jpgUrl;
            downloadLink.download = `passport_photo_${countrySelect.value}_${currentOutputWidthMM}x${currentOutputHeightMM}mm.jpg`;
            downloadLink.style.display = 'inline-block';

            // Generate PNG
            const pngUrl = croppedCanvas.toDataURL('image/png');
            downloadLinkPng.href = pngUrl;
            downloadLinkPng.download = `passport_photo_${countrySelect.value}_${currentOutputWidthMM}x${currentOutputHeightMM}mm.png`;
            downloadLinkPng.style.display = 'inline-block';

        } else {
            alert("Could not generate cropped image. Please try again.");
             resetDownloadLinks();
        }
    });

    // --- Reset Download Links ---
    function resetDownloadLinks() {
        downloadLink.style.display = 'none';
        downloadLink.href = '#';
         downloadLinkPng.style.display = 'none';
        downloadLinkPng.href = '#';
        outputResolutionDisplay.textContent = '';
    }

    // --- Set Footer Year ---
    yearSpan.textContent = new Date().getFullYear();

    // --- Initial Setup ---
    populateCountries();
    cropButton.disabled = true; // Initially disabled

}); // End DOMContentLoaded
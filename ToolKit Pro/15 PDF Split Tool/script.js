document.addEventListener('DOMContentLoaded', () => {
    // Check if pdf-lib is loaded
    if (typeof PDFLib === 'undefined') {
        console.error("PDF-LIB library not loaded!");
        setStatus('Error: PDF library failed to load. Please refresh.', true);
        return; // Stop execution if library is missing
    }
    const { PDFDocument, rgb } = PDFLib; // Destructure necessary components

    // DOM Elements
    const pdfLoader = document.getElementById('pdfLoader');
    const fileNameElement = document.getElementById('fileName');
    const fileInfoElement = document.getElementById('fileInfo');
    const statusMessageElement = document.getElementById('statusMessage');
    const optionsPanel = document.getElementById('optionsPanel');
    const splitBtn = document.getElementById('splitBtn');
    const downloadArea = document.getElementById('downloadArea');
    const downloadLinksContainer = document.getElementById('downloadLinks');
    const yearSpan = document.getElementById('year');

    // Options Elements
    const splitModeRadios = document.querySelectorAll('input[name="splitMode"]');
    const extractOptionsDiv = document.getElementById('extract-options');
    const splitEveryOptionsDiv = document.getElementById('split-every-options');
    const pageRangesInput = document.getElementById('pageRanges');
    const splitSizeInput = document.getElementById('splitSize');


    // State Variables
    let originalPdfDoc = null; // Stores the loaded PDFDocument object
    let originalFileName = 'document.pdf';
    let totalPages = 0;

    // Set current year in footer
    if (yearSpan) {
        yearSpan.textContent = new Date().getFullYear();
    }

    // --- Event Listeners ---
    pdfLoader.addEventListener('change', handlePdfUpload);
    splitModeRadios.forEach(radio => radio.addEventListener('change', handleModeChange));
    splitBtn.addEventListener('click', handleSplitPdf);

    // --- Functions ---

    async function handlePdfUpload(event) {
        const file = event.target.files[0];
        if (!file) {
            setStatus('No file selected.', true);
            resetToolState();
            return;
        }
        if (file.type !== 'application/pdf') {
             setStatus('Please select a valid PDF file.', true);
             resetToolState();
             return;
        }

        originalFileName = file.name;
        fileNameElement.textContent = `Selected: ${originalFileName}`;
        fileInfoElement.textContent = ''; // Clear previous info
        downloadLinksContainer.innerHTML = '<p>Your split PDF files will appear here.</p>'; // Reset download area
        setStatus('Loading PDF...', false, false, true); // Processing state
        optionsPanel.style.display = 'none'; // Hide options while loading
        splitBtn.disabled = true;


        try {
            const arrayBuffer = await file.arrayBuffer(); // Read file into ArrayBuffer
            originalPdfDoc = await PDFDocument.load(arrayBuffer); // Load with pdf-lib
            totalPages = originalPdfDoc.getPageCount();

            fileInfoElement.textContent = `Total pages: ${totalPages}`;
            setStatus('PDF loaded successfully. Choose split options.', false, true); // Success
            optionsPanel.style.display = 'block'; // Show options
            splitBtn.disabled = false; // Enable split button
            // Set default split size max
            splitSizeInput.max = totalPages > 1 ? totalPages -1 : 1;


        } catch (error) {
            console.error("Error loading PDF:", error);
            setStatus(`Error loading PDF: ${error.message}. Please try another file.`, true);
            resetToolState();
        }
    }

    function handleModeChange() {
        const selectedMode = document.querySelector('input[name="splitMode"]:checked').value;
        if (selectedMode === 'extract') {
            extractOptionsDiv.style.display = 'block';
            splitEveryOptionsDiv.style.display = 'none';
        } else { // 'every'
            extractOptionsDiv.style.display = 'none';
            splitEveryOptionsDiv.style.display = 'block';
        }
    }

    async function handleSplitPdf() {
        if (!originalPdfDoc) {
            setStatus('Please upload a PDF first.', true);
            return;
        }

        const selectedMode = document.querySelector('input[name="splitMode"]:checked').value;
        setStatus('Splitting PDF...', false, false, true); // Processing state
        splitBtn.disabled = true;
        downloadLinksContainer.innerHTML = '<p>Processing...</p>'; // Clear previous links

        try {
            if (selectedMode === 'extract') {
                await splitByExtractingPages();
            } else { // 'every'
                await splitEveryNPages();
            }
            setStatus('Splitting complete. Download your file(s) below.', false, true); // Success
        } catch (error) {
            console.error("Splitting error:", error);
            setStatus(`Error splitting PDF: ${error.message}`, true);
            downloadLinksContainer.innerHTML = '<p class="error">An error occurred during splitting.</p>';
        } finally {
             splitBtn.disabled = false; // Re-enable button
        }
    }

    // --- Splitting Logic ---

    async function splitByExtractingPages() {
        const pagesString = pageRangesInput.value.trim();
        if (!pagesString) {
            throw new Error("Please enter the pages or ranges to extract.");
        }

        const pageIndices = parsePageRanges(pagesString, totalPages); // Get 0-based indices
        if (!pageIndices || pageIndices.length === 0) {
             throw new Error("Invalid page numbers or ranges entered.");
        }

        // Create a new PDF
        const newPdfDoc = await PDFDocument.create();
        // Copy specified pages
        const copiedPages = await newPdfDoc.copyPages(originalPdfDoc, pageIndices);
        // Add copied pages to the new document
        copiedPages.forEach(page => newPdfDoc.addPage(page));

        // Save the new PDF
        const pdfBytes = await newPdfDoc.save();

        // Trigger download
        const baseName = originalFileName.replace(/\.pdf$/i, '');
        triggerDownload(pdfBytes, `${baseName}-extracted.pdf`);
    }

    async function splitEveryNPages() {
        const n = parseInt(splitSizeInput.value, 10);
        if (isNaN(n) || n <= 0) {
            throw new Error("Please enter a valid positive number for 'Split Every'.");
        }
        if (n >= totalPages) {
             throw new Error(`Split size (${n}) must be smaller than the total pages (${totalPages}).`);
        }


        const numResultingPdfs = Math.ceil(totalPages / n);
        const downloadPromises = []; // To store promises for each PDF generation/download trigger

        for (let i = 0; i < numResultingPdfs; i++) {
             const startIndex = i * n; // 0-based start index
             const endIndex = Math.min(startIndex + n, totalPages); // 0-based end index (exclusive for slicing)

             // Get page indices for this chunk (0-based)
             const pageIndices = Array.from({ length: endIndex - startIndex }, (_, k) => startIndex + k);

             // Create a new PDF for this chunk
             const chunkPdfDoc = await PDFDocument.create();
             const copiedPages = await chunkPdfDoc.copyPages(originalPdfDoc, pageIndices);
             copiedPages.forEach(page => chunkPdfDoc.addPage(page));

             // Save the chunk PDF
             const pdfBytes = await chunkPdfDoc.save();

             // Prepare download info (don't trigger immediately to avoid pop-up blockers)
             const baseName = originalFileName.replace(/\.pdf$/i, '');
             const chunkFileName = `${baseName}-part-${i + 1}.pdf`;
             downloadPromises.push({ bytes: pdfBytes, name: chunkFileName });
        }

         // Generate download links after all chunks are processed
         downloadLinksContainer.innerHTML = ''; // Clear "Processing..."
         downloadPromises.forEach(dl => {
             triggerDownload(dl.bytes, dl.name, true); // Pass true to generate link only
         });

         // Note: For better UX with many files, consider JSZip here to create a single zip download.
    }


    // --- Utility Functions ---

    // Parses ranges like "1, 3-5, 8" into 0-based indices [0, 2, 3, 4, 7]
    function parsePageRanges(rangesString, maxPage) {
        const indices = new Set();
        const parts = rangesString.split(',');

        for (const part of parts) {
            const trimmedPart = part.trim();
            if (trimmedPart.includes('-')) {
                // Range
                const [startStr, endStr] = trimmedPart.split('-');
                const start = parseInt(startStr.trim(), 10);
                const end = parseInt(endStr.trim(), 10);

                if (isNaN(start) || isNaN(end) || start < 1 || end < start || end > maxPage) {
                    console.warn(`Invalid range: ${trimmedPart}`);
                    continue; // Skip invalid range
                }
                for (let i = start; i <= end; i++) {
                    indices.add(i - 1); // Add 0-based index
                }
            } else {
                // Single page
                const pageNum = parseInt(trimmedPart, 10);
                if (isNaN(pageNum) || pageNum < 1 || pageNum > maxPage) {
                     console.warn(`Invalid page number: ${trimmedPart}`);
                     continue; // Skip invalid page number
                }
                indices.add(pageNum - 1); // Add 0-based index
            }
        }
        // Return sorted array of unique indices
        return Array.from(indices).sort((a, b) => a - b);
    }


    function triggerDownload(pdfBytes, filename, generateLinkOnly = false) {
         const blob = new Blob([pdfBytes], { type: 'application/pdf' });
         const link = document.createElement('a');
         link.href = URL.createObjectURL(blob);
         link.download = filename;
         link.textContent = `Download ${filename}`;

         if (generateLinkOnly) {
              downloadLinksContainer.appendChild(link);
              // Add a small delay before revoking for safety, especially if many links are added
               setTimeout(() => URL.revokeObjectURL(link.href), 100);
         } else {
              downloadLinksContainer.innerHTML = ''; // Clear previous links if downloading single file
              downloadLinksContainer.appendChild(link);
              link.click(); // Trigger immediate download for single file
              URL.revokeObjectURL(link.href); // Clean up object URL
              // Link remains visible temporarily
         }
    }


    function resetToolState() {
        originalPdfDoc = null;
        totalPages = 0;
        pdfLoader.value = ''; // Clear file input
        fileNameElement.textContent = 'No PDF selected';
        fileInfoElement.textContent = '';
        optionsPanel.style.display = 'none';
        splitBtn.disabled = true;
        downloadLinksContainer.innerHTML = '<p>Your split PDF files will appear here.</p>';
        // Don't clear status message if it's an error message
    }

    function setStatus(message, isError = false, isSuccess = false, isProcessing = false) {
        statusMessageElement.textContent = message;
        statusMessageElement.classList.remove('error', 'success', 'processing'); // Remove previous classes
        if (isError) {
            statusMessageElement.classList.add('error');
        } else if (isSuccess) {
             statusMessageElement.classList.add('success');
        } else if (isProcessing) {
            statusMessageElement.classList.add('processing');
        }
    }

    // Initial setup
    setStatus("Please upload a PDF file to begin.");
    splitBtn.disabled = true;
    optionsPanel.style.display = 'none'; // Ensure options hidden initially

    // --- AdSense Integration Reminder ---
    console.log("AdSense Integration Reminder: Ensure you replace 'ca-pub-YOUR_PUBLISHER_ID' and 'YOUR_..._SLOT_ID' placeholders in the index.html file with your actual Google AdSense IDs.");

}); // End DOMContentLoaded
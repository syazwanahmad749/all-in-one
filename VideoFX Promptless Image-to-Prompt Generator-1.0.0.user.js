// ==UserScript==
// @name         VideoFX Promptless Image-to-Prompt Generator
// @namespace    https://labs.google/
// @version      1.0.0
// @description  Generates a new video prompt directly from an uploaded image using the promptlessI2VPrompt API.
// @author       Your Name & Gemini
// @match        https://labs.google/fx/*
// @grant        GM_addStyle
// @grant        GM_setClipboard
// @grant        GM_xmlhttpRequest
// @run-at       document-end
// ==/UserScript==

(function () {
    'use strict';

    // --- Configuration ---
    const API_ENDPOINT = "https://labs.google/fx/api/trpc/general.generatePromptlessI2VPrompt";
    const OVERLAY_TITLE = 'Image-to-Prompt Generator';
    const OVERLAY_ID = 'vfx-i2p-overlay';
    const OVERLAY_TITLE_ID = 'vfx-i2p-title';
    const RESULT_TEXTAREA_ID = 'i2p-result-textarea';
    const IMAGE_INPUT_ID = 'i2p-image-input';
    const GENERATE_BUTTON_TEXT = 'Generate Prompt';
    const GENERATING_BUTTON_TEXT = 'Generating...';
    const COPY_BUTTON_TEXT = 'Copy';
    const COPIED_BUTTON_TEXT = 'Copied!';
    const INIT_FALLBACK_DELAY = 7000;
    const FAB_CONTAINER_ID = 'vfx-i2p-fab-container';
    const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
    const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

    // --- DOM Element Variables ---
    let overlay, overlayBackdrop, resultTextarea, generateApiButton, copyButton, closeButton, messageArea;
    let uiInitialized = false;
    let imageFileInput, uploadImageButton, imageInfoArea, clearImageButton;
    let selectedImageBase64 = null;
    let selectedImageFullDataUrl = null;

    function gmFetch(url, options) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: options.method || "GET",
                url: url,
                headers: options.headers || {},
                data: options.body,
                responseType: "json",
                onload: function(response) {
                    if (response.status >= 200 && response.status < 300) {
                        resolve({ ok: true, status: response.status, json: () => Promise.resolve(response.responseJson || response.response), text: () => Promise.resolve(response.responseText) });
                    } else {
                        resolve({ ok: false, status: response.status, json: () => Promise.resolve(response.responseJson || response.response || {}), text: () => Promise.resolve(response.responseText) });
                    }
                },
                onerror: function(response) { reject(new Error(response.statusText || `Network error: ${response.status}`)); },
                ontimeout: function() { reject(new Error("Request timed out.")); },
                onabort: function() { reject(new Error("Request aborted.")); }
            });
        });
    }

    function createModalButton(text, classNames = [], onClick = null, iconName = null) {
        const button = document.createElement('button');
        button.type = 'button';
        if (iconName) {
            const iconSpan = document.createElement('span');
            iconSpan.className = 'material-symbols-outlined';
            iconSpan.textContent = iconName;
            iconSpan.setAttribute('aria-hidden', 'true');
            if (!text || text.trim() === '') { button.classList.add('icon-only'); iconSpan.style.marginRight = '0'; }
            button.appendChild(iconSpan);
        }
        if (text && text.trim() !== '') {
            button.appendChild(document.createTextNode(text));
        } else if (iconName) {
            button.setAttribute('aria-label', button.title || iconName.replace(/_/g, ' '));
        }
        const classes = Array.isArray(classNames) ? classNames : [classNames];
        if (!classes.some(cls => cls.startsWith('vfx-fab'))) {
             if (!classes.includes('generator-button-base')) { classes.unshift('generator-button-base'); }
        }
        classes.forEach(cls => button.classList.add(cls));
        if (onClick) button.onclick = onClick;
        return button;
    }

    const showMessage = (text, type = 'info') => {
        if (!messageArea) return;
        messageArea.textContent = text;
        messageArea.className = `overlay-message message-${type}`;
        messageArea.style.display = 'block';
        messageArea.setAttribute('aria-hidden', 'false');
        if (type !== 'error') { setTimeout(clearMessage, 4000); }
    };

    const clearMessage = () => {
        if (!messageArea) return;
        messageArea.textContent = '';
        messageArea.style.display = 'none';
        messageArea.setAttribute('aria-hidden', 'true');
    };

    const setLoadingState = (isLoading) => {
        if (!generateApiButton) return;
        generateApiButton.disabled = isLoading;
        const iconHTML = isLoading ? createIconSpanHTML('hourglass_top') : createIconSpanHTML('auto_awesome');
        generateApiButton.innerHTML = iconHTML + (isLoading ? GENERATING_BUTTON_TEXT : GENERATE_BUTTON_TEXT);
        generateApiButton.style.cursor = isLoading ? 'wait' : 'pointer';
    };

    const handleFileSelect = (event) => {
        const file = event.target.files[0];
        if (file) {
            if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
                showMessage(`Invalid file type. Allowed: ${ALLOWED_IMAGE_TYPES.map(t=>t.split('/')[1]).join(', ')}.`, 'error');
                clearSelectedImage(); return;
            }
            if (file.size > MAX_IMAGE_SIZE_BYTES) {
                 showMessage(`Image is too large. Max ${MAX_IMAGE_SIZE_BYTES/(1024*1024)}MB.`, 'error');
                 clearSelectedImage(); return;
            }
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    selectedImageFullDataUrl = e.target.result;
                    selectedImageBase64 = selectedImageFullDataUrl.split(',')[1];
                    if (!selectedImageBase64) throw new Error("Could not extract base64 data.");
                    if (imageInfoArea && clearImageButton && uploadImageButton) {
                        imageInfoArea.innerHTML = '';
                        const imgPreview = document.createElement('img');
                        imgPreview.src = selectedImageFullDataUrl;
                        imgPreview.alt = file.name;
                        imgPreview.style.cssText = 'max-width: 80px; max-height: 50px; border-radius: 4px; margin-right: 10px;';
                        imageInfoArea.appendChild(imgPreview);
                        imageInfoArea.appendChild(document.createTextNode(file.name));
                        imageInfoArea.style.display = 'flex';
                        clearImageButton.style.display = 'inline-flex';
                        uploadImageButton.style.display = 'none';
                        generateApiButton.disabled = false;
                    }
                    showMessage('Image selected. Ready to generate.', 'info');
                } catch (err) { console.error("Error processing image:", err); showMessage(`Error processing image: ${err.message}`, 'error'); clearSelectedImage(); }
            };
            reader.onerror = (err) => { console.error("FileReader error:", err); showMessage('Error reading file.', 'error'); clearSelectedImage(); };
            reader.readAsDataURL(file);
        }
    };

    const clearSelectedImage = () => {
        selectedImageBase64 = null;
        selectedImageFullDataUrl = null;
        if (imageFileInput) imageFileInput.value = '';
        if (imageInfoArea) { imageInfoArea.innerHTML = 'No image selected.'; imageInfoArea.style.display = 'none'; }
        if (clearImageButton) clearImageButton.style.display = 'none';
        if (uploadImageButton) uploadImageButton.style.display = 'inline-flex';
        if (generateApiButton) generateApiButton.disabled = true;
        if (resultTextarea) resultTextarea.value = '';
        if (copyButton) copyButton.disabled = true;
    };

    const callApi = async () => {
        if (!selectedImageBase64) {
            showMessage("Please upload an image first.", 'error');
            return;
        }

        setLoadingState(true);
        clearMessage();
        resultTextarea.value = '';
        copyButton.disabled = true;

        const headers = {
            "Content-Type": "application/json",
            "Accept": "*/*",
            "Referer": "https://labs.google/fx/aitk-web/videofx-tt/tools/video-fx" // Using a generic referrer
        };

        const jsonPayload = {
            sessionId: `/aitk-web/videofx-tt;${Date.now()}`,
            imageBase64: selectedImageBase64
        };

        const body = JSON.stringify({ json: jsonPayload });

        try {
            const response = await gmFetch(API_ENDPOINT, { method: 'POST', headers: headers, body: body });
            const data = await response.json();

            console.log("API Transaction:", { request: { json: jsonPayload }, response: data });

            if (response.ok) {
                // Assuming the response structure is similar to others, with the prompt directly in the json object
                const finalPrompt = data?.result?.data?.json;

                if (typeof finalPrompt === 'string' && finalPrompt.trim() !== "") {
                    resultTextarea.value = finalPrompt;
                    showMessage('Prompt generated successfully!', 'success');
                    copyButton.disabled = false;
                } else {
                    throw new Error("Could not extract a valid prompt from the API response.");
                }
            } else {
                 const errorData = data?.error?.json || data?.error || data;
                 const errorMessage = errorData.message || errorData.code || `API Error ${response.status}`;
                 throw new Error(errorMessage);
            }
        } catch (error) {
            showMessage(`Generation Error: ${error.message}`, 'error');
            console.error("API Error:", error);
        } finally {
            setLoadingState(false);
        }
    };

    const openOverlay = () => {
        clearMessage();
        clearSelectedImage();
        if (copyButton) { copyButton.disabled = true; copyButton.innerHTML = createIconSpanHTML('content_copy') + COPY_BUTTON_TEXT; }
        if (overlay && overlayBackdrop) {
            overlayBackdrop.style.display = 'block'; overlay.style.display = 'flex';
            setTimeout(() => { overlayBackdrop.style.opacity = '1'; overlay.classList.add('visible'); }, 10);
            document.body.style.overflow = 'hidden';
        }
    };

    const closeOverlay = () => {
        if (overlay && overlayBackdrop) {
            overlayBackdrop.style.opacity = '0'; overlay.classList.remove('visible');
            overlay.addEventListener('transitionend', () => {
                overlay.style.display = 'none';
                overlayBackdrop.style.display = 'none';
                document.body.style.overflow = '';
            }, { once: true });
        }
    };

    const handleCopyClick = async () => {
        if (!resultTextarea || !copyButton) return;
        if (!resultTextarea.value) { showMessage("Nothing to copy.", "info"); return; }
        try {
            GM_setClipboard(resultTextarea.value, 'text');
            const originalHTML = copyButton.innerHTML;
            copyButton.innerHTML = createIconSpanHTML('task_alt') + COPIED_BUTTON_TEXT;
            copyButton.disabled = true;
            showMessage("Generated prompt copied!", "success");
            setTimeout(() => {
                copyButton.innerHTML = originalHTML;
                copyButton.disabled = false;
            }, 2000);
        } catch (err) {
            showMessage("Failed to copy. Check console.", "error");
            console.error('GM_setClipboard error: ', err);
        }
    };

    const createUI = () => {
        if (uiInitialized) return;
        uiInitialized = true;
        console.log("VideoFX Promptless Generator: Initializing UI...");

        GM_addStyle(`
            :root { --google-font: 'Google Sans Text', 'Google Sans', Roboto, sans-serif; --dark-bg-primary: #1f1f1f; --dark-bg-secondary: #2d2d2d; --dark-bg-tertiary: #3f3f3f; --dark-text-primary: #e8eaed; --dark-text-secondary: #bdc1c6; --dark-border: #4a4a4a; --dark-focus-border: #a0a0a0; --dark-error-border: #f28b82; --fab-main-bg: #8e44ad; --fab-main-hover: #9b59b6; --fab-secondary-bg: #303134; --fab-secondary-hover: #3c4043; --fab-icon-color: #ffffff; --fab-secondary-icon-color: #e8eaed; --dark-accent-blue: #8ab4f8; --dark-accent-red: #f28b82; --ui-radius: 18px; --shadow-color: rgba(0,0,0,0.35); --scroll-thumb: #5f6368; --scroll-track: var(--dark-bg-tertiary); }
            .material-symbols-outlined { font-variation-settings: 'FILL'0,'wght'400,'GRAD'0,'opsz'24; font-size:1.2em; vertical-align:middle; line-height:1; margin-right:5px; margin-left:-3px; }
            .generator-close-button .material-symbols-outlined { margin:0; font-size:24px; }
            .generator-button-base.icon-only .material-symbols-outlined { margin:0; }
            #${OVERLAY_ID}, #${FAB_CONTAINER_ID} button, #${OVERLAY_ID} select, #${OVERLAY_ID} input, #${OVERLAY_ID} textarea { font-family:var(--google-font); box-sizing: border-box; }
            #${FAB_CONTAINER_ID} { position:fixed; bottom:20px; right:20px; z-index:9990; }
            #${FAB_CONTAINER_ID} .vfx-fab-main { border:none; border-radius:16px; box-shadow:0 2px 6px 2px var(--shadow-color); cursor:pointer; transition:all .2s ease-out; font-weight:500; display:flex; align-items:center; justify-content:center; width:auto; height:56px; padding: 0 20px; background-color:var(--fab-main-bg); color:var(--fab-icon-color); }
            #${FAB_CONTAINER_ID} .vfx-fab-main:hover:not(:disabled) { box-shadow:0 4px 8px 3px var(--shadow-color); background-color:var(--fab-main-hover); transform:scale(1.02); }
            .generator-backdrop { display:none; position:fixed; top:0; left:0; width:100%; height:100%; background-color:rgba(0,0,0,.6); z-index:9998; opacity:0; transition:opacity .25s ease-out; }
            #${OVERLAY_ID} { display:none; flex-direction:column; position:fixed; top:50%; left:50%; transform:translate(-50%,-50%) scale(.95); background-color:var(--dark-bg-secondary); color:var(--dark-text-primary); padding:0; border-radius:var(--ui-radius); box-shadow:0 6px 12px var(--shadow-color); z-index:9999; width:clamp(450px, 50%, 600px); border:1px solid var(--dark-border); max-height:90vh; opacity:0; transition:opacity .25s ease-out,transform .25s ease-out; }
            #${OVERLAY_ID}.visible { opacity:1; transform:translate(-50%,-50%) scale(1); }
            #${OVERLAY_ID} .generator-overlay-content { padding:20px 24px; overflow-y:auto; flex-grow:1; scrollbar-width:thin; scrollbar-color:var(--scroll-thumb) var(--scroll-track); }
            .generator-overlay-header { display:flex; justify-content:space-between; align-items:center; padding:16px 24px; border-bottom:1px solid var(--dark-border); flex-shrink:0; }
            .generator-overlay-header h3 { margin:0; font-size:1.1rem; font-weight:500; color:var(--dark-text-primary); }
            .generator-close-button { background:0 0; border:none; font-size:24px; line-height:1; cursor:pointer; color:var(--dark-text-secondary); padding:4px; border-radius:50%; width:40px; height:40px; display:flex; align-items:center; justify-content:center; }
            .generator-close-button:hover { background-color:var(--dark-bg-tertiary); color:var(--dark-text-primary); }
            .generator-overlay-label { display:block; margin-bottom:8px; font-size:.8rem; font-weight:500; color:var(--dark-text-secondary); }
            .image-upload-section { margin-bottom:16px; padding:12px; border:1px dashed var(--dark-border); border-radius:calc(var(--ui-radius)/1.5); background-color:rgba(0,0,0,.1); }
            .image-upload-controls { display:flex; align-items:center; gap:10px; }
            #${IMAGE_INPUT_ID} { display:none; }
            .image-info-area { font-size:.85rem; color:var(--dark-text-secondary); font-style:italic; flex-grow:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; display:none; align-items:center; }
            #i2p-clear-image-btn .material-symbols-outlined { margin-right:3px; font-size:1em; }
            #${RESULT_TEXTAREA_ID} { width:100%; min-height:100px; height:140px; padding:12px 16px; border-radius:var(--ui-radius); border:1px solid var(--dark-border); background-color:var(--dark-bg-primary); margin-top:8px; font-size:.9rem; resize:vertical; line-height:1.5; color:var(--dark-text-primary); transition:border-color .2s ease; }
            #${RESULT_TEXTAREA_ID}:focus { outline:0; border-color:var(--dark-focus-border); }
            .overlay-message { display:none; padding:10px 12px; margin-bottom:16px; border-radius:calc(var(--ui-radius)/1.5); font-size:13px; line-height:1.4; border:1px solid transparent; }
            .message-info { background-color:rgba(138,180,248,.1); color:var(--dark-accent-blue); border-color:rgba(138,180,248,.3); }
            .message-success { background-color:rgba(129,230,134,.1); color:#81e686; border-color:rgba(129,230,134,.3); }
            .message-error { background-color:rgba(242,139,130,.1); color:var(--dark-accent-red); border-color:rgba(242,139,130,.3); }
            .generator-overlay-footer { display:flex; justify-content:space-between; align-items:center; gap:12px; padding:16px 24px; border-top:1px solid var(--dark-border); flex-shrink:0; }
            .generator-button-base { padding:10px 20px; border-radius:var(--ui-radius); border:none; cursor:pointer; font-size:.875rem; font-weight:500; transition:all .2s ease; min-height:40px; display:inline-flex; align-items:center; justify-content:center; gap:6px; }
            .generator-button-base:disabled { opacity:.6; cursor:not-allowed; transform:none; }
            .generator-button-base:hover:not(:disabled) { transform:translateY(-1px); }
            .generator-button-primary { background-color:var(--dark-bg-primary); color:var(--dark-text-primary); border:1px solid var(--dark-border); }
            .generator-button-primary:not(:disabled):hover { background-color:var(--dark-bg-tertiary); border-color:var(--dark-text-secondary); }
            .generator-button-secondary { background-color:transparent; color:var(--dark-text-secondary); border:1px solid transparent; }
            .generator-button-secondary:not(:disabled):hover { background-color:var(--dark-bg-tertiary); color:var(--dark-text-primary); }
        `);

        overlayBackdrop = document.createElement('div');
        overlayBackdrop.className = 'generator-backdrop';
        overlayBackdrop.addEventListener('click', closeOverlay);

        overlay = document.createElement('div');
        overlay.id = OVERLAY_ID;
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-labelledby', OVERLAY_TITLE_ID);

        // Header
        const overlayHeader = document.createElement('div');
        overlayHeader.className = 'generator-overlay-header';
        const headerTitle = document.createElement('h3');
        headerTitle.id = OVERLAY_TITLE_ID;
        headerTitle.textContent = OVERLAY_TITLE;
        closeButton = createModalButton('', ['generator-close-button', 'icon-only'], closeOverlay, 'close');
        closeButton.title = 'Close';
        overlayHeader.append(headerTitle, closeButton);

        // Content
        const overlayContent = document.createElement('div');
        overlayContent.className = 'generator-overlay-content';

        messageArea = document.createElement('div');
        messageArea.className = 'overlay-message';
        overlayContent.appendChild(messageArea);

        // Image Upload Section
        const imageUploadSection = document.createElement('div');
        imageUploadSection.className = 'image-upload-section';
        const imageUploadControls = document.createElement('div');
        imageUploadControls.className = 'image-upload-controls';
        imageFileInput = document.createElement('input');
        imageFileInput.type = 'file';
        imageFileInput.id = IMAGE_INPUT_ID;
        imageFileInput.accept = ALLOWED_IMAGE_TYPES.join(',');
        imageFileInput.addEventListener('change', handleFileSelect);
        uploadImageButton = createModalButton('Upload Image', ['generator-button-secondary'], () => imageFileInput.click(), 'upload_file');
        imageInfoArea = document.createElement('span');
        imageInfoArea.className = 'image-info-area';
        imageInfoArea.innerHTML = 'No image selected.';
        clearImageButton = createModalButton('Clear', ['generator-button-secondary'], clearSelectedImage, 'delete_outline');
        clearImageButton.id = 'i2p-clear-image-btn';
        clearImageButton.style.display = 'none';
        imageUploadControls.append(uploadImageButton, imageInfoArea, clearImageButton);
        imageUploadSection.appendChild(imageUploadControls);
        overlayContent.appendChild(imageUploadSection);

        // Result Section
        const resultLabel = document.createElement('label');
        resultLabel.className = 'generator-overlay-label';
        resultLabel.htmlFor = RESULT_TEXTAREA_ID;
        resultLabel.textContent = 'Generated Prompt';
        resultTextarea = document.createElement('textarea');
        resultTextarea.id = RESULT_TEXTAREA_ID;
        resultTextarea.readOnly = true;
        resultTextarea.setAttribute('placeholder', 'The generated prompt will appear here...');
        overlayContent.append(resultLabel, resultTextarea);

        // Footer and Buttons
        const overlayFooter = document.createElement('div');
        overlayFooter.className = 'generator-overlay-footer';
        copyButton = createModalButton(COPY_BUTTON_TEXT, ['generator-button-secondary'], handleCopyClick, 'content_copy');
        copyButton.disabled = true;
        generateApiButton = createModalButton(GENERATE_BUTTON_TEXT, ['generator-button-primary'], callApi, 'auto_awesome');
        generateApiButton.disabled = true;
        overlayFooter.append(copyButton, generateApiButton);

        overlay.append(overlayHeader, overlayContent, overlayFooter);
        document.body.append(overlayBackdrop, overlay);
        console.log("VideoFX Promptless Generator: UI creation complete.");
    };

    const initializeFab = () => {
        const fabContainer = document.createElement('div');
        fabContainer.id = FAB_CONTAINER_ID;
        const mainFab = createModalButton('Image-to-Prompt', ['vfx-fab-main'], openOverlay, 'image_search');
        fabContainer.append(mainFab);
        document.body.appendChild(fabContainer);
        console.log("VideoFX Promptless Generator: FAB Initialized.");
    };

    const initObserver = new MutationObserver((mutationsList, obs) => {
        const targetInput = document.querySelector('[aria-label="Enter a detailed description of your video"]');
        if (targetInput && !uiInitialized) {
            console.log("VideoFX Promptless Generator: Initializing via MutationObserver...");
            createUI(); initializeFab();
            obs.disconnect(); if (fallbackTimeoutId) clearTimeout(fallbackTimeoutId);
        }
    });

    const scriptVersion = (typeof GM_info !== 'undefined' && GM_info.script) ? GM_info.script.version : '1.0.0';
    console.log(`VideoFX Promptless Generator (v${scriptVersion}) script starting observer...`);
    initObserver.observe(document.body, { childList: true, subtree: true });

    const fallbackTimeoutId = setTimeout(() => {
        if (!uiInitialized) {
            console.warn(`Fallback init triggered after ${INIT_FALLBACK_DELAY}ms.`);
            initObserver.disconnect();
            createUI(); initializeFab();
        }
    }, INIT_FALLBACK_DELAY);

    function createIconSpanHTML(iconName) { return `<span class="material-symbols-outlined" aria-hidden="true">${iconName}</span>`; }
    (function (arr) { arr.forEach(function (item) { if (item.hasOwnProperty('append')) { return; } Object.defineProperty(item, 'append', { configurable: true, enumerable: true, writable: true, value: function append() { var argArr = Array.prototype.slice.call(arguments), docFrag = document.createDocumentFragment(); argArr.forEach(function (argItem) { var isNode = argItem instanceof Node; docFrag.appendChild(isNode ? argItem : document.createTextNode(String(argItem))); }); this.appendChild(docFrag); } }); });})([Element.prototype, Document.prototype, DocumentFragment.prototype]);
})();
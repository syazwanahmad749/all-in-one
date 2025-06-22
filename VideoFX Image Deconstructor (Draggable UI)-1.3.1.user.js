// ==UserScript==
// @name VideoFX Image Deconstructor (Draggable UI)
// @namespace https://labs.google/
// @version 1.3.1
// @description Deconstructs an image into Scene, Subject, and Style descriptions. UI is now draggable.
// @author Your Name & Gemini (fixed by AI)
// @match https://labs.google/fx/*
// @grant GM_addStyle
// @grant GM_setClipboard
// @grant GM_xmlhttpRequest
// @run-at document-end
// ==/UserScript==

(function () {
'use strict';

// --- Configuration ---
const API_ENDPOINT = "https://labs.google/fx/api/trpc/backbone.captionImage";
const OVERLAY_TITLE = 'Image Deconstructor';
const OVERLAY_ID = 'vfx-decon-overlay';
const OVERLAY_TITLE_ID = 'vfx-decon-title';
const IMAGE_INPUT_ID = 'decon-image-input';
const GENERATE_BUTTON_TEXT = 'Deconstruct Image';
const GENERATING_BUTTON_TEXT = 'Deconstructing...';
const COPY_BUTTON_TEXT = 'Copy';
const COPIED_BUTTON_TEXT = 'Copied!';
const INIT_FALLBACK_DELAY = 7000;
const FAB_CONTAINER_ID = 'vfx-decon-fab-container';
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const MEDIA_CATEGORIES = ['MEDIA_CATEGORY_SCENE', 'MEDIA_CATEGORY_SUBJECT', 'MEDIA_CATEGORY_STYLE'];

// --- DOM Element Variables ---
let overlay, overlayBackdrop, generateApiButton, closeButton, messageArea;
let uiInitialized = false;
let imageFileInput, uploadImageButton, imageInfoArea, clearImageButton;
let selectedImageFullDataUrl = null;
let resultTextareas = {};

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

function makeDraggable(elmnt, handle) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    const dragHandle = handle || elmnt;

    dragHandle.style.cursor = 'move';
    dragHandle.onmousedown = dragMouseDown;

    function dragMouseDown(e) {
        e = e || window.event;
        e.preventDefault(); // prevent default dragging of selected text
        pos3 = e.clientX;
        pos4 = e.clientY;

        // If the element is centered via transform, calculate its initial
        // pixel-based top/left and switch to that for smooth dragging.
        const computedStyle = window.getComputedStyle(elmnt);
        if (computedStyle.transform !== 'none' && computedStyle.position === 'fixed') {
            const rect = elmnt.getBoundingClientRect();
            elmnt.style.left = rect.left + 'px';
            elmnt.style.top = rect.top + 'px';
            elmnt.style.transform = 'none';
        }

        document.onmouseup = closeDragElement;
        document.onmousemove = elementDrag;
    }

    function elementDrag(e) {
        e = e || window.event;
        e.preventDefault();
        // calculate the new cursor position:
        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        pos3 = e.clientX;
        pos4 = e.clientY;
        // set the element's new position:
        elmnt.style.top = (elmnt.offsetTop - pos2) + "px";
        elmnt.style.left = (elmnt.offsetLeft - pos1) + "px";
    }

    function closeDragElement() {
        // stop moving when mouse button is released:
        document.onmouseup = null;
        document.onmousemove = null;
    }
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
         if (!classes.includes('decon-button-base')) { classes.unshift('decon-button-base'); }
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
    if (type !== 'error') { setTimeout(clearMessage, 4000); }
};

const clearMessage = () => {
    if (!messageArea) return;
    messageArea.textContent = '';
    messageArea.style.display = 'none';
};

const setLoadingState = (isLoading) => {
    if (!generateApiButton) return;
    generateApiButton.disabled = isLoading;
    const iconHTML = isLoading ? createIconSpanHTML('hourglass_top') : createIconSpanHTML('auto_awesome');
    generateApiButton.innerHTML = iconHTML + (isLoading ? GENERATING_BUTTON_TEXT : GENERATE_BUTTON_TEXT);
    generateApiButton.style.cursor = isLoading ? 'wait' : 'pointer';
};

const handleFileSelect = (event) => {
    // FIX: Get the FileList from the event.
    const files = event.target.files;

    // FIX: Check if a file was actually selected. `files` is a list.
    if (!files || files.length === 0) {
        console.log("No file selected.");
        return; // User likely cancelled the dialog
    }

    // FIX: Get the individual File object from the list.
    const file = files[0];

    // --- Validation ---
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        showMessage(`Invalid file type. Allowed: ${ALLOWED_IMAGE_TYPES.map(t=>t.split('/')[1]).join(', ')}.`, 'error');
        clearSelectedImage();
        return;
    }
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
         showMessage(`Image is too large. Max ${MAX_IMAGE_SIZE_BYTES/(1024*1024)}MB.`, 'error');
         clearSelectedImage();
         return;
    }

    // --- File Reading ---
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            selectedImageFullDataUrl = e.target.result;
            if (!selectedImageFullDataUrl) throw new Error("Could not read image data.");

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

            showMessage('Image selected. Ready to deconstruct.', 'info');
        } catch (err) {
            console.error("Error processing image:", err);
            showMessage(`Error processing image: ${err.message}`, 'error');
            clearSelectedImage();
        }
    };
    reader.onerror = (err) => {
        console.error("FileReader error:", err);
        showMessage('Error reading file.', 'error');
        clearSelectedImage();
    };
    reader.readAsDataURL(file); // Read the correct File object
};


const clearSelectedImage = () => {
    selectedImageFullDataUrl = null;
    if (imageFileInput) imageFileInput.value = ''; // Reset file input
    if (imageInfoArea) { imageInfoArea.innerHTML = 'No image selected.'; imageInfoArea.style.display = 'none'; }
    if (clearImageButton) clearImageButton.style.display = 'none';
    if (uploadImageButton) uploadImageButton.style.display = 'inline-flex';
    if (generateApiButton) generateApiButton.disabled = true;
    Object.values(resultTextareas).forEach(item => {
        item.textarea.value = '';
        item.copyButton.disabled = true;
    });
};

const callApi = async () => {
    if (!selectedImageFullDataUrl) {
        showMessage("Please upload an image first.", 'error');
        return;
    }

    setLoadingState(true);
    clearMessage();
    Object.values(resultTextareas).forEach(item => {
        item.textarea.value = 'Generating...';
        item.copyButton.disabled = true;
    });

    const headers = { "Content-Type": "application/json", "Accept": "*/*" };
    const clientContext = {
        sessionId: `/aitk-web/videofx-tt;${Date.now()}`,
        workflowId: `decon-${Date.now()}`
    };

    const apiPromises = MEDIA_CATEGORIES.map(category => {
        const jsonPayload = {
            clientContext: clientContext,
            captionInput: {
                candidatesCount: 1,
                mediaInput: {
                    mediaCategory: category,
                    rawBytes: selectedImageFullDataUrl
                }
            }
        };
        const body = JSON.stringify({ json: jsonPayload });
        console.log(`Requesting for category: ${category}`);
        return gmFetch(API_ENDPOINT, { method: 'POST', headers: headers, body: body });
    });

    const results = await Promise.allSettled(apiPromises);

    results.forEach(async (result, index) => {
        const category = MEDIA_CATEGORIES[index].split('_').pop();
        const categoryKey = category.toLowerCase();
        const { textarea, copyButton } = resultTextareas[categoryKey];

        if (result.status === 'fulfilled') {
            const response = result.value;
            const data = await response.json();
            console.log(`Response for ${category}:`, data);

            if (response.ok) {
                const candidates = data?.result?.data?.json?.result?.candidates;
                // FIX: Access the 'output' property of the *first element* in the candidates array.
                const caption = (Array.isArray(candidates) && candidates.length > 0) ? candidates[0]?.output : null;

                if (caption) {
                    textarea.value = caption;
                    copyButton.disabled = false;
                } else {
                    // NOTE: Added more specific error message and console log for easier debugging.
                    textarea.value = "Error: Could not find a valid caption in API response.";
                    console.warn(`Could not extract caption for category '${category}'. Full response:`, data);
                }
            } else {
                const errorMsg = data?.error?.json?.message || `API Error: ${response.status}`;
                textarea.value = `Error: ${errorMsg}`;
            }
        } else {
            textarea.value = `Error: ${result.reason.message}`;
            console.error(`Request failed for ${category}:`, result.reason);
        }
    });

    showMessage("Deconstruction complete.", "success");
    setLoadingState(false);
};

const openOverlay = () => {
    if (overlay) { // Reset position to center every time it's opened.
        overlay.style.top = '50%';
        overlay.style.left = '50%';
        overlay.style.transform = 'translate(-50%,-50%) scale(.95)';
    }
    clearMessage();
    // NOTE: Don't clear the image on open, user might want to re-run. Clear it on successful generation or manually.
    // clearSelectedImage(); // This was moved to a manual button for better UX.
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

const handleCopyClick = async (textarea, button) => {
    if (!textarea.value || textarea.value.startsWith('Error:') || textarea.value === 'Generating...') {
        showMessage("Nothing valid to copy.", "info");
        return;
    }
    try {
        GM_setClipboard(textarea.value, 'text');
        const originalHTML = button.innerHTML;
        button.innerHTML = createIconSpanHTML('task_alt') + COPIED_BUTTON_TEXT;
        button.disabled = true;
        showMessage(`${textarea.previousSibling.textContent.trim()} copied!`, "success");
        setTimeout(() => {
            button.innerHTML = originalHTML;
            button.disabled = false;
        }, 2000);
    } catch (err) {
        showMessage("Failed to copy. Check console.", "error");
        console.error('GM_setClipboard error: ', err);
    }
};

function createIconSpanHTML(iconName) {
    return `<span class="material-symbols-outlined" aria-hidden="true">${iconName}</span>`;
}

const createUI = () => {
    if (uiInitialized) return;
    uiInitialized = true;
    console.log("VideoFX Image Deconstructor: Initializing UI...");

    GM_addStyle(`
        :root { --google-font: 'Google Sans Text', 'Google Sans', Roboto, sans-serif; --dark-bg-primary: #1f1f1f; --dark-bg-secondary: #2d2d2d; --dark-bg-tertiary: #3f3f3f; --dark-text-primary: #e8eaed; --dark-text-secondary: #bdc1c6; --dark-border: #4a4a4a; --dark-focus-border: #a0a0a0; --dark-error-border: #f28b82; --fab-main-bg: #8e44ad; --fab-main-hover: #9b59b6; --fab-icon-color: #ffffff; --dark-accent-blue: #8ab4f8; --dark-accent-red: #f28b82; --ui-radius: 18px; --shadow-color: rgba(0,0,0,0.35); --scroll-thumb: #5f6368; --scroll-track: var(--dark-bg-tertiary); }
        .material-symbols-outlined { font-variation-settings: 'FILL'0,'wght'400,'GRAD'0,'opsz'24; font-size:1.2em; vertical-align:middle; line-height:1; margin-right:5px; margin-left:-3px; }
        .decon-close-button .material-symbols-outlined { margin:0; font-size:24px; }
        .decon-button-base.icon-only .material-symbols-outlined { margin:0; }
        #${OVERLAY_ID}, #${FAB_CONTAINER_ID} button, #${OVERLAY_ID} textarea { font-family:var(--google-font); box-sizing: border-box; }
        #${FAB_CONTAINER_ID} { position:fixed; top: 20px; right: 20px; z-index:9990; }
        #${FAB_CONTAINER_ID} .vfx-fab-main { border:none; border-radius:16px; box-shadow:0 2px 6px 2px var(--shadow-color); cursor:pointer; transition:all .2s ease-out; font-weight:500; display:flex; align-items:center; justify-content:center; width:auto; height:56px; padding: 0 20px; background-color:var(--fab-main-bg); color:var(--fab-icon-color); }
        #${FAB_CONTAINER_ID} .vfx-fab-main:hover:not(:disabled) { box-shadow:0 4px 8px 3px var(--shadow-color); background-color:var(--fab-main-hover); }
        .decon-backdrop { display:none; position:fixed; top:0; left:0; width:100%; height:100%; background-color:rgba(0,0,0,.6); z-index:9998; opacity:0; transition:opacity .25s ease-out; }
        #${OVERLAY_ID} { display:none; flex-direction:column; position:fixed; top:50%; left:50%; transform:translate(-50%,-50%) scale(.95); background-color:var(--dark-bg-secondary); color:var(--dark-text-primary); padding:0; border-radius:var(--ui-radius); box-shadow:0 6px 12px var(--shadow-color); z-index:9999; width:clamp(500px, 60%, 750px); border:1px solid var(--dark-border); max-height:90vh; opacity:0; transition:opacity .2s ease-out,transform .2s ease-out; }
        #${OVERLAY_ID}.visible { opacity:1; transform:translate(-50%,-50%) scale(1); }
        #${OVERLAY_ID} .decon-overlay-content { padding:20px 24px; overflow-y:auto; flex-grow:1; display: flex; flex-direction: column; gap: 16px; }
        .decon-overlay-header { display:flex; justify-content:space-between; align-items:center; padding:16px 24px; border-bottom:1px solid var(--dark-border); flex-shrink:0; cursor: move; }
        .decon-overlay-header h3 { margin:0; font-size:1.1rem; font-weight:500; }
        .decon-close-button { background:0 0; border:none; color:var(--dark-text-secondary); cursor:pointer; width:40px; height:40px; border-radius:50%; display:flex; align-items:center; justify-content:center; }
        .decon-close-button:hover { background-color:var(--dark-bg-tertiary); color:var(--dark-text-primary); }
        .decon-overlay-label { display:block; margin-bottom:4px; font-size:.8rem; font-weight:500; color:var(--dark-text-secondary); }
        .image-upload-section { padding:12px; border:1px dashed var(--dark-border); border-radius:calc(var(--ui-radius)/1.5); background-color:rgba(0,0,0,.1); }
        .image-upload-controls { display:flex; align-items:center; gap:10px; }
        #${IMAGE_INPUT_ID} { display:none; }
        .image-info-area { font-size:.85rem; color:var(--dark-text-secondary); font-style:italic; flex-grow:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; display:none; align-items:center; }
        .result-textarea { width:100%; min-height:60px; height:70px; padding:8px 12px; border-radius: 12px; border:1px solid var(--dark-border); background-color:var(--dark-bg-primary); font-size:.9rem; resize:vertical; line-height:1.5; color:var(--dark-text-primary); }
        .result-container { display:flex; flex-direction:column; }
        .result-header { display:flex; justify-content:space-between; align-items:center; margin-bottom: 4px; }
        .result-header .decon-button-base { padding: 4px 10px; min-height: 28px; font-size: 0.75rem; border-radius: 12px; }
        .overlay-message { padding:10px 12px; border-radius:calc(var(--ui-radius)/1.5); font-size:13px; line-height:1.4; border:1px solid transparent; margin: -8px 0 8px 0; display:none; }
        .message-info { background-color:rgba(138,180,248,.1); color:var(--dark-accent-blue); border-color:rgba(138,180,248,.3); }
        .message-success { background-color:rgba(129,230,134,.1); color:#81e686; border-color:rgba(129,230,134,.3); }
        .message-error { background-color:rgba(242,139,130,.1); color:var(--dark-accent-red); border-color:rgba(242,139,130,.3); }
        .decon-overlay-footer { display:flex; justify-content:flex-end; padding:16px 24px; border-top:1px solid var(--dark-border); flex-shrink:0; }
        .decon-button-base { padding:10px 20px; border-radius:var(--ui-radius); border:none; cursor:pointer; font-size:.875rem; font-weight:500; transition:all .2s ease; min-height:40px; display:inline-flex; align-items:center; justify-content:center; gap:6px; }
        .decon-button-base:disabled { opacity:.6; cursor:not-allowed; transform:none; }
        .decon-button-base:hover:not(:disabled) { transform:translateY(-1px); }
        .decon-button-primary { background-color:var(--dark-bg-primary); color:var(--dark-text-primary); border:1px solid var(--dark-border); }
        .decon-button-primary:not(:disabled):hover { background-color:var(--dark-bg-tertiary); border-color:var(--dark-text-secondary); }
        .decon-button-secondary { background-color:transparent; color:var(--dark-text-secondary); border:1px solid transparent; }
        .decon-button-secondary:not(:disabled):hover { background-color:var(--dark-bg-tertiary); color:var(--dark-text-primary); }
    `);

    overlayBackdrop = document.createElement('div');
    overlayBackdrop.className = 'decon-backdrop';
    overlayBackdrop.addEventListener('click', closeOverlay);

    overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', OVERLAY_TITLE_ID);

    const overlayHeader = document.createElement('div');
    overlayHeader.className = 'decon-overlay-header';
    const headerTitle = document.createElement('h3');
    headerTitle.id = OVERLAY_TITLE_ID;
    headerTitle.textContent = OVERLAY_TITLE;
    closeButton = createModalButton('', ['decon-close-button', 'icon-only'], closeOverlay, 'close');
    overlayHeader.append(headerTitle, closeButton);
    makeDraggable(overlay, overlayHeader);

    const overlayContent = document.createElement('div');
    overlayContent.className = 'decon-overlay-content';

    messageArea = document.createElement('div');
    messageArea.className = 'overlay-message';
    overlayContent.appendChild(messageArea);

    const imageUploadSection = document.createElement('div');
    imageUploadSection.className = 'image-upload-section';
    const imageUploadControls = document.createElement('div');
    imageUploadControls.className = 'image-upload-controls';
    imageFileInput = document.createElement('input');
    imageFileInput.type = 'file';
    imageFileInput.id = IMAGE_INPUT_ID;
    imageFileInput.accept = ALLOWED_IMAGE_TYPES.join(',');
    imageFileInput.addEventListener('change', handleFileSelect);
    uploadImageButton = createModalButton('Upload Image', ['decon-button-secondary'], () => imageFileInput.click(), 'upload_file');
    imageInfoArea = document.createElement('span');
    imageInfoArea.className = 'image-info-area';
    clearImageButton = createModalButton('', ['decon-button-secondary', 'icon-only'], clearSelectedImage, 'delete_outline');
    clearImageButton.title = 'Clear selected image';
    clearImageButton.style.display = 'none';
    imageUploadControls.append(uploadImageButton, imageInfoArea, clearImageButton);
    imageUploadSection.appendChild(imageUploadControls);
    overlayContent.appendChild(imageUploadSection);

    MEDIA_CATEGORIES.forEach(categoryString => {
        const categoryName = categoryString.split('_').pop();
        const key = categoryName.toLowerCase();
        const container = document.createElement('div');
        container.className = 'result-container';
        const header = document.createElement('div');
        header.className = 'result-header';
        const label = document.createElement('label');
        label.className = 'decon-overlay-label';
        label.setAttribute('for', `decon-textarea-${key}`);
        label.textContent = categoryName.charAt(0).toUpperCase() + categoryName.slice(1);
        const textarea = document.createElement('textarea');
        textarea.id = `decon-textarea-${key}`;
        textarea.className = 'result-textarea';
        textarea.readOnly = true;
        textarea.setAttribute('placeholder', `Awaiting deconstruction...`);
        const copyBtn = createModalButton(COPY_BUTTON_TEXT, ['decon-button-secondary'], null, 'content_copy');
        copyBtn.disabled = true;
        copyBtn.onclick = () => handleCopyClick(textarea, copyBtn);
        header.append(label, copyBtn);
        container.append(header, textarea);
        overlayContent.appendChild(container);
        resultTextareas[key] = { textarea, copyButton: copyBtn };
    });

    const overlayFooter = document.createElement('div');
    overlayFooter.className = 'decon-overlay-footer';
    generateApiButton = createModalButton(GENERATE_BUTTON_TEXT, ['decon-button-primary'], callApi, 'auto_awesome');
    generateApiButton.disabled = true;
    overlayFooter.appendChild(generateApiButton);

    overlay.append(overlayHeader, overlayContent, overlayFooter);
    document.body.append(overlayBackdrop, overlay);

    // Set initial state
    clearSelectedImage();

    console.log("VideoFX Image Deconstructor: UI creation complete.");
};

const initializeFab = () => {
    // Avoid re-creating the FAB if script runs multiple times
    if (document.getElementById(FAB_CONTAINER_ID)) return;
    const fabContainer = document.createElement('div');
    fabContainer.id = FAB_CONTAINER_ID;
    const mainFab = createModalButton('Image Deconstructor', ['vfx-fab-main'], openOverlay, 'splitscreen');
    fabContainer.append(mainFab);
    makeDraggable(fabContainer, mainFab); // Make the button itself the drag handle
    document.body.appendChild(fabContainer);
    console.log("VideoFX Image Deconstructor: FAB Initialized.");
};

const initObserver = new MutationObserver((mutationsList, obs) => {
    // NOTE: This selector is a good candidate for the main app UI being ready.
    const targetInput = document.querySelector('[aria-label="Enter a detailed description of your video"]');
    if (targetInput && !uiInitialized) {
        console.log("VideoFX Image Deconstructor: Initializing via MutationObserver...");
        createUI();
        initializeFab();
        obs.disconnect();
        if (fallbackTimeoutId) clearTimeout(fallbackTimeoutId);
    }
});

const scriptVersion = (typeof GM_info !== 'undefined' && GM_info.script) ? GM_info.script.version : '1.3.1';
console.log(`VideoFX Image Deconstructor (v${scriptVersion}) script starting observer...`);
initObserver.observe(document.body, { childList: true, subtree: true });

const fallbackTimeoutId = setTimeout(() => {
    if (!uiInitialized) {
        console.warn(`Fallback init triggered after ${INIT_FALLBACK_DELAY/1000}s. The page might have changed, or is loading very slowly.`);
        initObserver.disconnect();
        createUI();
        initializeFab();
    }
}, INIT_FALLBACK_DELAY);

// Polyfill for Element.append() for compatibility.
(function (arr) { arr.forEach(function (item) { if (item.hasOwnProperty('append')) { return; } Object.defineProperty(item, 'append', { configurable: true, enumerable: true, writable: true, value: function append() { var argArr = Array.prototype.slice.call(arguments), docFrag = document.createDocumentFragment(); argArr.forEach(function (argItem) { var isNode = argItem instanceof Node; docFrag.appendChild(isNode ? argItem : document.createTextNode(String(argItem))); }); this.appendChild(docFrag); } }); });})([Element.prototype, Document.prototype, DocumentFragment.prototype]);

})();
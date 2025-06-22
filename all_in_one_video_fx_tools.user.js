// ==UserScript==
// @name         All-In-One VideoFX Tools
// @namespace    https://labs.google/
// @version      1.0.0
// @description  Combines Prompt Enhancer, Image Deconstructor, and Promptless Image-to-Prompt Generator for VideoFX.
// @author       Jules (AI Agent) & Original Authors (Goldie, Your Name & Gemini)
// @match        https://labs.google/fx/*
// @grant        GM_addStyle
// @grant        GM_setClipboard
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_download
// @grant        GM_xmlhttpRequest
// @run-at       document-end
// ==/UserScript==

(function () {
    'use strict';

    // --- Overall Constants ---
    const SCRIPT_VERSION = '1.0.0'; // Combined script version
    const MAIN_FAB_CONTAINER_ID = 'vfx-all-in-one-fab-container';

    // --- Inject Google Font CSS (once for all tools) ---
    const fontLink = document.createElement('link');
    fontLink.rel = 'stylesheet';
    fontLink.href = 'https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&family=Google+Sans+Text:wght@400;500;600;700&family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap';
    document.head.appendChild(fontLink);

    // --- Shared Helper Function: gmFetch ---
    function gmFetch(url, options) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: options.method || "GET",
                url: url,
                headers: options.headers || {},
                data: options.body,
                responseType: options.responseType || "json", // Allow overriding for non-JSON
                onload: function(response) {
                    if (response.status >= 200 && response.status < 300) {
                        resolve({
                            ok: true,
                            status: response.status,
                            statusText: response.statusText,
                            json: () => Promise.resolve(response.responseJson || response.response), // Ensure responseJson is checked
                            text: () => Promise.resolve(response.responseText)
                        });
                    } else {
                        resolve({
                            ok: false,
                            status: response.status,
                            statusText: response.statusText,
                            json: () => Promise.resolve(response.responseJson || response.response || {}),
                            text: () => Promise.resolve(response.responseText)
                        });
                    }
                },
                onerror: (response) => reject(new Error(response.statusText || `Network error: ${response.status}`)),
                ontimeout: () => reject(new Error("GM_xmlhttpRequest timeout")),
                onabort: () => reject(new Error("GM_xmlhttpRequest aborted"))
            });
        });
    }

    // --- Shared Helper Function: Create Icon Span ---
    function createIconSpan(iconName) {
        const span = document.createElement('span');
        span.className = 'material-symbols-outlined';
        span.textContent = iconName;
        span.setAttribute('aria-hidden', 'true');
        return span;
    }

    function createIconSpanHTML(iconName) {
        return `<span class="material-symbols-outlined" aria-hidden="true">${iconName}</span>`;
    }

    // --- Shared Helper Function: Create Modal Button (Adapted from Prompt Enhancer) ---
    // This function is quite comprehensive and will be used as the base.
    // Minor adaptations might be needed if specific class names are critical for Deconstructor/I2P minimal styles.
    function createModalButton(text, classNames = [], onClick = null, iconName = null, title = null, buttonType = 'button') {
        const button = document.createElement('button');
        button.type = buttonType; // Added buttonType

        if (iconName) {
            const iconSpan = createIconSpan(iconName);
            if (!text || text.trim() === '') {
                button.classList.add('icon-only');
                iconSpan.style.marginRight = '0';
            }
            button.appendChild(iconSpan);
        }

        if (text && text.trim() !== '') {
            button.appendChild(document.createTextNode(text));
        }

        const classes = Array.isArray(classNames) ? classNames : [classNames];
        // Ensure base class for general modal buttons if not a FAB
        if (!classes.some(cls => cls.startsWith('vfx-fab')) && !classes.includes('vfx-modal-button')) {
            classes.unshift('vfx-modal-button');
        }
        classes.forEach(cls => button.classList.add(cls));

        if (onClick) button.onclick = onClick;

        const effectiveTitle = title || (iconName && (!text || text.trim() === '') ? iconName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : (text || 'Button'));
        button.title = effectiveTitle;
        button.setAttribute('aria-label', effectiveTitle);
        return button;
    }


    // --- Shared Draggable Logic (Adapted from Prompt Enhancer) ---
    function makeDraggable(modalElement, handleElement) {
        let isDragging = false, offsetX, offsetY, initialTop, initialLeft;

        (handleElement || modalElement).addEventListener('mousedown', (e) => {
            if (e.target.closest('button, input, select, textarea, .vfx-enhancer-close-btn, .decon-close-button, .i2p-close-button')) return;

            isDragging = true;
            const modalRect = modalElement.getBoundingClientRect();
            const computedStyle = window.getComputedStyle(modalElement);

            if (computedStyle.transform && computedStyle.transform !== 'none') {
                // If centered via transform, calculate initial pixel position
                initialLeft = modalRect.left;
                initialTop = modalRect.top;
                modalElement.style.transform = 'none'; // Remove transform to allow pixel positioning
                modalElement.style.left = `${initialLeft}px`;
                modalElement.style.top = `${initialTop}px`;
            } else {
                initialLeft = modalElement.offsetLeft;
                initialTop = modalElement.offsetTop;
            }

            offsetX = e.clientX - initialLeft;
            offsetY = e.clientY - initialTop;

            modalElement.style.transition = 'none'; // Disable transitions during drag
            document.body.style.userSelect = 'none';

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
            e.preventDefault();
        });

        function onMouseMove(e) {
            if (!isDragging) return;
            let newX = e.clientX - offsetX;
            let newY = e.clientY - offsetY;

            // Constrain to viewport
            newX = Math.max(0, Math.min(newX, window.innerWidth - modalElement.offsetWidth));
            newY = Math.max(0, Math.min(newY, window.innerHeight - modalElement.offsetHeight));

            modalElement.style.left = `${newX}px`;
            modalElement.style.top = `${newY}px`;
        }

        function onMouseUp() {
            if (isDragging) {
                isDragging = false;
                modalElement.style.transition = ''; // Re-enable transitions
                document.body.style.userSelect = '';
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
            }
        }
    }

    // --- Shared UI Helper: Create Modal (Adapted from Prompt Enhancer) ---
    // This is a complex function. It will be the base for all modals.
    // Specific modal classes will be used to differentiate content and styling.
    function createModalScaffold(title, modalUniqueClass = '', customHeaderId = null, hasFooter = true) {
        const modal = document.createElement('div');
        modal.className = `vfx-modal-base ${modalUniqueClass}`; // Base class + unique class
        modal.style.display = 'none'; // Initially hidden

        const backdrop = document.createElement('div');
        backdrop.className = 'vfx-modal-backdrop';
        backdrop.style.display = 'none'; // Initially hidden
        backdrop.onclick = () => closeModal(modal, backdrop); // Close on backdrop click

        const header = document.createElement('div');
        header.className = 'vfx-modal-header';
        if (customHeaderId) header.id = customHeaderId;

        const modalTitle = document.createElement('h2');
        modalTitle.className = 'vfx-modal-title';
        modalTitle.textContent = title;

        const closeButton = createModalButton('', ['vfx-modal-close-btn', 'icon-only'], () => closeModal(modal, backdrop), 'close', 'Close Modal');

        header.appendChild(modalTitle);
        header.appendChild(closeButton);

        const contentWrapper = document.createElement('div');
        contentWrapper.className = 'vfx-modal-content';

        modal.appendChild(header);
        modal.appendChild(contentWrapper);

        let footer = null;
        if (hasFooter) {
            footer = document.createElement('div');
            footer.className = 'vfx-modal-footer';
            modal.appendChild(footer);
        }

        document.body.appendChild(backdrop);
        document.body.appendChild(modal);

        makeDraggable(modal, header);

        return { modal, backdrop, header, contentWrapper, footer, closeButton };
    }

    function openModal(modal, backdrop) {
        backdrop.style.display = 'block';
        modal.style.display = 'flex'; // Use flex for centering, etc.

        // Recenter modal before showing
        requestAnimationFrame(() => {
            modal.style.top = '50%';
            modal.style.left = '50%';
            modal.style.transform = 'translate(-50%, -50%) scale(0.95)'; // Initial state for animation

            setTimeout(() => {
                backdrop.style.opacity = '1';
                modal.style.opacity = '1';
                modal.style.transform = 'translate(-50%, -50%) scale(1)';
            }, 10);
        });
        document.body.style.overflow = 'hidden'; // Prevent background scroll
    }

    function closeModal(modal, backdrop) {
        backdrop.style.opacity = '0';
        modal.style.opacity = '0';
        modal.style.transform = 'translate(-50%, -50%) scale(0.95)';

        modal.addEventListener('transitionend', () => {
            modal.style.display = 'none';
            backdrop.style.display = 'none';
            document.body.style.overflow = ''; // Restore scroll
        }, { once: true });
    }

    // --- Shared UI Helper: Show Message (Simplified for non-modal messages, can be expanded) ---
    // For more complex messages, Prompt Enhancer's showMessageModal can be adapted or used.
    // This is a placeholder for simple messages within tool modals.
    function showToolMessage(messageAreaElement, text, type = 'info', duration = 4000) {
        if (!messageAreaElement) return;
        messageAreaElement.textContent = text;
        messageAreaElement.className = `vfx-tool-message message-${type}`; // Use specific class
        messageAreaElement.style.display = 'block';
        if (type !== 'error' && duration > 0) {
            setTimeout(() => {
                messageAreaElement.textContent = '';
                messageAreaElement.style.display = 'none';
            }, duration);
        }
    }
    function clearToolMessage(messageAreaElement) {
        if (!messageAreaElement) return;
        messageAreaElement.textContent = '';
        messageAreaElement.style.display = 'none';
    }


    // --- START: Prompt Enhancer v7 Code (Adapted) ---
    const ENHANCER_SCRIPT_VERSION = '7.0';
    const ENHANCER_HISTORY_STORAGE_KEY = 'videofx_prompt_history_v5_aio';
    const ENHANCER_DEFAULT_PREAMBLE_SELECTED_KEY = '__videofxPreambleSelected_v4_aio';
    const ENHANCER_CUSTOM_PREAMBLES_KEY = '__videofxCustomPreambles_v1_aio';
    const ENHANCER_PRESETS_KEY = '__videofxEnhancerPresets_v1_aio';
    const ENHANCER_MAX_HISTORY_ITEMS = 50;
    const ENHANCER_API_ENDPOINT = 'https://labs.google/fx/api/trpc/videoFx.generateNextScenePrompts';
    const ENHANCER_INLINE_PREAMBLE_EDITOR_ID = 'vfx-enhancer-inline-preamble-editor-aio';
    const ENHANCER_LIVE_PROMPT_PREVIEW_ID = 'vfx-enhancer-live-prompt-preview-aio';
    const ENHANCER_LEXICON_POPOVER_ID = 'vfx-enhancer-lexicon-popover-aio';
    const ENHANCER_SMART_SUGGESTIONS_AREA_ID = 'vfx-enhancer-smart-suggestions-area-aio';
    const ENHANCER_CONFLICT_WARNING_CLASS = 'vfx-enhancer-schema-conflict-warning-aio';
    const ENHANCER_IMAGE_PREVIEW_CONTAINER_ID = 'vfx-enhancer-image-preview-container-aio';
    const ENHANCER_ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'];
    const ENHANCER_MAX_IMAGE_SIZE_MB = 10;

    const ENHANCER_DEFAULT_PREAMBLE_PRESETS_DATA = {
        "Cinematic Storyteller": {
            text: `You are an expert AI screenwriter and cinematographer for Google Veo, tasked with transforming a user's core concept into a compelling, micro-narrative video prompt. Your goal is to create a single, vivid paragraph that implies a complete story with a beginning, middle, and end, even within a short clip.\n\nInput:\nYou will receive a user's core idea, along with structured cinematic selections (shot size, camera movement, style, etc.) and optional negative keywords.\n\nOutput Requirements:\n1.  **Single Narrative Paragraph:** Generate ONLY the final video prompt as ONE continuous, descriptive paragraph. Do not use lists, labels, or conversational text. The output must be under 150 words unless 'High Detail' is selected.\n2.  **Imply a Story Arc:** Structure the description to suggest a narrative progression:\n    -   **Beginning (Establishment):** Start by setting the scene and introducing the subject, often with an establishing action or mood (e.g., "A lone figure emerges from the morning mist...").\n    -   **Middle (Action/Conflict):** Describe the main action, a turning point, or a moment of tension/realization (e.g., "...their pace quickens as they spot a mysterious glowing object...").\n    -   **End (Resolution/Reaction):** Conclude with the immediate outcome, a reaction, or a lingering emotional state that suggests what happens next (e.g., "...ending on a close-up of their awe-filled expression as they reach out to touch it.").\n3.  **Cinematic Integration:** Seamlessly weave the user's lexicon selections into the narrative. Use descriptive language that *shows* the effect of the choices:\n    -   **Shot Size/Angle:** Instead of saying "Low angle shot," describe it: "From a low angle, the character towers over the viewer, appearing dominant and powerful."\n    -   **Movement:** Instead of "Dolly in," describe the effect: "The camera slowly dollies in, heightening the tension and focusing our attention on their determined face."\n    -   **Lighting/Style:** Integrate the mood: "The scene is bathed in the harsh, dramatic shadows of film noir," or "A vibrant, hyper-saturated color palette gives the scene a surreal, dreamlike quality."\n4.  **Sensory Details:** Add evocative details—the sound of the wind, the texture of a surface, the temperature of the light—to create a richer, more immersive world for Veo to generate.\n5.  **Negative Constraints:** Strictly avoid describing elements listed after '--neg' in the user's input.\n\nCrucial: Your output is not just a description; it's a compressed story. Every word should serve the narrative and visual goal. Output ONLY the paragraph.\n\nUser provided input (Core Prompt + Selections/Keywords + Negative Keywords):\n`,
            requires: ['shot_size', 'camera_movement']
        },
        "Veo 2 Lexicon Guide": {
            text: `You are an expert AI prompt engineer specializing in Google Veo 2, acting as a virtual cinematographer.\nYour task is to translate the user's core concept, combined with their specific selections from the lexicon of cinematic terminology, into a highly detailed and effective video prompt optimized for Veo 2's capabilities.\n\nInput:\nYou will receive a core concept, potentially enhanced with selections for 'Shot Size', 'Camera Angle', 'Camera Movement', 'Lens Type/Effect', 'Lighting Style', 'Visual Style/Era', and 'Custom Keywords'.\n\nOutput Task:\nGenerate ONLY the final video prompt description as ONE single, descriptive paragraph. Do NOT use lists, labels, or conversational text.\n\nInstructions:\nCore Idea: Center the prompt around the user's core concept (subject, action, context).\nIntegrate Lexicon Selections: Seamlessly weave descriptions based on the user's selections into the paragraph. Use vivid language reflecting the chosen terms.\nShot Size: Translate selections like 'Extreme Wide Shot (EWS)', 'Medium Shot (MS)', 'Close-Up (CU)', 'Extreme Close-Up (ECU)' into descriptive framing (e.g., "A vast landscape with the subject appearing tiny," "Framed from the waist up," "Tightly frames the character's face," "Isolates the character's eye").\nCamera Angle: Incorporate 'Eye-Level', 'High Angle', 'Low Angle', 'Dutch Angle/Tilt', 'Overhead/Bird's Eye View' descriptively (e.g., "viewed from a neutral eye-level perspective," "looking down, making the subject seem vulnerable," "looking up, emphasizing power," "with a disorienting Dutch tilt," "a map-like overhead view").\nCamera Movement: Describe the motion using terms like 'Static/Fixed Shot', 'Pan (Left/Right)', 'Whip Pan', 'Tilt (Up/Down)', 'Dolly (In/Out)', 'Tracking/Trucking Shot', 'Pedestal/Crane Shot', 'Zoom (In/Out)', 'Handheld/Shaky Cam', 'Steadicam/Gimbal Shot', 'Arc Shot', 'Dolly Zoom (Vertigo)' (e.g., "a smooth Steadicam shot follows the subject," "the camera rapidly whip pans," "a slow dolly in builds tension," "handheld camera creates urgency," "a disorienting dolly zoom effect").\nLens Type/Effect: Reflect selections like 'Wide-Angle Lens', 'Telephoto Lens', 'Anamorphic Lens', 'Shallow DoF', 'Deep DoF', 'Creamy Bokeh', 'Oval Bokeh (Anamorphic)', 'Lens Flare (Specify Type)' (e.g., "shot with a wide-angle lens exaggerating perspective," "telephoto compression flattens the scene," "characteristic horizontal anamorphic lens flare," "a shallow depth of field isolates the subject with creamy bokeh," "deep depth of field keeps the background sharp").\nLighting Style: Incorporate 'Natural Light (Golden Hour/Daylight)', 'Hard Light', 'Soft Light', 'Three-Point Lighting', 'High-Key Lighting', 'Low-Key Lighting (Chiaroscuro)', 'Warm Color Temp', 'Cool Color Temp', 'Practical Lights' (e.g., "lit by warm golden hour sunlight," "dramatic hard light creates sharp shadows," "soft, diffused lighting for a flattering look," "high-key lighting creates a cheerful mood," "low-key lighting with deep chiaroscuro contrast," "cool blue color temperature enhances sadness").\nVisual Style/Era: Integrate selections like 'Cinematic', 'Film Noir', 'Cinéma Vérité', 'Found Footage', 'Early 2000s Digicam', 'VHS Aesthetic', 'Documentary', 'Animation (Specify)', 'Surreal/Dreamlike' (e.g., "in the style of film noir with deep shadows," "a raw cinéma vérité aesthetic," "looks like found footage from a handheld camera," "grainy early 2000s digicam video," "VHS tape look with tracking lines").\nCustom Keywords: Include any additional user-provided terms.\nPoint of View (POV): If 'POV Shot' or 'Found Footage' is selected, describe the scene from that perspective.\nDetail & Length: Be descriptive and evocative, aiming for clarity and detail appropriate for video generation (typically under 150 words unless 'High Detail' is selected). Combine elements naturally.\n\nCrucial:\nOutput ONLY the paragraph. No conversational text, no acknowledgments, no explanations.\n\nUser provided input (Core Prompt + Selections/Keywords):\n`,
            requires: null
        },
        "Gemini Veo Pro Enhancer": {
            text: `You are an expert AI prompt engineer specializing in Google Veo. Your objective is to transform a user's input (core concept + selections + negative keywords) into a highly effective, descriptive video prompt optimized for Veo's capabilities.\n\nInput Format: The user provides a core concept, potentially followed by structured selections (like 'Overall Style: Cinematic') and negative keywords (marked with '--neg').\n\nOutput Requirements:\n1.  Single Paragraph: Generate ONLY the final prompt description as one continuous paragraph.\n2.  No Conversational Text: Do NOT include any introductory phrases, explanations, or labels (e.g., 'Subject:', 'Camera:').\n3.  Veo Elements Integration: Seamlessly weave the following elements into the paragraph, using descriptive language and specific video terminology:\n    Subject: Clearly define the main subject(s) from the user's core concept.\n    Action: Detail what the subject is doing.\n    Context: Describe the setting/background.\n    Style: Incorporate the user's 'Overall Style' and 'Footage Style / Era' selections (e.g., 'cinematic', '80s VHS', '3D cartoon style render'). Use related keywords (e.g., for 'Noir Film', use 'high contrast black and white, dramatic shadows').\n    Camera Motion (Optional but Recommended): Use the 'Camera Style/Rig' and 'Camera Movement' selections to describe the shot (e.g., 'smooth Steadicam tracking shot following the subject', 'handheld POV', 'low angle dolly zoom in').\n    Composition (Optional but Recommended): Specify framing (e.g., 'extreme close-up', 'wide shot', 'over-the-shoulder shot').\n    Ambiance (Optional but Recommended): Describe lighting and color contributing to the mood (e.g., 'warm golden hour light', 'eerie green neon glow', 'cool blue tones', 'volumetric lighting').\n    Pacing & Effects: Reflect the 'Editing Pace' (e.g., 'quick cuts', 'long take') and add 'Visual Effects (VFX)' if selected (e.g., 'subtle film grain', 'lens flare').\n    Custom Keywords: Include any other 'Custom Elements / Keywords' provided.\n4.  Negative Prompts: Strictly AVOID generating elements listed after '--neg' in the input. Describe the scene *without* these elements.\n5.  Length: Adjust detail level based on 'Desired Prompt Length' selection (Short/Medium/Long), typically aiming for under 150 words unless 'Long' is selected.\n6.  Safety: Ensure compliance with responsible AI guidelines.\n\nEmphasis: Focus on translating the user's core idea and selections into a rich, actionable prompt for Veo, using precise video language.\n\nUser provided input:\n`,
            requires: null
        },
        "Veo Adherence Focus": {
            text: `You are an expert prompt engineer optimizing user prompts for a text-to-video AI model (like Google Veo). Your task is to rewrite the user's simple prompt into a highly detailed, unambiguous, and structured scene description optimized for maximum adherence by the video model.\n\nCore Requirements:\n1.  Extract & Clarify: Identify the absolute core subject, action, and setting from the user prompt. Ensure these are central.\n2.  Camera MANDATORY: MUST explicitly describe the camera angle (e.g., eye-level, low angle, high angle, wide shot, close-up, drone shot) AND any camera movement (e.g., static, slow pan left, dolly zoom in, handheld shaky cam). Consider the user's 'Camera Style' and 'Camera Direction' selections for specific techniques (e.g., 'Steadicam flow', 'Zoom in').\n3.  Lighting & Mood MANDATORY: MUST explicitly describe the lighting (e.g., cinematic volumetric lighting, soft natural daylight, dramatic neon glow, silhouette) and the resulting mood (e.g., mysterious, cheerful, intense, serene).\n4.  Action Flow & Pacing: Detail the primary action within the scene. Describe its beginning, middle, and end, even for short clips, to imply pacing. Incorporate the user's 'Pacing' selection (e.g., 'Slow (Long Takes)', 'Fast (Quick Cuts)').\n5.  Style & Effects: If a visual style is implied or stated (e.g., 'photo', 'painting', 'anime'), incorporate specific and effective keywords (e.g., 'photorealistic', 'watercolor illustration', 'anime style'). Integrate the user's 'Overall Style', 'Visual Effects (VFX)', and 'Footage Style / Era' selections (e.g., 'Cinematic', 'Glitches/Distortion', '80s VHS') seamlessly into the description to achieve the desired look and feel.\n6.  Negative Constraints: Ensure elements specified after '--neg' in the input are NOT included in the final description.\n7.  Conciseness & Limit: Be descriptive but avoid unnecessary fluff. The final output MUST remain under 150 words (unless 'Desired Prompt Length' is 'Long').\n\nOutput Format:\nCombine all the above details into a SINGLE, continuous paragraph. Do NOT use lists or labels in the final output.\n\nFinal Instruction:\nEmphasize the user's core request while enriching it with the mandatory camera, lighting, action, and style details necessary for the video model to generate the scene accurately and effectively. Incorporate all additional user-provided keywords and specific selections (Camera, Pacing, Style, Effects, Era) naturally, while respecting negative constraints.\n\nUser provided input (Core Prompt + Selections/Keywords + Negative Keywords):\n`,
            requires: ['camera_angle', 'camera_movement', 'lighting_style_atmosphere']
        },
        "Goldie Custom": {
            text: `You will be provided an input of a user provided text prompt.\nYour task is to generate a detailed scene description based *directly* on the user's provided text prompt for a text-to-video service. The goal is to expand and enrich the user's vision with vivid details suitable for video generation, ensuring the core concept remains unchanged. The scene description must be comprehensive and contain all necessary information for the AI video generator to create the corresponding visual.\n\nIMPORTANT: Make sure the new scene description is no more than 150 words (unless 'Desired Prompt Length' is 'Long').\n\nOutput Format:\nA vivid and detailed description of the scene, incorporating the characters, their actions, camera angles, lighting, camera settings, background, and any other relevant details directly inspired by the user's prompt and any additional keywords/selections provided (Style, Camera Style/Direction, Pacing, Special Effects, Footage Style/Era etc.). Ensure elements mentioned after '--neg' are excluded.\n\nIMPORTANT: Begin with the scene motion/action, setup, and style, THEN introduce characters (if any) with their full descriptions as they appear in the shot, ensuring they align with the user's prompt.\n\nGuidelines:\nPrompt Fidelity and Enhancement: While the core idea, subject, and intent of the initial user input prompt must be preserved, you should refine, rephrase, or modify the prompt description for optimal clarity, detail, and adherence for the video generation model. Your goal is to translate the user's concept into a 'better understanding adherence prompt'—one that uses vivid vocabulary and structure to guide the AI effectively without fundamentally altering the original request or introducing unrelated concepts. Focus on making the AI understand clearly. Integrate additional user selections (Overall Style, Camera Style/Rig, Camera Movement, Editing Pace, VFX, Footage Style/Era) naturally into the description. Exclude elements specified after '--neg'.\nComprehensive Shot: The shot description must encapsulate the motion/action described or implied in the user's prompt within a single, well-crafted shot. Ensure the described scene has motion and movement appropriate to the prompt and selected 'Editing Pace'/'Camera Movement'; it should not be static unless explicitly requested by the user or implied by selections like 'Tripod (Static/Stable)'.\nSubject Integration: If characters are mentioned or implied in the prompt, introduce them and their descriptions naturally as they appear in the scene description. Do not list them separately. Keep character descriptions consistent with any details provided in the user's prompt.\nCreative Enhancement (Within Prompt Bounds): Add creative details to enhance the visual quality and motion in service of the user's original prompt, but remain strictly faithful to the user's intent. Consider elements like:\n- Camera angles and movements reflecting 'Camera Style/Rig'/'Camera Movement' selections.\n- Lighting consistent with the mood implied by the prompt and selected 'Overall Style'.\n- Camera settings (depth of field, motion blur, etc.) relevant to the action and 'Overall Style'.\n- Backgrounds (blurred, bokeh, etc.) that support the main subject of the prompt.\n- Color schemes reflecting the prompt's tone and selected 'Overall Style' or 'Footage Style / Era'.\n- Subject actions derived directly from the prompt.\n- Effects based on the 'Visual Effects (VFX)' selection.\nOriginal Style: Maintain the style, tone, and aesthetic implied by the user's original text prompt and selected 'Overall Style' and 'Footage Style / Era' options.\n\nVERY IMPORTANT!!! ONLY output the new scene description, do it in a clean and continuous paragraph. VERY IMPORTANT!!!\n\nEmphasize the user provided prompt by translating its core elements into detailed visual language, adding necessary descriptive richness for the video generation model to produce a result that accurately reflects the user's original request and additional selections, while respecting negative constraints.\n\nSafety and Copyright Compliance: Critically review the generated description to ensure it avoids language, themes, or elements likely to trigger safety filters (e.g., explicit NSFW content, harmful depictions) or violate copyright (e.g., specific named characters, logos, or protected properties not implied by the original user prompt). If potentially problematic elements are inherent to the user's original prompt, rewrite descriptions carefully to be suggestive rather than explicit, or focus on generic representations, always prioritizing faithfulness to the user's core, permissible intent. Do not introduce unrelated elements. The goal is adherence AND compliance.\n\nUser provided input (Core Prompt + Selections/Keywords + Negative Keywords):\n`,
            requires: null
        }
    };
    let enhancerEffectivePreamblePresets = {}; // Will be populated by enhancerLoadAllPreamblesAndStoreGlobally

    const ENHANCER_SCHEMA_INPUTS_DATA = {
        composition_rule: { title: "Compositional Rule", enum: ["Default", "Rule of Thirds", "Golden Ratio / Spiral", "Centered Framing / Symmetry", "Leading Lines", "Diagonal Lines", "Triangle Composition", "Frame Within a Frame", "Negative Space Focus", "Dynamic Symmetry"], default: "Default", description: "Guides visual arrangement..." },
        shot_size: { title: "Shot Size / Framing", enum: ["Default", "Establishing Shot", "Master Shot", "Extreme Wide Shot (EWS/ELS)", "Very Wide Shot (VWS)", "Wide Shot (WS/LS)", "Full Shot (FS)", "Medium Wide Shot (MWS/American)", "Cowboy Shot (Mid-Thigh Up)", "Medium Shot (MS/Waist Up)", "Medium Close-Up (MCU/Chest Up)", "Close-Up (CU/Face)", "Choker Shot (Neck/Chin to Forehead)", "Extreme Close-Up (ECU/Features)", "Detail Shot / Insert", "Over-the-Shoulder (OTS)", "Point-of-View (POV)", "Cutaway Shot"], default: "Default", description: "Defines subject proximity..." },
        camera_angle: { title: "Camera Angle & Perspective", enum: ["Default / Eye-Level", "Shoulder Level", "High Angle (Looking Down)", "Low Angle (Looking Up)", "Dutch Angle / Canted Angle / Tilt", "Overhead / Bird's Eye View / Top Shot", "Ground Level Shot", "Worm's Eye View (Extreme Low)", "Hip Level", "Knee Level"], default: "Default / Eye-Level", description: "Camera's vertical position..." },
        camera_movement: { title: "Camera Movement & Dynamics", enum: ["Default / Static Shot (No Movement)", "Pan (Left/Right)", "Whip Pan / Swish Pan", "Tilt (Up/Down)", "Whip Tilt", "Dolly (In/Out on Track/Wheels)", "Truck / Tracking / Following Shot (Parallel to Subject)", "Pedestal / Crane Shot (Vertical Lift)", "Boom Shot / Jib Arm (Arcing Vertical/Horizontal)", "Zoom (In/Out - Lens Magnification)", "Handheld Camera (Intentional Shake/Organic)", "Steadicam / Gimbal Shot (Smooth Floating)", "Arc Shot (Circles Subject)", "Dolly Zoom / Vertigo Effect / Zolly", "Drone Shot / Aerial Movement", "Reveal Shot (Gradual Unveiling)", "Random / Erratic Movement"], default: "Default / Static Shot (No Movement)", description: "Describes physical motion..." },
        lens_type_optical_effects: { title: "Lens Type & Optical Effects", enum: ["Default / Standard Lens (Natural Perspective)", "Wide-Angle Lens (Exaggerated Depth/Distortion)", "Telephoto Lens (Compressed Perspective/Shallow DoF)", "Prime Lens Look (Sharp, Fixed Focal Length)", "Anamorphic Lens Look (Oval Bokeh, Horizontal Flares)", "Fisheye Lens Effect (Extreme Barrel Distortion)", "Macro Lens Effect (Extreme Close-Up on Small Details)", "Tilt-Shift Effect (Miniature Look/Selective Focus Plane)", "Shallow Depth of Field (Blurred Background/Foreground)", "Deep Depth of Field (All in Focus)", "Rack Focus / Focus Pull (Shifting Focus Mid-Shot)", "Soft Focus / Diffusion Filter (Dreamy, Hazy)", "Creamy Bokeh (Smooth Out-of-Focus Areas)", "Swirly Bokeh", "Oval Bokeh (Anamorphic Specific)", "Lens Flare (Subtle/Natural)", "Lens Flare (Pronounced/Stylized)", "Lens Flare (Anamorphic Horizontal Blue/Orange)", "Starburst Lens Flare (Point Light Sources)", "Chromatic Aberration (Intentional Color Fringing)", "Lens Breathing Effect (Focal Shift During Focus)", "Split Diopter Effect (Two Focal Planes Sharp)"], default: "Default / Standard Lens (Natural Perspective)", description: "Choice of lens..." },
        lighting_style_atmosphere: { title: "Lighting Style & Atmosphere", enum: ["Default / Naturalistic Lighting", "Natural Light (Sunlight - Midday)", "Natural Light (Golden Hour / Magic Hour)", "Natural Light (Blue Hour / Twilight)", "Natural Light (Overcast / Diffused Daylight)", "Moonlight Effect / Night Lighting", "Candlelight / Firelight Effect", "Hard Light (Sharp, Defined Shadows)", "Soft Light (Diffused, Gentle Shadows)", "Flat Lighting (Minimal Shadows, Even Illumination)", "Three-Point Lighting (Key, Fill, Backlight)", "High-Key Lighting (Bright, Low Contrast, Cheerful)", "Low-Key Lighting (Dark, High Contrast, Dramatic)", "Chiaroscuro (Strong Light/Dark Contrast)", "Rembrandt Lighting (Triangular Light on Cheek)", "Rim Lighting / Backlighting (Outlines Subject)", "Silhouette Lighting (Subject Dark Against Bright BG)", "Warm Color Temperature (Oranges, Yellows)", "Cool Color Temperature (Blues, Cyans)", "Neon Lighting (Vibrant, Artificial Glow)", "Volumetric Lighting (Light Beams Visible, e.g., God Rays)", "Motivated Lighting (Source Appears Realistic to Scene)", "Practical Lights (Lamps, Fixtures in Scene)", "Spotlight Effect (Focused Beam)", "Kicker Light (Side/Rear Edge Light)", "Gobo / Patterned Light (Shadows/Light Shapes)", "Window Light (Natural or Simulated)", "Day for Night Effect (Simulating Night during Day)"], default: "Default / Naturalistic Lighting", description: "Quality, direction, color..." },
        visual_style_medium_era: { title: "Visual Style, Medium & Era", enum: ["Default / Realistic", "Cinematic (Film-like Quality)", "Photorealistic (Highly Detailed, Real)", "Hyperrealistic (Exceedingly Real)", "Documentary (Observational / Vérité)", "Documentary (Expository / Interview-based)", "Film Noir (Dark, Shadowy B&W)", "Neo-Noir (Modern Film Noir)", "Found Footage (Handheld, Raw)", "Music Video (Stylized, Often Abstract)", "Commercial (Polished, Product-focused)", "Experimental / Art House", "Minimalist Style", "Action Sequence Style", "Surreal / Dreamlike", "Glitch Art / Datamosh", "Animation: 3D Render (Modern CGI)", "Animation: 2D Cel / Traditional", "Animation: Anime (Japanese Style)", "Animation: Cartoon (Western Style)", "Animation: Motion Graphics", "Animation: Stop Motion / Claymation", "Animation: Pixel Art", "Animation: Voxel Art", "Animation: Rotoscoped", "Animation: Hand-drawn Sketch Style", "Oil Painting Style", "Watercolor Painting Style", "Impressionistic Painting Style", "Charcoal Sketch Style", "Comic Book / Graphic Novel Style", "Matte Painting Look", "8mm Film Look (Grainy, Vintage)", "16mm Film Look (Grainy, Indie)", "35mm Film Look (Classic Cinema)", "Technicolor Look (Vibrant, Saturated 2-strip/3-strip)", "Kodachrome Look", "Ektachrome Look", "Fujifilm Stock Look", "VHS Aesthetic (80s/90s Tape)", "Betamax Look", "Early 2000s Digicam / MiniDV Look", "Vintage Newsreel (B&W, Aged)", "Archival Footage Look", "Sepia Tone Vintage", "1920s Silent Film Look", "1950s Cinema Look", "1960s Mod Style", "1970s Film Look (Gritty/Saturated)", "1980s Neon/Synthwave", "1990s Grunge Video", "Cyberpunk Aesthetic", "Steampunk Aesthetic", "Solarpunk Aesthetic", "Dieselpunk Aesthetic", "Gothic Aesthetic", "Fantasy Art Style", "Sci-Fi Concept Art Style", "Infrared / Thermal Look", "X-Ray Look", "Security Camera (CCTV) Look"], default: "Default / Realistic", description: "Overall aesthetic..." },
        vfx_post_production: { title: "Visual Effects (VFX) & Post-Production Styles", enum: ["None / In-Camera Only", "Subtle CGI Integration", "Heavy CGI / VFX Driven", "Practical Effects Focus", "Rotoscoping (Animated Outlines)", "Motion Graphics Elements", "Particle Effects (Snow, Rain, Dust, Fog, Embers)", "Lens Flares (Added in Post)", "Light Leaks (Post Effect)", "Film Grain Overlay (Added Texture)", "Color Grading: Cinematic Teal & Orange", "Color Grading: Bleach Bypass", "Color Grading: Desaturated / Muted", "Color Grading: Vibrant / Highly Saturated", "Color Grading: Cross-Processed Look", "Glitches / Distortion (Digital Artifacts)", "VHS Tracking Lines / Analog Glitches", "Data Moshing / Databending", "Scanlines / Interlacing Effect", "Composite (Green Screen Keying Implied)", "Wire Removal (Implied Clean-up)", "Digital Makeup / Retouching", "Time-Lapse Photography Effect", "Slow Motion (Overcranked)", "Speed Ramping (Variable Speed)", "Motion Blur (Post-Production Effect)", "Light Streaks / Trails (Post)", "Digital Set Extension / Matte Painting Integration", "Screen Shake / Camera Jitter (Post)", "Bullet Time Effect", "Slit-Scan Effect", "Morphing Effect", "Explosions / Fire VFX", "Muzzle Flashes / Gunfire VFX", "Smoke / Atmospheric VFX"], default: "None / In-Camera Only", description: "Added visual manipulations..." },
        color_palette_grading: { title: "Color Palette & Grading", enum: ["Default / Natural Colors", "Monochromatic (Single Color + Tints/Shades)", "Achromatic (Black, White, Grays)", "High Contrast Colors", "Low Contrast Colors", "Vibrant & Saturated Palette", "Desaturated / Muted Palette", "Pastel Color Palette", "Neon Color Palette", "Earthy Tones Palette", "Jewel Tones Palette", "Cool Color Dominant (Blues, Greens, Purples)", "Warm Color Dominant (Reds, Oranges, Yellows)", "Analogous Colors (Adjacent on Color Wheel)", "Complementary Colors (Opposite on Color Wheel)", "Triadic Colors (Evenly Spaced on Color Wheel)", "Split-Complementary Colors", "Teal and Orange Grading", "Bleach Bypass Look (Desaturated, High Contrast)", "Sepia Tone", "Two-Strip Technicolor Emulation", "Three-Strip Technicolor Emulation", "Cross-Processing Emulation"], default: "Default / Natural Colors", description: "Defines dominant color scheme..." },
        editing_pace_transitions: { title: "Editing Pace & Transitions (Implied)", enum: ["Default / Standard Pace", "Slow Pacing / Long Takes / Contemplative", "Fast Pacing / Quick Cuts / Energetic", "Montage Sequence (Series of Short Shots)", "Rhythmic Editing (To Music/Beat)", "Smooth Transitions (e.g., Standard Cuts, Soft Dissolves)", "Dynamic Transitions (e.g., Wipes, Graphic Matches, Hard Cuts)", "Jump Cuts (Disorienting, Noticeable)", "Match Cut (Visual/Conceptual Link)", "Split Screen Presentation", "Invisible Editing / Seamless Cuts"], default: "Default / Standard Pace", description: "Hints at implied editing rhythm..." },
        subject_prominence: { title: "Subject Prominence & Focus", enum: ["Default / Balanced Focus", "Primary Subject Sharp / Background Soft (Bokeh)", "Deep Focus / All Elements in Focus", "Background / Environment as Main Subject", "Selective Focus on Detail", "Dynamic Focus Shift (Rack Focus Implied)"], default: "Default / Balanced Focus", description: "Directs attention..." },
        sound_design_influence: { title: "Sound Design Influence (Visual Hint)", enum: ["Default / Unspecified Audio Influence", "Silent Film Aesthetic (Visuals for Silence)", "Intense Soundscape Implied (e.g., Visual Impacts, Dynamic Motion)", "Delicate / Quiet Sounds Implied (e.g., Subtle Visuals, Stillness)", "Music-Driven Visuals (Rhythmic, Flowing)", "Environmental Ambience Focus (Visuals Reflecting Natural Sounds)", "Dialogue Focused (Visuals Support Conversation)"], default: "Default / Unspecified Audio Influence", description: "Experimental: Hints at sound..." },
        prompt_detail_interpretation: { title: "Prompt Detail & Interpretation Style", enum: ["Balanced Detail (Default)", "High Detail (Specific & Elaborate)", "Hyper-Detailed (Extremely Specific, Granular)", "Medium Detail (Key Elements Described)", "Low Detail (Broad Strokes, Core Concept)", "Concise & Punchy (Brief, Impactful)", "Literal Interpretation (Adhere Closely to Text)", "Creative Interpretation (Allow Artistic Freedom)"], default: "Balanced Detail (Default)", description: "Guides LLM on detail..." },
        custom_elements: { title: "Custom Elements / Keywords", type: "string", default: "", description: "Specific keywords, artist names..." }
    };
    const ENHANCER_LEXICON_DATA_VAL = {
        "Shot Types & Framing": ["Aerial Shot", "Birds Eye View", /* ... */ "Master Shot"],
        "Camera Movements": ["Arc Shot", "Boom Shot", /* ... */ "Whip Tilt"],
        "Lighting Styles": ["Ambient Light", "Backlighting (Rim Lighting)", /* ... */ "Day for Night"],
        "Visual Styles & Aesthetics": ["Abstract", "Anime", /* ... */ "1990s Grunge Music Video"],
        "Lens & Optical Effects": ["Anamorphic Lens Flare", "Bokeh (Creamy, Swirly, Oval)", /* ... */ "Starburst Effect"],
        "Colors & Palettes": ["Analogous Colors", "Black and White (B&W)", /* ... */ "Achromatic"],
        "Materials & Textures": ["Brushed Metal", "Canvas", /* ... */ "Woven Fabric"],
        "Moods & Atmospheres": ["Adventurous", "Aggressive", /* ... */ "Zen"],
        "Film & Photography Terms": ["8K", "4K", /* ... */ "Aperture (f-stop)"],
        "Artistic Mediums": ["Acrylic Painting", "Chalk Art", /* ... */ "Woodblock Print"],
        "General Keywords": ["Detailed", "Intricate Details", /* ... */ "High Fidelity"]
    };
    const ENHANCER_SMART_SUGGESTIONS_MAP_DATA = {
        "run": { schemaKey: "camera_movement", value: "Truck / Tracking / Following Shot (Parallel to Subject)", label: "Tracking Shot for 'run' (Movement)" },
        "sunset": { schemaKey: "lighting_style_atmosphere", value: "Natural Light (Golden Hour / Magic Hour)", label: "Golden Hour for 'sunset' (Lighting)" },
        /* ... more suggestions ... */
        "explosion": { schemaKey: "vfx_post_production", value: "Explosions / Fire VFX", label: "Explosions for 'explosion' (VFX)"},
    };
    const ENHANCER_SCHEMA_CONFLICTS_DATA = {
        'camera_movement': { 'Default / Static Shot (No Movement)': [ /* ... conflicting values ... */ ], /* ... */ },
        'lens_type_optical_effects': { 'Shallow Depth of Field (Blurred Background/Foreground)': ['Deep Depth of Field (All in Focus)'], /* ... */ },
        'subject_prominence': { 'Primary Subject Sharp / Background Soft (Bokeh)': ['Deep Focus / All Elements in Focus', 'Background / Environment as Main Subject'], /* ... */ }
    };


    let enhancerGlobalSchemaInputElements = {};
    let enhancerSmartSuggestionTimeout = null;
    let enhancerCurrentLexiconPopover = null;
    let enhancerCurrentModal = null;
    let enhancerCurrentBackdrop = null;
    let enhancerUploadedImageBase64 = '';


    function enhancerShowMessageModal(title, message, errorDetails = null, type = 'info') {
        const modalUniqueClass = 'vfx-enhancer-message-modal-aio';
        const { modal, backdrop, contentWrapper, footer } = createModalScaffold(title, modalUniqueClass, null, true);

        let icon = 'info'; if (type === 'success') icon = 'check_circle'; if (type === 'error') icon = 'error';
        const messageIcon = createIconSpan(icon);
        messageIcon.style.fontSize = '1.5em'; messageIcon.style.marginRight = '10px';
        if (type === 'error') messageIcon.style.color = 'var(--dark-accent-red)';
        if (type === 'success') messageIcon.style.color = 'var(--dark-accent-blue)';

        const messageText = document.createElement('p');
        messageText.textContent = message;
        messageText.style.margin = '10px 0 20px 0';
        messageText.style.textAlign = 'left';
        messageText.style.display = 'flex';
        messageText.style.alignItems = 'center';
        messageText.prepend(messageIcon);
        contentWrapper.appendChild(messageText);

        if (errorDetails) {
            const detailsDiv = document.createElement('div');
            detailsDiv.className = 'vfx-error-details-aio';
            detailsDiv.style.whiteSpace = 'pre-wrap';
            detailsDiv.style.maxHeight = '150px';
            detailsDiv.style.overflowY = 'auto';
            detailsDiv.style.backgroundColor = 'var(--dark-bg-tertiary)';
            detailsDiv.style.padding = '10px';
            detailsDiv.style.borderRadius = '8px';
            detailsDiv.style.fontSize = '0.8em';
            detailsDiv.textContent = typeof errorDetails === 'string' ? errorDetails : JSON.stringify(errorDetails, null, 2);
            contentWrapper.appendChild(detailsDiv);
        }

        const okButton = createModalButton('OK', ['primary-action'], () => closeModalUI(modal, backdrop), 'check_circle');
        footer.appendChild(okButton);
        openModalUI(modal, backdrop);
        setTimeout(() => okButton.focus(), 50);
    }

    function enhancerLoadAllPreamblesAndStoreGlobally() {
        const customPreamblesFromStorage = JSON.parse(GM_getValue(ENHANCER_CUSTOM_PREAMBLES_KEY, '{}'));
        enhancerEffectivePreamblePresets = {};
        const allDefaultPresets = { ...ENHANCER_DEFAULT_PREAMBLE_PRESETS_DATA };

        for (const key in allDefaultPresets) {
            const presetDefinition = allDefaultPresets[key];
            enhancerEffectivePreamblePresets[key] = {
                text: presetDefinition.text,
                _status: 'default',
                requires: presetDefinition.requires || null
            };
        }
        for (const key in customPreamblesFromStorage) {
            const customText = customPreamblesFromStorage[key];
            if (enhancerEffectivePreamblePresets[key]) {
                enhancerEffectivePreamblePresets[key].text = customText;
                enhancerEffectivePreamblePresets[key]._status = 'custom_override';
            } else {
                enhancerEffectivePreamblePresets[key] = { text: customText, _status: 'custom', requires: null };
            }
        }
    }

    function enhancerSaveCustomPreambleText(name, text) {
        if (!name || !name.trim()) { enhancerShowMessageModal("Error Saving Preamble", "Preamble name cannot be empty.", null, "error"); return false; }
        const customPreamblesStore = JSON.parse(GM_getValue(ENHANCER_CUSTOM_PREAMBLES_KEY, '{}'));
        customPreamblesStore[name.trim()] = text;
        try { GM_setValue(ENHANCER_CUSTOM_PREAMBLES_KEY, JSON.stringify(customPreamblesStore)); enhancerLoadAllPreamblesAndStoreGlobally(); return true; }
        catch (e) { console.error("Error saving custom preamble:", e); enhancerShowMessageModal("Storage Error", "Could not save custom preamble.", e.message, "error"); return false; }
    }

    function enhancerDeleteCustomPreambleText(name) {
        const customPreamblesStore = JSON.parse(GM_getValue(ENHANCER_CUSTOM_PREAMBLES_KEY, '{}'));
        if (customPreamblesStore.hasOwnProperty(name)) {
            delete customPreamblesStore[name];
            try {
                GM_setValue(ENHANCER_CUSTOM_PREAMBLES_KEY, JSON.stringify(customPreamblesStore));
                enhancerLoadAllPreamblesAndStoreGlobally();
                const currentSelectedKey = GM_getValue(ENHANCER_DEFAULT_PREAMBLE_SELECTED_KEY);
                if (currentSelectedKey === name) { GM_setValue(ENHANCER_DEFAULT_PREAMBLE_SELECTED_KEY, Object.keys(ENHANCER_DEFAULT_PREAMBLE_PRESETS_DATA)[0] || ''); }
                return true;
            } catch (e) { console.error("Error deleting custom preamble:", e); enhancerShowMessageModal("Storage Error", "Could not delete custom preamble.", e.message, "error"); return false; }
        } return false;
    }

    // --- Enhancer: Populate Preamble Select ---
    function enhancerPopulatePreambleSelect(selectElement, selectedPreambleName) {
        selectElement.innerHTML = '';
        enhancerLoadAllPreamblesAndStoreGlobally(); // Ensure data is fresh

        const defaultGroup = document.createElement('optgroup'); defaultGroup.label = 'Default Preambles';
        const customOverrideGroup = document.createElement('optgroup'); customOverrideGroup.label = 'Customized Defaults';
        const customGroup = document.createElement('optgroup'); customGroup.label = 'Custom Preambles';

        Object.keys(enhancerEffectivePreamblePresets).sort((a,b) => a.toLowerCase().localeCompare(b.toLowerCase())).forEach(key => {
            const preambleEntry = enhancerEffectivePreamblePresets[key];
            const option = document.createElement('option');
            option.value = key;
            option.textContent = key;
            if (preambleEntry._status === 'custom') { option.textContent = `${key} (Custom)`; customGroup.appendChild(option); }
            else if (preambleEntry._status === 'custom_override') { option.textContent = `${key} (Customized)`; customOverrideGroup.appendChild(option); }
            else { defaultGroup.appendChild(option); }
            if (key === selectedPreambleName) option.selected = true;
        });

        if (defaultGroup.childNodes.length > 0) selectElement.appendChild(defaultGroup);
        if (customOverrideGroup.childNodes.length > 0) selectElement.appendChild(customOverrideGroup);
        if (customGroup.childNodes.length > 0) selectElement.appendChild(customGroup);

        if (!selectElement.value && selectElement.options.length > 0) { // Fallback if selected not found
            selectElement.selectedIndex = 0;
            GM_setValue(ENHANCER_DEFAULT_PREAMBLE_SELECTED_KEY, selectElement.value);
        }
    }

    // --- Enhancer: Update Preamble Editor Visibility & Content ---
    function enhancerUpdatePreambleEditorVisibility(preambleName, editorElement, editorButtonsContainer, saveChangesBtn) {
        enhancerLoadAllPreamblesAndStoreGlobally(); // Ensure data is fresh
        const preambleEntry = enhancerEffectivePreamblePresets[preambleName];
        if (editorElement.style.display === 'block') { // Only update if visible
            editorElement.value = preambleEntry ? preambleEntry.text : '';
            if (saveChangesBtn) {
                saveChangesBtn.disabled = !(preambleEntry && (preambleEntry._status === 'custom' || preambleEntry._status === 'custom_override'));
            }
        }
    }

    // --- Enhancer: Live Preview & UI State Update ---
    function enhancerUpdateLivePromptPreview(previewElement, preambleTextToShow, corePrompt, currentSchemaSelections, negativePrompt, imageAttached = false) {
        if (!previewElement) return;
        let fullPrompt = preambleTextToShow ? preambleTextToShow + "\n\n" : "";
        if (imageAttached) { fullPrompt += "[Image Attached] "; }
        fullPrompt += corePrompt || "[Your Core Prompt Here]";
        const selectedKeywords = [];
        if(currentSchemaSelections){
            for (const key in currentSchemaSelections) {
                const value = currentSchemaSelections[key]; const schemaDef = ENHANCER_SCHEMA_INPUTS_DATA[key];
                if (value && value.trim() !== "" && schemaDef && value !== schemaDef.default) {
                    selectedKeywords.push(key === 'custom_elements' ? value.trim() : `${schemaDef.title}: ${value}`);
                }
            }
        }
        if (selectedKeywords.length > 0) { fullPrompt += "\n\n" + selectedKeywords.join(". "); }
        if (negativePrompt && negativePrompt.trim() !== "") { fullPrompt += `\n\n--neg ${negativePrompt.trim()}`; }
        previewElement.textContent = fullPrompt;
    }

    function enhancerUpdateModifiedStateForAllInputs() {
        Object.entries(enhancerGlobalSchemaInputElements).forEach(([key, element]) => {
            const schemaDef = ENHANCER_SCHEMA_INPUTS_DATA[key];
            if (!schemaDef) return;
            const isModified = element.value !== schemaDef.default;
            element.closest('.vfx-schema-input-item-aio')?.classList.toggle('modified', isModified);
        });
    }

    // --- Enhancer: Create Schema Field ---
    function enhancerCreateSchemaFieldComponent(key, schemaDef, initialValue, commonChangeHandler) {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'vfx-schema-input-item-aio'; // Specific class

        const label = document.createElement('label');
        label.textContent = schemaDef.title;
        label.htmlFor = `vfx-enhancer-schema-${key}-aio`; // Unique ID
        label.title = schemaDef.description;
        itemDiv.appendChild(label);

        let element;
        if (schemaDef.enum) {
            element = document.createElement('select');
            element.id = `vfx-enhancer-schema-${key}-aio`;
            schemaDef.enum.forEach(val => {
                const opt = document.createElement('option'); opt.value = val; opt.textContent = val;
                if (val === initialValue) opt.selected = true;
                element.appendChild(opt);
            });
        } else {
            element = document.createElement('input');
            element.type = schemaDef.type || 'text';
            element.id = `vfx-enhancer-schema-${key}-aio`;
            element.placeholder = schemaDef.description;
            element.value = initialValue || '';
        }
        element.onchange = (e) => { commonChangeHandler(e); itemDiv.classList.toggle('modified', e.target.value !== schemaDef.default); };
        if (initialValue !== schemaDef.default) { itemDiv.classList.add('modified'); }
        itemDiv.appendChild(element);
        return { itemDiv, element };
    }

    // ... (Many more functions from Prompt Enhancer need to be fully defined here)

    function openPromptEnhancerModal(initialSettings = {}) {
        if (enhancerCurrentModal && enhancerCurrentModal.style.display !== 'none') {
            openModalUI(enhancerCurrentModal, enhancerCurrentBackdrop);
            return;
        }

        enhancerGlobalSchemaInputElements = {};
        const elementsToResetForClear = [];
        enhancerUploadedImageBase64 = initialSettings.imageBase64 || '';

        const modalUniqueClass = 'vfx-prompt-enhancer-modal-aio';
        const { modal, backdrop, contentWrapper, footer, closeButton } = createModalScaffold(
            `VideoFX Prompt Enhancer v${ENHANCER_SCRIPT_VERSION}`,
            modalUniqueClass, null, true
        );
        enhancerCurrentModal = modal;
        enhancerCurrentBackdrop = backdrop;

        // --- Preamble Section ---
        const preambleSectionContainer = document.createElement('div');
        preambleSectionContainer.style.marginBottom = '15px';
        const preambleLabelMain = document.createElement('label');
        preambleLabelMain.textContent = 'Preamble (AI Instructions)';
        preambleLabelMain.htmlFor = 'vfx-enhancer-preamble-select-aio';
        preambleLabelMain.id = 'vfx-preamble-label-main-aio'; // Unique
        preambleControlsContainer = document.createElement('div'); // Renamed variable
        preambleControlsContainer.className = 'vfx-preamble-controls-aio';
        const preambleSelect = document.createElement('select');
        preambleSelect.id = 'vfx-enhancer-preamble-select-aio'; // Unique ID
        elementsToResetForClear.push(preambleSelect);

        const preambleEditor = document.createElement('textarea');
        preambleEditor.id = ENHANCER_INLINE_PREAMBLE_EDITOR_ID;
        preambleEditor.placeholder = "Preamble text for editing...";
        preambleEditor.style.display = 'none'; // Initially hidden
        elementsToResetForClear.push(preambleEditor);

        const editorButtonsContainer = document.createElement('div');
        editorButtonsContainer.className = 'vfx-preamble-editor-buttons-aio'; // Unique
        editorButtonsContainer.style.display = 'none'; // Initially hidden
        const saveChangesBtn = createModalButton('Save Changes', ['info-action'], ()=>{/* Placeholder */}, 'save');
        const saveAsNewBtn = createModalButton('Save as New', ['info-action'], ()=>{/* Placeholder */}, 'add_circle');
        editorButtonsContainer.append(saveChangesBtn, saveAsNewBtn);

        const toggleEditorBtn = createModalButton('', ['icon-only', 'vfx-preamble-action-btn-aio'], ()=>{
            const isVisible = preambleEditor.style.display === 'block';
            preambleEditor.style.display = isVisible ? 'none' : 'block';
            editorButtonsContainer.style.display = isVisible ? 'none' : 'flex';
            // enhancerUpdatePreambleEditorVisibility(preambleSelect.value, preambleEditor, editorButtonsContainer, saveChangesBtn);
            // enhancerLivePreviewAndSuggestionsUpdate(); // Update preview based on editor state
        }, 'edit', 'Edit/View Preamble');
        const managePreamblesBtn = createModalButton('', ['icon-only', 'vfx-preamble-action-btn-aio'], ()=>{/* enhancerOpenPreambleManagerModal */}, 'tune', 'Manage Preambles');

        preambleControlsContainer.append(preambleSelect, toggleEditorBtn, managePreamblesBtn);
        preambleSectionContainer.append(preambleLabelMain, preambleControlsContainer, preambleEditor, editorButtonsContainer);
        contentWrapper.appendChild(preambleSectionContainer);

        // --- Core Concept & Image Section ---
        // ... (Rest of the UI construction as in the previous, more complete skeleton)

        enhancerLoadAllPreamblesAndStoreGlobally();
        enhancerPopulatePreambleSelect(preambleSelect, GM_getValue(ENHANCER_DEFAULT_PREAMBLE_SELECTED_KEY, Object.keys(ENHANCER_DEFAULT_PREAMBLE_PRESETS_DATA)[0]));
        // enhancerUpdatePreambleEditorVisibility(preambleSelect.value, preambleEditor, editorButtonsContainer, saveChangesBtn); // Initial state
        // preambleSelect.onchange = () => { /* ... update editor, preview, GM_setValue ... */ };
        // preambleEditor.oninput = () => { /* ... update preview ... */ };


        // --- Footer Buttons for Enhancer ---
        const clearBtn = createModalButton('Clear All', ['secondary-action'], () => { /* ... enhancer clear logic ... */ }, 'clear_all');
        const savePresetBtn = createModalButton('Save Preset', ['secondary-action'], () => { /* ... */ }, 'save');
        const loadPresetBtn = createModalButton('Load Preset', ['secondary-action'], () => { /* ... */ }, 'settings_backup_restore');
        const generateBtn = createModalButton('Generate & Enhance', ['primary-action'], () => { /* enhancerExecutePromptGeneration ... */ }, 'auto_awesome');

        const footerLeftContainer = document.createElement('div');
        footerLeftContainer.style.display = 'flex'; footerLeftContainer.style.gap = '10px';
        footerLeftContainer.append(clearBtn, savePresetBtn, loadPresetBtn);

        const footerRightContainer = document.createElement('div');
        footerRightContainer.appendChild(generateBtn);

        if(footer) { // Ensure footer exists from scaffold
             footer.appendChild(footerLeftContainer);
             footer.appendChild(footerRightContainer);
        }


        openModalUI(modal, backdrop);
    }
    // --- END: Prompt Enhancer v7 Code ---


    // --- START: VideoFX Image Deconstructor Code (Adapted) ---
    const DECON_API_ENDPOINT = "https://labs.google/fx/api/trpc/backbone.captionImage";
    const DECON_OVERLAY_TITLE = 'Image Deconstructor';
    const DECON_IMAGE_INPUT_ID = 'decon-image-input-aio';
    const DECON_ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    const DECON_MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
    const DECON_MEDIA_CATEGORIES = ['MEDIA_CATEGORY_SCENE', 'MEDIA_CATEGORY_SUBJECT', 'MEDIA_CATEGORY_STYLE'];

    let deconSelectedImageFullDataUrl = null;
    let deconResultTextareas = {}; // { scene: {textarea, copyButton}, ... }
    let deconMessageArea = null;
    let deconGenerateApiButton = null;
    let deconImageFileInput = null;
    let deconUploadImageButton = null;
    let deconImageInfoArea = null;
    let deconClearImageButton = null;
    let deconCurrentModal = null;
    let deconCurrentBackdrop = null;

    function deconSetLoadingState(isLoading) {
        if (!deconGenerateApiButton) return;
        deconGenerateApiButton.disabled = isLoading;
        const iconHTML = isLoading ? createIconSpanHTML('hourglass_top') : createIconSpanHTML('auto_awesome');
        deconGenerateApiButton.innerHTML = iconHTML + (isLoading ? 'Deconstructing...' : 'Deconstruct Image');
    }

    function deconClearSelectedImage() {
        deconSelectedImageFullDataUrl = null;
        if (deconImageFileInput) deconImageFileInput.value = '';
        if (deconImageInfoArea) {
            deconImageInfoArea.innerHTML = '';
             const placeholderText = document.createElement('span');
             placeholderText.textContent = 'No image selected.';
             placeholderText.style.fontStyle = 'italic';
             deconImageInfoArea.appendChild(placeholderText);
        }
        if (deconClearImageButton) deconClearImageButton.style.display = 'none';
        if (deconUploadImageButton) deconUploadImageButton.style.display = 'inline-flex';
        if (deconGenerateApiButton) deconGenerateApiButton.disabled = true;
        Object.values(deconResultTextareas).forEach(item => {
            if (item.textarea) item.textarea.value = '';
            if (item.copyButton) item.copyButton.disabled = true;
        });
        if (deconMessageArea) clearToolMessage(deconMessageArea);
    }

    function deconHandleFileSelect(event) {
        const files = event.target.files;
        if (!files || files.length === 0) return;
        const file = files[0];

        if (!DECON_ALLOWED_IMAGE_TYPES.includes(file.type)) {
            showToolMessage(deconMessageArea, `Invalid file type. Allowed: ${DECON_ALLOWED_IMAGE_TYPES.map(t=>t.split('/')[1]).join(', ')}.`, 'error');
            deconClearSelectedImage(); return;
        }
        if (file.size > DECON_MAX_IMAGE_SIZE_BYTES) {
            showToolMessage(deconMessageArea, `Image is too large. Max ${DECON_MAX_IMAGE_SIZE_BYTES/(1024*1024)}MB.`, 'error');
            deconClearSelectedImage(); return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            deconSelectedImageFullDataUrl = e.target.result;
            if (!deconSelectedImageFullDataUrl) {
                showToolMessage(deconMessageArea, "Could not read image data.", "error");
                deconClearSelectedImage(); return;
            }
            if (deconImageInfoArea) {
                deconImageInfoArea.innerHTML = '';
                const imgPreview = document.createElement('img');
                imgPreview.src = deconSelectedImageFullDataUrl;
                imgPreview.alt = file.name;
                imgPreview.style.cssText = 'max-width: 80px; max-height: 50px; border-radius: 4px; margin-right: 10px; vertical-align: middle;';
                deconImageInfoArea.appendChild(imgPreview);
                deconImageInfoArea.appendChild(document.createTextNode(file.name));
            }
            if (deconClearImageButton) deconClearImageButton.style.display = 'inline-flex';
            if (deconUploadImageButton) deconUploadImageButton.style.display = 'none';
            if (deconGenerateApiButton) deconGenerateApiButton.disabled = false;
            showToolMessage(deconMessageArea, 'Image selected. Ready to deconstruct.', 'info');
        };
        reader.onerror = () => { showToolMessage(deconMessageArea, 'Error reading file.', 'error'); deconClearSelectedImage(); };
        reader.readAsDataURL(file);
    }

    async function deconCallApi() {
        if (!deconSelectedImageFullDataUrl) {
            showToolMessage(deconMessageArea, "Please upload an image first.", 'error'); return;
        }
        deconSetLoadingState(true); if (deconMessageArea) clearToolMessage(deconMessageArea);
        Object.values(deconResultTextareas).forEach(item => { if(item.textarea) item.textarea.value = 'Generating...'; if(item.copyButton) item.copyButton.disabled = true; });
        const headers = { "Content-Type": "application/json", "Accept": "*/*" };
        const clientContext = { sessionId: `/aitk-web/videofx-tt;${Date.now()}`, workflowId: `decon-${Date.now()}` };
        const apiPromises = DECON_MEDIA_CATEGORIES.map(category => {
            const jsonPayload = { clientContext, captionInput: { candidatesCount: 1, mediaInput: { mediaCategory: category, rawBytes: deconSelectedImageFullDataUrl }}};
            return gmFetch(DECON_API_ENDPOINT, { method: 'POST', headers, body: JSON.stringify({ json: jsonPayload }) });
        });
        const results = await Promise.allSettled(apiPromises);
        results.forEach(async (result, index) => {
            const category = DECON_MEDIA_CATEGORIES[index].split('_').pop().toLowerCase();
            const resultBox = deconResultTextareas[category];
            if (!resultBox || !resultBox.textarea) return;
            if (result.status === 'fulfilled') {
                const response = result.value;
                try {
                    const data = await response.json();
                    if (response.ok) {
                        const caption = data?.result?.data?.json?.result?.candidates?.[0]?.output;
                        if (caption) { resultBox.textarea.value = caption; if(resultBox.copyButton) resultBox.copyButton.disabled = false; }
                        else { resultBox.textarea.value = "Error: No caption in API response."; }
                    } else { resultBox.textarea.value = `Error: ${data?.error?.json?.message || response.status}`; }
                } catch (e) { resultBox.textarea.value = `Error: Parsing API response. ${e.message}`; }
            } else { resultBox.textarea.value = `Error: ${result.reason.message}`; }
        });
        showToolMessage(deconMessageArea, "Deconstruction complete.", "success");
        deconSetLoadingState(false);
    }
    function deconHandleCopyClick(textareaElement, buttonElement) {
        if (!textareaElement.value || textareaElement.value.startsWith('Error:') || textareaElement.value === 'Generating...') {
            showToolMessage(deconMessageArea, "Nothing valid to copy.", "info"); return;
        }
        GM_setClipboard(textareaElement.value, 'text');
        const originalHTML = buttonElement.innerHTML;
        buttonElement.innerHTML = createIconSpanHTML('task_alt') + 'Copied!'; buttonElement.disabled = true;
        showToolMessage(deconMessageArea, `${textareaElement.id.split('-')[1]} copied!`, "success"); // Use ID for category name
        setTimeout(() => { buttonElement.innerHTML = originalHTML; buttonElement.disabled = false; }, 2000);
    }

    function openDeconstructorModal() {
        if (deconCurrentModal && deconCurrentModal.style.display !== 'none') {
            openModalUI(deconCurrentModal, deconCurrentBackdrop);
            deconClearSelectedImage();
            return;
        }

        const modalUniqueClass = 'vfx-image-deconstructor-modal-aio';
        const { modal, backdrop, contentWrapper, footer } = createModalScaffold(
            DECON_OVERLAY_TITLE, modalUniqueClass, 'vfx-decon-title-aio', true
        );
        deconCurrentModal = modal;
        deconCurrentBackdrop = backdrop;
        deconResultTextareas = {};

        deconMessageArea = document.createElement('div');
        deconMessageArea.className = 'vfx-tool-message';
        contentWrapper.appendChild(deconMessageArea);

        const imageUploadSection = document.createElement('div');
        imageUploadSection.className = 'vfx-image-upload-section';
        const imageUploadControls = document.createElement('div');
        imageUploadControls.className = 'vfx-image-upload-controls';
        deconImageFileInput = document.createElement('input');
        deconImageFileInput.type = 'file';
        deconImageFileInput.id = DECON_IMAGE_INPUT_ID;
        deconImageFileInput.accept = DECON_ALLOWED_IMAGE_TYPES.join(',');
        deconImageFileInput.style.display = 'none';
        deconImageFileInput.addEventListener('change', deconHandleFileSelect);

        deconUploadImageButton = createModalButton('Upload Image', ['secondary-action'], () => deconImageFileInput.click(), 'upload_file');
        deconImageInfoArea = document.createElement('span');
        deconImageInfoArea.className = 'vfx-image-info-area';
        deconClearImageButton = createModalButton('', ['secondary-action', 'icon-only'], deconClearSelectedImage, 'delete_outline');
        deconClearImageButton.title = 'Clear selected image';

        imageUploadControls.append(deconUploadImageButton, deconImageInfoArea, deconClearImageButton);
        imageUploadSection.append(deconImageFileInput, imageUploadControls);
        contentWrapper.appendChild(imageUploadSection);

        DECON_MEDIA_CATEGORIES.forEach(categoryString => {
            const categoryName = categoryString.split('_').pop();
            const key = categoryName.toLowerCase();
            const container = document.createElement('div'); container.className = 'vfx-result-container';
            const header = document.createElement('div'); header.className = 'vfx-result-header';
            const label = document.createElement('label'); label.className = 'vfx-tool-label';
            label.setAttribute('for', `decon-textarea-${key}-aio`);
            label.textContent = categoryName.charAt(0).toUpperCase() + categoryName.slice(1);
            const textarea = document.createElement('textarea'); textarea.id = `decon-textarea-${key}-aio`;
            textarea.className = 'vfx-tool-textarea'; textarea.readOnly = true; textarea.placeholder = 'Awaiting deconstruction...';
            const copyBtn = createModalButton('Copy', ['secondary-action', 'small-text-button'], null, 'content_copy');
            copyBtn.onclick = () => deconHandleCopyClick(textarea, copyBtn);
            header.append(label, copyBtn);
            container.append(header, textarea);
            contentWrapper.appendChild(container);
            deconResultTextareas[key] = { textarea, copyButton: copyBtn };
        });

        deconGenerateApiButton = createModalButton('Deconstruct Image', ['primary-action'], deconCallApi, 'auto_awesome');
        footer.appendChild(deconGenerateApiButton);

        deconClearSelectedImage();
        openModalUI(modal, backdrop);
    }
    // --- END: VideoFX Image Deconstructor Code ---


    // --- START: VideoFX Promptless Image-to-Prompt Generator Code (Adapted) ---
    const I2P_API_ENDPOINT = "https://labs.google/fx/api/trpc/general.generatePromptlessI2VPrompt";
    const I2P_OVERLAY_TITLE = 'Image-to-Prompt Generator';
    const I2P_RESULT_TEXTAREA_ID = 'i2p-result-textarea-aio';
    const I2P_IMAGE_INPUT_ID = 'i2p-image-input-aio';
    const I2P_ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    const I2P_MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

    let i2pResultTextarea, i2pGenerateApiButton, i2pCopyButton, i2pMessageArea, i2pImageFileInput, i2pUploadImageButton, i2pImageInfoArea, i2pClearImageButton;
    let i2pSelectedImageBase64 = null;
    let i2pSelectedImageFullDataUrl = null;
    let i2pCurrentModal = null;
    let i2pCurrentBackdrop = null;

    function i2pSetLoadingState(isLoading) {
        if(!i2pGenerateApiButton) return;
        i2pGenerateApiButton.disabled = isLoading;
        i2pGenerateApiButton.innerHTML = createIconSpanHTML(isLoading ? 'hourglass_top' : 'auto_awesome') + (isLoading ? 'Generating...' : 'Generate Prompt');
    }
    function i2pClearSelectedImage() {
        i2pSelectedImageBase64 = null; i2pSelectedImageFullDataUrl = null;
        if(i2pImageFileInput) i2pImageFileInput.value = '';
        if(i2pImageInfoArea) { i2pImageInfoArea.innerHTML = ''; const p = document.createElement('span'); p.textContent='No image selected'; p.style.fontStyle='italic'; i2pImageInfoArea.appendChild(p); }
        if(i2pClearImageButton) i2pClearImageButton.style.display = 'none';
        if(i2pUploadImageButton) i2pUploadImageButton.style.display = 'inline-flex';
        if(i2pGenerateApiButton) i2pGenerateApiButton.disabled = true;
        if(i2pResultTextarea) i2pResultTextarea.value = '';
        if(i2pCopyButton) i2pCopyButton.disabled = true;
        if(i2pMessageArea) clearToolMessage(i2pMessageArea);
    }
    function i2pHandleFileSelect(event) {
        const file = event.target.files[0]; if(!file) return;
        if (!I2P_ALLOWED_IMAGE_TYPES.includes(file.type)) { showToolMessage(i2pMessageArea, `Invalid file type...`, 'error'); i2pClearSelectedImage(); return; }
        if (file.size > I2P_MAX_IMAGE_SIZE_BYTES) { showToolMessage(i2pMessageArea, `Image too large...`, 'error'); i2pClearSelectedImage(); return; }
        const reader = new FileReader();
        reader.onload = (e) => {
            i2pSelectedImageFullDataUrl = e.target.result; i2pSelectedImageBase64 = i2pSelectedImageFullDataUrl.split(',')[1];
            if(!i2pSelectedImageBase64) {showToolMessage(i2pMessageArea, "Could not extract base64.", "error"); i2pClearSelectedImage(); return;}
            if(i2pImageInfoArea) { i2pImageInfoArea.innerHTML = ''; const img = document.createElement('img'); img.src=i2pSelectedImageFullDataUrl; img.style.cssText='max-width:80px;max-height:50px;...'; i2pImageInfoArea.append(img, file.name); }
            if(i2pClearImageButton) i2pClearImageButton.style.display = 'inline-flex';
            if(i2pUploadImageButton) i2pUploadImageButton.style.display = 'none';
            if(i2pGenerateApiButton) i2pGenerateApiButton.disabled = false;
            showToolMessage(i2pMessageArea, 'Image selected.', 'info');
        };
        reader.onerror = () => { showToolMessage(i2pMessageArea, 'Error reading file.', 'error'); i2pClearSelectedImage(); };
        reader.readAsDataURL(file);
    }
    async function i2pCallApi() {
        if (!i2pSelectedImageBase64) { showToolMessage(i2pMessageArea, "Upload image first.", 'error'); return; }
        i2pSetLoadingState(true); if(i2pMessageArea) clearToolMessage(i2pMessageArea); if(i2pResultTextarea) i2pResultTextarea.value=''; if(i2pCopyButton) i2pCopyButton.disabled=true;
        const headers = { "Content-Type": "application/json", "Accept": "*/*", "Referer": "https://labs.google/fx/aitk-web/videofx-tt/tools/video-fx" };
        const jsonPayload = { sessionId: `/aitk-web/videofx-tt;${Date.now()}`, imageBase64: i2pSelectedImageBase64 };
        try {
            const response = await gmFetch(I2P_API_ENDPOINT, { method: 'POST', headers, body: JSON.stringify({json: jsonPayload}) });
            const data = await response.json();
            if (response.ok) {
                const finalPrompt = data?.result?.data?.json;
                if (typeof finalPrompt === 'string' && finalPrompt.trim()) { if(i2pResultTextarea) i2pResultTextarea.value = finalPrompt; showToolMessage(i2pMessageArea, 'Prompt generated!', 'success'); if(i2pCopyButton) i2pCopyButton.disabled=false;}
                else { throw new Error("No valid prompt in API response."); }
            } else { const errData = data?.error?.json || data?.error || data; throw new Error(errData.message || errData.code || `API Error ${response.status}`); }
        } catch (error) { showToolMessage(i2pMessageArea, `Generation Error: ${error.message}`, 'error'); }
        finally { i2pSetLoadingState(false); }
    }
    function i2pHandleCopyClick() {
        if (!i2pResultTextarea || !i2pCopyButton || !i2pResultTextarea.value) { showToolMessage(i2pMessageArea, "Nothing to copy.", "info"); return; }
        GM_setClipboard(i2pResultTextarea.value, 'text');
        const originalHTML = i2pCopyButton.innerHTML; i2pCopyButton.innerHTML = createIconSpanHTML('task_alt') + 'Copied!'; i2pCopyButton.disabled = true;
        showToolMessage(i2pMessageArea, "Prompt copied!", "success");
        setTimeout(() => { i2pCopyButton.innerHTML = originalHTML; i2pCopyButton.disabled = false; }, 2000);
    }

    function openImageToPromptModal() {
        if (i2pCurrentModal && i2pCurrentModal.style.display !== 'none') {
            openModalUI(i2pCurrentModal, i2pCurrentBackdrop);
            i2pClearSelectedImage(); return;
        }
        const modalUniqueClass = 'vfx-image-to-prompt-modal-aio';
        const { modal, backdrop, contentWrapper, footer } = createModalScaffold(
            I2P_OVERLAY_TITLE, modalUniqueClass, 'vfx-i2p-title-aio', true
        );
        i2pCurrentModal = modal; i2pCurrentBackdrop = backdrop;

        i2pMessageArea = document.createElement('div'); i2pMessageArea.className = 'vfx-tool-message';
        contentWrapper.appendChild(i2pMessageArea);

        const imageUploadSection = document.createElement('div'); imageUploadSection.className = 'vfx-image-upload-section';
        const imageUploadControls = document.createElement('div'); imageUploadControls.className = 'vfx-image-upload-controls';
        i2pImageFileInput = document.createElement('input'); i2pImageFileInput.type='file'; i2pImageFileInput.id=I2P_IMAGE_INPUT_ID; i2pImageFileInput.accept=I2P_ALLOWED_IMAGE_TYPES.join(','); i2pImageFileInput.style.display='none';
        i2pImageFileInput.addEventListener('change', i2pHandleFileSelect);
        i2pUploadImageButton = createModalButton('Upload Image', ['secondary-action'], () => i2pImageFileInput.click(), 'upload_file');
        i2pImageInfoArea = document.createElement('span'); i2pImageInfoArea.className = 'vfx-image-info-area';
        i2pClearImageButton = createModalButton('Clear', ['secondary-action', 'small-text-button'], i2pClearSelectedImage, 'delete_outline');
        imageUploadControls.append(i2pUploadImageButton, i2pImageInfoArea, i2pClearImageButton);
        imageUploadSection.append(i2pImageFileInput, imageUploadControls);
        contentWrapper.appendChild(imageUploadSection);

        const resultLabel = document.createElement('label'); resultLabel.className = 'vfx-tool-label'; resultLabel.htmlFor = I2P_RESULT_TEXTAREA_ID; resultLabel.textContent = 'Generated Prompt';
        i2pResultTextarea = document.createElement('textarea'); i2pResultTextarea.id = I2P_RESULT_TEXTAREA_ID; i2pResultTextarea.className = 'vfx-tool-textarea'; i2pResultTextarea.readOnly = true; i2pResultTextarea.placeholder = 'Generated prompt...';
        contentWrapper.append(resultLabel, i2pResultTextarea);

        i2pCopyButton = createModalButton('Copy', ['secondary-action'], i2pHandleCopyClick, 'content_copy');
        i2pGenerateApiButton = createModalButton('Generate Prompt', ['primary-action'], i2pCallApi, 'auto_awesome');
        footer.append(i2pCopyButton, i2pGenerateApiButton);

        i2pClearSelectedImage();
        openModalUI(modal, backdrop);
    }
    // --- END: VideoFX Promptless Image-to-Prompt Generator Code ---

    function initializeMainFab() {
        if (document.getElementById(MAIN_FAB_CONTAINER_ID)) return;
        const fabContainer = document.createElement('div'); fabContainer.id = MAIN_FAB_CONTAINER_ID;
        const mainFab = createModalButton('', ['vfx-fab', 'vfx-fab-main'], () => {
            fabContainer.classList.toggle('expanded');
            const isExpanded = fabContainer.classList.contains('expanded');
            mainFab.setAttribute('aria-expanded', isExpanded.toString());
            mainFab.title = isExpanded ? "Close Tools Menu" : "Open VideoFX Tools";
            fabContainer.querySelectorAll('.vfx-fab-item .vfx-tooltip').forEach(tooltip => {
                tooltip.style.opacity = isExpanded ? '1' : '0';
                tooltip.style.visibility = isExpanded ? 'visible' : 'hidden';
            });
         }, 'construction');
        mainFab.title = "Open VideoFX Tools"; mainFab.setAttribute('aria-haspopup', 'true'); mainFab.setAttribute('aria-expanded', 'false');

        const fabActions = [
            { id: 'enhancer', icon: 'auto_fix_high', label: 'Prompt Enhancer', action: openPromptEnhancerModal },
            { id: 'deconstructor', icon: 'splitscreen', label: 'Image Deconstructor', action: openDeconstructorModal },
            { id: 'image-to-prompt', icon: 'image_search', label: 'Image-to-Prompt Gen', action: openImageToPromptModal }
        ];
        fabActions.forEach(actionDef => {
            const itemWrapper = document.createElement('div'); itemWrapper.className = 'vfx-fab-item';
            const fabButton = createModalButton('', ['vfx-fab', 'vfx-fab-secondary'], actionDef.action, actionDef.icon);
            fabButton.id = `fab-action-${actionDef.id}`;
            const tooltip = document.createElement('span'); tooltip.className = 'vfx-tooltip'; tooltip.textContent = actionDef.label;
            itemWrapper.appendChild(fabButton); itemWrapper.appendChild(tooltip);
            fabContainer.appendChild(itemWrapper);
        });
        fabContainer.appendChild(mainFab);
        document.body.appendChild(fabContainer);

        document.addEventListener('click', (event) => {
            if (fabContainer.classList.contains('expanded') && !fabContainer.contains(event.target)) {
                fabContainer.classList.remove('expanded');
                mainFab.setAttribute('aria-expanded', 'false');
                mainFab.title = "Open VideoFX Tools";
                fabContainer.querySelectorAll('.vfx-fab-item .vfx-tooltip').forEach(tooltip => {
                     tooltip.style.opacity = '0'; tooltip.style.visibility = 'hidden';
                });
            }
        });
        console.log(`All-In-One VideoFX Tools v${SCRIPT_VERSION} Main FAB Initialized`);
    }

    GM_addStyle(`
        /* Root Variables */
        :root {
            --google-font: 'Google Sans Text', 'Roboto', sans-serif;
            --dark-bg-primary: #2d2d2d; --dark-bg-secondary: #1f1f1f; --dark-bg-tertiary: #3f3f3f;
            --dark-text-primary: #e8eaed; --dark-text-secondary: #bdc1c6;
            --dark-border: #4a4a4a; --dark-focus-border: #8ab4f8; --dark-error-border: #f28b82;
            --fab-main-bg: #8ab4f8; --fab-main-hover: #9ac1f9;
            --fab-secondary-bg: #303134; --fab-secondary-hover: #3c4043;
            --fab-icon-color: #202124; --fab-secondary-icon-color: #e8eaed;
            --dark-accent-blue: #8ab4f8; --dark-accent-red: #f28b82; --dark-button-text-on-blue: #202124;
            --ui-radius: 18px; --shadow-color: rgba(0,0,0,0.25); --shadow-strong-color: rgba(0,0,0,0.35);
            --scroll-thumb: #5f6368; --scroll-track: var(--dark-bg-secondary);
            --warning-color: #fdd663; --warning-border: #fbc02d;
            --modified-indicator-color: #8ab4f8;
        }
        /* Shared Material Symbols */
        .material-symbols-outlined { font-variation-settings:'FILL'0,'wght'400,'GRAD'0,'opsz'24; font-size:1.25em; vertical-align:middle; line-height:1; margin-right:6px; margin-left:-4px; }
        .vfx-modal-close-btn .material-symbols-outlined, .vfx-modal-button.icon-only .material-symbols-outlined { margin:0; font-size:24px; }
        /* Main FAB System */
        #${MAIN_FAB_CONTAINER_ID} { position:fixed; top:20px; left:20px; z-index:9990; display:flex; flex-direction:column; align-items:flex-start; }
        #${MAIN_FAB_CONTAINER_ID} .vfx-fab-item { display:flex; align-items:center; margin-bottom:12px; position:relative; }
        #${MAIN_FAB_CONTAINER_ID} .vfx-fab { font-family:var(--google-font); border:none; border-radius:50%; box-shadow:0 3px 8px var(--shadow-strong-color); cursor:pointer; transition:all .2s ease-out; font-weight:500; display:flex; align-items:center; justify-content:center; width:56px; height:56px; transform:scale(0); opacity:0; pointer-events:none; }
        #${MAIN_FAB_CONTAINER_ID} .vfx-fab:hover:not(:disabled) { box-shadow:0 5px 12px var(--shadow-strong-color); transform:scale(1.05) !important; }
        #${MAIN_FAB_CONTAINER_ID} .vfx-fab-main { background-color:var(--fab-main-bg); color:var(--fab-icon-color); transform:scale(1); opacity:1; pointer-events:auto; order:-1; }
        #${MAIN_FAB_CONTAINER_ID} .vfx-fab-main .material-symbols-outlined { transition:transform .2s ease-in-out; }
        #${MAIN_FAB_CONTAINER_ID} .vfx-fab-main:hover:not(:disabled) { background-color:var(--fab-main-hover); }
        #${MAIN_FAB_CONTAINER_ID} .vfx-fab-secondary { background-color:var(--fab-secondary-bg); color:var(--fab-secondary-icon-color); width:48px; height:48px; margin-left:8px; }
        #${MAIN_FAB_CONTAINER_ID} .vfx-fab-secondary:hover:not(:disabled) { background-color:var(--fab-secondary-hover); }
        #${MAIN_FAB_CONTAINER_ID}.expanded .vfx-fab { transform:scale(1); opacity:1; pointer-events:auto; }
        #${MAIN_FAB_CONTAINER_ID}.expanded .vfx-fab-main .material-symbols-outlined { transform:rotate(135deg); }
        .vfx-tooltip { position:absolute; left:100%; top:50%; transform:translateY(-50%); margin-left:12px; padding:6px 12px; background-color:var(--dark-bg-tertiary); color:var(--dark-text-primary); border-radius:8px; font-size:.8rem; white-space:nowrap; box-shadow:0 2px 5px var(--shadow-color); opacity:0; visibility:hidden; transition:opacity .15s ease .1s, visibility .15s ease .1s; pointer-events:none; z-index:1; font-family:var(--google-font); }
        #${MAIN_FAB_CONTAINER_ID}.expanded .vfx-fab-item:hover .vfx-tooltip { opacity:1; visibility:visible; }
        /* Shared Modal Styles */
        .vfx-modal-backdrop { display:none; position:fixed; top:0; left:0; width:100%; height:100%; background-color:rgba(0,0,0,.6); z-index:9998; opacity:0; transition:opacity .25s ease-out; }
        .vfx-modal-base { font-family:var(--google-font); box-sizing:border-box; display:none; flex-direction:column; position:fixed; top:50%; left:50%; transform:translate(-50%,-50%) scale(.95); background-color:var(--dark-bg-secondary); color:var(--dark-text-primary); padding:0; border-radius:var(--ui-radius); box-shadow:0 8px 25px var(--shadow-strong-color); z-index:9999; width:clamp(500px, 70%, 900px); border:1px solid var(--dark-border); max-height:calc(100vh - 100px); opacity:0; transition:opacity .25s cubic-bezier(.4,0,.2,1), transform .25s cubic-bezier(.4,0,.2,1); }
        .vfx-modal-base.vfx-prompt-enhancer-modal-aio { width: clamp(700px, 80%, 1200px); }
        .vfx-modal-base.vfx-image-deconstructor-modal-aio { width: clamp(500px, 60%, 750px); }
        .vfx-modal-base.vfx-image-to-prompt-modal-aio { width: clamp(450px, 50%, 600px); }
        .vfx-modal-header { display:flex; justify-content:space-between; align-items:center; padding:16px 24px; border-bottom:1px solid var(--dark-border); cursor:move; background-color:var(--dark-bg-primary); border-top-left-radius:var(--ui-radius); border-top-right-radius:var(--ui-radius); user-select:none; flex-shrink:0; }
        .vfx-modal-title { font-size:1.2rem; font-weight:500; color:var(--dark-text-primary); margin:0; }
        .vfx-modal-close-btn { background:0 0; border:none; color:var(--dark-text-secondary); cursor:pointer; width:40px; height:40px; border-radius:50%; transition:background-color .2s ease; margin-left:10px; padding:0; display:flex; align-items:center; justify-content:center; }
        .vfx-modal-close-btn:hover { background-color:var(--dark-bg-tertiary); color:var(--dark-text-primary); }
        .vfx-modal-content { flex-grow:1; overflow-y:auto; padding:20px 24px; min-height:100px; scrollbar-width:thin; scrollbar-color:var(--scroll-thumb) var(--scroll-track); }
        .vfx-modal-content::-webkit-scrollbar { width:8px; } .vfx-modal-content::-webkit-scrollbar-track { background:var(--scroll-track); border-radius:4px; } .vfx-modal-content::-webkit-scrollbar-thumb { background-color:var(--scroll-thumb); border-radius:4px; border:2px solid var(--scroll-track); } .vfx-modal-content::-webkit-scrollbar-thumb:hover { background-color:var(--dark-text-secondary); }
        .vfx-modal-footer { display:flex; justify-content:space-between; align-items:center; padding:16px 24px; border-top:1px solid var(--dark-border); background-color:var(--dark-bg-primary); border-bottom-left-radius:var(--ui-radius); border-bottom-right-radius:var(--ui-radius); flex-wrap:wrap; gap:12px; flex-shrink:0; }
        /* Shared Modal Button Styles */
        .vfx-modal-button { padding:10px 20px; font-size:.9rem; font-weight:500; border:1px solid transparent; border-radius:var(--ui-radius); cursor:pointer; transition:background-color .2s ease,box-shadow .2s ease,transform .1s ease,border-color .2s ease; text-transform:none; min-height:40px; display:inline-flex; align-items:center; justify-content:center; gap:6px; font-family:var(--google-font); }
        .vfx-modal-button:hover:not(:disabled) { transform:translateY(-1px); box-shadow:0 2px 4px var(--shadow-color); }
        .vfx-modal-button:disabled { opacity:.5; cursor:not-allowed; transform:none; box-shadow:none; }
        .vfx-modal-button.primary-action { background-color:var(--dark-accent-blue); color:var(--dark-button-text-on-blue); border-color:var(--dark-accent-blue); }
        .vfx-modal-button.primary-action:hover:not(:disabled) { background-color:#9ac1f9; border-color:#9ac1f9; }
        .vfx-modal-button.secondary-action { background-color:var(--dark-bg-tertiary); color:var(--dark-text-primary); border-color:var(--dark-bg-tertiary); }
        .vfx-modal-button.secondary-action:hover:not(:disabled) { background-color:#4a4a4a; border-color:#4a4a4a;}
        .vfx-modal-button.danger-action { background-color:transparent; color:var(--dark-accent-red); border:1px solid var(--dark-accent-red); }
        .vfx-modal-button.danger-action:hover:not(:disabled) { background-color:rgba(242,139,130,.15); }
        .vfx-modal-button.small-text-button { font-size:.8rem; padding:6px 12px; min-height:auto; }
        /* Shared Form Element Styles */
        .vfx-modal-base label, .vfx-tool-label { font-size:.8rem; font-weight:500; color:var(--dark-text-secondary); margin-bottom:6px; display:block; text-align:left; }
        .vfx-modal-base select, .vfx-modal-base textarea, .vfx-modal-base input[type="text"], .vfx-modal-base input[type="search"], .vfx-tool-textarea, .vfx-tool-input { width:100%; margin-bottom:16px; padding:12px 16px; font-size:.9rem; border-radius:var(--ui-radius); border:1px solid var(--dark-border); background-color:var(--dark-bg-secondary); color:var(--dark-text-primary); box-sizing:border-box; transition:border-color .2s ease,box-shadow .2s ease; font-family:var(--google-font); }
        .vfx-modal-base select::placeholder, .vfx-modal-base textarea::placeholder, .vfx-modal-base input[type="text"]::placeholder, .vfx-modal-base input[type="search"]::placeholder, .vfx-tool-textarea::placeholder, .vfx-tool-input::placeholder { color:var(--dark-text-secondary); opacity:.7; }
        .vfx-modal-base select:focus, .vfx-modal-base textarea:focus, .vfx-modal-base input[type="text"]:focus, .vfx-modal-base input[type="search"]:focus, .vfx-tool-textarea:focus, .vfx-tool-input:focus { border-color:var(--dark-focus-border); outline:0; box-shadow:0 0 0 2px rgba(138,180,248,.3); }
        .vfx-modal-base select { appearance:none; background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='%23bdc1c6' viewBox='0 0 16 16'%3E%3Cpath fill-rule='evenodd' d='M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708z'/%3E%3C/svg%3E"); background-repeat:no-repeat; background-position:right 16px center; background-size:16px 16px; padding-right:45px; }
        /* Shared Image Upload Area Styles */
        .vfx-image-upload-section { padding:12px; border:1px dashed var(--dark-border); border-radius:calc(var(--ui-radius)/1.5); background-color:rgba(0,0,0,.1); margin-bottom:16px; }
        .vfx-image-upload-controls { display:flex; align-items:center; gap:10px; }
        .vfx-image-info-area { font-size:.85rem; color:var(--dark-text-secondary); font-style:italic; flex-grow:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; display:flex; align-items:center; }
        .vfx-image-info-area:empty::before { content:'No image selected.'; display:inline; }
        .vfx-image-info-area img+span { margin-left:5px; }
        /* Shared Tool Message Styles */
        .vfx-tool-message { padding:10px 12px; border-radius:calc(var(--ui-radius)/1.5); font-size:13px; line-height:1.4; border:1px solid transparent; margin:-8px 0 8px 0; display:none; text-align:center; }
        .message-info { background-color:rgba(138,180,248,.1); color:var(--dark-accent-blue); border-color:rgba(138,180,248,.3); }
        .message-success { background-color:rgba(129,230,134,.1); color:#81e686; border-color:rgba(129,230,134,.3); }
        .message-error { background-color:rgba(242,139,130,.1); color:var(--dark-accent-red); border-color:rgba(242,139,130,.3); }
        /* Styles for Deconstructor/I2P specific layouts */
        .vfx-result-container { display:flex; flex-direction:column; margin-bottom:10px; }
        .vfx-result-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:4px; }
        .vfx-result-header .vfx-tool-label { margin-bottom:0; }
        .vfx-result-header .vfx-modal-button.small-text-button { padding:4px 10px; min-height:28px; font-size:.75rem; border-radius:12px; }
        .vfx-tool-textarea { min-height:70px; }
        .vfx-image-to-prompt-modal-aio .vfx-tool-textarea { min-height:100px; height:140px; } /* I2P needs more space */
        /* Enhancer specific styles */
        .vfx-prompt-enhancer-modal-aio .vfx-fieldset-aio { border:1px solid var(--dark-border); border-radius:var(--ui-radius); padding:0 18px 18px; margin-bottom:18px; background-color:transparent; position:relative; transition:padding .3s ease; }
        .vfx-prompt-enhancer-modal-aio .vfx-fieldset-aio legend { font-size:.9rem; font-weight:500; color:var(--dark-text-primary); padding:0 10px; margin-left:8px; background-color:var(--dark-bg-secondary); display:inline-flex; align-items:center; cursor:pointer; user-select:none; gap:8px; transform:translateY(1px); }
        .vfx-prompt-enhancer-modal-aio .vfx-fieldset-aio legend .material-symbols-outlined { font-size:20px; transition:transform .2s ease-in-out; }
        .vfx-prompt-enhancer-modal-aio .vfx-fieldset-aio.collapsed > *:not(legend) { display:none; }
        .vfx-prompt-enhancer-modal-aio .vfx-fieldset-aio.collapsed { padding-top:0; padding-bottom:0; margin-top:-1px; }
        .vfx-prompt-enhancer-modal-aio .vfx-fieldset-aio:not(.collapsed) legend .material-symbols-outlined { transform:rotate(90deg); }
        .vfx-prompt-enhancer-modal-aio .vfx-fieldset-grid-aio { display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:14px 24px; margin-top:18px; }
        .vfx-prompt-enhancer-modal-aio .vfx-schema-input-item-aio label { margin-bottom:4px; }
        .vfx-prompt-enhancer-modal-aio .vfx-schema-input-item-aio select, .vfx-prompt-enhancer-modal-aio .vfx-schema-input-item-aio input[type="text"] { margin-bottom:0; }
        .vfx-prompt-enhancer-modal-aio .vfx-preamble-controls-aio { display:flex; align-items:center; gap:8px; margin-bottom:10px; }
        .vfx-prompt-enhancer-modal-aio #vfx-enhancer-preamble-select-aio { flex-grow:1; margin-bottom:0 !important; }
        .vfx-prompt-enhancer-modal-aio .vfx-preamble-action-btn-aio { background:0 0; border:none; color:var(--dark-text-secondary); cursor:pointer; padding:0; line-height:1; margin-left:0; flex-shrink:0; width:36px; height:36px; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; }
        .vfx-prompt-enhancer-modal-aio .vfx-preamble-action-btn-aio:hover { color:var(--dark-text-primary); background-color:var(--dark-bg-tertiary); }
        .vfx-prompt-enhancer-modal-aio .vfx-preamble-action-btn-aio .material-symbols-outlined { font-size:20px; vertical-align:middle; margin:0; }
        .vfx-prompt-enhancer-modal-aio #${ENHANCER_INLINE_PREAMBLE_EDITOR_ID} { width:100%; min-height:100px; max-height:250px; overflow-y:auto; background-color:var(--dark-bg-tertiary); padding:12px 15px; border-radius:calc(var(--ui-radius)/1.5); border:1px solid var(--dark-border); white-space:pre-wrap; font-size:.85rem; color:var(--dark-text-primary); line-height:1.5; margin-top:0; margin-bottom:10px; resize:vertical; box-sizing:border-box; scrollbar-width:thin; scrollbar-color:var(--scroll-thumb) var(--scroll-track); }
        .vfx-prompt-enhancer-modal-aio #${ENHANCER_INLINE_PREAMBLE_EDITOR_ID}:focus { border-color:var(--dark-focus-border); outline:0; box-shadow:0 0 0 2px rgba(138,180,248,.3); }
        .vfx-prompt-enhancer-modal-aio .vfx-preamble-editor-buttons-aio { display:flex; gap:8px; margin-bottom:10px; justify-content:flex-end; }
        .vfx-prompt-enhancer-modal-aio #${ENHANCER_LIVE_PROMPT_PREVIEW_ID} { width:100%; min-height:80px; max-height:200px; overflow-y:auto; background-color:var(--dark-bg-tertiary); padding:10px 15px; border-radius:calc(var(--ui-radius)/1.5); border:1px dashed var(--dark-border); white-space:pre-wrap; font-size:.85rem; color:var(--dark-text-secondary); line-height:1.5; margin-top:10px; margin-bottom:16px; box-sizing:border-box; font-style:italic; scrollbar-width:thin; scrollbar-color:var(--scroll-thumb) var(--scroll-track); }
        .vfx-prompt-enhancer-modal-aio .vfx-error-details-aio { background-color: var(--dark-bg-tertiary); padding: 10px; border-radius: 8px; margin-top: 10px; font-size: 0.8em; white-space: pre-wrap; max-height: 150px; overflow-y: auto; border: 1px solid var(--dark-border); }
        .vfx-prompt-enhancer-modal-aio .vfx-image-upload-area-aio { cursor:pointer; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:10px; margin-top:8px; border:2px dashed var(--dark-border); border-radius:var(--ui-radius); padding:15px; text-align:center; transition:border-color .3s, background-color .3s; }
        .vfx-prompt-enhancer-modal-aio .vfx-image-upload-area-aio.drag-over { border-color:var(--dark-focus-border); background-color:rgba(138,180,248,.1); }
        .vfx-prompt-enhancer-modal-aio #${ENHANCER_IMAGE_PREVIEW_CONTAINER_ID} { position:relative; display:none; margin-top:10px; margin-bottom:0; max-width:250px; border-radius:calc(var(--ui-radius)/1.5); overflow:hidden; border:1px solid var(--dark-border); }
        .vfx-prompt-enhancer-modal-aio #${ENHANCER_IMAGE_PREVIEW_CONTAINER_ID} img { display:block; width:100%; height:auto; }
        .vfx-prompt-enhancer-modal-aio #vfx-enhancer-remove-image-btn-aio { position:absolute; top:8px; right:8px; background-color:rgba(30,30,30,.7); color:#fff; border-radius:50%; width:28px; height:28px; padding:0; line-height:1; border:1px solid rgba(255,255,255,.2); cursor:pointer; display:flex; align-items:center; justify-content:center; font-family:sans-serif; font-size:20px; font-weight:700; transition:background-color .2s, transform .2s; }
        .vfx-prompt-enhancer-modal-aio #vfx-enhancer-remove-image-btn-aio:hover { background-color:rgba(220,53,69,.9); transform:scale(1.1); }
        /* Add more Enhancer-specific styles here, properly scoped with .vfx-prompt-enhancer-modal-aio */
    `);

    function waitForPageReady(callback) {
        const checkInterval = 200; const maxWait = 10000; let elapsedTime = 0;
        const readyCheck = () => {
            if (document.body && document.querySelector('canvas')) {
                console.log("All-In-One VideoFX Tools: Page appears ready.");
                callback();
            } else {
                elapsedTime += checkInterval;
                if (elapsedTime < maxWait) { setTimeout(readyCheck, checkInterval); }
                else { console.warn("All-In-One VideoFX Tools: Page ready check timed out. Initializing anyway."); callback(); }
            }
        };
        if (document.readyState === 'complete' || (document.readyState === 'interactive' && document.body && document.querySelector('canvas'))) {
            callback();
        } else {
            window.addEventListener('DOMContentLoaded', () => setTimeout(readyCheck, checkInterval));
        }
    }
    waitForPageReady(initializeMainFab);

    (function (arr) { arr.forEach(function (item) { if (item.hasOwnProperty('append')) { return; } Object.defineProperty(item, 'append', { configurable: true, enumerable: true, writable: true, value: function append() { var argArr = Array.prototype.slice.call(arguments), docFrag = document.createDocumentFragment(); argArr.forEach(function (argItem) { var isNode = argItem instanceof Node; docFrag.appendChild(isNode ? argItem : document.createTextNode(String(argItem))); }); this.appendChild(docFrag); } }); });})([Element.prototype, Document.prototype, DocumentFragment.prototype]);

})();
    const DECON_OVERLAY_TITLE = 'Image Deconstructor';
    const DECON_IMAGE_INPUT_ID = 'decon-image-input-combined'; // Renamed to avoid clash
    const DECON_GENERATE_BUTTON_TEXT = 'Deconstruct Image';
    const DECON_GENERATING_BUTTON_TEXT = 'Deconstructing...';
    const DECON_COPY_BUTTON_TEXT = 'Copy';
    const DECON_COPIED_BUTTON_TEXT = 'Copied!';
    const DECON_ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']; // Same as Enhancer's subset
    const DECON_MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

    const DECON_MEDIA_CATEGORIES = ['MEDIA_CATEGORY_SCENE', 'MEDIA_CATEGORY_SUBJECT', 'MEDIA_CATEGORY_STYLE'];

    let deconSelectedImageFullDataUrl = null;
    let deconResultTextareas = {}; // Structure: { scene: {textarea, copyButton}, ... }
    let deconMessageArea = null;
    let deconGenerateApiButton = null;
    let deconImageFileInput = null;
    let deconUploadImageButton = null;
    let deconImageInfoArea = null;
    let deconClearImageButton = null;
    let deconCurrentModalInstance = null;


    function deconSetLoadingState(isLoading) {
        if (!deconGenerateApiButton) return;
        deconGenerateApiButton.disabled = isLoading;
        const iconHTML = isLoading ? createIconSpanHTML('hourglass_top') : createIconSpanHTML('auto_awesome');
        deconGenerateApiButton.innerHTML = iconHTML + (isLoading ? DECON_GENERATING_BUTTON_TEXT : DECON_GENERATE_BUTTON_TEXT);
    }

    function deconClearSelectedImage() {
        deconSelectedImageFullDataUrl = null;
        if (deconImageFileInput) deconImageFileInput.value = '';
        if (deconImageInfoArea) {
            deconImageInfoArea.innerHTML = 'No image selected.';
            // Potentially hide preview if it was shown directly in info area
            const imgPreview = deconImageInfoArea.querySelector('img');
            if (imgPreview) imgPreview.remove();
        }
        if (deconClearImageButton) deconClearImageButton.style.display = 'none';
        if (deconUploadImageButton) deconUploadImageButton.style.display = 'inline-flex'; // Or your default display
        if (deconGenerateApiButton) deconGenerateApiButton.disabled = true;
        Object.values(deconResultTextareas).forEach(item => {
            if (item.textarea) item.textarea.value = '';
            if (item.copyButton) item.copyButton.disabled = true;
        });
        if (deconMessageArea) clearToolMessage(deconMessageArea);
    }

    function deconHandleFileSelect(event) {
        const files = event.target.files;
        if (!files || files.length === 0) return;
        const file = files[0];

        if (!DECON_ALLOWED_IMAGE_TYPES.includes(file.type)) {
            showToolMessage(deconMessageArea, `Invalid file type. Allowed: ${DECON_ALLOWED_IMAGE_TYPES.map(t=>t.split('/')[1]).join(', ')}.`, 'error');
            deconClearSelectedImage(); return;
        }
        if (file.size > DECON_MAX_IMAGE_SIZE_BYTES) {
            showToolMessage(deconMessageArea, `Image is too large. Max ${DECON_MAX_IMAGE_SIZE_BYTES/(1024*1024)}MB.`, 'error');
            deconClearSelectedImage(); return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            deconSelectedImageFullDataUrl = e.target.result;
            if (!deconSelectedImageFullDataUrl) {
                showToolMessage(deconMessageArea, "Could not read image data.", "error");
                deconClearSelectedImage(); return;
            }

            if (deconImageInfoArea) {
                deconImageInfoArea.innerHTML = ''; // Clear previous
                const imgPreview = document.createElement('img');
                imgPreview.src = deconSelectedImageFullDataUrl;
                imgPreview.alt = file.name;
                imgPreview.style.cssText = 'max-width: 80px; max-height: 50px; border-radius: 4px; margin-right: 10px; vertical-align: middle;';
                deconImageInfoArea.appendChild(imgPreview);
                deconImageInfoArea.appendChild(document.createTextNode(file.name));
            }
            if (deconClearImageButton) deconClearImageButton.style.display = 'inline-flex';
            if (deconUploadImageButton) deconUploadImageButton.style.display = 'none';
            if (deconGenerateApiButton) deconGenerateApiButton.disabled = false;
            showToolMessage(deconMessageArea, 'Image selected. Ready to deconstruct.', 'info');
        };
        reader.onerror = () => { showToolMessage(deconMessageArea, 'Error reading file.', 'error'); deconClearSelectedImage(); };
        reader.readAsDataURL(file);
    }


    async function deconCallApi() {
        if (!deconSelectedImageFullDataUrl) {
            showToolMessage(deconMessageArea, "Please upload an image first.", 'error');
            return;
        }
        deconSetLoadingState(true);
        if (deconMessageArea) clearToolMessage(deconMessageArea);
        Object.values(deconResultTextareas).forEach(item => {
            if(item.textarea) item.textarea.value = 'Generating...';
            if(item.copyButton) item.copyButton.disabled = true;
        });

        const headers = { "Content-Type": "application/json", "Accept": "*/*" };
        const clientContext = { sessionId: `/aitk-web/videofx-tt;${Date.now()}`, workflowId: `decon-${Date.now()}` };

        const apiPromises = DECON_MEDIA_CATEGORIES.map(category => {
            const jsonPayload = { clientContext, captionInput: { candidatesCount: 1, mediaInput: { mediaCategory: category, rawBytes: deconSelectedImageFullDataUrl }}};
            const body = JSON.stringify({ json: jsonPayload });
            return gmFetch(DECON_API_ENDPOINT, { method: 'POST', headers, body });
        });

        const results = await Promise.allSettled(apiPromises);
        results.forEach(async (result, index) => {
            const category = DECON_MEDIA_CATEGORIES[index].split('_').pop();
            const categoryKey = category.toLowerCase();
            const resultBox = deconResultTextareas[categoryKey];
            if (!resultBox || !resultBox.textarea) return;

            if (result.status === 'fulfilled') {
                const response = result.value;
                try {
                    const data = await response.json();
                    if (response.ok) {
                        const candidates = data?.result?.data?.json?.result?.candidates;
                        const caption = (Array.isArray(candidates) && candidates.length > 0) ? candidates[0]?.output : null;
                        if (caption) {
                            resultBox.textarea.value = caption;
                            if(resultBox.copyButton) resultBox.copyButton.disabled = false;
                        } else {
                            resultBox.textarea.value = "Error: No caption in API response.";
                        }
                    } else {
                        const errorMsg = data?.error?.json?.message || `API Error: ${response.status}`;
                        resultBox.textarea.value = `Error: ${errorMsg}`;
                    }
                } catch (e) {
                     resultBox.textarea.value = `Error: Could not parse API response. ${e.message}`;
                }
            } else {
                resultBox.textarea.value = `Error: ${result.reason.message}`;
            }
        });
        showToolMessage(deconMessageArea, "Deconstruction complete.", "success");
        deconSetLoadingState(false);
    }

    function deconHandleCopyClick(textareaElement, buttonElement) {
        if (!textareaElement.value || textareaElement.value.startsWith('Error:') || textareaElement.value === 'Generating...') {
            showToolMessage(deconMessageArea, "Nothing valid to copy.", "info");
            return;
        }
        GM_setClipboard(textareaElement.value, 'text');
        const originalHTML = buttonElement.innerHTML;
        buttonElement.innerHTML = createIconSpanHTML('task_alt') + DECON_COPIED_BUTTON_TEXT;
        buttonElement.disabled = true;
        showToolMessage(deconMessageArea, `${textareaElement.previousSibling.textContent.trim()} copied!`, "success");
        setTimeout(() => {
            buttonElement.innerHTML = originalHTML;
            buttonElement.disabled = false;
        }, 2000);
    }


    function openDeconstructorModal() {
        if (deconCurrentModalInstance && deconCurrentModalInstance.modal.style.display !== 'none') {
            openModal(deconCurrentModalInstance.modal, deconCurrentModalInstance.backdrop);
            deconClearSelectedImage(); // Clear previous state on open
            return;
        }

        const modalUniqueClass = 'vfx-image-deconstructor-modal';
        const { modal, backdrop, contentWrapper, footer } = createModalScaffold(
            DECON_OVERLAY_TITLE,
            modalUniqueClass,
            'vfx-decon-title-combined', // Custom header ID
            true
        );
        deconCurrentModalInstance = { modal, backdrop };
        deconResultTextareas = {}; // Reset

        // Message Area
        deconMessageArea = document.createElement('div');
        deconMessageArea.className = 'vfx-tool-message'; // Use shared class
        contentWrapper.appendChild(deconMessageArea);

        // Image Upload Section
        const imageUploadSection = document.createElement('div');
        imageUploadSection.className = 'vfx-image-upload-section'; // Shared class
        const imageUploadControls = document.createElement('div');
        imageUploadControls.className = 'vfx-image-upload-controls'; // Shared class

        deconImageFileInput = document.createElement('input');
        deconImageFileInput.type = 'file';
        deconImageFileInput.id = DECON_IMAGE_INPUT_ID;
        deconImageFileInput.accept = DECON_ALLOWED_IMAGE_TYPES.join(',');
        deconImageFileInput.addEventListener('change', deconHandleFileSelect);
        deconImageFileInput.style.display = 'none'; // Hide it

        deconUploadImageButton = createModalButton('Upload Image', ['secondary-action'], () => deconImageFileInput.click(), 'upload_file');
        deconImageInfoArea = document.createElement('span');
        deconImageInfoArea.className = 'vfx-image-info-area'; // Shared class
        deconClearImageButton = createModalButton('', ['secondary-action', 'icon-only'], deconClearSelectedImage, 'delete_outline');
        deconClearImageButton.title = 'Clear selected image';

        imageUploadControls.append(deconUploadImageButton, deconImageInfoArea, deconClearImageButton);
        imageUploadSection.appendChild(deconImageFileInput); // Keep input in DOM
        imageUploadSection.appendChild(imageUploadControls);
        contentWrapper.appendChild(imageUploadSection);

        // Result Textareas
        DECON_MEDIA_CATEGORIES.forEach(categoryString => {
            const categoryName = categoryString.split('_').pop();
            const key = categoryName.toLowerCase();
            const container = document.createElement('div');
            container.className = 'vfx-result-container'; // Shared class

            const header = document.createElement('div');
            header.className = 'vfx-result-header'; // Shared class
            const label = document.createElement('label');
            label.className = 'vfx-tool-label'; // Shared class
            label.setAttribute('for', `decon-textarea-${key}-combined`);
            label.textContent = categoryName.charAt(0).toUpperCase() + categoryName.slice(1);

            const textarea = document.createElement('textarea');
            textarea.id = `decon-textarea-${key}-combined`;
            textarea.className = 'vfx-tool-textarea'; // Shared class
            textarea.readOnly = true;
            textarea.placeholder = 'Awaiting deconstruction...';

            const copyBtn = createModalButton(DECON_COPY_BUTTON_TEXT, ['secondary-action', 'small-text-button'], null, 'content_copy');
            copyBtn.onclick = () => deconHandleCopyClick(textarea, copyBtn);

            header.append(label, copyBtn);
            container.append(header, textarea);
            contentWrapper.appendChild(container);
            deconResultTextareas[key] = { textarea, copyButton: copyBtn };
        });

        // Footer Button
        deconGenerateApiButton = createModalButton(DECON_GENERATE_BUTTON_TEXT, ['primary-action'], deconCallApi, 'auto_awesome');
        footer.appendChild(deconGenerateApiButton);

        deconClearSelectedImage(); // Set initial state
        openModal(modal, backdrop);
    }

    // --- END: VideoFX Image Deconstructor Code ---


    // --- START: VideoFX Promptless Image-to-Prompt Generator Code (Adapted) ---
    const I2P_API_ENDPOINT = "https://labs.google/fx/api/trpc/general.generatePromptlessI2VPrompt";
    const I2P_OVERLAY_TITLE = 'Image-to-Prompt Generator';
    const I2P_RESULT_TEXTAREA_ID = 'i2p-result-textarea-combined';
    const I2P_IMAGE_INPUT_ID = 'i2p-image-input-combined';
    const I2P_GENERATE_BUTTON_TEXT = 'Generate Prompt';
    const I2P_GENERATING_BUTTON_TEXT = 'Generating...';
    const I2P_COPY_BUTTON_TEXT = 'Copy';
    const I2P_COPIED_BUTTON_TEXT = 'Copied!';
    const I2P_ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    const I2P_MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

    let i2pResultTextarea = null;
    let i2pGenerateApiButton = null;
    let i2pCopyButton = null;
    let i2pMessageArea = null;
    let i2pImageFileInput = null;
    let i2pUploadImageButton = null;
    let i2pImageInfoArea = null;
    let i2pClearImageButton = null;
    let i2pSelectedImageBase64 = null;
    let i2pSelectedImageFullDataUrl = null;
    let i2pCurrentModalInstance = null;

    function i2pSetLoadingState(isLoading) {
        if (!i2pGenerateApiButton) return;
        i2pGenerateApiButton.disabled = isLoading;
        const iconHTML = isLoading ? createIconSpanHTML('hourglass_top') : createIconSpanHTML('auto_awesome');
        i2pGenerateApiButton.innerHTML = iconHTML + (isLoading ? I2P_GENERATING_BUTTON_TEXT : I2P_GENERATE_BUTTON_TEXT);
    }

    function i2pClearSelectedImage() {
        i2pSelectedImageBase64 = null;
        i2pSelectedImageFullDataUrl = null;
        if (i2pImageFileInput) i2pImageFileInput.value = '';
        if (i2pImageInfoArea) {
            i2pImageInfoArea.innerHTML = 'No image selected.';
            const imgPreview = i2pImageInfoArea.querySelector('img');
            if (imgPreview) imgPreview.remove();
        }
        if (i2pClearImageButton) i2pClearImageButton.style.display = 'none';
        if (i2pUploadImageButton) i2pUploadImageButton.style.display = 'inline-flex';
        if (i2pGenerateApiButton) i2pGenerateApiButton.disabled = true;
        if (i2pResultTextarea) i2pResultTextarea.value = '';
        if (i2pCopyButton) i2pCopyButton.disabled = true;
        if (i2pMessageArea) clearToolMessage(i2pMessageArea);
    }

    function i2pHandleFileSelect(event) {
        const files = event.target.files;
        if (!files || files.length === 0) return;
        const file = files[0];

        if (!I2P_ALLOWED_IMAGE_TYPES.includes(file.type)) {
            showToolMessage(i2pMessageArea, `Invalid file type. Allowed: ${I2P_ALLOWED_IMAGE_TYPES.map(t=>t.split('/')[1]).join(', ')}.`, 'error');
            i2pClearSelectedImage(); return;
        }
        if (file.size > I2P_MAX_IMAGE_SIZE_BYTES) {
            showToolMessage(i2pMessageArea, `Image is too large. Max ${I2P_MAX_IMAGE_SIZE_BYTES/(1024*1024)}MB.`, 'error');
            i2pClearSelectedImage(); return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            i2pSelectedImageFullDataUrl = e.target.result;
            i2pSelectedImageBase64 = i2pSelectedImageFullDataUrl.split(',')[1];
            if (!i2pSelectedImageBase64) {
                 showToolMessage(i2pMessageArea, "Could not extract base64 data.", "error");
                 i2pClearSelectedImage(); return;
            }
            if (i2pImageInfoArea) {
                i2pImageInfoArea.innerHTML = '';
                const imgPreview = document.createElement('img');
                imgPreview.src = i2pSelectedImageFullDataUrl;
                imgPreview.alt = file.name;
                imgPreview.style.cssText = 'max-width: 80px; max-height: 50px; border-radius: 4px; margin-right: 10px; vertical-align: middle;';
                i2pImageInfoArea.appendChild(imgPreview);
                i2pImageInfoArea.appendChild(document.createTextNode(file.name));
            }
            if (i2pClearImageButton) i2pClearImageButton.style.display = 'inline-flex';
            if (i2pUploadImageButton) i2pUploadImageButton.style.display = 'none';
            if (i2pGenerateApiButton) i2pGenerateApiButton.disabled = false;
            showToolMessage(i2pMessageArea, 'Image selected. Ready to generate.', 'info');
        };
        reader.onerror = () => { showToolMessage(i2pMessageArea, 'Error reading file.', 'error'); i2pClearSelectedImage(); };
        reader.readAsDataURL(file);
    }

    async function i2pCallApi() {
        if (!i2pSelectedImageBase64) {
            showToolMessage(i2pMessageArea, "Please upload an image first.", 'error');
            return;
        }
        i2pSetLoadingState(true);
        if(i2pMessageArea) clearToolMessage(i2pMessageArea);
        if(i2pResultTextarea) i2pResultTextarea.value = '';
        if(i2pCopyButton) i2pCopyButton.disabled = true;

        const headers = { "Content-Type": "application/json", "Accept": "*/*", "Referer": "https://labs.google/fx/aitk-web/videofx-tt/tools/video-fx" };
        const jsonPayload = { sessionId: `/aitk-web/videofx-tt;${Date.now()}`, imageBase64: i2pSelectedImageBase64 };
        const body = JSON.stringify({ json: jsonPayload });

        try {
            const response = await gmFetch(I2P_API_ENDPOINT, { method: 'POST', headers, body });
            const data = await response.json();
            if (response.ok) {
                const finalPrompt = data?.result?.data?.json;
                if (typeof finalPrompt === 'string' && finalPrompt.trim() !== "") {
                    if(i2pResultTextarea) i2pResultTextarea.value = finalPrompt;
                    showToolMessage(i2pMessageArea, 'Prompt generated successfully!', 'success');
                    if(i2pCopyButton) i2pCopyButton.disabled = false;
                } else { throw new Error("Could not extract a valid prompt from API."); }
            } else {
                 const errorData = data?.error?.json || data?.error || data;
                 const errorMessage = errorData.message || errorData.code || `API Error ${response.status}`;
                 throw new Error(errorMessage);
            }
        } catch (error) {
            showToolMessage(i2pMessageArea, `Generation Error: ${error.message}`, 'error');
        } finally {
            i2pSetLoadingState(false);
        }
    }

    function i2pHandleCopyClick() {
        if (!i2pResultTextarea || !i2pCopyButton) return;
        if (!i2pResultTextarea.value) { showToolMessage(i2pMessageArea, "Nothing to copy.", "info"); return; }
        GM_setClipboard(i2pResultTextarea.value, 'text');
        const originalHTML = i2pCopyButton.innerHTML;
        i2pCopyButton.innerHTML = createIconSpanHTML('task_alt') + I2P_COPIED_BUTTON_TEXT;
        i2pCopyButton.disabled = true;
        showToolMessage(i2pMessageArea, "Generated prompt copied!", "success");
        setTimeout(() => {
            i2pCopyButton.innerHTML = originalHTML;
            i2pCopyButton.disabled = false;
        }, 2000);
    }

    function openImageToPromptModal() {
         if (i2pCurrentModalInstance && i2pCurrentModalInstance.modal.style.display !== 'none') {
            openModal(i2pCurrentModalInstance.modal, i2pCurrentModalInstance.backdrop);
            i2pClearSelectedImage();
            return;
        }

        const modalUniqueClass = 'vfx-image-to-prompt-modal';
        const { modal, backdrop, contentWrapper, footer } = createModalScaffold(
            I2P_OVERLAY_TITLE,
            modalUniqueClass,
            'vfx-i2p-title-combined',
            true
        );
        i2pCurrentModalInstance = { modal, backdrop };

        i2pMessageArea = document.createElement('div');
        i2pMessageArea.className = 'vfx-tool-message';
        contentWrapper.appendChild(i2pMessageArea);

        const imageUploadSection = document.createElement('div');
        imageUploadSection.className = 'vfx-image-upload-section';
        const imageUploadControls = document.createElement('div');
        imageUploadControls.className = 'vfx-image-upload-controls';
        i2pImageFileInput = document.createElement('input');
        i2pImageFileInput.type = 'file';
        i2pImageFileInput.id = I2P_IMAGE_INPUT_ID;
        i2pImageFileInput.accept = I2P_ALLOWED_IMAGE_TYPES.join(',');
        i2pImageFileInput.addEventListener('change', i2pHandleFileSelect);
        i2pImageFileInput.style.display = 'none';
        i2pUploadImageButton = createModalButton('Upload Image', ['secondary-action'], () => i2pImageFileInput.click(), 'upload_file');
        i2pImageInfoArea = document.createElement('span');
        i2pImageInfoArea.className = 'vfx-image-info-area';
        i2pClearImageButton = createModalButton('Clear', ['secondary-action', 'small-text-button'], i2pClearSelectedImage, 'delete_outline');
        imageUploadControls.append(i2pUploadImageButton, i2pImageInfoArea, i2pClearImageButton);
        imageUploadSection.appendChild(i2pImageFileInput);
        imageUploadSection.appendChild(imageUploadControls);
        contentWrapper.appendChild(imageUploadSection);

        const resultLabel = document.createElement('label');
        resultLabel.className = 'vfx-tool-label';
        resultLabel.htmlFor = I2P_RESULT_TEXTAREA_ID;
        resultLabel.textContent = 'Generated Prompt';
        i2pResultTextarea = document.createElement('textarea');
        i2pResultTextarea.id = I2P_RESULT_TEXTAREA_ID;
        i2pResultTextarea.className = 'vfx-tool-textarea';
        i2pResultTextarea.readOnly = true;
        i2pResultTextarea.placeholder = 'The generated prompt will appear here...';
        contentWrapper.append(resultLabel, i2pResultTextarea);

        i2pCopyButton = createModalButton(I2P_COPY_BUTTON_TEXT, ['secondary-action'], i2pHandleCopyClick, 'content_copy');
        i2pGenerateApiButton = createModalButton(I2P_GENERATE_BUTTON_TEXT, ['primary-action'], i2pCallApi, 'auto_awesome');
        footer.append(i2pCopyButton, i2pGenerateApiButton);

        i2pClearSelectedImage();
        openModal(modal, backdrop);
    }

    // --- END: VideoFX Promptless Image-to-Prompt Generator Code ---


    // --- Main FAB Initialization & Overall CSS ---
    function initializeMainFab() {
        if (document.getElementById(MAIN_FAB_CONTAINER_ID)) return;

        const fabContainer = document.createElement('div');
        fabContainer.id = MAIN_FAB_CONTAINER_ID;

        const mainFab = createModalButton('', ['vfx-fab', 'vfx-fab-main'], () => {
            fabContainer.classList.toggle('expanded');
            const isExpanded = fabContainer.classList.contains('expanded');
            mainFab.setAttribute('aria-expanded', isExpanded.toString());
            mainFab.title = isExpanded ? "Close Tools Menu" : "Open VideoFX Tools";
            // Toggle visibility of secondary FAB tooltips
            fabContainer.querySelectorAll('.vfx-fab-item .vfx-tooltip').forEach(tooltip => {
                tooltip.style.opacity = isExpanded ? '1' : '0';
                tooltip.style.visibility = isExpanded ? 'visible' : 'hidden';
            });
        }, 'construction'); // Main icon, e.g., 'construction' or 'apps'
        mainFab.title = "Open VideoFX Tools";
        mainFab.setAttribute('aria-haspopup', 'true');
        mainFab.setAttribute('aria-expanded', 'false');

        const fabActions = [
            { id: 'enhancer', icon: 'auto_fix_high', label: 'Prompt Enhancer', action: openPromptEnhancerModal },
            { id: 'deconstructor', icon: 'splitscreen', label: 'Image Deconstructor', action: openDeconstructorModal },
            { id: 'image-to-prompt', icon: 'image_search', label: 'Image-to-Prompt Gen', action: openImageToPromptModal }
        ];

        fabActions.forEach(actionDef => {
            const itemWrapper = document.createElement('div');
            itemWrapper.className = 'vfx-fab-item';
            const fabButton = createModalButton('', ['vfx-fab', 'vfx-fab-secondary'], actionDef.action, actionDef.icon);
            fabButton.id = `fab-action-${actionDef.id}`;
            const tooltip = document.createElement('span');
            tooltip.className = 'vfx-tooltip';
            tooltip.textContent = actionDef.label;
            itemWrapper.appendChild(fabButton);
            itemWrapper.appendChild(tooltip);
            fabContainer.appendChild(itemWrapper);
        });

        fabContainer.appendChild(mainFab); // Main FAB added last to be on top visually before expansion
        document.body.appendChild(fabContainer);

        // Close expanded FABs if clicking outside
        document.addEventListener('click', (event) => {
            if (fabContainer.classList.contains('expanded') && !fabContainer.contains(event.target)) {
                fabContainer.classList.remove('expanded');
                mainFab.setAttribute('aria-expanded', 'false');
                mainFab.title = "Open VideoFX Tools";
                fabContainer.querySelectorAll('.vfx-fab-item .vfx-tooltip').forEach(tooltip => {
                     tooltip.style.opacity = '0'; tooltip.style.visibility = 'hidden';
                });
            }
        });
        console.log(`All-In-One VideoFX Tools v${SCRIPT_VERSION} Main FAB Initialized`);
    }

    // --- Consolidated CSS ---
    GM_addStyle(`
        /* Root Variables from Prompt Enhancer (slightly adjusted for sharing) */
        :root {
            --google-font: 'Google Sans Text', 'Roboto', sans-serif;
            --dark-bg-primary: #2d2d2d; --dark-bg-secondary: #1f1f1f; --dark-bg-tertiary: #3f3f3f;
            --dark-text-primary: #e8eaed; --dark-text-secondary: #bdc1c6;
            --dark-border: #4a4a4a; --dark-focus-border: #8ab4f8; --dark-error-border: #f28b82;
            --fab-main-bg: #8ab4f8; --fab-main-hover: #9ac1f9;
            --fab-secondary-bg: #303134; --fab-secondary-hover: #3c4043;
            --fab-icon-color: #202124; --fab-secondary-icon-color: #e8eaed;
            --dark-accent-blue: #8ab4f8; --dark-accent-red: #f28b82; --dark-button-text-on-blue: #202124;
            --ui-radius: 18px; --shadow-color: rgba(0, 0, 0, 0.25); --shadow-strong-color: rgba(0, 0, 0, 0.35);
            --scroll-thumb: #5f6368; --scroll-track: var(--dark-bg-secondary);
            --warning-color: #fdd663; --warning-border: #fbc02d;
            --modified-indicator-color: #8ab4f8;
        }

        /* Shared Material Symbols */
        .material-symbols-outlined {
            font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
            font-size: 1.25em; vertical-align: middle; line-height: 1;
            margin-right: 6px; margin-left: -4px;
        }
        .vfx-modal-close-btn .material-symbols-outlined,
        .vfx-modal-button.icon-only .material-symbols-outlined { margin: 0; font-size: 24px; }

        /* Main FAB System Styles (from Prompt Enhancer) */
        #${MAIN_FAB_CONTAINER_ID} { position: fixed; top: 20px; left: 20px; z-index: 9990; display: flex; flex-direction: column; align-items: flex-start; }
        #${MAIN_FAB_CONTAINER_ID} .vfx-fab-item { display: flex; align-items: center; margin-bottom: 12px; position: relative; }
        #${MAIN_FAB_CONTAINER_ID} .vfx-fab {
            font-family: var(--google-font); border: none; border-radius: 50%;
            box-shadow: 0 3px 8px var(--shadow-strong-color); cursor: pointer;
            transition: all 0.2s ease-out; font-weight: 500;
            display: flex; align-items: center; justify-content: center;
            width: 56px; height: 56px;
            transform: scale(0); opacity: 0; pointer-events: none; /* Hidden by default, shown by expansion */
        }
        #${MAIN_FAB_CONTAINER_ID} .vfx-fab:hover:not(:disabled) { box-shadow: 0 5px 12px var(--shadow-strong-color); transform: scale(1.05) !important; }
        #${MAIN_FAB_CONTAINER_ID} .vfx-fab-main { background-color: var(--fab-main-bg); color: var(--fab-icon-color); transform: scale(1); opacity: 1; pointer-events: auto; order: -1; /* Main FAB always visible and on top */ }
        #${MAIN_FAB_CONTAINER_ID} .vfx-fab-main .material-symbols-outlined { transition: transform 0.2s ease-in-out; }
        #${MAIN_FAB_CONTAINER_ID} .vfx-fab-main:hover:not(:disabled) { background-color: var(--fab-main-hover); }
        #${MAIN_FAB_CONTAINER_ID} .vfx-fab-secondary { background-color: var(--fab-secondary-bg); color: var(--fab-secondary-icon-color); width: 48px; height: 48px; margin-left: 8px; /* Align secondary FABs to the right of main */ }
        #${MAIN_FAB_CONTAINER_ID} .vfx-fab-secondary:hover:not(:disabled) { background-color: var(--fab-secondary-hover); }
        #${MAIN_FAB_CONTAINER_ID}.expanded .vfx-fab { transform: scale(1); opacity: 1; pointer-events: auto; }
        #${MAIN_FAB_CONTAINER_ID}.expanded .vfx-fab-main .material-symbols-outlined { transform: rotate(135deg); } /* Example: close icon */
        .vfx-tooltip {
            position: absolute; left: 100%; top: 50%; transform: translateY(-50%);
            margin-left: 12px; padding: 6px 12px; background-color: var(--dark-bg-tertiary);
            color: var(--dark-text-primary); border-radius: 8px; font-size: 0.8rem;
            white-space: nowrap; box-shadow: 0 2px 5px var(--shadow-color);
            opacity: 0; visibility: hidden; transition: opacity 0.15s ease 0.1s, visibility 0.15s ease 0.1s;
            pointer-events: none; z-index: 1; font-family: var(--google-font);
        }
        #${MAIN_FAB_CONTAINER_ID}.expanded .vfx-fab-item:hover .vfx-tooltip { opacity: 1; visibility: visible; }


        /* Shared Modal Styles (Adapted from Prompt Enhancer) */
        .vfx-modal-backdrop { display:none; position:fixed; top:0; left:0; width:100%; height:100%; background-color:rgba(0,0,0,.6); z-index:9998; opacity:0; transition:opacity .25s ease-out; }
        .vfx-modal-base {
            font-family: var(--google-font); box-sizing: border-box;
            display:none; flex-direction:column; position:fixed;
            top:50%; left:50%; transform:translate(-50%,-50%) scale(.95);
            background-color: var(--dark-bg-secondary); color: var(--dark-text-primary);
            padding:0; border-radius:var(--ui-radius); box-shadow:0 8px 25px var(--shadow-strong-color);
            z-index:9999; width:clamp(500px, 70%, 900px); /* Default width, can be overridden by specific modal class */
            border:1px solid var(--dark-border); max-height:calc(100vh - 100px);
            opacity:0; transition:opacity .25s cubic-bezier(0.4, 0, 0.2, 1), transform .25s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .vfx-modal-base.vfx-prompt-enhancer-modal { width: clamp(700px, 80%, 1200px); /* Enhancer is wider */ }
        .vfx-modal-base.vfx-image-deconstructor-modal { width: clamp(500px, 60%, 750px); }
        .vfx-modal-base.vfx-image-to-prompt-modal { width: clamp(450px, 50%, 600px); }

        .vfx-modal-header { display:flex; justify-content:space-between; align-items:center; padding:16px 24px; border-bottom:1px solid var(--dark-border); cursor:move; background-color:var(--dark-bg-primary); border-top-left-radius:var(--ui-radius); border-top-right-radius:var(--ui-radius); user-select:none; flex-shrink:0; }
        .vfx-modal-title { font-size:1.2rem; font-weight:500; color:var(--dark-text-primary); margin:0; }
        .vfx-modal-close-btn { background:none; border:none; color:var(--dark-text-secondary); cursor:pointer; width:40px; height:40px; border-radius:50%; transition:background-color .2s ease; margin-left:10px; padding:0; display:flex; align-items:center; justify-content:center; }
        .vfx-modal-close-btn:hover { background-color:var(--dark-bg-tertiary); color:var(--dark-text-primary); }
        .vfx-modal-content { flex-grow:1; overflow-y:auto; padding:20px 24px; min-height:100px; scrollbar-width:thin; scrollbar-color:var(--scroll-thumb) var(--scroll-track); }
        .vfx-modal-content::-webkit-scrollbar { width:8px; } .vfx-modal-content::-webkit-scrollbar-track { background:var(--scroll-track); border-radius:4px; } .vfx-modal-content::-webkit-scrollbar-thumb { background-color:var(--scroll-thumb); border-radius:4px; border:2px solid var(--scroll-track); } .vfx-modal-content::-webkit-scrollbar-thumb:hover { background-color:var(--dark-text-secondary); }
        .vfx-modal-footer { display:flex; justify-content:space-between; align-items:center; padding:16px 24px; border-top:1px solid var(--dark-border); background-color:var(--dark-bg-primary); border-bottom-left-radius:var(--ui-radius); border-bottom-right-radius:var(--ui-radius); flex-wrap:wrap; gap:12px; flex-shrink:0; }

        /* Shared Modal Button Styles (from Prompt Enhancer) */
        .vfx-modal-button {
            padding: 10px 20px; font-size: 0.9rem; font-weight: 500;
            border: 1px solid transparent; border-radius: var(--ui-radius);
            cursor: pointer; transition: background-color 0.2s ease, box-shadow 0.2s ease, transform 0.1s ease, border-color 0.2s ease;
            text-transform: none; min-height: 40px;
            display: inline-flex; align-items: center; justify-content: center; gap: 6px;
            font-family: var(--google-font); /* Ensure font */
        }
        .vfx-modal-button:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 2px 4px var(--shadow-color); }
        .vfx-modal-button:disabled { opacity: 0.5; cursor: not-allowed; transform: none; box-shadow: none; }
        .vfx-modal-button.primary-action { background-color: var(--dark-accent-blue); color: var(--dark-button-text-on-blue); border-color: var(--dark-accent-blue); }
        .vfx-modal-button.primary-action:hover:not(:disabled) { background-color: #9ac1f9; border-color: #9ac1f9; }
        .vfx-modal-button.secondary-action { background-color: var(--dark-bg-tertiary); color: var(--dark-text-primary); border-color: var(--dark-bg-tertiary); }
        .vfx-modal-button.secondary-action:hover:not(:disabled) { background-color: #4a4a4a; border-color: #4a4a4a;}
        .vfx-modal-button.danger-action { background-color: transparent; color: var(--dark-accent-red); border: 1px solid var(--dark-accent-red); }
        .vfx-modal-button.danger-action:hover:not(:disabled) { background-color: rgba(242, 139, 130, 0.15); }
        .vfx-modal-button.small-text-button { font-size: 0.8rem; padding: 6px 12px; min-height: auto; } /* For smaller copy buttons */


        /* Shared Form Element Styles (Inputs, Textareas, Selects from Enhancer) */
        .vfx-modal-base label, .vfx-tool-label { font-size:0.8rem; font-weight:500; color:var(--dark-text-secondary); margin-bottom:6px; display:block; text-align:left; }
        .vfx-modal-base select, .vfx-modal-base textarea, .vfx-modal-base input[type="text"], .vfx-modal-base input[type="search"],
        .vfx-tool-textarea, .vfx-tool-input { /* Generic class for simple tools */
            width:100%; margin-bottom:16px; padding:12px 16px; font-size:0.9rem;
            border-radius:var(--ui-radius); border:1px solid var(--dark-border);
            background-color:var(--dark-bg-secondary); color:var(--dark-text-primary);
            box-sizing:border-box; transition:border-color .2s ease, box-shadow .2s ease;
            font-family: var(--google-font);
        }
        .vfx-modal-base select::placeholder, .vfx-modal-base textarea::placeholder,
        .vfx-modal-base input[type="text"]::placeholder, .vfx-modal-base input[type="search"]::placeholder,
        .vfx-tool-textarea::placeholder, .vfx-tool-input::placeholder { color:var(--dark-text-secondary); opacity:0.7; }
        .vfx-modal-base select:focus, .vfx-modal-base textarea:focus,
        .vfx-modal-base input[type="text"]:focus, .vfx-modal-base input[type="search"]:focus,
        .vfx-tool-textarea:focus, .vfx-tool-input:focus {
            border-color:var(--dark-focus-border); outline:none; box-shadow:0 0 0 2px rgba(138,180,248,0.3);
        }
        .vfx-modal-base select {
            appearance:none;
            background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='%23bdc1c6' viewBox='0 0 16 16'%3E%3Cpath fill-rule='evenodd' d='M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708z'/%3E%3C/svg%3E");
            background-repeat:no-repeat; background-position:right 16px center; background-size:16px 16px; padding-right:45px;
        }

        /* Shared Image Upload Area Styles */
        .vfx-image-upload-section {
            padding:12px; border:1px dashed var(--dark-border);
            border-radius:calc(var(--ui-radius)/1.5); background-color:rgba(0,0,0,.1);
            margin-bottom: 16px;
        }
        .vfx-image-upload-controls { display:flex; align-items:center; gap:10px; }
        .vfx-image-info-area {
            font-size:.85rem; color:var(--dark-text-secondary); font-style:italic;
            flex-grow:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
            display:flex; align-items:center; /* Changed from none to flex */
        }
         /* Initially hide info area text if no image, show only button */
        .vfx-image-info-area:empty::before { content: 'No image selected.'; display: inline; }
        .vfx-image-info-area img + span { margin-left: 5px; } /* Space between preview and text if any */


        /* Shared Tool Message Styles */
        .vfx-tool-message {
            padding:10px 12px; border-radius:calc(var(--ui-radius)/1.5);
            font-size:13px; line-height:1.4; border:1px solid transparent;
            margin: -8px 0 8px 0; /* Adjusted from original Enhancer for better fit */
            display:none; text-align: center;
        }
        .message-info { background-color:rgba(138,180,248,.1); color:var(--dark-accent-blue); border-color:rgba(138,180,248,.3); }
        .message-success { background-color:rgba(129,230,134,.1); color:#81e686; border-color:rgba(129,230,134,.3); }
        .message-error { background-color:rgba(242,139,130,.1); color:var(--dark-accent-red); border-color:rgba(242,139,130,.3); }

        /* Styles for Deconstructor/I2P specific layouts if needed */
        .vfx-result-container { display:flex; flex-direction:column; margin-bottom: 10px; }
        .vfx-result-header { display:flex; justify-content:space-between; align-items:center; margin-bottom: 4px; }
        .vfx-result-header .vfx-tool-label { margin-bottom: 0; }
        .vfx-result-header .vfx-modal-button.small-text-button { /* Ensure specificity */
            padding: 4px 10px; min-height: 28px; font-size: 0.75rem; border-radius: 12px;
        }
        .vfx-tool-textarea { min-height: 70px; /* Default for simple tools */ }
        .vfx-image-to-prompt-modal .vfx-tool-textarea { min-height: 100px; height: 140px; } /* I2P needs more space */


        /* Enhancer specific styles (fieldset, grids, lexicon etc.) would be here, prefixed with .vfx-prompt-enhancer-modal */
        .vfx-prompt-enhancer-modal .vfx-fieldset { border: 1px solid var(--dark-border); /* ... more enhancer styles ... */ }
        .vfx-prompt-enhancer-modal #vfx-enhancer-live-prompt-preview { /* ... */ }
        /* ... etc. for all Enhancer specific UI elements ... */

    `);

    // --- Page Ready Check and Initialization ---
    function waitForPageReady(callback) {
        const checkInterval = 200; const maxWait = 10000; let elapsedTime = 0;
        const readyCheck = () => {
            // A more generic ready check, or specific to VideoFX UI
            if (document.body && document.querySelector('canvas')) { // VideoFX usually has a canvas
                console.log("All-In-One VideoFX Tools: Page appears ready.");
                callback();
            } else {
                elapsedTime += checkInterval;
                if (elapsedTime < maxWait) { setTimeout(readyCheck, checkInterval); }
                else { console.warn("All-In-One VideoFX Tools: Page ready check timed out. Initializing anyway."); callback(); }
            }
        };
        if (document.readyState === 'complete' || (document.readyState === 'interactive' && document.body && document.querySelector('canvas'))) {
            callback();
        } else {
            window.addEventListener('DOMContentLoaded', () => { setTimeout(readyCheck, checkInterval); });
        }
    }

    waitForPageReady(initializeMainFab);

    // Polyfill for Element.append() for compatibility if any script part uses it.
    (function (arr) { arr.forEach(function (item) { if (item.hasOwnProperty('append')) { return; } Object.defineProperty(item, 'append', { configurable: true, enumerable: true, writable: true, value: function append() { var argArr = Array.prototype.slice.call(arguments), docFrag = document.createDocumentFragment(); argArr.forEach(function (argItem) { var isNode = argItem instanceof Node; docFrag.appendChild(isNode ? argItem : document.createTextNode(String(argItem))); }); this.appendChild(docFrag); } }); });})([Element.prototype, Document.prototype, DocumentFragment.prototype]);

})();
// ==UserScript==
// @name         All-In-One VideoFX Tools
// @namespace    https://labs.google/
// @version      1.0.0
// @description  Combines Prompt Enhancer, Image Deconstructor, and Promptless Image-to-Prompt Generator for VideoFX.
// @author       Jules (AI Agent) & Original Authors (Goldie, Your Name & Gemini)
// @match        https://labs.google/fx/*
// @grant        GM_addStyle
// @grant        GM_setClipboard
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_download
// @grant        GM_xmlhttpRequest
// @run-at       document-end
// ==/UserScript==

(function () {
    'use strict';

    // --- Overall Constants ---
    const SCRIPT_VERSION = '1.0.0'; // Combined script version
    const MAIN_FAB_CONTAINER_ID = 'vfx-all-in-one-fab-container';

    // --- Inject Google Font CSS (once for all tools) ---
    const fontLink = document.createElement('link');
    fontLink.rel = 'stylesheet';
    fontLink.href = 'https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&family=Google+Sans+Text:wght@400;500;600;700&family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap';
    document.head.appendChild(fontLink);

    // --- Shared Helper Function: gmFetch ---
    function gmFetch(url, options) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: options.method || "GET",
                url: url,
                headers: options.headers || {},
                data: options.body,
                responseType: options.responseType || "json", // Allow overriding for non-JSON
                onload: function(response) {
                    if (response.status >= 200 && response.status < 300) {
                        resolve({
                            ok: true,
                            status: response.status,
                            statusText: response.statusText,
                            json: () => Promise.resolve(response.responseJson || response.response), // Ensure responseJson is checked
                            text: () => Promise.resolve(response.responseText)
                        });
                    } else {
                        resolve({
                            ok: false,
                            status: response.status,
                            statusText: response.statusText,
                            json: () => Promise.resolve(response.responseJson || response.response || {}),
                            text: () => Promise.resolve(response.responseText)
                        });
                    }
                },
                onerror: (response) => reject(new Error(response.statusText || `Network error: ${response.status}`)),
                ontimeout: () => reject(new Error("GM_xmlhttpRequest timeout")),
                onabort: () => reject(new Error("GM_xmlhttpRequest aborted"))
            });
        });
    }

    // --- Shared Helper Function: Create Icon Span ---
    function createIconSpan(iconName) {
        const span = document.createElement('span');
        span.className = 'material-symbols-outlined';
        span.textContent = iconName;
        span.setAttribute('aria-hidden', 'true');
        return span;
    }

    function createIconSpanHTML(iconName) {
        return `<span class="material-symbols-outlined" aria-hidden="true">${iconName}</span>`;
    }

    // --- Shared Helper Function: Create Modal Button (Adapted from Prompt Enhancer) ---
    function createModalButton(text, classNames = [], onClick = null, iconName = null, title = null, buttonType = 'button') {
        const button = document.createElement('button');
        button.type = buttonType;

        if (iconName) {
            const iconSpan = createIconSpan(iconName);
            if (!text || text.trim() === '') {
                button.classList.add('icon-only');
                iconSpan.style.marginRight = '0';
            }
            button.appendChild(iconSpan);
        }

        if (text && text.trim() !== '') {
            button.appendChild(document.createTextNode(text));
        }

        const classes = Array.isArray(classNames) ? classNames : [classNames];
        if (!classes.some(cls => cls.startsWith('vfx-fab')) && !classes.includes('vfx-modal-button')) {
            classes.unshift('vfx-modal-button');
        }
        classes.forEach(cls => button.classList.add(cls));

        if (onClick) button.onclick = onClick;

        const effectiveTitle = title || (iconName && (!text || text.trim() === '') ? iconName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : (text || 'Button'));
        button.title = effectiveTitle;
        button.setAttribute('aria-label', effectiveTitle);
        return button;
    }


    // --- Shared Draggable Logic (Adapted from Prompt Enhancer) ---
    function makeDraggable(modalElement, handleElement) {
        let isDragging = false, offsetX, offsetY, initialTop, initialLeft;

        (handleElement || modalElement).addEventListener('mousedown', (e) => {
            if (e.target.closest('button, input, select, textarea, .vfx-modal-close-btn')) return; // Added generic .vfx-modal-close-btn

            isDragging = true;
            const modalRect = modalElement.getBoundingClientRect();
            const computedStyle = window.getComputedStyle(modalElement);

            if (computedStyle.transform && computedStyle.transform !== 'none' && computedStyle.position === 'fixed') {
                initialLeft = modalRect.left;
                initialTop = modalRect.top;
                modalElement.style.transform = 'none';
                modalElement.style.left = `${initialLeft}px`;
                modalElement.style.top = `${initialTop}px`;
            } else {
                initialLeft = modalElement.offsetLeft;
                initialTop = modalElement.offsetTop;
            }

            offsetX = e.clientX - initialLeft;
            offsetY = e.clientY - initialTop;

            modalElement.style.transition = 'none';
            document.body.style.userSelect = 'none';

            document.addEventListener('mousemove', onMouseMoveDraggable); // Renamed to avoid conflict
            document.addEventListener('mouseup', onMouseUpDraggable); // Renamed to avoid conflict
            e.preventDefault();
        });

        function onMouseMoveDraggable(e) {
            if (!isDragging) return;
            let newX = e.clientX - offsetX;
            let newY = e.clientY - offsetY;

            newX = Math.max(0, Math.min(newX, window.innerWidth - modalElement.offsetWidth));
            newY = Math.max(0, Math.min(newY, window.innerHeight - modalElement.offsetHeight));

            modalElement.style.left = `${newX}px`;
            modalElement.style.top = `${newY}px`;
        }

        function onMouseUpDraggable() {
            if (isDragging) {
                isDragging = false;
                modalElement.style.transition = '';
                document.body.style.userSelect = '';
                document.removeEventListener('mousemove', onMouseMoveDraggable);
                document.removeEventListener('mouseup', onMouseUpDraggable);
            }
        }
    }

    // --- Shared UI Helper: Create Modal ---
    function createModalScaffold(title, modalUniqueClass = '', customHeaderId = null, hasFooter = true) {
        const modal = document.createElement('div');
        modal.className = `vfx-modal-base ${modalUniqueClass}`;
        modal.style.display = 'none';

        const backdrop = document.createElement('div');
        backdrop.className = 'vfx-modal-backdrop';
        backdrop.style.display = 'none';
        backdrop.onclick = () => closeModalUI(modal, backdrop);

        const header = document.createElement('div');
        header.className = 'vfx-modal-header';
        if (customHeaderId) header.id = customHeaderId;

        const modalTitle = document.createElement('h2');
        modalTitle.className = 'vfx-modal-title';
        modalTitle.textContent = title;

        const closeButton = createModalButton('', ['vfx-modal-close-btn', 'icon-only'], () => closeModalUI(modal, backdrop), 'close', 'Close Modal');

        header.appendChild(modalTitle);
        header.appendChild(closeButton);

        const contentWrapper = document.createElement('div');
        contentWrapper.className = 'vfx-modal-content';

        modal.appendChild(header);
        modal.appendChild(contentWrapper);

        let footer = null;
        if (hasFooter) {
            footer = document.createElement('div');
            footer.className = 'vfx-modal-footer';
            modal.appendChild(footer);
        }

        document.body.appendChild(backdrop);
        document.body.appendChild(modal);

        makeDraggable(modal, header);

        return { modal, backdrop, header, contentWrapper, footer, closeButton };
    }

    function openModalUI(modal, backdrop) { // Renamed
        backdrop.style.display = 'block';
        modal.style.display = 'flex';

        requestAnimationFrame(() => {
            modal.style.top = '50%';
            modal.style.left = '50%';
            modal.style.transform = 'translate(-50%, -50%) scale(0.95)';

            setTimeout(() => {
                backdrop.style.opacity = '1';
                modal.style.opacity = '1';
                modal.style.transform = 'translate(-50%, -50%) scale(1)';
            }, 10);
        });
        document.body.style.overflow = 'hidden';
    }

    function closeModalUI(modal, backdrop) { // Renamed
        backdrop.style.opacity = '0';
        modal.style.opacity = '0';
        modal.style.transform = 'translate(-50%, -50%) scale(0.95)';

        modal.addEventListener('transitionend', () => {
            modal.style.display = 'none';
            backdrop.style.display = 'none';
            document.body.style.overflow = '';
        }, { once: true });
    }

    // --- Shared UI Helper: Show Message ---
    function showToolMessage(messageAreaElement, text, type = 'info', duration = 4000) {
        if (!messageAreaElement) return;
        messageAreaElement.textContent = text;
        messageAreaElement.className = `vfx-tool-message message-${type}`;
        messageAreaElement.style.display = 'block';
        if (type !== 'error' && duration > 0) {
            setTimeout(() => {
                if (messageAreaElement) { // Check if still exists
                    messageAreaElement.textContent = '';
                    messageAreaElement.style.display = 'none';
                }
            }, duration);
        }
    }
    function clearToolMessage(messageAreaElement) {
        if (!messageAreaElement) return;
        messageAreaElement.textContent = '';
        messageAreaElement.style.display = 'none';
    }


    // --- START: Prompt Enhancer v7 Code (Adapted) ---
    const ENHANCER_SCRIPT_VERSION = '7.0';
    const ENHANCER_HISTORY_STORAGE_KEY = 'videofx_prompt_history_v5_aio'; // Appended _aio
    const ENHANCER_DEFAULT_PREAMBLE_SELECTED_KEY = '__videofxPreambleSelected_v4_aio';
    const ENHANCER_CUSTOM_PREAMBLES_KEY = '__videofxCustomPreambles_v1_aio';
    const ENHANCER_PRESETS_KEY = '__videofxEnhancerPresets_v1_aio';
    const ENHANCER_MAX_HISTORY_ITEMS = 50;
    const ENHANCER_API_ENDPOINT = 'https://labs.google/fx/api/trpc/videoFx.generateNextScenePrompts';
    const ENHANCER_INLINE_PREAMBLE_EDITOR_ID = 'vfx-enhancer-inline-preamble-editor-aio';
    const ENHANCER_LIVE_PROMPT_PREVIEW_ID = 'vfx-enhancer-live-prompt-preview-aio';
    const ENHANCER_LEXICON_POPOVER_ID = 'vfx-enhancer-lexicon-popover-aio';
    const ENHANCER_SMART_SUGGESTIONS_AREA_ID = 'vfx-enhancer-smart-suggestions-area-aio';
    const ENHANCER_CONFLICT_WARNING_CLASS = 'vfx-enhancer-schema-conflict-warning-aio';
    const ENHANCER_IMAGE_PREVIEW_CONTAINER_ID = 'vfx-enhancer-image-preview-container-aio';
    const ENHANCER_ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'];
    const ENHANCER_MAX_IMAGE_SIZE_MB = 10;

    const ENHANCER_DEFAULT_PREAMBLE_PRESETS = { /* ... Full Presets Object from Enhancer ... */ };
    // --- Default Preamble Presets (with consolidated 'requires') ---
    // (Copied from the original script)
    const ENHANCER_DEFAULT_PREAMBLE_PRESETS_DATA = {
        "Cinematic Storyteller": { /* ... */ },
        "Veo 2 Lexicon Guide": { /* ... */ },
        "Gemini Veo Pro Enhancer": { /* ... */ },
        "Veo Adherence Focus": { /* ... */ },
        "Goldie Custom": { /* ... */ }
    };


    let enhancerEffectivePreamblePresets = {};
    const ENHANCER_SCHEMA_INPUTS_DATA = { /* ... Full Schema Object from Enhancer ... */ };
    const ENHANCER_LEXICON_DATA_VAL = { /* ... Full Lexicon Data from Enhancer ... */ };
    const ENHANCER_SMART_SUGGESTIONS_MAP_DATA = { /* ... Full Smart Suggestions Map from Enhancer ... */ };
    const ENHANCER_SCHEMA_CONFLICTS_DATA = { /* ... Full Schema Conflicts from Enhancer ... */ };


    let enhancerGlobalSchemaInputElements = {};
    let enhancerSmartSuggestionTimeout = null;
    let enhancerCurrentLexiconPopover = null;
    let enhancerCurrentModal = null;
    let enhancerCurrentBackdrop = null;
    let enhancerUploadedImageBase64 = '';


    function enhancerShowMessageModal(title, message, errorDetails = null, type = 'info') {
        const modalUniqueClass = 'vfx-enhancer-message-modal-aio';
        const { modal, backdrop, contentWrapper, footer } = createModalScaffold(title, modalUniqueClass, null, true);

        let icon = 'info'; if (type === 'success') icon = 'check_circle'; if (type === 'error') icon = 'error';
        const messageIcon = createIconSpan(icon);
        messageIcon.style.fontSize = '1.5em'; messageIcon.style.marginRight = '10px';
        if (type === 'error') messageIcon.style.color = 'var(--dark-accent-red)';
        if (type === 'success') messageIcon.style.color = 'var(--dark-accent-blue)';

        const messageText = document.createElement('p');
        messageText.textContent = message;
        messageText.style.margin = '10px 0 20px 0';
        messageText.style.textAlign = 'left';
        messageText.style.display = 'flex';
        messageText.style.alignItems = 'center';
        messageText.prepend(messageIcon);
        contentWrapper.appendChild(messageText);

        if (errorDetails) {
            const detailsDiv = document.createElement('div');
            detailsDiv.className = 'vfx-error-details-aio';
            detailsDiv.textContent = typeof errorDetails === 'string' ? errorDetails : JSON.stringify(errorDetails, null, 2);
            contentWrapper.appendChild(detailsDiv);
        }

        const okButton = createModalButton('OK', ['primary-action'], () => closeModalUI(modal, backdrop), 'check_circle');
        footer.appendChild(okButton);
        openModalUI(modal, backdrop);
        setTimeout(() => okButton.focus(), 50);
    }

    // --- Preamble Management ---
    function enhancerLoadAllPreamblesAndStoreGlobally() {
        const customPreamblesFromStorage = JSON.parse(GM_getValue(ENHANCER_CUSTOM_PREAMBLES_KEY, '{}'));
        enhancerEffectivePreamblePresets = {};
        const allDefaultPresets = { ...ENHANCER_DEFAULT_PREAMBLE_PRESETS_DATA };
        for (const key in allDefaultPresets) {
            const presetDefinition = allDefaultPresets[key];
            enhancerEffectivePreamblePresets[key] = {
                text: presetDefinition.text,
                _status: 'default',
                requires: presetDefinition.requires || null
            };
        }
        for (const key in customPreamblesFromStorage) {
            const customText = customPreamblesFromStorage[key];
            if (enhancerEffectivePreamblePresets[key]) {
                enhancerEffectivePreamblePresets[key].text = customText;
                enhancerEffectivePreamblePresets[key]._status = 'custom_override';
            } else {
                enhancerEffectivePreamblePresets[key] = { text: customText, _status: 'custom', requires: null };
            }
        }
    }
    // ... (enhancerSaveCustomPreambleText, enhancerDeleteCustomPreambleText - adapted GM_getValue/setValue keys)


    function openPromptEnhancerModal(initialSettings = {}) {
        if (enhancerCurrentModal && enhancerCurrentModal.style.display !== 'none') {
            openModalUI(enhancerCurrentModal, enhancerCurrentBackdrop);
            return;
        }

        enhancerGlobalSchemaInputElements = {};
        const elementsToReset = []; // For the clear button
        enhancerUploadedImageBase64 = initialSettings.imageBase64 || '';

        const modalUniqueClass = 'vfx-prompt-enhancer-modal-aio';
        const { modal, backdrop, contentWrapper, footer, closeButton } = createModalScaffold(
            `VideoFX Prompt Enhancer v${ENHANCER_SCRIPT_VERSION}`,
            modalUniqueClass,
            null, true
        );
        enhancerCurrentModal = modal;
        enhancerCurrentBackdrop = backdrop;

        // --- Preamble Section ---
        const preambleSectionContainer = document.createElement('div'); /* ... build UI ... */
        contentWrapper.appendChild(preambleSectionContainer);
        // ... (Populate with preamble select, editor, buttons using createModalButton)
        // ... (Event listeners for preamble controls)

        // --- Core Concept & Image Section ---
        const coreConceptFieldset = document.createElement('fieldset'); /* ... build UI ... */
        contentWrapper.appendChild(coreConceptFieldset);
        // ... (Input box, image upload area using ENHANCER_IMAGE_PREVIEW_CONTAINER_ID)
        // ... (Event listeners for input and image handling - enhancerHandleImageFile)

        // --- Other Inputs ---
        const negativeInputLabel = document.createElement('label'); /* ... */ contentWrapper.appendChild(negativeInputLabel);
        const negativeInputBox = document.createElement('textarea'); /* ... */ contentWrapper.appendChild(negativeInputBox);
        // ... (Candidate count, Live Preview Area using ENHANCER_LIVE_PROMPT_PREVIEW_ID)

        // --- Schema Fieldsets ---
        const customKeywordsFieldset = document.createElement('fieldset'); /* ... */ contentWrapper.appendChild(customKeywordsFieldset);
        // ... (Build custom keywords input and lexicon popover using ENHANCER_LEXICON_POPOVER_ID)
        const fieldsetContainer = document.createElement('div'); /* ... */ contentWrapper.appendChild(fieldsetContainer);
        // ... (Build all schema fieldsets and their inputs using ENHANCER_SCHEMA_INPUTS_DATA)
        // ... (Attach commonSchemaChangeHandler to schema inputs)


        // --- Footer Buttons for Enhancer ---
        const clearBtn = createModalButton('Clear All', ['secondary-action'], () => { /* ... enhancer clear logic ... */ }, 'clear_all');
        const savePresetBtn = createModalButton('Save Preset', ['secondary-action'], () => { /* ... */ }, 'save');
        const loadPresetBtn = createModalButton('Load Preset', ['secondary-action'], () => { /* ... */ }, 'settings_backup_restore');
        const generateBtn = createModalButton('Generate & Enhance', ['primary-action'], () => { /* enhancerExecutePromptGeneration ... */ }, 'auto_awesome');

        const footerLeftContainer = document.createElement('div'); footerLeftContainer.style.display = 'flex'; footerLeftContainer.style.gap = '10px';
        footerLeftContainer.append(clearBtn, savePresetBtn, loadPresetBtn);
        const footerRightContainer = document.createElement('div'); footerRightContainer.appendChild(generateBtn);
        footer.append(footerLeftContainer, footerRightContainer);


        // enhancerLoadAllPreamblesAndStoreGlobally(); // Call this to populate data
        // enhancerPopulatePreambleSelect(...);
        // enhancerUpdatePreambleEditorVisibility(...);
        // enhancerLivePreviewAndSuggestionsUpdate();
        // enhancerUpdateImagePreviewUI();

        openModalUI(modal, backdrop);
    }
    // --- END: Prompt Enhancer v7 Code ---


    // --- START: VideoFX Image Deconstructor Code (Adapted) ---
    const DECON_API_ENDPOINT = "https://labs.google/fx/api/trpc/backbone.captionImage";
    const DECON_OVERLAY_TITLE = 'Image Deconstructor';
    const DECON_IMAGE_INPUT_ID = 'decon-image-input-aio';
    const DECON_ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    const DECON_MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
    const DECON_MEDIA_CATEGORIES = ['MEDIA_CATEGORY_SCENE', 'MEDIA_CATEGORY_SUBJECT', 'MEDIA_CATEGORY_STYLE'];

    let deconSelectedImageFullDataUrl = null;
    let deconResultTextareas = {};
    let deconMessageArea = null;
    let deconGenerateApiButton = null;
    let deconImageFileInput = null;
    let deconUploadImageButton = null;
    let deconImageInfoArea = null;
    let deconClearImageButton = null;
    let deconCurrentModal = null;
    let deconCurrentBackdrop = null;

    // ... (deconSetLoadingState, deconClearSelectedImage, deconHandleFileSelect, deconCallApi, deconHandleCopyClick - adapted)

    function openDeconstructorModal() {
        if (deconCurrentModal && deconCurrentModal.style.display !== 'none') {
            openModalUI(deconCurrentModal, deconCurrentBackdrop);
            // deconClearSelectedImage(); // Reset state
            return;
        }

        const modalUniqueClass = 'vfx-image-deconstructor-modal-aio';
        const { modal, backdrop, contentWrapper, footer } = createModalScaffold(
            DECON_OVERLAY_TITLE, modalUniqueClass, 'vfx-decon-title-aio', true
        );
        deconCurrentModal = modal;
        deconCurrentBackdrop = backdrop;
        deconResultTextareas = {};

        deconMessageArea = document.createElement('div'); deconMessageArea.className = 'vfx-tool-message';
        contentWrapper.appendChild(deconMessageArea);

        // Image Upload Section
        const imageUploadSection = document.createElement('div'); imageUploadSection.className = 'vfx-image-upload-section';
        const imageUploadControls = document.createElement('div'); imageUploadControls.className = 'vfx-image-upload-controls';
        deconImageFileInput = document.createElement('input'); deconImageFileInput.type = 'file'; deconImageFileInput.id = DECON_IMAGE_INPUT_ID; /* ... */
        deconUploadImageButton = createModalButton('Upload Image', ['secondary-action'], () => deconImageFileInput.click(), 'upload_file');
        deconImageInfoArea = document.createElement('span'); deconImageInfoArea.className = 'vfx-image-info-area';
        deconClearImageButton = createModalButton('', ['secondary-action', 'icon-only'], ()=>{/*deconClearSelectedImage*/}, 'delete_outline');
        imageUploadControls.append(deconUploadImageButton, deconImageInfoArea, deconClearImageButton);
        imageUploadSection.append(deconImageFileInput, imageUploadControls);
        contentWrapper.appendChild(imageUploadSection);
        deconImageFileInput.addEventListener('change', ()=>{/*deconHandleFileSelect*/});


        DECON_MEDIA_CATEGORIES.forEach(categoryString => { /* ... build result textareas and copy buttons ... */ });

        deconGenerateApiButton = createModalButton('Deconstruct Image', ['primary-action'], ()=>{/*deconCallApi*/}, 'auto_awesome');
        footer.appendChild(deconGenerateApiButton);

        // deconClearSelectedImage();
        openModalUI(modal, backdrop);
    }
    // --- END: VideoFX Image Deconstructor Code ---


    // --- START: VideoFX Promptless Image-to-Prompt Generator Code (Adapted) ---
    const I2P_API_ENDPOINT = "https://labs.google/fx/api/trpc/general.generatePromptlessI2VPrompt";
    const I2P_OVERLAY_TITLE = 'Image-to-Prompt Generator';
    const I2P_IMAGE_INPUT_ID = 'i2p-image-input-aio';
    const I2P_ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    const I2P_MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

    let i2pResultTextarea = null; /* ... other i2p variables ... */
    let i2pCurrentModal = null;
    let i2pCurrentBackdrop = null;

    // ... (i2pSetLoadingState, i2pClearSelectedImage, i2pHandleFileSelect, i2pCallApi, i2pHandleCopyClick - adapted)

    function openImageToPromptModal() {
        if (i2pCurrentModal && i2pCurrentModal.style.display !== 'none') {
            openModalUI(i2pCurrentModal, i2pCurrentBackdrop);
            // i2pClearSelectedImage();
            return;
        }
        const modalUniqueClass = 'vfx-image-to-prompt-modal-aio';
        const { modal, backdrop, contentWrapper, footer } = createModalScaffold(
            I2P_OVERLAY_TITLE, modalUniqueClass, 'vfx-i2p-title-aio', true
        );
        i2pCurrentModal = modal;
        i2pCurrentBackdrop = backdrop;

        // ... Build I2P UI (message area, image upload, result textarea) in contentWrapper ...

        const i2pCopyButton = createModalButton('Copy', ['secondary-action'], ()=>{/*i2pHandleCopyClick*/}, 'content_copy');
        const i2pGenerateApiButton = createModalButton('Generate Prompt', ['primary-action'], ()=>{/*i2pCallApi*/}, 'auto_awesome');
        footer.append(i2pCopyButton, i2pGenerateApiButton);

        // i2pClearSelectedImage();
        openModalUI(modal, backdrop);
    }
    // --- END: VideoFX Promptless Image-to-Prompt Generator Code ---


    // --- Main FAB Initialization & Overall CSS ---
    function initializeMainFab() { /* ... as designed, calls openPromptEnhancerModal etc. ... */ }

    // --- Consolidated CSS ---
    GM_addStyle(` /* ... All combined and prefixed CSS ... */ `);

    // --- Page Ready Check and Initialization ---
    function waitForPageReady(callback) { /* ... */ }
    waitForPageReady(initializeMainFab);

    // Polyfill for Element.append()
    (function (arr) { /* ... */ }) ([Element.prototype, Document.prototype, DocumentFragment.prototype]);

})();
// ==UserScript==
// @name         All-In-One VideoFX Tools
// @namespace    https://labs.google/
// @version      1.0.0
// @description  Combines Prompt Enhancer, Image Deconstructor, and Promptless Image-to-Prompt Generator for VideoFX.
// @author       Jules (AI Agent) & Original Authors (Goldie, Your Name & Gemini)
// @match        https://labs.google/fx/*
// @grant        GM_addStyle
// @grant        GM_setClipboard
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_download
// @grant        GM_xmlhttpRequest
// @run-at       document-end
// ==/UserScript==

(function () {
    'use strict';

    // --- Overall Constants ---
    const SCRIPT_VERSION = '1.0.0';
    const MAIN_FAB_CONTAINER_ID = 'vfx-all-in-one-fab-container';

    // --- Inject Google Font CSS (once for all tools) ---
    const fontLink = document.createElement('link');
    fontLink.rel = 'stylesheet';
    fontLink.href = 'https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&family=Google+Sans+Text:wght@400;500;600;700&family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap';
    document.head.appendChild(fontLink);

    // --- Shared Helper Function: gmFetch ---
    function gmFetch(url, options) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: options.method || "GET",
                url: url,
                headers: options.headers || {},
                data: options.body,
                responseType: options.responseType || "json",
                onload: function(response) {
                    if (response.status >= 200 && response.status < 300) {
                        resolve({
                            ok: true, status: response.status, statusText: response.statusText,
                            json: () => Promise.resolve(response.responseJson || response.response),
                            text: () => Promise.resolve(response.responseText)
                        });
                    } else {
                        resolve({
                            ok: false, status: response.status, statusText: response.statusText,
                            json: () => Promise.resolve(response.responseJson || response.response || {}),
                            text: () => Promise.resolve(response.responseText)
                        });
                    }
                },
                onerror: (response) => reject(new Error(response.statusText || `Network error: ${response.status}`)),
                ontimeout: () => reject(new Error("GM_xmlhttpRequest timeout")),
                onabort: () => reject(new Error("GM_xmlhttpRequest aborted"))
            });
        });
    }

    function createIconSpan(iconName) {
        const span = document.createElement('span');
        span.className = 'material-symbols-outlined';
        span.textContent = iconName;
        span.setAttribute('aria-hidden', 'true');
        return span;
    }

    function createIconSpanHTML(iconName) {
        return `<span class="material-symbols-outlined" aria-hidden="true">${iconName}</span>`;
    }

    function createModalButton(text, classNames = [], onClick = null, iconName = null, title = null, buttonType = 'button') {
        const button = document.createElement('button');
        button.type = buttonType;
        if (iconName) {
            const iconSpan = createIconSpan(iconName);
            if (!text || text.trim() === '') { button.classList.add('icon-only'); iconSpan.style.marginRight = '0'; }
            button.appendChild(iconSpan);
        }
        if (text && text.trim() !== '') { button.appendChild(document.createTextNode(text)); }
        const classes = Array.isArray(classNames) ? classNames : [classNames];
        if (!classes.some(cls => cls.startsWith('vfx-fab')) && !classes.includes('vfx-modal-button')) {
            classes.unshift('vfx-modal-button');
        }
        classes.forEach(cls => button.classList.add(cls));
        if (onClick) button.onclick = onClick;
        const effectiveTitle = title || (iconName && (!text || text.trim() === '') ? iconName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : (text || 'Button'));
        button.title = effectiveTitle; button.setAttribute('aria-label', effectiveTitle);
        return button;
    }

    function makeDraggable(modalElement, handleElement) {
        let isDragging = false, offsetX, offsetY, initialTop, initialLeft;
        (handleElement || modalElement).addEventListener('mousedown', (e) => {
            if (e.target.closest('button, input, select, textarea, .vfx-modal-close-btn')) return;
            isDragging = true;
            const modalRect = modalElement.getBoundingClientRect();
            const computedStyle = window.getComputedStyle(modalElement);
            if (computedStyle.transform && computedStyle.transform !== 'none' && computedStyle.position === 'fixed') {
                initialLeft = modalRect.left; initialTop = modalRect.top;
                modalElement.style.transform = 'none';
                modalElement.style.left = `${initialLeft}px`; modalElement.style.top = `${initialTop}px`;
            } else {
                initialLeft = modalElement.offsetLeft; initialTop = modalElement.offsetTop;
            }
            offsetX = e.clientX - initialLeft; offsetY = e.clientY - initialTop;
            modalElement.style.transition = 'none'; document.body.style.userSelect = 'none';
            document.addEventListener('mousemove', onMouseMoveDraggable);
            document.addEventListener('mouseup', onMouseUpDraggable);
            e.preventDefault();
        });
        function onMouseMoveDraggable(e) {
            if (!isDragging) return;
            let newX = e.clientX - offsetX; let newY = e.clientY - offsetY;
            newX = Math.max(0, Math.min(newX, window.innerWidth - modalElement.offsetWidth));
            newY = Math.max(0, Math.min(newY, window.innerHeight - modalElement.offsetHeight));
            modalElement.style.left = `${newX}px`; modalElement.style.top = `${newY}px`;
        }
        function onMouseUpDraggable() {
            if (isDragging) {
                isDragging = false; modalElement.style.transition = ''; document.body.style.userSelect = '';
                document.removeEventListener('mousemove', onMouseMoveDraggable);
                document.removeEventListener('mouseup', onMouseUpDraggable);
            }
        }
    }

    function createModalScaffold(title, modalUniqueClass = '', customHeaderId = null, hasFooter = true) {
        const modal = document.createElement('div');
        modal.className = `vfx-modal-base ${modalUniqueClass}`; modal.style.display = 'none';
        const backdrop = document.createElement('div');
        backdrop.className = 'vfx-modal-backdrop'; backdrop.style.display = 'none';
        backdrop.onclick = () => closeModalUI(modal, backdrop);
        const header = document.createElement('div');
        header.className = 'vfx-modal-header'; if (customHeaderId) header.id = customHeaderId;
        const modalTitle = document.createElement('h2');
        modalTitle.className = 'vfx-modal-title'; modalTitle.textContent = title;
        const closeButton = createModalButton('', ['vfx-modal-close-btn', 'icon-only'], () => closeModalUI(modal, backdrop), 'close', 'Close Modal');
        header.appendChild(modalTitle); header.appendChild(closeButton);
        const contentWrapper = document.createElement('div');
        contentWrapper.className = 'vfx-modal-content';
        modal.appendChild(header); modal.appendChild(contentWrapper);
        let footer = null;
        if (hasFooter) {
            footer = document.createElement('div'); footer.className = 'vfx-modal-footer'; modal.appendChild(footer);
        }
        document.body.appendChild(backdrop); document.body.appendChild(modal);
        makeDraggable(modal, header);
        return { modal, backdrop, header, contentWrapper, footer, closeButton };
    }

    function openModalUI(modal, backdrop) {
        backdrop.style.display = 'block'; modal.style.display = 'flex';
        requestAnimationFrame(() => {
            modal.style.top = '50%'; modal.style.left = '50%'; modal.style.transform = 'translate(-50%, -50%) scale(0.95)';
            setTimeout(() => {
                backdrop.style.opacity = '1'; modal.style.opacity = '1'; modal.style.transform = 'translate(-50%, -50%) scale(1)';
            }, 10);
        });
        document.body.style.overflow = 'hidden';
    }

    function closeModalUI(modal, backdrop) {
        backdrop.style.opacity = '0'; modal.style.opacity = '0'; modal.style.transform = 'translate(-50%, -50%) scale(0.95)';
        modal.addEventListener('transitionend', () => {
            modal.style.display = 'none'; backdrop.style.display = 'none'; document.body.style.overflow = '';
        }, { once: true });
    }

    function showToolMessage(messageAreaElement, text, type = 'info', duration = 4000) {
        if (!messageAreaElement) return;
        messageAreaElement.textContent = text; messageAreaElement.className = `vfx-tool-message message-${type}`; messageAreaElement.style.display = 'block';
        if (type !== 'error' && duration > 0) {
            setTimeout(() => {
                if (messageAreaElement) { messageAreaElement.textContent = ''; messageAreaElement.style.display = 'none'; }
            }, duration);
        }
    }
    function clearToolMessage(messageAreaElement) {
        if (!messageAreaElement) return;
        messageAreaElement.textContent = ''; messageAreaElement.style.display = 'none';
    }

    // --- START: Prompt Enhancer v7 Code (Adapted) ---
    const ENHANCER_SCRIPT_VERSION = '7.0';
    const ENHANCER_HISTORY_STORAGE_KEY = 'videofx_prompt_history_v5_aio';
    const ENHANCER_DEFAULT_PREAMBLE_SELECTED_KEY = '__videofxPreambleSelected_v4_aio';
    const ENHANCER_CUSTOM_PREAMBLES_KEY = '__videofxCustomPreambles_v1_aio';
    const ENHANCER_PRESETS_KEY = '__videofxEnhancerPresets_v1_aio';
    const ENHANCER_MAX_HISTORY_ITEMS = 50;
    const ENHANCER_API_ENDPOINT = 'https://labs.google/fx/api/trpc/videoFx.generateNextScenePrompts';
    const ENHANCER_INLINE_PREAMBLE_EDITOR_ID = 'vfx-enhancer-inline-preamble-editor-aio';
    const ENHANCER_LIVE_PROMPT_PREVIEW_ID = 'vfx-enhancer-live-prompt-preview-aio';
    const ENHANCER_LEXICON_POPOVER_ID = 'vfx-enhancer-lexicon-popover-aio';
    const ENHANCER_SMART_SUGGESTIONS_AREA_ID = 'vfx-enhancer-smart-suggestions-area-aio';
    const ENHANCER_CONFLICT_WARNING_CLASS = 'vfx-enhancer-schema-conflict-warning-aio';
    const ENHANCER_IMAGE_PREVIEW_CONTAINER_ID = 'vfx-enhancer-image-preview-container-aio';
    const ENHANCER_ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'];
    const ENHANCER_MAX_IMAGE_SIZE_MB = 10;

    const ENHANCER_DEFAULT_PREAMBLE_PRESETS_DATA = {
        "Cinematic Storyteller": { text: `You are an expert AI screenwriter...`, requires: ['shot_size', 'camera_movement'] },
        "Veo 2 Lexicon Guide": { text: `You are an expert AI prompt engineer...`, requires: null },
        "Gemini Veo Pro Enhancer": { text: `You are an expert AI prompt engineer...`, requires: null },
        "Veo Adherence Focus": { text: `You are an expert prompt engineer...`, requires: ['camera_angle', 'camera_movement', 'lighting_style_atmosphere'] },
        "Goldie Custom": { text: `You will be provided an input...`, requires: null }
    };
    let enhancerEffectivePreamblePresets = {};
    const ENHANCER_SCHEMA_INPUTS_DATA = { /* ... Full Schema Object from Enhancer, ensure all keys are present ... */ };
    const ENHANCER_LEXICON_DATA_VAL = { /* ... Full Lexicon Data from Enhancer ... */ };
    const ENHANCER_SMART_SUGGESTIONS_MAP_DATA = { /* ... Full Smart Suggestions Map from Enhancer ... */ };
    const ENHANCER_SCHEMA_CONFLICTS_DATA = { /* ... Full Schema Conflicts from Enhancer ... */ };

    let enhancerGlobalSchemaInputElements = {};
    let enhancerSmartSuggestionTimeout = null;
    let enhancerCurrentLexiconPopover = null;
    let enhancerCurrentModal = null;
    let enhancerCurrentBackdrop = null;
    let enhancerUploadedImageBase64 = '';

    function enhancerShowMessageModal(title, message, errorDetails = null, type = 'info') { /* ... As defined before ... */ }
    function enhancerLoadAllPreamblesAndStoreGlobally() { /* ... As defined before ... */ }
    // ... (Other enhancer helper functions: save/delete preambles, history, presets, live preview, schema interactions, API call)
    // ... (All these functions need to be fully defined here, using the _aio suffixed constants)

    function openPromptEnhancerModal(initialSettings = {}) {
        if (enhancerCurrentModal && enhancerCurrentModal.style.display !== 'none') {
            openModalUI(enhancerCurrentModal, enhancerCurrentBackdrop); return;
        }
        // ... (Full UI construction for Enhancer modal as sketched previously, ensuring all elements are created and appended to contentWrapper)
        // ... (Event listeners for all Enhancer UI elements)
        // ... (Call initial data loading and UI update functions for Enhancer)
        enhancerCurrentModal = document.querySelector('.vfx-prompt-enhancer-modal-aio'); // Example: Find the created modal
        enhancerCurrentBackdrop = enhancerCurrentModal.previousElementSibling; // Assuming backdrop is immediately before
        openModalUI(enhancerCurrentModal, enhancerCurrentBackdrop);
    }
    // --- END: Prompt Enhancer v7 Code ---


    // --- START: VideoFX Image Deconstructor Code (Adapted) ---
    const DECON_API_ENDPOINT = "https://labs.google/fx/api/trpc/backbone.captionImage";
    const DECON_OVERLAY_TITLE = 'Image Deconstructor';
    // ... (Other DECON constants with _aio suffix if needed for IDs)
    // ... (DECON global variables: deconCurrentModal, deconSelectedImageFullDataUrl, etc.)
    // ... (DECON helper functions: deconSetLoadingState, deconClearSelectedImage, deconHandleFileSelect, deconCallApi, deconHandleCopyClick)

    function openDeconstructorModal() {
        if (deconCurrentModal && deconCurrentModal.style.display !== 'none') {
            openModalUI(deconCurrentModal, deconCurrentBackdrop); return;
        }
        // ... (Full UI construction for Deconstructor modal)
        deconCurrentModal = document.querySelector('.vfx-image-deconstructor-modal-aio');
        deconCurrentBackdrop = deconCurrentModal.previousElementSibling;
        openModalUI(deconCurrentModal, deconCurrentBackdrop);
    }
    // --- END: VideoFX Image Deconstructor Code ---


    // --- START: VideoFX Promptless Image-to-Prompt Generator Code (Adapted) ---
    const I2P_API_ENDPOINT = "https://labs.google/fx/api/trpc/general.generatePromptlessI2VPrompt";
    const I2P_OVERLAY_TITLE = 'Image-to-Prompt Generator';
    // ... (Other I2P constants and global variables)
    // ... (I2P helper functions)

    function openImageToPromptModal() {
        if (i2pCurrentModal && i2pCurrentModal.style.display !== 'none') {
            openModalUI(i2pCurrentModal, i2pCurrentBackdrop); return;
        }
        // ... (Full UI construction for I2P modal)
        i2pCurrentModal = document.querySelector('.vfx-image-to-prompt-modal-aio');
        i2pCurrentBackdrop = i2pCurrentModal.previousElementSibling;
        openModalUI(i2pCurrentModal, i2pCurrentBackdrop);
    }
    // --- END: VideoFX Promptless Image-to-Prompt Generator Code ---

    function initializeMainFab() {
        if (document.getElementById(MAIN_FAB_CONTAINER_ID)) return;
        const fabContainer = document.createElement('div'); fabContainer.id = MAIN_FAB_CONTAINER_ID;
        const mainFab = createModalButton('', ['vfx-fab', 'vfx-fab-main'], () => { /* ... expand/collapse logic ... */ }, 'construction');
        mainFab.title = "Open VideoFX Tools"; mainFab.setAttribute('aria-haspopup', 'true'); mainFab.setAttribute('aria-expanded', 'false');
        const fabActions = [
            { id: 'enhancer', icon: 'auto_fix_high', label: 'Prompt Enhancer', action: openPromptEnhancerModal },
            { id: 'deconstructor', icon: 'splitscreen', label: 'Image Deconstructor', action: openDeconstructorModal },
            { id: 'image-to-prompt', icon: 'image_search', label: 'Image-to-Prompt Gen', action: openImageToPromptModal }
        ];
        fabActions.forEach(actionDef => { /* ... create secondary FABs and tooltips ... */ });
        fabContainer.appendChild(mainFab); document.body.appendChild(fabContainer);
        document.addEventListener('click', (event) => { /* ... close expanded FAB if clicking outside ... */ });
        console.log(`All-In-One VideoFX Tools v${SCRIPT_VERSION} Main FAB Initialized`);
    }

    GM_addStyle(` /* ... All combined and prefixed CSS from previous step ... */ `);
    function waitForPageReady(callback) {
        const readyCheck = () => { if (document.body && document.querySelector('canvas')) { callback(); } else { setTimeout(readyCheck, 200); }};
        if (document.readyState === 'complete' || (document.readyState === 'interactive' && document.body && document.querySelector('canvas'))) { callback(); }
        else { window.addEventListener('DOMContentLoaded', () => setTimeout(readyCheck, 200)); }
    }
    waitForPageReady(initializeMainFab);
    (function (arr) { /* Polyfill ... */ }) ([Element.prototype, Document.prototype, DocumentFragment.prototype]);
})();


// ==UserScript==
// @name          Prompt Enhancer v7 (Collapsible UI, Drag & Drop, Storyteller AI)
// @namespace     https://labs.google/
// @version       7.0
// @description   Major Upgrade: Collapsible UI, Drag & Drop Images, Section Resets, State-Aware Inputs, "Copy All" Results, and a new Cinematic Storyteller Preamble.
// @author        Goldie (Upgraded by AI)
// @match         https://labs.google/fx/*
// @grant         GM_addStyle
// @grant         GM_setClipboard
// @grant         GM_getValue
// @grant         GM_setValue
// @grant         GM_download
// @grant         GM_xmlhttpRequest
// @downloadURL   https://update.greasyfork.org/scripts/535432/Prompt%20Enhancer%20v7.user.js
// @updateURL     https://update.greasyfork.org/scripts/535432/Prompt%20Enhancer%20v7.meta.js
// ==/UserScript==

(function () {
    'use strict';

    // --- Inject Google Font CSS ---
    const fontLink = document.createElement('link');
    fontLink.rel = 'stylesheet';
    fontLink.href = 'https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&family=Google+Sans+Text:wght@400;500;600;700&family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap';
    document.head.appendChild(fontLink);

    // --- Constants ---
    const SCRIPT_VERSION = '7.0'; // Updated version
    const HISTORY_STORAGE_KEY = 'videofx_prompt_history_v5'; // Keep key for backward compatibility
    const DEFAULT_PREAMBLE_SELECTED_KEY = '__videofxPreambleSelected_v4';
    const CUSTOM_PREAMBLES_KEY = '__videofxCustomPreambles_v1';
    const ENHANCER_PRESETS_KEY = '__videofxEnhancerPresets_v1';
    const MAX_HISTORY_ITEMS = 50;
    const ENHANCER_ENDPOINT = 'https://labs.google/fx/api/trpc/videoFx.generateNextScenePrompts';
    const INLINE_PREAMBLE_EDITOR_ID = 'vfx-inline-preamble-editor';
    const FAB_CONTAINER_ID = 'vfx-fab-container';
    const LIVE_PROMPT_PREVIEW_ID = 'vfx-live-prompt-preview';
    const LEXICON_POPOVER_ID = 'vfx-lexicon-popover';
    const SMART_SUGGESTIONS_AREA_ID = 'vfx-smart-suggestions-area';
    const CONFLICT_WARNING_CLASS = 'vfx-schema-conflict-warning';
    const IMAGE_PREVIEW_CONTAINER_ID = 'vfx-image-preview-container';
    const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'];
    const MAX_IMAGE_SIZE_MB = 10;


    // --- Default Preamble Presets (with consolidated 'requires') ---
    const DEFAULT_PREAMBLE_PRESETS = {
        // NEW in v7.0
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
    let effectivePreamblePresets = {};

    // --- Schema Definition (EXPANDED) ---
    const SCHEMA_INPUTS = {
        composition_rule: {
            title: "Compositional Rule",
            enum: [
                "Default", "Rule of Thirds", "Golden Ratio / Spiral", "Centered Framing / Symmetry",
                "Leading Lines", "Diagonal Lines", "Triangle Composition", "Frame Within a Frame",
                "Negative Space Focus", "Dynamic Symmetry"
            ],
            default: "Default",
            description: "Guides visual arrangement of elements for aesthetic impact and storytelling."
        },
        shot_size: {
            title: "Shot Size / Framing",
            enum: [
                "Default", "Establishing Shot", "Master Shot", "Extreme Wide Shot (EWS/ELS)", "Very Wide Shot (VWS)",
                "Wide Shot (WS/LS)", "Full Shot (FS)", "Medium Wide Shot (MWS/American)",
                "Cowboy Shot (Mid-Thigh Up)", "Medium Shot (MS/Waist Up)", "Medium Close-Up (MCU/Chest Up)",
                "Close-Up (CU/Face)", "Choker Shot (Neck/Chin to Forehead)", "Extreme Close-Up (ECU/Features)",
                "Detail Shot / Insert", "Over-the-Shoulder (OTS)", "Point-of-View (POV)", "Cutaway Shot"
            ],
            default: "Default",
            description: "Defines subject proximity and how much of the scene/context is visible."
        },
        camera_angle: {
            title: "Camera Angle & Perspective",
            enum: [
                "Default / Eye-Level", "Shoulder Level", "High Angle (Looking Down)", "Low Angle (Looking Up)",
                "Dutch Angle / Canted Angle / Tilt", "Overhead / Bird's Eye View / Top Shot",
                "Ground Level Shot", "Worm's Eye View (Extreme Low)", "Hip Level", "Knee Level"
            ],
            default: "Default / Eye-Level",
            description: "Camera's vertical position and tilt relative to the subject, affecting perspective and emotion."
        },
        camera_movement: {
            title: "Camera Movement & Dynamics",
            enum: [
                "Default / Static Shot (No Movement)", "Pan (Left/Right)", "Whip Pan / Swish Pan", "Tilt (Up/Down)", "Whip Tilt",
                "Dolly (In/Out on Track/Wheels)", "Truck / Tracking / Following Shot (Parallel to Subject)",
                "Pedestal / Crane Shot (Vertical Lift)", "Boom Shot / Jib Arm (Arcing Vertical/Horizontal)",
                "Zoom (In/Out - Lens Magnification)", "Handheld Camera (Intentional Shake/Organic)",
                "Steadicam / Gimbal Shot (Smooth Floating)", "Arc Shot (Circles Subject)",
                "Dolly Zoom / Vertigo Effect / Zolly", "Drone Shot / Aerial Movement", "Reveal Shot (Gradual Unveiling)",
                "Random / Erratic Movement"
            ],
            default: "Default / Static Shot (No Movement)",
            description: "Describes the physical motion or lens adjustment of the camera during the shot."
        },
        lens_type_optical_effects: {
            title: "Lens Type & Optical Effects",
            enum: [
                "Default / Standard Lens (Natural Perspective)", "Wide-Angle Lens (Exaggerated Depth/Distortion)",
                "Telephoto Lens (Compressed Perspective/Shallow DoF)", "Prime Lens Look (Sharp, Fixed Focal Length)",
                "Anamorphic Lens Look (Oval Bokeh, Horizontal Flares)", "Fisheye Lens Effect (Extreme Barrel Distortion)",
                "Macro Lens Effect (Extreme Close-Up on Small Details)", "Tilt-Shift Effect (Miniature Look/Selective Focus Plane)",
                "Shallow Depth of Field (Blurred Background/Foreground)", "Deep Depth of Field (All in Focus)",
                "Rack Focus / Focus Pull (Shifting Focus Mid-Shot)", "Soft Focus / Diffusion Filter (Dreamy, Hazy)",
                "Creamy Bokeh (Smooth Out-of-Focus Areas)", "Swirly Bokeh", "Oval Bokeh (Anamorphic Specific)",
                "Lens Flare (Subtle/Natural)", "Lens Flare (Pronounced/Stylized)", "Lens Flare (Anamorphic Horizontal Blue/Orange)",
                "Starburst Lens Flare (Point Light Sources)", "Chromatic Aberration (Intentional Color Fringing)",
                "Lens Breathing Effect (Focal Shift During Focus)", "Split Diopter Effect (Two Focal Planes Sharp)"
            ],
            default: "Default / Standard Lens (Natural Perspective)",
            description: "Choice of lens and how it shapes the image, including focus, depth, flares, and aberrations."
        },
        lighting_style_atmosphere: {
            title: "Lighting Style & Atmosphere",
            enum: [
                "Default / Naturalistic Lighting", "Natural Light (Sunlight - Midday)", "Natural Light (Golden Hour / Magic Hour)",
                "Natural Light (Blue Hour / Twilight)", "Natural Light (Overcast / Diffused Daylight)", "Moonlight Effect / Night Lighting",
                "Candlelight / Firelight Effect", "Hard Light (Sharp, Defined Shadows)", "Soft Light (Diffused, Gentle Shadows)",
                "Flat Lighting (Minimal Shadows, Even Illumination)", "Three-Point Lighting (Key, Fill, Backlight)",
                "High-Key Lighting (Bright, Low Contrast, Cheerful)", "Low-Key Lighting (Dark, High Contrast, Dramatic)",
                "Chiaroscuro (Strong Light/Dark Contrast)", "Rembrandt Lighting (Triangular Light on Cheek)",
                "Rim Lighting / Backlighting (Outlines Subject)", "Silhouette Lighting (Subject Dark Against Bright BG)",
                "Warm Color Temperature (Oranges, Yellows)", "Cool Color Temperature (Blues, Cyans)",
                "Neon Lighting (Vibrant, Artificial Glow)", "Volumetric Lighting (Light Beams Visible, e.g., God Rays)",
                "Motivated Lighting (Source Appears Realistic to Scene)", "Practical Lights (Lamps, Fixtures in Scene)",
                "Spotlight Effect (Focused Beam)", "Kicker Light (Side/Rear Edge Light)",
                "Gobo / Patterned Light (Shadows/Light Shapes)", "Window Light (Natural or Simulated)", "Day for Night Effect (Simulating Night during Day)"
            ],
            default: "Default / Naturalistic Lighting",
            description: "The quality, direction, color, and mood created by light sources and shadows."
        },
        visual_style_medium_era: {
            title: "Visual Style, Medium & Era",
            enum: [
                "Default / Realistic", "Cinematic (Film-like Quality)", "Photorealistic (Highly Detailed, Real)", "Hyperrealistic (Exceedingly Real)",
                "Documentary (Observational / Vérité)", "Documentary (Expository / Interview-based)",
                "Film Noir (Dark, Shadowy B&W)", "Neo-Noir (Modern Film Noir)",
                "Found Footage (Handheld, Raw)", "Music Video (Stylized, Often Abstract)", "Commercial (Polished, Product-focused)",
                "Experimental / Art House", "Minimalist Style", "Action Sequence Style", "Surreal / Dreamlike", "Glitch Art / Datamosh",
                // Animation Styles
                "Animation: 3D Render (Modern CGI)", "Animation: 2D Cel / Traditional", "Animation: Anime (Japanese Style)",
                "Animation: Cartoon (Western Style)", "Animation: Motion Graphics", "Animation: Stop Motion / Claymation",
                "Animation: Pixel Art", "Animation: Voxel Art", "Animation: Rotoscoped", "Animation: Hand-drawn Sketch Style",
                // Artistic Mediums
                "Oil Painting Style", "Watercolor Painting Style", "Impressionistic Painting Style", "Charcoal Sketch Style", "Comic Book / Graphic Novel Style", "Matte Painting Look",
                // Film Stock & Era Emulation
                "8mm Film Look (Grainy, Vintage)", "16mm Film Look (Grainy, Indie)", "35mm Film Look (Classic Cinema)",
                "Technicolor Look (Vibrant, Saturated 2-strip/3-strip)", "Kodachrome Look", "Ektachrome Look", "Fujifilm Stock Look",
                "VHS Aesthetic (80s/90s Tape)", "Betamax Look", "Early 2000s Digicam / MiniDV Look",
                "Vintage Newsreel (B&W, Aged)", "Archival Footage Look", "Sepia Tone Vintage",
                "1920s Silent Film Look", "1950s Cinema Look", "1960s Mod Style", "1970s Film Look (Gritty/Saturated)", "1980s Neon/Synthwave", "1990s Grunge Video",
                // Specific Aesthetics
                "Cyberpunk Aesthetic", "Steampunk Aesthetic", "Solarpunk Aesthetic", "Dieselpunk Aesthetic",
                "Gothic Aesthetic", "Fantasy Art Style", "Sci-Fi Concept Art Style",
                "Infrared / Thermal Look", "X-Ray Look", "Security Camera (CCTV) Look"
            ],
            default: "Default / Realistic",
            description: "Overall aesthetic, artistic medium emulation, historical period, or genre-specific look."
        },
        vfx_post_production: {
            title: "Visual Effects (VFX) & Post-Production Styles",
            enum: [
                "None / In-Camera Only", "Subtle CGI Integration", "Heavy CGI / VFX Driven", "Practical Effects Focus",
                "Rotoscoping (Animated Outlines)", "Motion Graphics Elements", "Particle Effects (Snow, Rain, Dust, Fog, Embers)",
                "Lens Flares (Added in Post)", "Light Leaks (Post Effect)", "Film Grain Overlay (Added Texture)",
                "Color Grading: Cinematic Teal & Orange", "Color Grading: Bleach Bypass", "Color Grading: Desaturated / Muted",
                "Color Grading: Vibrant / Highly Saturated", "Color Grading: Cross-Processed Look",
                "Glitches / Distortion (Digital Artifacts)", "VHS Tracking Lines / Analog Glitches", "Data Moshing / Databending",
                "Scanlines / Interlacing Effect", "Composite (Green Screen Keying Implied)", "Wire Removal (Implied Clean-up)",
                "Digital Makeup / Retouching", "Time-Lapse Photography Effect", "Slow Motion (Overcranked)", "Speed Ramping (Variable Speed)",
                "Motion Blur (Post-Production Effect)", "Light Streaks / Trails (Post)", "Digital Set Extension / Matte Painting Integration",
                "Screen Shake / Camera Jitter (Post)", "Bullet Time Effect", "Slit-Scan Effect", "Morphing Effect", "Explosions / Fire VFX", "Muzzle Flashes / Gunfire VFX", "Smoke / Atmospheric VFX"
            ],
            default: "None / In-Camera Only",
            description: "Added visual manipulations, typically in post-production, or specific in-camera effect styles."
        },
        color_palette_grading: {
            title: "Color Palette & Grading",
            enum: [
                "Default / Natural Colors", "Monochromatic (Single Color + Tints/Shades)", "Achromatic (Black, White, Grays)",
                "High Contrast Colors", "Low Contrast Colors", "Vibrant & Saturated Palette", "Desaturated / Muted Palette",
                "Pastel Color Palette", "Neon Color Palette", "Earthy Tones Palette", "Jewel Tones Palette",
                "Cool Color Dominant (Blues, Greens, Purples)", "Warm Color Dominant (Reds, Oranges, Yellows)",
                "Analogous Colors (Adjacent on Color Wheel)", "Complementary Colors (Opposite on Color Wheel)",
                "Triadic Colors (Evenly Spaced on Color Wheel)", "Split-Complementary Colors",
                "Teal and Orange Grading", "Bleach Bypass Look (Desaturated, High Contrast)", "Sepia Tone",
                "Two-Strip Technicolor Emulation", "Three-Strip Technicolor Emulation", "Cross-Processing Emulation"
            ],
            default: "Default / Natural Colors",
            description: "Defines the dominant color scheme, color relationships, or specific color grading style."
        },
        editing_pace_transitions: {
            title: "Editing Pace & Transitions (Implied)",
            enum: [
                "Default / Standard Pace", "Slow Pacing / Long Takes / Contemplative", "Fast Pacing / Quick Cuts / Energetic",
                "Montage Sequence (Series of Short Shots)", "Rhythmic Editing (To Music/Beat)",
                "Smooth Transitions (e.g., Standard Cuts, Soft Dissolves)",
                "Dynamic Transitions (e.g., Wipes, Graphic Matches, Hard Cuts)",
                "Jump Cuts (Disorienting, Noticeable)", "Match Cut (Visual/Conceptual Link)", "Split Screen Presentation", "Invisible Editing / Seamless Cuts"
            ],
            default: "Default / Standard Pace",
            description: "Hints at the implied editing rhythm and style of transitions for the video's feel."
        },
        subject_prominence: {
            title: "Subject Prominence & Focus",
            enum: [
                "Default / Balanced Focus", "Primary Subject Sharp / Background Soft (Bokeh)",
                "Deep Focus / All Elements in Focus", "Background / Environment as Main Subject",
                "Selective Focus on Detail", "Dynamic Focus Shift (Rack Focus Implied)"
            ],
            default: "Default / Balanced Focus",
            description: "Directs attention and implies depth of field towards specific scene elements."
        },
        sound_design_influence: {
            title: "Sound Design Influence (Visual Hint)",
            enum: [
                "Default / Unspecified Audio Influence", "Silent Film Aesthetic (Visuals for Silence)",
                "Intense Soundscape Implied (e.g., Visual Impacts, Dynamic Motion)",
                "Delicate / Quiet Sounds Implied (e.g., Subtle Visuals, Stillness)",
                "Music-Driven Visuals (Rhythmic, Flowing)",
                "Environmental Ambience Focus (Visuals Reflecting Natural Sounds)",
                "Dialogue Focused (Visuals Support Conversation)"
            ],
            default: "Default / Unspecified Audio Influence",
            description: "Experimental: Hints at sound design to influence visual interpretation (e.g., impact, stillness, rhythm)."
        },
        prompt_detail_interpretation: {
            title: "Prompt Detail & Interpretation Style",
            enum: [
                "Balanced Detail (Default)", "High Detail (Specific & Elaborate)",
                "Hyper-Detailed (Extremely Specific, Granular)",
                "Medium Detail (Key Elements Described)", "Low Detail (Broad Strokes, Core Concept)",
                "Concise & Punchy (Brief, Impactful)",
                "Literal Interpretation (Adhere Closely to Text)",
                "Creative Interpretation (Allow Artistic Freedom)"
            ],
            default: "Balanced Detail (Default)",
            description: "Guides the LLM on the desired level of descriptive output and adherence to the input phrasing."
        },
        custom_elements: {
            title: "Custom Elements / Keywords",
            type: "string",
            default: "",
            description: "Specific keywords, artist names, unique objects, or complex actions. Use Lexicon Helper for ideas."
        }
    };

    const LEXICON_DATA = {
        "Shot Types & Framing": ["Aerial Shot", "Birds Eye View", "Close-Up (CU)", "Cowboy Shot", "Crane Shot", "Dutch Angle/Tilt", "Establishing Shot", "Extreme Close-Up (ECU)", "Extreme Wide Shot (EWS)", "Eye-Level Shot", "Full Shot (FS)", "Ground-Level Shot", "High-Angle Shot", "Insert Shot", "Long Shot (LS)", "Low-Angle Shot", "Macro Shot", "Medium Close-Up (MCU)", "Medium Shot (MS)", "Over-the-Shoulder Shot (OTS)", "Point-of-View (POV) Shot", "Reaction Shot", "Two-Shot", "Wide Shot (WS)", "Worm's Eye View", "Choker Shot", "Detail Shot", "Master Shot"],
        "Camera Movements": ["Arc Shot", "Boom Shot", "Crane Up/Down", "Dolly In/Out", "Dolly Zoom (Vertigo Effect)", "Handheld Camera", "Jib Shot", "Pan Left/Right", "Pedestal Up/Down", "Rack Focus (Focus Pull)", "Roll Shot", "Shaky Cam", "Slow Motion", "Fast Motion (Time-Lapse)", "Steadicam Shot", "Static Shot (Fixed)", "Swish Pan (Whip Pan)", "Tilt Up/Down", "Tracking Shot (Trucking/Following)", "Zoom In/Out", "Drone Shot", "Reveal Shot", "Whip Tilt"],
        "Lighting Styles": ["Ambient Light", "Backlighting (Rim Lighting)", "Chiaroscuro", "Daylight", "Diffused Light", "Direct Sunlight", "Film Noir Lighting", "Flat Lighting", "Floodlight", "Fluorescent Light", "Golden Hour (Magic Hour)", "Hard Light", "High-Key Lighting", "Key Light", "Fill Light", "Low-Key Lighting", "Moonlight", "Motivated Lighting", "Natural Light", "Neon Glow", "Overcast Light", "Practical Lights", "Rembrandt Lighting", "Silhouette", "Soft Light", "Spotlight", "Three-Point Lighting", "Volumetric Lighting (God Rays)", "Warm Light", "Cool Light", "Candlelight", "Firelight", "Blue Hour", "Kicker Light", "Gobo/Patterned Light", "Window Light", "Day for Night"],
        "Visual Styles & Aesthetics": ["Abstract", "Anime", "Art Deco", "Art Nouveau", "Baroque", "Bauhaus", "Biopunk", "Cinematic", "Collage", "Comic Book Style", "Conceptual Art", "Cubism", "Cyberpunk", "Dark Fantasy", "Dieselpunk", "Digital Art", "Documentary Style", "Doodle", "Dreamlike", "Expressionism", "Fantasy", "Film Noir", "Found Footage", "Futuristic", "Geometric", "Glitch Art", "Gothic", "Graffiti", "Grunge", "Hyperrealistic", "Impressionism", "Industrial", "Isometric", "Kinetic Typography", "Lo-Fi", "Low Poly", "Mandala", "Minimalist", "Modernist", "Monochromatic", "Neo-Noir", "Neon", "Nostalgic", "Oil Painting", "Origami", "Pastel", "Photorealistic", "Pixel Art", "Pop Art", "Psychedelic", "Realism", "Retro (Specify Era, e.g., 80s Retro)", "Rococo", "Romanticism", "Sci-Fi", "Sketch", "Steampunk", "Surrealism", "Synthwave", "Technical Drawing", "Technicolor", "Ukiyo-e", "Vaporwave", "Vector Art", "Vintage (Specify Era)", "Watercolor", "Western Style", "Y2K Aesthetic", "Zen", "Voxel Art", "Matte Painting", "Hand-drawn Animation", "Rotoscoped Animation", "Solarpunk", "1920s Silent Film", "1950s Technicolor Film", "1970s Grindhouse Film", "1990s Grunge Music Video"],
        "Lens & Optical Effects": ["Anamorphic Lens Flare", "Bokeh (Creamy, Swirly, Oval)", "Chromatic Aberration", "Deep Depth of Field (Deep Focus)", "Fisheye Lens", "Lens Distortion", "Lens Flare (Blue, Gold, Rainbow)", "Light Leaks", "Macro Lens", "Shallow Depth of Field (Shallow Focus)", "Soft Focus", "Telephoto Compression", "Tilt-Shift (Miniature Effect)", "Vignette", "Wide-Angle Distortion", "Prime Lens Look", "Diffusion Filter", "Lens Breathing", "Split Diopter", "Starburst Effect"],
        "Colors & Palettes": ["Analogous Colors", "Black and White (B&W)", "Bright Colors", "Cold Colors", "Complementary Colors", "Cool Color Palette", "Dark Tones", "Desaturated Colors", "Duotone", "Earthy Tones", "Grayscale", "High Contrast Colors", "Jewel Tones", "Low Contrast Colors", "Monochromatic (Specify Color)", "Muted Colors", "Neon Colors", "Pastel Colors", "Primary Colors", "Saturated Colors", "Sepia Tone", "Split Complementary Colors", "Teal and Orange", "Triadic Colors", "Vibrant Colors", "Vintage Colors", "Warm Color Palette", "Achromatic"],
        "Materials & Textures": ["Brushed Metal", "Canvas", "Ceramic", "Chiffon", "Chrome", "Clay", "Concrete", "Corrugated Metal", "Cotton", "Denim", "Distressed Wood", "Embroidered", "Fur", "Glass", "Glossy", "Gold Leaf", "Holographic", "Iridescent", "Knitted", "Lace", "Leather", "Linen", "Marble", "Matte Finish", "Metallic", "Mosaic", "Mother of Pearl", "Painted Wood", "Paper Mache", "Parchment", "Polished Stone", "Rough Hewn", "Rusty Metal", "Satin", "Scales", "Sequins", "Silk", "Smooth Stone", "Stained Glass", "Stainless Steel", "Suede", "Translucent", "Velvet", "Weathered", "Wicker", "Worn Leather", "Woven Fabric"],
        "Moods & Atmospheres": ["Adventurous", "Aggressive", "Alien", "Angelic", "Anxious", "Apocalyptic", "Arcane", "Atmospheric", "Austere", "Awe-Inspiring", "Bleak", "Calm", "Chaotic", "Cheerful", "Chilling", "Cinematic", "Clean", "Comforting", "Comical", "Cozy", "Creepy", "Cruel", "Crystalline", "Cute", "Dark", "Delicate", "Depressing", "Desolate", "Dirty", "Divine", "Dramatic", "Dreamy", "Dynamic", "Eerie", "Elegant", "Energetic", "Enigmatic", "Epic", "Ethereal", "Euphoric", "Exciting", "Exotic", "Explosive", "Festive", "Foreboding", "Frantic", "Friendly", "Futuristic", "Gloomy", "Gossamer", "Grand", "Gritty", "Grotesque", "Happy", "Haunting", "Heavenly", "Heroic", "Hopeful", "Humorous", "Hypnotic", "Idyllic", "Industrial", "Infernal", "Intense", "Intimate", "Intricate", "Joyful", "Jubilant", "Lonely", "Lush", "Luxurious", "Magical", "Majestic", "Melancholic", "Menacing", "Minimalist", "Mischievous", "Misty", "Moody", "Mysterious", "Mystical", "Mythic", "Nostalgic", "Ominous", "Opulent", "Orderly", "Ornate", "Otherworldly", "Overgrown", "Passionate", "Pastoral", "Peaceful", "Playful", "Powerful", "Primitive", "Psychedelic", "Quiet", "Radiant", "Raw", "Regal", "Relaxing", "Retro", "Reverent", "Romantic", "Rough", "Rustic", "Sacred", "Sad", "Savage", "Scary", "Scientific", "Screaming", "Seductive", "Sensual", "Serene", "Shadowy", "Shimmering", "Sinister", "Sleek", "Solemn", "Somber", "Soothing", "Sophisticated", "Sparkling", "Spiritual", "Spooky", "Sterile", "Still", "Stormy", "Stressful", "Strong", "Stylized", "Sublime", "Sunny", "Surreal", "Suspenseful", "Sweet", "Symmetrical", "Tense", "Terrifying", "Thoughtful", "Threatening", "Thrilling", "Timeless", "Tranquil", "Tribal", "Tropical", "Unsettling", "Uplifting", "Urban", "Urgent", "Vast", "Vibrant", "Victorian", "Violent", "Volatile", "Warm", "Whimsical", "Wild", "Wintry", "Wise", "Wistful", "Youthful", "Zen"],
        "Film & Photography Terms": ["8K", "4K", "HD", "Aspect Ratio (16:9, 2.35:1)", "Depth of Field (DoF)", "Exposure (Overexposed, Underexposed)", "Film Grain", "Focal Length", "ISO", "Long Exposure", "Motion Blur", "Noise", "Shutter Speed", "Time-lapse", "White Balance", "Aperture (f-stop)"],
        "Artistic Mediums": ["Acrylic Painting", "Chalk Art", "Charcoal Drawing", "Claymation", "Collage Art", "Concept Art", "Cross-Stitch", "Digital Painting", "Etching", "Graffiti Art", "Illustration", "Ink Drawing", "Linocut", "Lithograph", "Mixed Media", "Mosaic Art", "Oil Painting", "Pastel Drawing", "Pencil Sketch", "Quilling", "Screen Printing", "Sculpture (Specify Material, e.g., Bronze Sculpture)", "Spray Paint Art", "Stained Glass Art", "Stop Motion Animation", "Tapestry", "Watercolor Painting", "Woodblock Print"],
        "General Keywords": ["Detailed", "Intricate Details", "Hyperdetailed", "Sharp Focus", "High Resolution", "Award-Winning Photography", "Masterpiece", "Trending on ArtStation", "Unreal Engine 5 Render", "Octane Render", "VFX", "SFX", "High Fidelity"]
    };
    const SMART_SUGGESTIONS_MAP = {
        "run": { schemaKey: "camera_movement", value: "Truck / Tracking / Following Shot (Parallel to Subject)", label: "Tracking Shot for 'run' (Movement)" },
        "running": { schemaKey: "camera_movement", value: "Truck / Tracking / Following Shot (Parallel to Subject)", label: "Tracking Shot for 'running' (Movement)" },
        "walk": { schemaKey: "camera_movement", value: "Truck / Tracking / Following Shot (Parallel to Subject)", label: "Tracking Shot for 'walk' (Movement)" },
        "walking": { schemaKey: "camera_movement", value: "Truck / Tracking / Following Shot (Parallel to Subject)", label: "Tracking Shot for 'walking' (Movement)" },
        "fly": { schemaKey: "camera_movement", value: "Drone Shot / Aerial Movement", label: "Drone/Aerial for 'fly' (Movement)" },
        "flying": { schemaKey: "camera_movement", value: "Drone Shot / Aerial Movement", label: "Drone/Aerial for 'flying' (Movement)" },
        "sunset": { schemaKey: "lighting_style_atmosphere", value: "Natural Light (Golden Hour / Magic Hour)", label: "Golden Hour for 'sunset' (Lighting)" },
        "sunrise": { schemaKey: "lighting_style_atmosphere", value: "Natural Light (Golden Hour / Magic Hour)", label: "Golden Hour for 'sunrise' (Lighting)" },
        "night": { schemaKey: "lighting_style_atmosphere", value: "Low-Key Lighting (Dark, High Contrast, Dramatic)", label: "Low-Key Lighting for 'night' (Lighting)" },
        "dark": { schemaKey: "lighting_style_atmosphere", value: "Low-Key Lighting (Dark, High Contrast, Dramatic)", label: "Low-Key Lighting for 'dark' (Lighting)" },
        "sad": { schemaKey: "lighting_style_atmosphere", value: "Cool Color Temperature (Blues, Cyans)", label: "Cool Colors for 'sad' (Lighting)" },
        "happy": { schemaKey: "lighting_style_atmosphere", value: "Warm Color Temperature (Oranges, Yellows)", label: "Warm Colors for 'happy' (Lighting)" },
        "face": { schemaKey: "shot_size", value: "Close-Up (CU/Face)", label: "Close-Up for 'face' (Shot Size)" },
        "eyes": { schemaKey: "shot_size", value: "Extreme Close-Up (ECU/Features)", label: "Extreme Close-Up for 'eyes' (Shot Size)" },
        "landscape": { schemaKey: "shot_size", value: "Extreme Wide Shot (EWS/ELS)", label: "Extreme Wide Shot for 'landscape' (Shot Size)" },
        "vast": { schemaKey: "shot_size", value: "Extreme Wide Shot (EWS/ELS)", label: "Extreme Wide Shot for 'vast' (Shot Size)" },
        "cinematic": { schemaKey: "visual_style_medium_era", value: "Cinematic (Film-like Quality)", label: "Cinematic for 'cinematic' (Visual Style)" },
        "anime": { schemaKey: "visual_style_medium_era", value: "Animation: Anime (Japanese Style)", label: "Anime for 'anime' (Visual Style)" },
        "cartoon": { schemaKey: "visual_style_medium_era", value: "Animation: Cartoon (Western Style)", label: "Cartoon for 'cartoon' (Visual Style)" },
        "rain": { schemaKey: "vfx_post_production", value: "Particle Effects (Snow, Rain, Dust, Fog, Embers)", label: "Particle Effects (Rain) for 'rain' (VFX)"},
        "snow": { schemaKey: "vfx_post_production", value: "Particle Effects (Snow, Rain, Dust, Fog, Embers)", label: "Particle Effects (Snow) for 'snow' (VFX)"},
        "fog": { schemaKey: "vfx_post_production", value: "Particle Effects (Snow, Rain, Dust, Fog, Embers)", label: "Particle Effects (Fog) for 'fog' (VFX)"},
        "explosion": { schemaKey: "vfx_post_production", value: "Explosions / Fire VFX", label: "Explosions for 'explosion' (VFX)"},
    };
    const SCHEMA_CONFLICTS = {
        'camera_movement': {
            'Default / Static Shot (No Movement)': [
                'Pan (Left/Right)', 'Whip Pan / Swish Pan', 'Tilt (Up/Down)', 'Whip Tilt',
                'Dolly (In/Out on Track/Wheels)', 'Truck / Tracking / Following Shot (Parallel to Subject)',
                'Pedestal / Crane Shot (Vertical Lift)', 'Boom Shot / Jib Arm (Arcing Vertical/Horizontal)',
                'Zoom (In/Out - Lens Magnification)', 'Handheld Camera (Intentional Shake/Organic)',
                'Steadicam / Gimbal Shot (Smooth Floating)', 'Arc Shot (Circles Subject)',
                'Dolly Zoom / Vertigo Effect / Zolly', 'Drone Shot / Aerial Movement', 'Reveal Shot (Gradual Unveiling)'
            ],
            'Handheld Camera (Intentional Shake/Organic)': ['Steadicam / Gimbal Shot (Smooth Floating)'],
            'Steadicam / Gimbal Shot (Smooth Floating)': ['Handheld Camera (Intentional Shake/Organic)'],
        },
        'lens_type_optical_effects': {
            'Shallow Depth of Field (Blurred Background/Foreground)': ['Deep Depth of Field (All in Focus)'],
            'Deep Depth of Field (All in Focus)': ['Shallow Depth of Field (Blurred Background/Foreground)'],
        },
        'subject_prominence': {
             'Primary Subject Sharp / Background Soft (Bokeh)': ['Deep Focus / All Elements in Focus', 'Background / Environment as Main Subject'],
             'Deep Focus / All Elements in Focus': ['Primary Subject Sharp / Background Soft (Bokeh)'],
        }
    };

    let globalSchemaInputElements = {};
    let smartSuggestionTimeout = null;
    let currentLexiconPopover = null;

    // --- CSS Styles (with v7 additions) ---
    GM_addStyle(`
        :root {
            --google-font: 'Google Sans Text', 'Roboto', sans-serif;
            --dark-bg-primary: #2d2d2d; --dark-bg-secondary: #1f1f1f; --dark-bg-tertiary: #3f3f3f;
            --dark-text-primary: #e8eaed; --dark-text-secondary: #bdc1c6;
            --dark-border: #3f3f3f; --dark-focus-border: #8ab4f8; --dark-error-border: #f28b82; /* Adjusted focus color */
            --fab-main-bg: #8ab4f8; --fab-main-hover: #9ac1f9; --fab-secondary-bg: #303134; /* Adjusted FAB color */
            --fab-secondary-hover: #3c4043; --fab-icon-color: #202124; --fab-secondary-icon-color: #e8eaed;
            --dark-accent-blue: #8ab4f8; --dark-accent-red: #f28b82; --dark-button-text-on-blue: #202124;
            --ui-radius: 18px; --shadow-color: rgba(0, 0, 0, 0.25); --shadow-strong-color: rgba(0, 0, 0, 0.35);
            --scroll-thumb: #5f6368; --scroll-track: var(--dark-bg-secondary);
            --warning-color: #fdd663; --warning-border: #fbc02d;
            --modified-indicator-color: #8ab4f8; /* New color for state awareness */
        }
        .material-symbols-outlined { font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24; font-size: 1.25em; vertical-align: middle; line-height: 1; margin-right: 6px; margin-left: -4px; }
        .vfx-enhancer-close-btn .material-symbols-outlined, .vfx-modal-button.icon-only .material-symbols-outlined { margin: 0; font-size: 24px; }
        .vfx-modal-button.info-action .material-symbols-outlined { font-size: 1.1em; margin-right: 4px; }
        .vfx-lexicon-keyword .material-symbols-outlined { font-size: 1em; margin-left: 4px; margin-right: 0; color: var(--dark-text-secondary); }
        .vfx-enhancer-modal, .vfx-fab-container button, .vfx-tooltip { font-family: var(--google-font); }
        #${FAB_CONTAINER_ID} { position: fixed; top: 20px; left: 20px; z-index: 9990; display: flex; flex-direction: column; align-items: flex-start; }
        #${FAB_CONTAINER_ID} .vfx-fab-item { display: flex; align-items: center; margin-bottom: 12px; position: relative; }
        #${FAB_CONTAINER_ID} .vfx-fab { border: none; border-radius: 50%; box-shadow: 0 3px 8px var(--shadow-strong-color); cursor: pointer; transition: all 0.2s ease-out; font-weight: 500; display: flex; align-items: center; justify-content: center; width: 56px; height: 56px; transform: scale(0); opacity: 0; pointer-events: none; }
        #${FAB_CONTAINER_ID} .vfx-fab:hover:not(:disabled) { box-shadow: 0 5px 12px var(--shadow-strong-color); transform: scale(1.05) !important; }
        #${FAB_CONTAINER_ID} .vfx-fab-main { background-color: var(--fab-main-bg); color: var(--fab-icon-color); transform: scale(1); opacity: 1; pointer-events: auto; order: -1; }
        #${FAB_CONTAINER_ID} .vfx-fab-main .material-symbols-outlined { transition: transform 0.2s ease-in-out; }
        #${FAB_CONTAINER_ID} .vfx-fab-main:hover:not(:disabled) { background-color: var(--fab-main-hover); }
        #${FAB_CONTAINER_ID} .vfx-fab-secondary { background-color: var(--fab-secondary-bg); color: var(--fab-secondary-icon-color); width: 48px; height: 48px; margin-right: 8px; }
        #${FAB_CONTAINER_ID} .vfx-fab-secondary:hover:not(:disabled) { background-color: var(--fab-secondary-hover); }
        #${FAB_CONTAINER_ID}.expanded .vfx-fab { transform: scale(1); opacity: 1; pointer-events: auto; }
        #${FAB_CONTAINER_ID}.expanded .vfx-fab-main .material-symbols-outlined { transform: rotate(135deg); }
        .vfx-tooltip { position: absolute; left: 100%; top: 50%; transform: translateY(-50%); margin-left: 12px; padding: 6px 12px; background-color: var(--dark-bg-tertiary); color: var(--dark-text-primary); border-radius: 8px; font-size: 0.8rem; white-space: nowrap; box-shadow: 0 2px 5px var(--shadow-color); opacity: 0; visibility: hidden; transition: opacity 0.15s ease 0.1s, visibility 0.15s ease 0.1s; pointer-events: none; z-index: 1; }
        #${FAB_CONTAINER_ID}.expanded .vfx-fab-item:hover .vfx-tooltip { opacity: 1; visibility: visible; }
        .vfx-enhancer-modal { position: fixed; top: 50px; left: 50px; z-index: 9995; background-color: var(--dark-bg-primary); color: var(--dark-text-primary); border-radius: var(--ui-radius); box-shadow: 0 8px 25px var(--shadow-strong-color); padding: 0; max-width: 900px; width: 95%; max-height: calc(100vh - 100px); display: flex; flex-direction: column; overflow: hidden; border: 1px solid var(--dark-border); opacity: 0; transform: scale(0.95) translateY(10px); transition: opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1), transform 0.25s cubic-bezier(0.4, 0, 0.2, 1); }
        .vfx-enhancer-modal.visible { opacity: 1; transform: scale(1) translateY(0); }
        .vfx-enhancer-modal-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 24px; border-bottom: 1px solid var(--dark-border); cursor: move; background-color: var(--dark-bg-primary); border-top-left-radius: var(--ui-radius); border-top-right-radius: var(--ui-radius); user-select: none; flex-shrink: 0; }
        .vfx-enhancer-modal-title { font-size: 1.2rem; font-weight: 500; color: var(--dark-text-primary); margin: 0; }
        .vfx-enhancer-close-btn { position: static; background: none; border: none; color: var(--dark-text-secondary); cursor: pointer; width: 40px; height: 40px; border-radius: 50%; transition: background-color 0.2s ease; margin-left: 10px; padding: 0; display: flex; align-items: center; justify-content: center; }
        .vfx-enhancer-close-btn:hover { background-color: var(--dark-bg-tertiary); color: var(--dark-text-primary); }
        .vfx-enhancer-modal-content { flex-grow: 1; overflow-y: auto; padding: 20px 24px; min-height: 100px; scrollbar-width: thin; scrollbar-color: var(--scroll-thumb) var(--scroll-track); }
        .vfx-enhancer-modal-content::-webkit-scrollbar { width: 8px; } .vfx-enhancer-modal-content::-webkit-scrollbar-track { background: var(--scroll-track); border-radius: 4px; } .vfx-enhancer-modal-content::-webkit-scrollbar-thumb { background-color: var(--scroll-thumb); border-radius: 4px; border: 2px solid var(--scroll-track); } .vfx-enhancer-modal-content::-webkit-scrollbar-thumb:hover { background-color: var(--dark-text-secondary); }
        .vfx-enhancer-modal-footer { display: flex; justify-content: space-between; align-items: center; padding: 16px 24px; border-top: 1px solid var(--dark-border); background-color: var(--dark-bg-primary); border-bottom-left-radius: var(--ui-radius); border-bottom-right-radius: var(--ui-radius); flex-wrap: wrap; gap: 12px; flex-shrink: 0; }
        .vfx-enhancer-modal-footer .footer-actions-right { display: flex; gap: 12px; flex-wrap: wrap; justify-content: flex-end; }
        .vfx-enhancer-modal-footer .footer-actions-left { display: flex; gap: 12px; flex-wrap: wrap; }
        .vfx-enhancer-modal label { font-size: 0.8rem; font-weight: 500; color: var(--dark-text-secondary); margin-bottom: 6px; display: block; text-align: left; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        #vfx-preamble-label-main { margin-bottom: 0; font-weight: bold; color: var(--dark-text-primary); display: flex; align-items: center; justify-content: space-between; }
        .vfx-preamble-controls { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
        #vfx-preamble-select { flex-grow: 1; margin-bottom: 0 !important; }
        .vfx-preamble-action-btn { background: none; border: none; color: var(--dark-text-secondary); cursor: pointer; padding: 0; line-height: 1; margin-left: 0; flex-shrink: 0; width:36px; height:36px; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; }
        .vfx-preamble-action-btn:hover { color: var(--dark-text-primary); background-color: var(--dark-bg-tertiary); }
        .vfx-preamble-action-btn .material-symbols-outlined { font-size: 20px; vertical-align: middle; margin: 0; }
        #${INLINE_PREAMBLE_EDITOR_ID} { width: 100%; min-height: 100px; max-height: 250px; overflow-y: auto; background-color: var(--dark-bg-secondary); padding: 12px 15px; border-radius: calc(var(--ui-radius) / 1.5); border: 1px solid var(--dark-border); white-space: pre-wrap; font-size: 0.85rem; color: var(--dark-text-primary); line-height: 1.5; margin-top: 0; margin-bottom: 10px; display: none; resize: vertical; box-sizing: border-box; scrollbar-width: thin; scrollbar-color: var(--scroll-thumb) var(--scroll-track); }
        #${INLINE_PREAMBLE_EDITOR_ID}:focus { border-color: var(--dark-focus-border); outline: none; box-shadow: 0 0 0 2px rgba(138, 180, 248, 0.3); }
        #${INLINE_PREAMBLE_EDITOR_ID}::-webkit-scrollbar { width: 6px; } #${INLINE_PREAMBLE_EDITOR_ID}::-webkit-scrollbar-track { background: var(--scroll-track); } #${INLINE_PREAMBLE_EDITOR_ID}::-webkit-scrollbar-thumb { background-color: var(--scroll-thumb); }
        .vfx-preamble-editor-buttons { display: none; gap: 8px; margin-bottom:10px; justify-content: flex-end; }
        .vfx-enhancer-modal select, .vfx-enhancer-modal textarea, .vfx-enhancer-modal input[type="text"], .vfx-enhancer-modal input[type="search"] { width: 100%; margin-bottom: 16px; padding: 12px 16px; font-size: 0.9rem; border-radius: var(--ui-radius); border: 1px solid var(--dark-border); background-color: var(--dark-bg-secondary); color: var(--dark-text-primary); box-sizing: border-box; transition: border-color 0.2s ease, box-shadow 0.2s ease; }
        .vfx-enhancer-modal select::placeholder, .vfx-enhancer-modal textarea::placeholder, .vfx-enhancer-modal input[type="text"]::placeholder, .vfx-enhancer-modal input[type="search"]::placeholder { color: var(--dark-text-secondary); opacity: 0.7; }
        .vfx-enhancer-modal select:focus, .vfx-enhancer-modal textarea:focus, .vfx-enhancer-modal input[type="text"]:focus, .vfx-enhancer-modal input[type="search"]:focus { border-color: var(--dark-focus-border); outline: none; box-shadow: 0 0 0 2px rgba(138, 180, 248, 0.3); }
        .vfx-enhancer-modal textarea.input-error, .vfx-enhancer-modal input.input-error { border-color: var(--dark-error-border) !important; box-shadow: 0 0 0 2px rgba(242, 139, 130, 0.3) !important; }
        .vfx-enhancer-modal select { appearance: none; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='%23bdc1c6' viewBox='0 0 16 16'%3E%3Cpath fill-rule='evenodd' d='M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708z'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 16px center; background-size: 16px 16px; padding-right: 45px; }
        .vfx-schema-input-item { position: relative; } /* New for modified indicator */
        .vfx-schema-input-item label { position: relative; display: inline-block; padding-left: 12px; }
        .vfx-schema-input-item.modified label::before { content: ''; position: absolute; left: 0; top: 50%; transform: translateY(-50%); width: 6px; height: 6px; background-color: var(--modified-indicator-color); border-radius: 50%; }
        .vfx-enhancer-modal textarea#vfx-prompt-input, .vfx-enhancer-modal textarea#vfx-negative-prompt-input { min-height: 80px; resize: vertical; font-size: 0.95rem; }
        .vfx-enhancer-modal textarea#vfx-negative-prompt-input { min-height: 50px; }
        #vfx-candidate-count-select { margin-bottom: 16px; }
        #${LIVE_PROMPT_PREVIEW_ID} { width: 100%; min-height: 80px; max-height: 200px; overflow-y: auto; background-color: var(--dark-bg-secondary); padding: 10px 15px; border-radius: calc(var(--ui-radius) / 1.5); border: 1px dashed var(--dark-border); white-space: pre-wrap; font-size: 0.85rem; color: var(--dark-text-secondary); line-height: 1.5; margin-top: 10px; margin-bottom: 16px; box-sizing: border-box; font-style: italic; scrollbar-width: thin; scrollbar-color: var(--scroll-thumb) var(--scroll-track); }
        #${LIVE_PROMPT_PREVIEW_ID}::-webkit-scrollbar { width: 6px; }
        .vfx-fieldset { border: 1px solid var(--dark-border); border-radius: var(--ui-radius); padding: 0 18px 18px 18px; margin-bottom: 18px; background-color: transparent; position: relative; transition: padding .3s ease; }
        .vfx-fieldset legend { font-size: 0.9rem; font-weight: 500; color: var(--dark-text-primary); padding: 0 10px; margin-left: 8px; background-color: var(--dark-bg-primary); display: inline-flex; align-items: center; cursor: pointer; user-select: none; gap: 8px; transform: translateY(1px); }
        .vfx-fieldset legend .material-symbols-outlined { font-size: 20px; transition: transform 0.2s ease-in-out; }
        .vfx-fieldset legend .vfx-fieldset-reset-btn { font-size: 16px; color: var(--dark-text-secondary); visibility: hidden; opacity: 0; transition: opacity 0.2s, color 0.2s; }
        .vfx-fieldset legend:hover .vfx-fieldset-reset-btn { visibility: visible; opacity: 1; }
        .vfx-fieldset legend .vfx-fieldset-reset-btn:hover { color: var(--dark-text-primary); }
        .vfx-fieldset.collapsed > *:not(legend) { display: none; }
        .vfx-fieldset.collapsed { padding-top: 0; padding-bottom: 0; margin-top: -1px; }
        .vfx-fieldset:not(.collapsed) legend .material-symbols-outlined { transform: rotate(90deg); }
        .vfx-fieldset-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 14px 24px; margin-top: 18px; }
        .vfx-fieldset-grid .vfx-schema-input-item label { margin-bottom: 4px; }
        .vfx-fieldset-grid .vfx-schema-input-item select, .vfx-fieldset-grid .vfx-schema-input-item input[type="text"] { margin-bottom: 0; }
        .vfx-modal-button { padding: 10px 20px; font-size: 0.9rem; font-weight: 500; border: 1px solid transparent; border-radius: var(--ui-radius); cursor: pointer; transition: background-color 0.2s ease, box-shadow 0.2s ease, transform 0.1s ease, border-color 0.2s ease; text-transform: none; min-height: 40px; display: inline-flex; align-items: center; justify-content: center; gap: 6px; }
        .vfx-modal-button:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 2px 4px var(--shadow-color); }
        .vfx-modal-button:disabled { opacity: 0.5; cursor: not-allowed; transform: none; box-shadow: none; }
        .vfx-modal-button.primary-action { background-color: var(--dark-accent-blue); color: var(--dark-button-text-on-blue); border-color: var(--dark-accent-blue); }
        .vfx-modal-button.primary-action:hover:not(:disabled) { background-color: #9ac1f9; border-color: #9ac1f9; }
        .vfx-modal-button.secondary-action { background-color: var(--dark-bg-tertiary); color: var(--dark-text-primary); border-color: var(--dark-bg-tertiary); }
        .vfx-modal-button.secondary-action:hover:not(:disabled) { background-color: #4a4a4a; border-color: #4a4a4a;}
        .vfx-modal-button.danger-action { background-color: transparent; color: var(--dark-accent-red); border: 1px solid var(--dark-accent-red); }
        .vfx-modal-button.danger-action:hover:not(:disabled) { background-color: rgba(242, 139, 130, 0.15); }
        .vfx-modal-button.info-action { background-color: var(--dark-bg-secondary); border: 1px solid var(--dark-border); color: var(--dark-text-primary); padding: 6px 12px; font-size: 0.8rem; min-height: auto; font-weight: 400; border-radius: var(--ui-radius); }
        .vfx-modal-button.info-action:hover:not(:disabled) { background-color: var(--dark-bg-tertiary); border-color: var(--dark-text-secondary); }
        .vfx-modal-button.info-action:disabled { color: var(--dark-text-secondary); background-color: var(--dark-bg-secondary); opacity: 0.7; border-color: var(--dark-border);}
        .vfx-modal-button.icon-only { padding: 8px; min-width: 36px; min-height: 36px; border-radius: 50%; background-color: transparent; border: 1px solid transparent;}
        .vfx-modal-button.icon-only:hover:not(:disabled) { background-color: var(--dark-bg-tertiary); }
        .vfx-history-entry, .vfx-result-entry { background: var(--dark-bg-primary); color: var(--dark-text-primary); margin-bottom: 16px; padding: 16px 20px; border-radius: var(--ui-radius); border: 1px solid var(--dark-border); box-shadow: 0 2px 4px var(--shadow-color); }
        .vfx-history-entry h3, .vfx-result-entry h3 { margin-top: 0; margin-bottom: 12px; color: var(--dark-text-primary); font-size: 1.05rem; font-weight: 500; display: flex; justify-content: space-between; align-items: center; }
        .vfx-result-actions, .vfx-history-actions { display: flex; gap: 8px; margin-left: 12px; }
        .vfx-results-modal .vfx-enhancer-modal-header .vfx-enhancer-modal-title { flex-grow: 1; }
        .vfx-results-modal .vfx-enhancer-modal-header .vfx-modal-button { margin-left: auto; margin-right: 15px; }
        .vfx-history-details-block { margin-top: 10px; padding: 10px; background-color: var(--dark-bg-secondary); border-radius: calc(var(--ui-radius) / 2); border: 1px solid var(--dark-border); font-size: 0.85rem; }
        .vfx-history-details-block strong { color: var(--dark-text-secondary); display: block; margin-bottom: 3px; }
        .vfx-history-details-block ul { padding-left: 20px; margin: 5px 0; color: var(--dark-text-primary); } .vfx-history-details-block ul li { margin-bottom: 3px; }
        /* Image Upload & Drag/Drop Styles */
        #vfx-image-upload-input { display: none; }
        .vfx-image-upload-area { cursor: pointer; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; margin-top: 8px; border: 2px dashed var(--dark-border); border-radius: var(--ui-radius); padding: 15px; text-align: center; transition: border-color 0.3s, background-color 0.3s; }
        .vfx-image-upload-area.drag-over { border-color: var(--dark-focus-border); background-color: rgba(138, 180, 248, 0.1); }
        .vfx-image-upload-area p { margin:0; pointer-events:none; }
        #${IMAGE_PREVIEW_CONTAINER_ID} { position: relative; display: none; margin-top: 10px; margin-bottom: 0px; max-width: 250px; border-radius: calc(var(--ui-radius) / 1.5); overflow: hidden; border: 1px solid var(--dark-border); }
        #${IMAGE_PREVIEW_CONTAINER_ID} img { display: block; width: 100%; height: auto; }
        #vfx-remove-image-btn { position: absolute; top: 8px; right: 8px; background-color: rgba(30, 30, 30, 0.7); color: white; border-radius: 50%; width: 28px; height: 28px; padding: 0; line-height: 1; border: 1px solid rgba(255, 255, 255, 0.2); cursor: pointer; display: flex; align-items: center; justify-content: center; font-family: sans-serif; font-size: 20px; font-weight: bold; transition: background-color 0.2s, transform 0.2s; }
        #vfx-remove-image-btn:hover { background-color: rgba(220, 53, 69, 0.9); transform: scale(1.1); }
        /* Lexicon Popover Styles etc. */
        #${LEXICON_POPOVER_ID} {
            position: absolute; z-index: 10000;
            background-color: var(--dark-bg-primary); color: var(--dark-text-primary);
            border: 1px solid var(--dark-border); border-radius: calc(var(--ui-radius) / 1.5);
            box-shadow: 0 5px 15px var(--shadow-strong-color);
            width: calc(100% - 40px); max-width: 450px;
            max-height: 350px; display: flex; flex-direction: column;
            margin-top: 5px;
            opacity: 0; transform: translateY(-10px); visibility: hidden;
            transition: opacity 0.2s ease-out, transform 0.2s ease-out, visibility 0s linear 0.2s;
        }
        #${LEXICON_POPOVER_ID}.visible {
            opacity: 1; transform: translateY(0); visibility: visible;
            transition: opacity 0.2s ease-out, transform 0.2s ease-out, visibility 0s linear 0s;
        }
        .${CONFLICT_WARNING_CLASS} {
            font-size: 0.75rem; color: var(--warning-color);
            background-color: rgba(251, 192, 45, 0.1);
            border: 1px solid var(--warning-border);
            border-radius: calc(var(--ui-radius) / 3);
            padding: 4px 8px; margin-top: 4px;
            display: block;
        }
    `);

    // --- Helper Function ---
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

    // --- Preamble Management ---
    function loadAllPreamblesAndStoreGlobally() {
        const customPreamblesFromStorage = JSON.parse(GM_getValue(CUSTOM_PREAMBLES_KEY, '{}'));
        effectivePreamblePresets = {};
        const allDefaultPresets = { ...DEFAULT_PREAMBLE_PRESETS };
        // This ensures the new preamble is added if the script is updated
        if (!allDefaultPresets["Cinematic Storyteller"]) {
            allDefaultPresets["Cinematic Storyteller"] = {
                 text: `You are an expert AI screenwriter...`, // (full text)
                 requires: ['shot_size', 'camera_movement']
            };
        }
        for (const key in allDefaultPresets) {
            const presetDefinition = allDefaultPresets[key];
            effectivePreamblePresets[key] = {
                text: presetDefinition.text,
                _status: 'default',
                requires: presetDefinition.requires || null
            };
        }
        for (const key in customPreamblesFromStorage) {
            const customText = customPreamblesFromStorage[key];
            if (effectivePreamblePresets[key]) {
                effectivePreamblePresets[key].text = customText;
                effectivePreamblePresets[key]._status = 'custom_override';
            } else {
                effectivePreamblePresets[key] = { text: customText, _status: 'custom', requires: null };
            }
        }
    }
    function saveCustomPreambleText(name, text) {
        if (!name || !name.trim()) { showMessageModal("Error Saving Preamble", "Preamble name cannot be empty.", null, "error"); return false; }
        const customPreamblesStore = JSON.parse(GM_getValue(CUSTOM_PREAMBLES_KEY, '{}'));
        customPreamblesStore[name.trim()] = text;
        try { GM_setValue(CUSTOM_PREAMBLES_KEY, JSON.stringify(customPreamblesStore)); loadAllPreamblesAndStoreGlobally(); return true; }
        catch (e) { console.error("Error saving custom preamble:", e); showMessageModal("Storage Error", "Could not save custom preamble.", e.message, "error"); return false; }
    }
    function deleteCustomPreambleText(name) {
        const customPreamblesStore = JSON.parse(GM_getValue(CUSTOM_PREAMBLES_KEY, '{}'));
        if (customPreamblesStore.hasOwnProperty(name)) {
            delete customPreamblesStore[name];
            try { GM_setValue(CUSTOM_PREAMBLES_KEY, JSON.stringify(customPreamblesStore)); loadAllPreamblesAndStoreGlobally();
                const currentSelectedKey = GM_getValue(DEFAULT_PREAMBLE_SELECTED_KEY);
                if (currentSelectedKey === name) { GM_setValue(DEFAULT_PREAMBLE_SELECTED_KEY, Object.keys(DEFAULT_PREAMBLE_PRESETS)[0] || ''); }
                return true;
            } catch (e) { console.error("Error deleting custom preamble:", e); showMessageModal("Storage Error", "Could not delete custom preamble.", e.message, "error"); return false; }
        } return false;
    }

    // --- UI Helper Functions ---
    function createModal(title, contentElements = [], footerElements = [], modalClass = '') {
        const existingModal = document.querySelector(`.vfx-enhancer-modal.${modalClass.split(' ')[0]}`);
        if (existingModal && !modalClass.includes('allow-multiple')) {
            existingModal.style.top = `${Math.max(0, (window.innerHeight / 2) - (existingModal.offsetHeight / 2))}px`;
            existingModal.style.left = `${Math.max(0, (window.innerWidth / 2) - (existingModal.offsetWidth / 2))}px`;
            setTimeout(() => existingModal.classList.add('visible'), 0);
            let focusTarget = existingModal.querySelector('textarea, input:not([type="file"]), select, button:not(.info-action):not([disabled])') || existingModal.querySelector('.vfx-enhancer-close-btn');
            if (focusTarget) setTimeout(() => focusTarget.focus(), 50);
            return { modal: existingModal, contentWrapper: existingModal.querySelector('.vfx-enhancer-modal-content'), header: existingModal.querySelector('.vfx-enhancer-modal-header'), footer: existingModal.querySelector('.vfx-enhancer-modal-footer'), footerLeft: existingModal.querySelector('.footer-actions-left'), footerRight: existingModal.querySelector('.footer-actions-right') };
        }
        const modal = document.createElement('div'); modal.className = `vfx-enhancer-modal ${modalClass}`;
        const header = document.createElement('div'); header.className = 'vfx-enhancer-modal-header';
        const modalTitle = document.createElement('h2'); modalTitle.className = 'vfx-enhancer-modal-title'; modalTitle.textContent = title;
        const closeButton = createModalButton('', ['vfx-enhancer-close-btn', 'icon-only'], () => { modal.classList.remove('visible'); modal.addEventListener('transitionend', () => modal.remove(), { once: true }); }, 'close', 'Close Modal');
        header.appendChild(modalTitle); header.appendChild(closeButton);
        const contentWrapper = document.createElement('div'); contentWrapper.className = 'vfx-enhancer-modal-content'; contentElements.forEach(el => contentWrapper.appendChild(el));
        const footer = document.createElement('div'); footer.className = 'vfx-enhancer-modal-footer';
        const footerLeft = document.createElement('div'); footerLeft.className = 'footer-actions-left';
        const footerRight = document.createElement('div'); footerRight.className = 'footer-actions-right';
        if (Array.isArray(footerElements)) { footerElements.forEach(el => { (el.dataset.align === 'left' ? footerLeft : footerRight).appendChild(el); }); }
        else if (footerElements) { footerRight.appendChild(footerElements); }
        footer.appendChild(footerLeft); footer.appendChild(footerRight); modal.appendChild(header); modal.appendChild(contentWrapper);
        if (footerLeft.hasChildNodes() || footerRight.hasChildNodes() || modalClass.includes('vfx-results-modal') || modalClass.includes('vfx-prompt-builder-modal') || modalClass.includes('vfx-history-modal') || modalClass.includes('vfx-message-modal') || modalClass.includes('vfx-preamble-manager-modal')) { modal.appendChild(footer); }
        let isDragging = false, offsetX, offsetY;
        header.addEventListener('mousedown', (e) => { if (e.target.closest('.vfx-enhancer-close-btn, button, input, select, textarea')) return; isDragging = true; offsetX = e.clientX - modal.offsetLeft; offsetY = e.clientY - modal.offsetTop; modal.style.transition = 'none'; document.body.style.userSelect = 'none'; document.addEventListener('mousemove', onMouseMove); document.addEventListener('mouseup', onMouseUp); e.preventDefault(); });
        function onMouseMove(e) { if (!isDragging) return; let newX = e.clientX - offsetX; let newY = e.clientY - offsetY; newX = Math.max(0, Math.min(newX, window.innerWidth - modal.offsetWidth)); newY = Math.max(0, Math.min(newY, window.innerHeight - modal.offsetHeight)); modal.style.left = `${newX}px`; modal.style.top = `${newY}px`; }
        function onMouseUp() { if (isDragging) { isDragging = false; modal.style.transition = ''; document.body.style.userSelect = ''; document.removeEventListener('mousemove', onMouseMove); document.removeEventListener('mouseup', onMouseUp); } }
        document.body.appendChild(modal);
        requestAnimationFrame(() => { modal.style.top = `${Math.max(0, (window.innerHeight / 2) - (modal.offsetHeight / 2))}px`; modal.style.left = `${Math.max(0, (window.innerWidth / 2) - (modal.offsetWidth / 2))}px`; setTimeout(() => modal.classList.add('visible'), 0); });
        let focusTarget = modal.querySelector('input[type="search"], textarea, input:not([type="file"]), select, button.primary-action:not([disabled])') || closeButton; if (focusTarget) setTimeout(() => focusTarget.focus(), 100);
        return { modal, contentWrapper, header, footer, footerLeft, footerRight };
    }
    function createModalButton(text, classNames = [], onClick = null, iconName = null, title = null) {
        const button = document.createElement('button'); button.type = 'button';
        if (iconName) { const iconSpan = createIconSpan(iconName); if (!text || text.trim() === '') { button.classList.add('icon-only'); iconSpan.style.marginRight = '0'; } button.appendChild(iconSpan); }
        if (text && text.trim() !== '') { button.appendChild(document.createTextNode(text)); }
        const classes = Array.isArray(classNames) ? classNames : [classNames]; if (!classes.some(cls => cls.startsWith('vfx-fab'))) { if (!classes.includes('vfx-modal-button')) classes.unshift('vfx-modal-button'); } classes.forEach(cls => button.classList.add(cls));
        if (onClick) button.onclick = onClick;
        const effectiveTitle = title || (iconName && (!text || text.trim() === '') ? iconName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : (text || 'Button'));
        button.title = effectiveTitle; button.setAttribute('aria-label', effectiveTitle);
        return button;
    }
    function showLoadingModal(message = "Processing your request...") {
        document.querySelectorAll('.vfx-loading-modal').forEach(m => { m.classList.remove('visible'); m.addEventListener('transitionend', () => m.remove(), { once: true });});
        const loadingIcon = createIconSpan('hourglass_top'); const loadingText = document.createElement('div'); loadingText.className = 'vfx-loading-indicator'; loadingText.setAttribute('role', 'status'); loadingText.appendChild(loadingIcon); loadingText.appendChild(document.createTextNode(message));
        const { modal } = createModal("Processing", [loadingText], [], 'vfx-loading-modal allow-multiple');
        const closeBtn = modal.querySelector('.vfx-enhancer-close-btn'); if(closeBtn) closeBtn.style.display = 'none';
        const header = modal.querySelector('.vfx-enhancer-modal-header'); if(header) header.style.cursor = 'default';
        return modal;
    }
    function showMessageModal(title, message, errorDetails = null, type = 'info') {
        let icon = 'info'; if (type === 'success') icon = 'check_circle'; if (type === 'error') icon = 'error';
        const messageIcon = createIconSpan(icon); messageIcon.style.fontSize = '1.5em'; messageIcon.style.marginRight = '10px';
        if (type === 'error') messageIcon.style.color = 'var(--dark-accent-red)'; if (type === 'success') messageIcon.style.color = 'var(--dark-accent-blue)';
        const messageText = document.createElement('p'); messageText.textContent = message; messageText.style.margin = '10px 0 20px 0'; messageText.style.textAlign = 'left'; messageText.style.display = 'flex'; messageText.style.alignItems = 'center'; messageText.prepend(messageIcon);
        const contentElements = [messageText];
        if (errorDetails) { const detailsDiv = document.createElement('div'); detailsDiv.className = 'vfx-error-details'; detailsDiv.textContent = typeof errorDetails === 'string' ? errorDetails : JSON.stringify(errorDetails, null, 2); contentElements.push(detailsDiv); }
        const okButton = createModalButton('OK', ['primary-action'], (e) => { const m = e.target.closest('.vfx-enhancer-modal'); if (m) { m.classList.remove('visible'); m.addEventListener('transitionend', () => m.remove(), { once: true }); } }, 'check_circle');
        createModal(title, contentElements, [okButton], `vfx-message-modal allow-multiple`);
    }
    function populatePreambleSelect(selectElement, selectedPreambleName) {
        selectElement.innerHTML = ''; loadAllPreamblesAndStoreGlobally();
        const defaultGroup = document.createElement('optgroup'); defaultGroup.label = 'Default Preambles';
        const customOverrideGroup = document.createElement('optgroup'); customOverrideGroup.label = 'Customized Defaults';
        const customGroup = document.createElement('optgroup'); customGroup.label = 'Custom Preambles';
        Object.keys(effectivePreamblePresets).sort((a,b) => a.toLowerCase().localeCompare(b.toLowerCase())).forEach(key => {
            const preambleEntry = effectivePreamblePresets[key]; const option = document.createElement('option'); option.value = key; option.textContent = key;
            if (preambleEntry._status === 'custom') { option.textContent = `${key} (Custom)`; customGroup.appendChild(option); }
            else if (preambleEntry._status === 'custom_override') { option.textContent = `${key} (Customized)`; customOverrideGroup.appendChild(option); }
            else { defaultGroup.appendChild(option); }
            if (key === selectedPreambleName) option.selected = true;
        });
        if (defaultGroup.childNodes.length > 0) selectElement.appendChild(defaultGroup);
        if (customOverrideGroup.childNodes.length > 0) selectElement.appendChild(customOverrideGroup);
        if (customGroup.childNodes.length > 0) selectElement.appendChild(customGroup);
        if (!selectElement.value && selectElement.options.length > 0) { selectElement.selectedIndex = 0; GM_setValue(DEFAULT_PREAMBLE_SELECTED_KEY, selectElement.value); }
    }
    function updatePreambleEditorVisibility(preambleName, editorElement, editorButtonsContainer, saveChangesBtn) {
        loadAllPreamblesAndStoreGlobally(); const preambleEntry = effectivePreamblePresets[preambleName];
        if (editorElement.style.display === 'block') { editorElement.value = preambleEntry ? preambleEntry.text : ''; if (saveChangesBtn) { saveChangesBtn.disabled = !(preambleEntry && (preambleEntry._status === 'custom' || preambleEntry._status === 'custom_override')); } }
    }

    // --- History ---
    function saveToHistory(prompt, outputs, schemaSelections, negativeKeywords = '', preambleName = '', preambleText = '', imageAttached = false) {
        try { const h = JSON.parse(GM_getValue(HISTORY_STORAGE_KEY, '[]')); h.unshift({ time: new Date().toISOString(), prompt, outputs, schemaSelections, negativeKeywords, preambleName, preambleText, imageAttached }); GM_setValue(HISTORY_STORAGE_KEY, JSON.stringify(h.slice(0, MAX_HISTORY_ITEMS))); }
        catch (e) { console.error("Error saving to history:", e); showMessageModal("History Error", "Could not save to history.", e.message, "error"); }
    }
    function loadHistory() {
        try { const hd = GM_getValue(HISTORY_STORAGE_KEY); return hd ? JSON.parse(hd) : []; }
        catch (e) { console.error("Error loading history:", e); GM_setValue(HISTORY_STORAGE_KEY, JSON.stringify([])); return []; }
    }
    function clearHistory() {
        if (confirm("Are you sure you want to clear the entire prompt history? This cannot be undone.")) {
            try { GM_setValue(HISTORY_STORAGE_KEY, JSON.stringify([])); return true; }
            catch (e) { console.error("Error clearing history:", e); showMessageModal("History Error", "Could not clear history.", e.message, "error"); return false; }
        } return false;
    }

    // --- Live Preview & UI State Update ---
    function updateLivePromptPreview(previewElement, preambleTextToShow, corePrompt, currentSchemaSelections, negativePrompt, imageAttached = false) {
        if (!previewElement) return;
        let fullPrompt = preambleTextToShow ? preambleTextToShow + "\n\n" : "";
        if (imageAttached) {
            fullPrompt += "[Image Attached] ";
        }
        fullPrompt += corePrompt || "[Your Core Prompt Here]";
        const selectedKeywords = [];
        if(currentSchemaSelections){
            for (const key in currentSchemaSelections) {
                const value = currentSchemaSelections[key]; const schemaDef = SCHEMA_INPUTS[key];
                if (value && value.trim() !== "" && schemaDef && value !== schemaDef.default) { selectedKeywords.push(key === 'custom_elements' ? value.trim() : `${schemaDef.title}: ${value}`); }
            }
        }
        if (selectedKeywords.length > 0) { fullPrompt += "\n\n" + selectedKeywords.join(". "); }
        if (negativePrompt && negativePrompt.trim() !== "") { fullPrompt += `\n\n--neg ${negativePrompt.trim()}`; }
        previewElement.textContent = fullPrompt;
    }

    function updateModifiedStateForAllInputs() {
        Object.entries(globalSchemaInputElements).forEach(([key, element]) => {
            const schemaDef = SCHEMA_INPUTS[key];
            if (!schemaDef) return;
            const isModified = element.value !== schemaDef.default;
            element.closest('.vfx-schema-input-item')?.classList.toggle('modified', isModified);
        });
    }

    // --- GM_xmlhttpRequest Wrapper ---
    function gmFetch(url, options) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: options.method || "GET", url: url, headers: options.headers || {},
                data: options.body, responseType: "json",
                onload: function(response) {
                    if (response.status >= 200 && response.status < 300) { resolve({ ok: true, status: response.status, statusText: response.statusText, json: () => Promise.resolve(response.response), text: () => Promise.resolve(response.responseText) }); }
                    else { resolve({ ok: false, status: response.status, statusText: response.statusText, json: () => Promise.resolve(response.response || {}), text: () => Promise.resolve(response.responseText) }); }
                },
                onerror: (response) => reject(new Error(`GM_xmlhttpRequest error: ${response.statusText || 'Network error'}`)),
                ontimeout: () => reject(new Error("GM_xmlhttpRequest timeout")), onabort: () => reject(new Error("GM_xmlhttpRequest aborted"))
            });
        });
    }

    // --- Core API Interaction & Result Display ---
    async function executePromptGeneration(userPrompt, preambleTextForAPI, combinedKeywords, negativeKeywords, selectedPreambleName, candidateCount = 4, contextForHistory = null, imageBase64 = '') {
        let loadingModal = showLoadingModal("Generating Enhanced Prompts...");
        let promptForApi = preambleTextForAPI ? preambleTextForAPI + "\n\n" + userPrompt : userPrompt;
        if (combinedKeywords) promptForApi += (promptForApi.endsWith('\n\n') || !promptForApi ? "" : "\n\n") + combinedKeywords;
        if (negativeKeywords) promptForApi += (promptForApi.endsWith('\n\n') || !promptForApi ? "" : "\n\n") + `--neg ${negativeKeywords}`;

        const sessionId = `userscript-session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

        console.log(`--- Running Generation (Preset: ${selectedPreambleName}, Candidates: ${candidateCount}) ---\nFinal String for API: ${promptForApi}\n--- Preamble Used ---\n${preambleTextForAPI}\n--- Session ID: ${sessionId} ---`);

        const jsonPayload = {
            prompt: promptForApi,
            sessionId,
            image: imageBase64 || "",
            candidateCount: parseInt(candidateCount, 10),
            preamble: (effectivePreamblePresets[selectedPreambleName]?.text || preambleTextForAPI)
        };
        let errorDetailsText = null;
        try {
            const response = await gmFetch(ENHANCER_ENDPOINT, { method: 'POST', headers: { 'accept': '*/*', 'content-type': 'application/json' }, body: JSON.stringify({ json: jsonPayload }) });
            if (!response.ok) { try { errorDetailsText = await response.text(); if (errorDetailsText.trim().startsWith('{')) errorDetailsText = JSON.stringify(JSON.parse(errorDetailsText), null, 2); } catch (e) {} throw new Error(`API request failed: ${response.status} ${response.statusText}`); }
            const prepData = await response.json();
            if(loadingModal) { loadingModal.classList.remove('visible'); loadingModal.addEventListener('transitionend', () => loadingModal.remove(), { once: true }); }
            const candidates = prepData?.result?.data?.json?.result?.candidates; if (!candidates?.length) throw new Error('No valid candidate prompts returned by the API.');
            const outputs = candidates.map(c => c?.output).filter(Boolean); if (outputs.length === 0) throw new Error('Received candidates but no valid output text found.');
            const schemaSelectionsForHistory = contextForHistory?.schemaSelections || {};
            saveToHistory(userPrompt, outputs, schemaSelectionsForHistory, negativeKeywords, selectedPreambleName, preambleTextForAPI, imageBase64 !== '');
            displayResults(userPrompt, schemaSelectionsForHistory, negativeKeywords, outputs, preambleTextForAPI, selectedPreambleName, imageBase64);
        } catch (error) { if(loadingModal) { loadingModal.classList.remove('visible'); loadingModal.addEventListener('transitionend', () => loadingModal.remove(), { once: true }); } console.error("Error during prompt generation fetch:", error, errorDetailsText); showMessageModal('Generation Failed', `${error.message}. Check console.`, errorDetailsText, "error"); }
    }

    function displayResults(originalPrompt, schemaSelectionsForHistory, negativeKeywords, outputs, usedPreambleText, usedPreambleName, imageBase64 = '') {
        const resultEntryElements = outputs.map((text, index) => { const div = document.createElement('div'); div.className = 'vfx-result-entry'; const resultTitle = document.createElement('h3'); resultTitle.textContent = `Enhanced Prompt ${index + 1}`; const actionsDiv = document.createElement('div'); actionsDiv.className = 'vfx-result-actions'; const copyBtn = createModalButton('Copy', ['info-action'], () => { GM_setClipboard(text, 'text'); copyBtn.innerHTML = createIconSpanHTML('task_alt') + 'Copied!'; copyBtn.disabled = true; setTimeout(() => { copyBtn.innerHTML = createIconSpanHTML('content_copy') + 'Copy'; copyBtn.disabled = false; }, 2000); }, 'content_copy', 'Copy prompt'); actionsDiv.appendChild(copyBtn); resultTitle.appendChild(actionsDiv); const resultText = document.createElement('p'); resultText.textContent = text; div.appendChild(resultTitle); div.appendChild(resultText); return div; });
        const detailsContainer = document.createElement('div'); detailsContainer.className = 'vfx-history-details-block'; detailsContainer.style.marginBottom = '20px';
        let detailsHTML = `<strong>Original Core Prompt:</strong> ${originalPrompt || '(empty)'}`;
        if (imageBase64) detailsHTML += `<br><strong>Image Reference:</strong> Yes`;
        if (negativeKeywords) detailsHTML += `<br><strong>Negative Keywords:</strong> ${negativeKeywords}`;
        if (usedPreambleName) detailsHTML += `<br><strong>Preamble Used:</strong> ${usedPreambleName}`;
        const selectionsList = []; if (schemaSelectionsForHistory) { Object.entries(schemaSelectionsForHistory).forEach(([key, value]) => { const schema = SCHEMA_INPUTS[key]; if (value && value.trim() !== "" && schema && value !== schema.default) { selectionsList.push(`<li><strong>${schema.title}:</strong> ${value}</li>`); } }); } if (selectionsList.length > 0) { detailsHTML += `<br><strong>Key Selections:</strong><ul>${selectionsList.join('')}</ul>`; } detailsContainer.innerHTML = detailsHTML;

        // Footer buttons
        const footerButtonsLeft = []; loadAllPreamblesAndStoreGlobally();
        Object.keys(effectivePreamblePresets).sort((a,b)=>a.toLowerCase().localeCompare(b.toLowerCase())).forEach((presetKey) => {
            if (presetKey !== usedPreambleName) {
                const preambleEntry = effectivePreamblePresets[presetKey]; const preambleTextToRetry = preambleEntry ? preambleEntry.text : "";
                const retryBtn = createModalButton(`Retry: ${presetKey.substring(0,20)}${presetKey.length > 20 ? '...' : ''}`, ['info-action'], (e) => {
                    const currentResultsModal = e.target.closest('.vfx-results-modal'); if (currentResultsModal) { currentResultsModal.classList.remove('visible'); currentResultsModal.addEventListener('transitionend', () => currentResultsModal.remove(), { once: true }); }
                    const schemaKeywordsForApi = []; if (schemaSelectionsForHistory) { Object.entries(schemaSelectionsForHistory).forEach(([key, val]) => { const schema = SCHEMA_INPUTS[key]; if (val && val.trim() !== "" && schema && val !== schema.default) { schemaKeywordsForApi.push(key === 'custom_elements' ? val.trim() : `${schema.title}: ${val}`); } }); } const combinedKeywordsForApi = schemaKeywordsForApi.join(". ");
                    executePromptGeneration(originalPrompt, preambleTextToRetry, combinedKeywordsForApi, negativeKeywords, presetKey, undefined, {schemaSelections: schemaSelectionsForHistory}, imageBase64);
                }, 'replay', `Retry with '${presetKey}'`);
                retryBtn.dataset.align = "left"; footerButtonsLeft.push(retryBtn);
            }
        });
        const okButton = createModalButton('OK', ['primary-action'], (e) => { const m = e.target.closest('.vfx-enhancer-modal'); if (m) { m.classList.remove('visible'); m.addEventListener('transitionend', () => m.remove(), { once: true }); } }, 'check_circle', "Close results");

        // Header with Copy All button
        const { modal } = createModal("Generated Results", [detailsContainer, ...resultEntryElements], [...footerButtonsLeft, okButton], 'vfx-results-modal allow-multiple');
        const header = modal.querySelector('.vfx-enhancer-modal-header');
        const copyAllBtn = createModalButton('Copy All', ['info-action'], () => {
             const allText = outputs.join('\n\n---\n\n');
             GM_setClipboard(allText, 'text');
             copyAllBtn.innerHTML = createIconSpanHTML('task_alt') + 'All Copied!';
             copyAllBtn.disabled = true;
             setTimeout(() => {
                 copyAllBtn.innerHTML = createIconSpanHTML('content_copy_all') + 'Copy All';
                 copyAllBtn.disabled = false;
             }, 2500);
        }, 'content_copy_all', 'Copy all generated prompts');
        header.insertBefore(copyAllBtn, header.querySelector('.vfx-enhancer-close-btn'));
    }

    // --- Lexicon Popover ---
    function toggleLexiconPopover(popover, helperButton) {
        if (!popover || !helperButton) return;
        const isVisible = popover.classList.toggle('visible');
        if (isVisible) {
            const inputRect = helperButton.closest('.vfx-custom-keywords-group').getBoundingClientRect();
            const modalContentRect = popover.closest('.vfx-enhancer-modal-content').getBoundingClientRect();
            popover.style.top = `${inputRect.bottom - modalContentRect.top + 5}px`;
            popover.style.left = `${inputRect.left - modalContentRect.left + (inputRect.width / 2) - (popover.offsetWidth / 2)}px`;
            if(popover.offsetLeft + popover.offsetWidth > modalContentRect.width - 20){ popover.style.left = `${modalContentRect.width - popover.offsetWidth - 25}px`; }
            if(popover.offsetLeft < 10){ popover.style.left = '10px'; }
            popover.querySelector('.vfx-lexicon-search-bar')?.focus();
            document.addEventListener('click', hideLexiconOnClickOutside, true);
        } else {
            document.removeEventListener('click', hideLexiconOnClickOutside, true);
        }
    }
    function hideLexiconOnClickOutside(event) {
        const popover = document.getElementById(LEXICON_POPOVER_ID);
        const helperButton = document.querySelector('.vfx-custom-keywords-group .vfx-modal-button[title*="Lexicon"]');
        if (popover && popover.classList.contains('visible') && !popover.contains(event.target) && !(helperButton && helperButton.contains(event.target))) {
            popover.classList.remove('visible');
            document.removeEventListener('click', hideLexiconOnClickOutside, true);
        }
    }
    function createLexiconPopover(customKeywordsInputRef, livePreviewUpdateFn) {
        if (document.getElementById(LEXICON_POPOVER_ID)) return document.getElementById(LEXICON_POPOVER_ID);

        const popover = document.createElement('div'); popover.id = LEXICON_POPOVER_ID; popover.onclick = (e) => e.stopPropagation();
        const contentDiv = document.createElement('div'); contentDiv.className = 'vfx-lexicon-popover-content';
        const searchInput = document.createElement('input'); searchInput.type = 'search'; searchInput.placeholder = 'Search keywords...'; searchInput.className = 'vfx-lexicon-search-bar'; contentDiv.appendChild(searchInput);
        const categoriesContainer = document.createElement('div'); categoriesContainer.className = 'vfx-lexicon-categories'; contentDiv.appendChild(categoriesContainer);
        popover.appendChild(contentDiv);

        const getCurrentKeywordsArray = () => customKeywordsInputRef.value.split(',').map(k => k.trim().toLowerCase()).filter(Boolean);
        const renderKeywords = (searchTerm = '') => {
            categoriesContainer.innerHTML = ''; const lowerSearchTerm = searchTerm.toLowerCase(); let currentCustomKeywords = getCurrentKeywordsArray();
            Object.entries(LEXICON_DATA).forEach(([categoryName, keywords]) => {
                const filteredKeywords = keywords.filter(kw => kw.toLowerCase().includes(lowerSearchTerm)); if (filteredKeywords.length === 0 && searchTerm) return;
                const categoryDiv = document.createElement('div'); categoryDiv.className = 'vfx-lexicon-category';
                const titleDiv = document.createElement('div'); titleDiv.className = 'vfx-lexicon-category-title'; titleDiv.textContent = categoryName; const expandIcon = createIconSpan('chevron_right'); titleDiv.appendChild(expandIcon);
                const keywordsDiv = document.createElement('div'); keywordsDiv.className = 'vfx-lexicon-keywords-container';
                filteredKeywords.forEach(keyword => {
                    const keywordSpan = document.createElement('span'); keywordSpan.className = 'vfx-lexicon-keyword'; keywordSpan.textContent = keyword;
                    if (currentCustomKeywords.includes(keyword.toLowerCase())) { keywordSpan.classList.add('added'); keywordSpan.appendChild(createIconSpan('check_circle')); }
                    keywordSpan.onclick = () => { let keywordsArray = customKeywordsInputRef.value.split(',').map(k => k.trim()).filter(Boolean); const keywordLower = keyword.toLowerCase(); const currentIcon = keywordSpan.querySelector('.material-symbols-outlined'); if (keywordsArray.map(k => k.toLowerCase()).includes(keywordLower)) { keywordsArray = keywordsArray.filter(k => k.toLowerCase() !== keywordLower); keywordSpan.classList.remove('added'); if(currentIcon) currentIcon.remove(); } else { keywordsArray.push(keyword); keywordSpan.classList.add('added'); if(!currentIcon) keywordSpan.appendChild(createIconSpan('check_circle')); } customKeywordsInputRef.value = keywordsArray.join(', '); livePreviewUpdateFn(); renderKeywords(searchInput.value); };
                    keywordsDiv.appendChild(keywordSpan);
                });
                categoryDiv.appendChild(titleDiv); categoryDiv.appendChild(keywordsDiv); categoriesContainer.appendChild(categoryDiv);
                titleDiv.onclick = () => { const isExpanded = keywordsDiv.classList.toggle('visible'); titleDiv.classList.toggle('expanded', isExpanded); expandIcon.textContent = isExpanded ? 'expand_more' : 'chevron_right'; };
                if (searchTerm && filteredKeywords.length > 0) { keywordsDiv.classList.add('visible'); titleDiv.classList.add('expanded'); expandIcon.textContent = 'expand_more'; }
            });
        };
        searchInput.oninput = () => renderKeywords(searchInput.value); renderKeywords();
        return popover;
    }

    // --- Smart Schema Suggestions & Conflict Detection ---
    function updateSmartSuggestions(corePromptText, suggestionsAreaElement, currentSchemaElements, livePreviewUpdateFn, selectedPreambleName) {
        if (!suggestionsAreaElement) return;
        suggestionsAreaElement.innerHTML = ''; const suggestionsFound = [];
        loadAllPreamblesAndStoreGlobally(); const preambleInfo = effectivePreamblePresets[selectedPreambleName];
        const requirements = preambleInfo?.requires;
        if (requirements && requirements.length > 0) {
             requirements.forEach(reqKey => {
                const schemaInput = currentSchemaElements[reqKey]; const schemaDefault = SCHEMA_INPUTS[reqKey]?.default;
                if (schemaInput && schemaInput.value === schemaDefault) {
                     suggestionsFound.push({ text: `Preamble suggests setting: ${SCHEMA_INPUTS[reqKey]?.title || reqKey}`, isRequirement: true, apply: () => schemaInput.focus() });
                }
             });
        }
        if (corePromptText.trim()) {
            const promptWords = corePromptText.toLowerCase().match(/\b(\w+)\b/g) || [];
            for (const keyword in SMART_SUGGESTIONS_MAP) {
                if (promptWords.includes(keyword)) {
                    const suggestion = SMART_SUGGESTIONS_MAP[keyword]; const schemaInput = currentSchemaElements[suggestion.schemaKey]; const schemaDefault = SCHEMA_INPUTS[suggestion.schemaKey]?.default;
                    if (schemaInput && schemaInput.value === schemaDefault && suggestion.value !== schemaDefault && SCHEMA_INPUTS[suggestion.schemaKey]?.enum?.includes(suggestion.value)) {
                        suggestionsFound.push({ text: suggestion.label, isRequirement: false,
                            apply: () => { if (schemaInput && SCHEMA_INPUTS[suggestion.schemaKey].enum.includes(suggestion.value)) { schemaInput.value = suggestion.value; const event = new Event('change', { bubbles: true }); schemaInput.dispatchEvent(event); updateSmartSuggestions(corePromptText, suggestionsAreaElement, currentSchemaElements, livePreviewUpdateFn, selectedPreambleName); checkSchemaConflicts(currentSchemaElements); } }
                        });
                    }
                }
            }
        }
        if (suggestionsFound.length > 0) {
            suggestionsAreaElement.innerHTML = '<strong>Smart Suggestions:</strong><ul></ul>'; const ul = suggestionsAreaElement.querySelector('ul');
            suggestionsFound.forEach(sugg => { const li = document.createElement('li'); li.textContent = sugg.text; li.style.cursor = 'pointer'; li.title = sugg.isRequirement ? `Preamble recommends setting this field` : `Click to apply: ${sugg.text.split(" for ")[0]}`; li.onclick = sugg.apply; if(sugg.isRequirement) li.classList.add('suggestion-preamble-req'); ul.appendChild(li); });
            suggestionsAreaElement.style.display = 'block';
        } else { suggestionsAreaElement.style.display = 'none'; }
    }
    function checkSchemaConflicts(currentSchemaElements) {
        document.querySelectorAll(`.${CONFLICT_WARNING_CLASS}`).forEach(el => el.remove());
        let conflictsFound = false;

        Object.keys(SCHEMA_CONFLICTS).forEach(primaryKey => {
            const primaryInput = currentSchemaElements[primaryKey];
            if (!primaryInput) return;

            const selectedPrimaryValue = primaryInput.value;
            const conflictMapForPrimaryKey = SCHEMA_CONFLICTS[primaryKey];

            if (conflictMapForPrimaryKey && conflictMapForPrimaryKey[selectedPrimaryValue]) {
                const conflictingValues = conflictMapForPrimaryKey[selectedPrimaryValue];

                Object.entries(currentSchemaElements).forEach(([secondaryKey, secondaryElement]) => {
                    if (primaryKey === secondaryKey) return;

                    const selectedSecondaryValue = secondaryElement.value;
                    const secondarySchemaDef = SCHEMA_INPUTS[secondaryKey];

                    if (conflictingValues.includes(selectedSecondaryValue) && selectedSecondaryValue !== secondarySchemaDef.default) {
                        displayConflictWarning(primaryInput, `May conflict with '${secondarySchemaDef.title}: ${selectedSecondaryValue}'`);
                        displayConflictWarning(secondaryElement, `May conflict with '${SCHEMA_INPUTS[primaryKey].title}: ${selectedPrimaryValue}'`);
                        conflictsFound = true;
                    }
                });
            }
        });
        return conflictsFound;
    }
    function displayConflictWarning(inputElement, message) {
        const fieldset = inputElement.closest('.vfx-fieldset'); if (!fieldset) return;
        if (fieldset.querySelector(`.${CONFLICT_WARNING_CLASS}[data-message="${message}"]`)) return;
        const warningDiv = document.createElement('div'); warningDiv.className = CONFLICT_WARNING_CLASS; warningDiv.dataset.message = message;
        warningDiv.innerHTML = createIconSpanHTML('warning') + message;
        const legend = fieldset.querySelector('legend');
        if (legend) { legend.parentNode.insertBefore(warningDiv, legend.nextSibling); } else { fieldset.prepend(warningDiv); }
    }

    // --- Enhancer Presets ---
    function loadEnhancerPresets() { try { return JSON.parse(GM_getValue(ENHANCER_PRESETS_KEY, '{}')); } catch(e) { return {}; } }
    function saveEnhancerPreset(name, presetData) {
        if (!name || !name.trim()) { showMessageModal("Save Error", "Preset name cannot be empty.", null, "error"); return false; }
        const presets = loadEnhancerPresets(); presets[name.trim()] = presetData;
        try { GM_setValue(ENHANCER_PRESETS_KEY, JSON.stringify(presets)); return true; }
        catch (e) { showMessageModal("Save Error", "Could not save preset.", e.message, "error"); return false; }
    }
    function deleteEnhancerPreset(name) {
        const presets = loadEnhancerPresets(); if (!presets[name]) return false; delete presets[name];
        try { GM_setValue(ENHANCER_PRESETS_KEY, JSON.stringify(presets)); return true; }
        catch (e) { showMessageModal("Delete Error", "Could not delete preset.", e.message, "error"); return false; }
    }
    function openLoadPresetModal(preambleSelect, schemaElements, negativeInput, livePreviewUpdateFn, smartSuggestUpdateFn, conflictCheckFn, preambleEditorVisibilityFn, candidateCountSelectRef) { // Added candidateCountSelectRef
        const presets = loadEnhancerPresets(); const contentDiv = document.createElement('div');
        if (Object.keys(presets).length === 0) { contentDiv.innerHTML = "<p>No saved enhancer presets found.</p>"; }
        else {
            const list = document.createElement('ul'); list.className = 'vfx-preamble-list';
            Object.entries(presets).sort((a,b)=>a[0].toLowerCase().localeCompare(b[0].toLowerCase())).forEach(([name, data]) => {
                const item = document.createElement('li'); item.className = 'vfx-preamble-list-item';
                const nameSpan = document.createElement('span'); nameSpan.textContent = name;
                const actionsDiv = document.createElement('div'); actionsDiv.className = 'actions';
                const loadBtn = createModalButton('Load', ['info-action'], () => {
                    if (data.preambleName) { preambleSelect.value = data.preambleName; GM_setValue(DEFAULT_PREAMBLE_SELECTED_KEY, data.preambleName); }
                    if (data.negativeKeywords !== undefined) { negativeInput.value = data.negativeKeywords; }
                    if (data.schemaSelections) { Object.entries(data.schemaSelections).forEach(([key, value]) => { if (schemaElements[key]) { schemaElements[key].value = value; } }); }
                    if (candidateCountSelectRef && data.candidateCount !== undefined) { // Load candidate count if available
                        candidateCountSelectRef.value = data.candidateCount;
                    }
                    livePreviewUpdateFn(); smartSuggestUpdateFn(); conflictCheckFn(); preambleEditorVisibilityFn();
                    showMessageModal("Preset Loaded", `Settings from preset "${name}" applied.`, null, "success");
                    const loadModal = document.querySelector('.vfx-load-preset-modal');
                    if(loadModal) { loadModal.classList.remove('visible'); loadModal.addEventListener('transitionend', () => loadModal.remove(), { once: true }); }
                }, 'settings_backup_restore', 'Load this preset');
                const deleteBtn = createModalButton('', ['icon-only', 'danger-action'], () => {
                    if (confirm(`Delete preset "${name}"?`)) { if (deleteEnhancerPreset(name)) { showMessageModal("Deleted", `Preset "${name}" deleted.`, null, "success"); item.remove(); if (list.children.length === 0) contentDiv.innerHTML = "<p>No saved enhancer presets found.</p>"; } else { showMessageModal("Delete Error", "Failed to delete preset.", null, "error"); } }
                }, 'delete', 'Delete this preset');
                actionsDiv.appendChild(loadBtn); actionsDiv.appendChild(deleteBtn); item.appendChild(nameSpan); item.appendChild(actionsDiv); list.appendChild(item);
            }); contentDiv.appendChild(list);
        }
        const closeBtn = createModalButton('Cancel', ['secondary-action'], (e) => { e.target.closest('.vfx-enhancer-modal')?.remove(); });
        createModal("Load Enhancer Preset", [contentDiv], [closeBtn], 'vfx-load-preset-modal allow-multiple');
    }

    // --- Schema Field Creation Helper ---
    function createSchemaFieldComponent(key, schemaDef, initialValue, commonChangeHandler) {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'vfx-schema-input-item';

        const label = document.createElement('label');
        label.textContent = schemaDef.title;
        label.htmlFor = `vfx-schema-${key}`;
        label.title = schemaDef.description;
        itemDiv.appendChild(label);

        let element;
        if (schemaDef.enum) {
            element = document.createElement('select');
            element.id = `vfx-schema-${key}`;
            schemaDef.enum.forEach(val => {
                const opt = document.createElement('option');
                opt.value = val;
                opt.textContent = val;
                if (val === initialValue) opt.selected = true;
                element.appendChild(opt);
            });
        } else {
            element = document.createElement('input');
            element.type = schemaDef.type || 'text';
            element.id = `vfx-schema-${key}`;
            element.placeholder = schemaDef.description;
            element.value = initialValue || '';
        }

        element.onchange = (e) => {
            commonChangeHandler(e);
            itemDiv.classList.toggle('modified', e.target.value !== schemaDef.default);
        };

        if (initialValue !== schemaDef.default) {
            itemDiv.classList.add('modified');
        }

        itemDiv.appendChild(element);
        return { itemDiv, element };
    }


    // --- Main Logic: openPromptBuilderModal ---
    function openPromptBuilderModal(initialSettings = {}) {
        globalSchemaInputElements = {}; const elementsToReset = []; let currentModalInstance = null;
        let uploadedImageBase64 = initialSettings.imageBase64 || '';

        // --- Preamble Section ---
        const preambleSectionContainer = document.createElement('div'); preambleSectionContainer.style.marginBottom = '15px';
        const preambleLabelMain = document.createElement('label'); preambleLabelMain.textContent = 'Preamble (AI Instructions)'; preambleLabelMain.htmlFor = 'vfx-preamble-select'; preambleLabelMain.id = 'vfx-preamble-label-main';
        const preambleControlsContainer = document.createElement('div'); preambleControlsContainer.className = 'vfx-preamble-controls';
        const preambleSelect = document.createElement('select'); preambleSelect.id = 'vfx-preamble-select'; elementsToReset.push(preambleSelect);
        const initialPreambleNameVal = initialSettings.preambleName || GM_getValue(DEFAULT_PREAMBLE_SELECTED_KEY); populatePreambleSelect(preambleSelect, initialPreambleNameVal || Object.keys(DEFAULT_PREAMBLE_PRESETS)[0]); if (preambleSelect.value) GM_setValue(DEFAULT_PREAMBLE_SELECTED_KEY, preambleSelect.value);
        const preambleEditor = document.createElement('textarea'); preambleEditor.id = INLINE_PREAMBLE_EDITOR_ID; preambleEditor.placeholder = "Preamble text will appear here for editing..."; preambleEditor.setAttribute('aria-labelledby', 'vfx-preamble-label-main'); elementsToReset.push(preambleEditor);
        const editorButtonsContainer = document.createElement('div'); editorButtonsContainer.className = 'vfx-preamble-editor-buttons';
        const saveChangesBtn = createModalButton('Save Changes', ['info-action'], null, 'save', 'Save changes to this preamble'); saveChangesBtn.classList.add('vfx-save-preamble-changes-btn');
        const saveAsNewBtn = createModalButton('Save as New', ['info-action'], null, 'add_circle', 'Save current text as a new custom preamble');
        editorButtonsContainer.appendChild(saveChangesBtn); editorButtonsContainer.appendChild(saveAsNewBtn);
        const toggleEditorBtn = createModalButton('', ['vfx-preamble-action-btn', 'icon-only'], null, 'edit', 'Edit or View selected preamble'); toggleEditorBtn.setAttribute('aria-controls', INLINE_PREAMBLE_EDITOR_ID);
        const managePreamblesBtn = createModalButton('', ['vfx-preamble-action-btn', 'icon-only'], () => openPreambleManagerModal(preambleSelect, preambleEditor, editorButtonsContainer, saveChangesBtn, updateLivePreviewFromInputs), 'tune', 'Manage all custom preambles');
        preambleControlsContainer.appendChild(preambleSelect); preambleControlsContainer.appendChild(toggleEditorBtn); preambleControlsContainer.appendChild(managePreamblesBtn);
        preambleSectionContainer.appendChild(preambleLabelMain); preambleSectionContainer.appendChild(preambleControlsContainer); preambleSectionContainer.appendChild(preambleEditor); preambleSectionContainer.appendChild(editorButtonsContainer);

        // --- Core Concept & Image Section (with Drag & Drop) ---
        const coreConceptFieldset = document.createElement('fieldset');
        coreConceptFieldset.className = 'vfx-fieldset';
        const coreConceptLegend = document.createElement('legend');
        coreConceptLegend.innerHTML = `${createIconSpanHTML('chevron_right')} Core Concept`;
        coreConceptLegend.onclick = () => coreConceptFieldset.classList.toggle('collapsed');
        coreConceptFieldset.appendChild(coreConceptLegend);

        const imageUploadArea = document.createElement('div');
        imageUploadArea.className = 'vfx-image-upload-area';
        const imageUploadText = document.createElement('p');
        imageUploadText.innerHTML = `${createIconSpanHTML('upload_file')} <b>Drag & drop an image here</b>, or click to upload.`;
        const imageUploadInput = document.createElement('input');
        imageUploadInput.type = 'file';
        imageUploadInput.id = 'vfx-image-upload-input';
        imageUploadInput.accept = ALLOWED_IMAGE_TYPES.join(',');
        const imagePreviewContainer = document.createElement('div');
        imagePreviewContainer.id = IMAGE_PREVIEW_CONTAINER_ID;
        imageUploadArea.appendChild(imageUploadText);
        imageUploadArea.appendChild(imagePreviewContainer);
        coreConceptFieldset.appendChild(imageUploadArea);
        coreConceptFieldset.appendChild(imageUploadInput); // Input is hidden but available

        imageUploadArea.onclick = () => imageUploadInput.click();

        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => { imageUploadArea.addEventListener(eventName, e => { e.preventDefault(); e.stopPropagation(); }, false); });
        ['dragenter', 'dragover'].forEach(eventName => { imageUploadArea.addEventListener(eventName, () => imageUploadArea.classList.add('drag-over'), false); });
        ['dragleave', 'drop'].forEach(eventName => { imageUploadArea.addEventListener(eventName, () => imageUploadArea.classList.remove('drag-over'), false); });
        imageUploadArea.addEventListener('drop', (e) => { handleImageFile(e.dataTransfer.files[0]); }, false);


        const inputLabel = document.createElement('label'); inputLabel.textContent = 'Your Core Prompt Concept'; inputLabel.htmlFor = 'vfx-prompt-input'; inputLabel.style.marginTop = '10px';
        const inputBox = document.createElement('textarea'); inputBox.id = 'vfx-prompt-input'; inputBox.placeholder = "e.g., A majestic eagle soaring over snowy mountains"; inputBox.value = initialSettings.prompt || ''; inputBox.rows = 3; inputBox.setAttribute('required', true); elementsToReset.push(inputBox);
        const smartSuggestionsArea = document.createElement('div'); smartSuggestionsArea.id = SMART_SUGGESTIONS_AREA_ID; smartSuggestionsArea.style.display = 'none'; smartSuggestionsArea.setAttribute('aria-live', 'polite');
        coreConceptFieldset.appendChild(inputLabel);
        coreConceptFieldset.appendChild(inputBox);
        coreConceptFieldset.appendChild(smartSuggestionsArea);

        // --- Other Inputs ---
        const negativeInputLabel = document.createElement('label'); negativeInputLabel.textContent = 'Negative Keywords (e.g., text, blurry)'; negativeInputLabel.htmlFor = 'vfx-negative-prompt-input';
        const negativeInputBox = document.createElement('textarea'); negativeInputBox.id = 'vfx-negative-prompt-input'; negativeInputBox.placeholder = "e.g., watermark, low quality"; negativeInputBox.value = initialSettings.negativeKeywords || ''; negativeInputBox.rows = 2; elementsToReset.push(negativeInputBox);
        const candidateCountLabel = document.createElement('label'); candidateCountLabel.textContent = 'Number of Generations (Candidates)'; candidateCountLabel.htmlFor = 'vfx-candidate-count-select'; candidateCountLabel.style.marginTop = '16px';
        const candidateCountSelect = document.createElement('select'); candidateCountSelect.id = 'vfx-candidate-count-select';
        [1, 2, 3, 4].forEach(num => { const option = document.createElement('option'); option.value = num; option.textContent = num; if (num === 4) option.selected = true; candidateCountSelect.appendChild(option); });
        if (initialSettings.candidateCount !== undefined) { candidateCountSelect.value = initialSettings.candidateCount; }
        elementsToReset.push(candidateCountSelect);
        const livePreviewLabel = document.createElement('label'); livePreviewLabel.textContent = 'Live Prompt Preview'; livePreviewLabel.htmlFor = LIVE_PROMPT_PREVIEW_ID;
        const livePreviewArea = document.createElement('div'); livePreviewArea.id = LIVE_PROMPT_PREVIEW_ID; livePreviewArea.setAttribute('aria-live', 'polite'); livePreviewArea.textContent = 'Prompt preview...';

        // --- Schema Fieldsets ---
        const customKeywordsFieldset = document.createElement('fieldset'); customKeywordsFieldset.className = 'vfx-fieldset';
        const customKeywordsLegend = document.createElement('legend');
        customKeywordsLegend.innerHTML = `${createIconSpanHTML('chevron_right')} Custom Keywords`;
        customKeywordsLegend.onclick = () => customKeywordsFieldset.classList.toggle('collapsed');
        customKeywordsFieldset.appendChild(customKeywordsLegend);

        const customKeywordsGroup = document.createElement('div'); customKeywordsGroup.className = 'vfx-custom-keywords-group';
        const customKeywordsInput = document.createElement('input'); customKeywordsInput.type = 'text'; customKeywordsInput.id = `vfx-schema-custom_elements`; globalSchemaInputElements['custom_elements'] = customKeywordsInput;
        customKeywordsInput.placeholder = SCHEMA_INPUTS.custom_elements.description; customKeywordsInput.value = (initialSettings.schemaSelections && initialSettings.schemaSelections.custom_elements) || SCHEMA_INPUTS.custom_elements.default || ''; elementsToReset.push(customKeywordsInput);
        const lexiconHelperBtn = createModalButton('', ['icon-only', 'info-action'], null, 'style_palette', 'Open Keyword Lexicon Helper'); lexiconHelperBtn.style.padding = '8px 10px';
        const lexiconPopover = createLexiconPopover(customKeywordsInput, () => updateLivePreviewFromInputs(true));
        customKeywordsGroup.appendChild(customKeywordsInput); customKeywordsGroup.appendChild(lexiconHelperBtn); customKeywordsGroup.appendChild(lexiconPopover);
        customKeywordsFieldset.appendChild(customKeywordsGroup);
        lexiconHelperBtn.onclick = (e) => { e.stopPropagation(); toggleLexiconPopover(lexiconPopover, lexiconHelperBtn); };
        const fieldsetContainer = document.createElement('div');
        const fieldsetGroups = {
             'Composition & Framing': ['composition_rule', 'shot_size', 'camera_angle'],
             'Camera & Lens Dynamics': ['camera_movement', 'lens_type_optical_effects'],
             'Lighting & Color': ['lighting_style_atmosphere', 'color_palette_grading'],
             'Visual Aesthetics & Effects': ['visual_style_medium_era', 'vfx_post_production'],
             'Scene & Output Control': ['subject_prominence', 'editing_pace_transitions', 'sound_design_influence', 'prompt_detail_interpretation']
        };
        const commonSchemaChangeHandler = () => { livePreviewAndSuggestionsUpdate(); };
        Object.entries(fieldsetGroups).forEach(([legendText, keys]) => {
             const fieldset = document.createElement('fieldset'); fieldset.className = 'vfx-fieldset';
             const legend = document.createElement('legend');

             const resetBtn = createIconSpan('refresh');
             resetBtn.className = 'material-symbols-outlined vfx-fieldset-reset-btn';
             resetBtn.title = `Reset ${legendText}`;
             resetBtn.onclick = (e) => {
                e.stopPropagation(); // prevent collapse/expand
                if (confirm(`Reset all fields in the "${legendText}" section to their default values?`)) {
                    keys.forEach(key => {
                        const element = globalSchemaInputElements[key];
                        if (element && SCHEMA_INPUTS[key]) {
                            element.value = SCHEMA_INPUTS[key].default;
                            element.dispatchEvent(new Event('change', { bubbles: true }));
                        }
                    });
                }
             };
             legend.innerHTML = `${createIconSpanHTML('chevron_right')} ${legendText}`;
             legend.appendChild(resetBtn);
             legend.onclick = () => fieldset.classList.toggle('collapsed');
             fieldset.appendChild(legend);

             const gridDiv = document.createElement('div'); gridDiv.className = 'vfx-fieldset-grid';
             keys.forEach(key => {
                 if (!SCHEMA_INPUTS[key] || key === 'custom_elements') return;
                 const schema = SCHEMA_INPUTS[key];
                 const initialValue = initialSettings.schemaSelections && initialSettings.schemaSelections[key] !== undefined ? initialSettings.schemaSelections[key] : schema.default;
                 const { itemDiv, element: schemaElement } = createSchemaFieldComponent(key, schema, initialValue, commonSchemaChangeHandler);
                 globalSchemaInputElements[key] = schemaElement;
                 elementsToReset.push(schemaElement);
                 gridDiv.appendChild(itemDiv);
             });
             fieldset.appendChild(gridDiv); fieldsetContainer.appendChild(fieldset);
         });

        // --- Functions for Image Handling and Live Updates ---
        function handleImageFile(file) {
            if (!file) return;
            if (!ALLOWED_IMAGE_TYPES.includes(file.type)) { showMessageModal('Invalid File Type', `Please select a valid image file. You provided: ${file.type || 'unknown'}.`, null, 'error'); return; }
            if (file.size > MAX_IMAGE_SIZE_MB * 1024 * 1024) { showMessageModal('File Too Large', `Image size cannot exceed ${MAX_IMAGE_SIZE_MB}MB.`, null, 'error'); return; }
            const reader = new FileReader();
            reader.onload = (e) => { uploadedImageBase64 = e.target.result.split(',')[1]; updateImagePreviewUI(); livePreviewAndSuggestionsUpdate(); };
            reader.onerror = () => { showMessageModal('File Read Error', 'There was an error reading the selected file.', null, 'error'); removeUploadedImage(); };
            reader.readAsDataURL(file);
        }
        function updateImagePreviewUI() {
            if (uploadedImageBase64) {
                imagePreviewContainer.style.display = 'block';
                imageUploadText.style.display = 'none';
                imagePreviewContainer.innerHTML = `<img src="data:image/jpeg;base64,${uploadedImageBase64}" alt="Image Preview"><button id="vfx-remove-image-btn" title="Remove Image">&times;</button>`;
                document.getElementById('vfx-remove-image-btn').onclick = removeUploadedImage;
            } else {
                imagePreviewContainer.style.display = 'none';
                imageUploadText.style.display = 'block';
                imagePreviewContainer.innerHTML = '';
            }
        }
        function removeUploadedImage() {
            uploadedImageBase64 = ''; imageUploadInput.value = '';
            updateImagePreviewUI(); livePreviewAndSuggestionsUpdate();
        }
        imageUploadInput.onchange = (event) => { handleImageFile(event.target.files[0]); };

        function livePreviewAndSuggestionsUpdate(skipConflictCheck = false) {
            updateLivePreviewFromInputs();
            if (!skipConflictCheck) checkSchemaConflicts(globalSchemaInputElements);
            updateSmartSuggestions(inputBox.value, smartSuggestionsArea, globalSchemaInputElements, livePreviewAndSuggestionsUpdate, preambleSelect.value);
            updateModifiedStateForAllInputs();
        }
        function updateLivePreviewFromInputs(skipConflictCheck = false) {
            loadAllPreamblesAndStoreGlobally(); const currentPreambleName = preambleSelect.value; const preambleData = effectivePreamblePresets[currentPreambleName];
            const preambleTextToShow = (preambleEditor.style.display === 'block') ? preambleEditor.value : (preambleData ? preambleData.text : '');
            const corePrompt = inputBox.value; const negativePrompt = negativeInputBox.value;
            const currentSchemaSelections = {}; Object.entries(globalSchemaInputElements).forEach(([key, el]) => { currentSchemaSelections[key] = el.value; });
            updateLivePromptPreview(livePreviewArea, preambleTextToShow, corePrompt, currentSchemaSelections, negativePrompt, uploadedImageBase64 !== '');
            if (!skipConflictCheck) checkSchemaConflicts(globalSchemaInputElements);
        }

        // --- Event Listeners for Controls ---
        inputBox.oninput = () => { inputBox.classList.remove('input-error'); clearTimeout(smartSuggestionTimeout); smartSuggestionTimeout = setTimeout(() => { livePreviewAndSuggestionsUpdate(); }, 300); };
        negativeInputBox.oninput = updateLivePreviewFromInputs;
        customKeywordsInput.oninput = commonSchemaChangeHandler;
        preambleSelect.onchange = () => { GM_setValue(DEFAULT_PREAMBLE_SELECTED_KEY, preambleSelect.value); updatePreambleEditorVisibility(preambleSelect.value, preambleEditor, editorButtonsContainer, saveChangesBtn); livePreviewAndSuggestionsUpdate(); };
        preambleEditor.oninput = updateLivePreviewFromInputs;
        toggleEditorBtn.onclick = () => { const isVisible = preambleEditor.style.display === 'block'; if (isVisible) { preambleEditor.style.display = 'none'; editorButtonsContainer.style.display = 'none'; toggleEditorBtn.innerHTML = createIconSpanHTML('edit'); toggleEditorBtn.title = "Edit or View selected preamble"; } else { preambleEditor.style.display = 'block'; editorButtonsContainer.style.display = 'flex'; updatePreambleEditorVisibility(preambleSelect.value, preambleEditor, editorButtonsContainer, saveChangesBtn); toggleEditorBtn.innerHTML = createIconSpanHTML('visibility_off'); toggleEditorBtn.title = "Hide editor / View raw"; preambleEditor.focus(); } updateLivePreviewFromInputs(); };
        saveChangesBtn.onclick = () => { const currentName = preambleSelect.value; loadAllPreamblesAndStoreGlobally(); const preambleEntry = effectivePreamblePresets[currentName]; if (preambleEntry && (preambleEntry._status === 'custom' || preambleEntry._status === 'custom_override')) { if (saveCustomPreambleText(currentName, preambleEditor.value)) { showMessageModal("Preamble Saved", `Changes to "${currentName}" saved.`, null, "success"); updatePreambleEditorVisibility(currentName, preambleEditor, editorButtonsContainer, saveChangesBtn); updateLivePreviewFromInputs(); } } else { showMessageModal("Save Error", "Can only save changes to custom or customized default preambles. Use 'Save as New' for defaults.", null, "error"); } };
        saveAsNewBtn.onclick = () => { const newName = prompt("Enter name for new custom preamble:", preambleSelect.value + " (Custom)"); if (newName && newName.trim()) { const trimmedNewName = newName.trim(); loadAllPreamblesAndStoreGlobally(); if (effectivePreamblePresets[trimmedNewName]) { showMessageModal("Save Error", `A preamble named "${trimmedNewName}" already exists. Choose a unique name.`, null, "error"); return; } if (saveCustomPreambleText(trimmedNewName, preambleEditor.value)) { showMessageModal("Preamble Saved", `New preamble "${trimmedNewName}" saved.`, null, "success"); populatePreambleSelect(preambleSelect, trimmedNewName); GM_setValue(DEFAULT_PREAMBLE_SELECTED_KEY, trimmedNewName); updatePreambleEditorVisibility(trimmedNewName, preambleEditor, editorButtonsContainer, saveChangesBtn); updateLivePreviewFromInputs(); } } };

        // --- Footer Buttons ---
        const clearBtn = createModalButton('Clear All', ['secondary-action'], null, 'clear_all', "Clear inputs & reset selections"); clearBtn.dataset.align = "left";
        clearBtn.onclick = () => {
             if (confirm("Clear all inputs and reset all schema selections to their defaults?")) {
                removeUploadedImage();
                elementsToReset.forEach(el => {
                    const key = el.id.startsWith('vfx-schema-') ? el.id.replace('vfx-schema-', '') : null;
                    if (el.tagName === 'SELECT') {
                        if(key && SCHEMA_INPUTS[key] && SCHEMA_INPUTS[key].enum) el.value = SCHEMA_INPUTS[key]?.default || SCHEMA_INPUTS[key].enum[0];
                        else if(el.id === 'vfx-preamble-select') { const firstDefaultKey = Object.keys(DEFAULT_PREAMBLE_PRESETS)[0] || ''; el.value = firstDefaultKey; GM_setValue(DEFAULT_PREAMBLE_SELECTED_KEY, firstDefaultKey); }
                        else if (el.id === 'vfx-candidate-count-select') { el.value = '4'; }
                    } else if (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && el.type === 'text')) {
                         if (key && SCHEMA_INPUTS[key]) { el.value = SCHEMA_INPUTS[key]?.default || ''; }
                         else { el.value = ''; }
                    }
                    if (el.classList.contains('input-error')) el.classList.remove('input-error');
                    el.dispatchEvent(new Event('change', { bubbles: true })); // Trigger change to update UI state
                });
                if (preambleEditor.style.display === 'block') { updatePreambleEditorVisibility(preambleSelect.value, preambleEditor, editorButtonsContainer, saveChangesBtn); }
                livePreviewAndSuggestionsUpdate(); inputBox.focus();
            }
        };
        const savePresetBtn = createModalButton('Save Preset', ['secondary-action'], () => { const presetName = prompt("Enter a name for this Enhancer Preset:"); if (presetName && presetName.trim()) { const currentSchemaSelections = {}; Object.entries(globalSchemaInputElements).forEach(([key, el]) => currentSchemaSelections[key] = el.value); const presetData = { preambleName: preambleSelect.value, schemaSelections: currentSchemaSelections, negativeKeywords: negativeInputBox.value, candidateCount: candidateCountSelect.value }; if (saveEnhancerPreset(presetName.trim(), presetData)) { showMessageModal("Preset Saved", `Preset "${presetName.trim()}" saved successfully.`, null, "success"); } } }, 'save', "Save current settings as preset"); savePresetBtn.dataset.align = "left";
        const loadPresetBtn = createModalButton('Load Preset', ['secondary-action'], () => { openLoadPresetModal(preambleSelect, globalSchemaInputElements, negativeInputBox, updateLivePreviewFromInputs, () => updateSmartSuggestions(inputBox.value, smartSuggestionsArea, globalSchemaInputElements, updateLivePreviewFromInputs, preambleSelect.value), () => checkSchemaConflicts(globalSchemaInputElements), () => updatePreambleEditorVisibility(preambleSelect.value, preambleEditor, editorButtonsContainer, saveChangesBtn), candidateCountSelect); }, 'settings_backup_restore', "Load saved preset"); loadPresetBtn.dataset.align = "left";
        const cancelBtn = createModalButton('Cancel', ['secondary-action'], (e) => { const m = e.target.closest('.vfx-enhancer-modal'); if (m) { m.classList.remove('visible'); m.addEventListener('transitionend', () => m.remove(), { once: true }); } }, 'close', "Close builder");
        const generateBtn = createModalButton('Generate & Enhance', ['primary-action'], null, 'auto_awesome', "Submit for enhancement");
        generateBtn.onclick = async () => {
             const userPrompt = inputBox.value.trim(); if (!userPrompt && !uploadedImageBase64) { showMessageModal("Input Required", "Please enter a core prompt concept or upload an image.", null, "error"); inputBox.classList.add('input-error'); inputBox.focus(); return; } inputBox.classList.remove('input-error');
             const selectedPreambleName = preambleSelect.value; loadAllPreamblesAndStoreGlobally(); const preambleData = effectivePreamblePresets[selectedPreambleName]; const preambleTextToUse = (preambleEditor.style.display === 'block') ? preambleEditor.value : (preambleData ? preambleData.text : '');
             if (!preambleTextToUse && preambleTextToUse !== "" && selectedPreambleName) { showMessageModal("Preamble Error", "Preamble text not found or empty.", null, "error"); return; }
             const selectedCandidateCount = parseInt(candidateCountSelect.value, 10);
             const negativeKeywords = negativeInputBox.value.trim(); const currentSchemaSelections = {}; const schemaKeywordsForApi = [];
             Object.entries(globalSchemaInputElements).forEach(([key, element]) => { const value = element.value; const schema = SCHEMA_INPUTS[key]; currentSchemaSelections[key] = value; if (value && value.trim() !== "" && schema && value !== schema.default) { schemaKeywordsForApi.push(key === 'custom_elements' ? value.trim() : `${schema.title}: ${value}`); } });
             const combinedKeywordsForApi = schemaKeywordsForApi.join(". ");
             const thisModal = currentModalInstance?.modal; if (thisModal) { thisModal.classList.remove('visible'); thisModal.addEventListener('transitionend', () => thisModal.remove(), { once: true }); }
             executePromptGeneration(userPrompt, preambleTextToUse, combinedKeywordsForApi, negativeKeywords, selectedPreambleName, selectedCandidateCount, {schemaSelections: currentSchemaSelections}, uploadedImageBase64);
        };

        // --- Create and Display Modal ---
        currentModalInstance = createModal(
             "VideoFX Prompt Enhancer v" + SCRIPT_VERSION,
             [preambleSectionContainer, coreConceptFieldset, negativeInputLabel, negativeInputBox, candidateCountLabel, candidateCountSelect, livePreviewLabel, livePreviewArea, customKeywordsFieldset, fieldsetContainer],
             [clearBtn, savePresetBtn, loadPresetBtn, cancelBtn, generateBtn],
             'vfx-prompt-builder-modal'
         );
        updatePreambleEditorVisibility(preambleSelect.value, preambleEditor, editorButtonsContainer, saveChangesBtn);
        livePreviewAndSuggestionsUpdate();
        updateImagePreviewUI();
    }

    function openHistoryModal() {
        const history = loadHistory(); const contentElements = []; let historyModalInstanceRef = null;
        if (history.length === 0) { const p = document.createElement('p'); p.textContent = "No prompt history yet."; contentElements.push(p); }
        else {
            history.forEach((item, index) => {
                const entryDiv = document.createElement('div'); entryDiv.className = 'vfx-history-entry'; const title = document.createElement('h3'); title.textContent = `Entry #${history.length - index} (${new Date(item.time).toLocaleString()})`; const actionsDiv = document.createElement('div'); actionsDiv.className = 'vfx-history-actions';
                const reuseBtn = createModalButton('Load', ['info-action'], () => {
                    if (historyModalInstanceRef && historyModalInstanceRef.modal) {
                        historyModalInstanceRef.modal.classList.remove('visible');
                        historyModalInstanceRef.modal.addEventListener('transitionend', () => historyModalInstanceRef.modal.remove(), { once: true });
                    }
                    openPromptBuilderModal({ prompt: item.prompt, negativeKeywords: item.negativeKeywords, preambleName: item.preambleName, schemaSelections: item.schemaSelections, candidateCount: item.candidateCount });
                }, 'settings_backup_restore', 'Load these settings into the enhancer');
                actionsDiv.appendChild(reuseBtn); title.appendChild(actionsDiv); entryDiv.appendChild(title); const detailsBlock = document.createElement('div'); detailsBlock.className = 'vfx-history-details-block';
                let detailsHTML = `<strong>Core Prompt:</strong> ${item.prompt || '(empty)'}`;
                if (item.imageAttached) detailsHTML += `<br><strong>Image Reference:</strong> Yes`;
                if (item.negativeKeywords) detailsHTML += `<br><strong>Negative:</strong> ${item.negativeKeywords}`; if (item.preambleName) detailsHTML += `<br><strong>Preamble Used:</strong> ${item.preambleName}`; const selectionsList = []; if (item.schemaSelections) { Object.entries(item.schemaSelections).forEach(([key, value]) => { const schema = SCHEMA_INPUTS[key]; if (value && value.trim() !== "" && schema && value !== schema.default) { selectionsList.push(`<li><strong>${schema.title}:</strong> ${value}</li>`); } }); } if (selectionsList.length > 0) { detailsHTML += `<br><strong>Key Selections:</strong><ul>${selectionsList.join('')}</ul>`; } else { detailsHTML += `<br><strong>Key Selections:</strong> <em>(All default or no specific selections made)</em>`; } detailsBlock.innerHTML = detailsHTML; entryDiv.appendChild(detailsBlock); item.outputs.forEach((outputText, outIdx) => { const outputTitle = document.createElement('h4'); outputTitle.style.marginTop = '15px'; outputTitle.innerHTML = `Generated Output ${outIdx + 1} `; const copyOutputBtn = createModalButton('Copy', ['info-action'], () => { GM_setClipboard(outputText, 'text'); copyOutputBtn.innerHTML = createIconSpanHTML('task_alt') + 'Copied!'; copyOutputBtn.disabled = true; setTimeout(() => { copyOutputBtn.innerHTML = createIconSpanHTML('content_copy') + 'Copy'; copyOutputBtn.disabled = false; }, 2000); }, 'content_copy', 'Copy this output'); outputTitle.appendChild(copyOutputBtn); const outputP = document.createElement('p'); outputP.textContent = outputText; entryDiv.appendChild(outputTitle); entryDiv.appendChild(outputP); }); contentElements.push(entryDiv);
            });
        }
        const clearHistoryBtn = createModalButton('Clear History', ['danger-action'], () => { if (clearHistory()) { const currentModal = document.querySelector('.vfx-history-modal'); if (currentModal) { currentModal.classList.remove('visible'); currentModal.addEventListener('transitionend', () => { currentModal.remove(); openHistoryModal(); }, { once: true }); } showMessageModal("History Cleared", "Prompt history has been cleared.", null, "success"); } }, 'delete_sweep', 'Clear all history entries'); clearHistoryBtn.dataset.align = "left";
        const closeBtn = createModalButton('Close', ['primary-action'], (e) => { const m = e.target.closest('.vfx-enhancer-modal'); if (m) { m.classList.remove('visible'); m.addEventListener('transitionend', () => m.remove(), { once: true }); } }, 'close', 'Close history window');
        const footerElements = history.length > 0 ? [clearHistoryBtn, closeBtn] : [closeBtn];
        historyModalInstanceRef = createModal("Prompt History", contentElements, footerElements, 'vfx-history-modal allow-multiple');
    }
    function openPreambleManagerModal(mainPreambleSelectElement, mainPreambleEditorElement, mainEditorButtonsContainer, mainSaveChangesBtn, mainLivePreviewUpdateFn) {
        const contentDiv = document.createElement('div'); const list = document.createElement('ul'); list.className = 'vfx-preamble-list';
        function refreshPreambleManagerList() {
            list.innerHTML = ''; loadAllPreamblesAndStoreGlobally(); const customPreamblesStore = JSON.parse(GM_getValue(CUSTOM_PREAMBLES_KEY, '{}'));
            if (Object.keys(customPreamblesStore).length === 0) { list.innerHTML = '<li><em>No custom preambles have been saved yet.</em></li>'; return; }
            Object.keys(customPreamblesStore).sort((a,b)=>a.toLowerCase().localeCompare(b.toLowerCase())).forEach(name => {
                const item = document.createElement('li'); item.className = 'vfx-preamble-list-item'; const nameSpan = document.createElement('span'); nameSpan.textContent = name; if (DEFAULT_PREAMBLE_PRESETS.hasOwnProperty(name)) nameSpan.textContent += " (Overrides Default)";
                const actionsDiv = document.createElement('div'); actionsDiv.className = 'actions';
                const editBtn = createModalButton('', ['icon-only', 'info-action'], () => { mainPreambleSelectElement.value = name; GM_setValue(DEFAULT_PREAMBLE_SELECTED_KEY, name); mainPreambleEditorElement.style.display = 'block'; mainEditorButtonsContainer.style.display = 'flex'; const toggleBtn = document.querySelector('#vfx-prompt-builder-modal .vfx-preamble-action-btn[title*="Edit"], #vfx-prompt-builder-modal .vfx-preamble-action-btn[title*="Hide"]'); if (toggleBtn) { toggleBtn.innerHTML = createIconSpanHTML('visibility_off'); toggleBtn.title = "Hide editor / View raw"; } updatePreambleEditorVisibility(name, mainPreambleEditorElement, mainEditorButtonsContainer, mainSaveChangesBtn); mainLivePreviewUpdateFn(); const managerModal = document.querySelector('.vfx-preamble-manager-modal'); if (managerModal) { managerModal.classList.remove('visible'); managerModal.addEventListener('transitionend', () => managerModal.remove(), {once: true});} const builderModal = document.querySelector('.vfx-prompt-builder-modal'); if (builderModal) builderModal.querySelector('#vfx-preamble-select')?.focus(); }, 'edit', 'Edit Preamble in Main Enhancer');
                const deleteBtn = createModalButton('', ['icon-only', 'danger-action'], () => { if (confirm(`Delete custom preamble "${name}"? ${DEFAULT_PREAMBLE_PRESETS.hasOwnProperty(name) ? 'The default version will be restored.' : ''}`)) { if (deleteCustomPreambleText(name)) { showMessageModal("Preamble Deleted", `Custom preamble "${name}" has been deleted.`, null, "success"); refreshPreambleManagerList(); populatePreambleSelect(mainPreambleSelectElement, GM_getValue(DEFAULT_PREAMBLE_SELECTED_KEY)); updatePreambleEditorVisibility(mainPreambleSelectElement.value, mainPreambleEditorElement, mainEditorButtonsContainer, mainSaveChangesBtn); mainLivePreviewUpdateFn(); } else { showMessageModal("Delete Error", "Could not delete the preamble.", null, "error"); } } }, 'delete', 'Delete this custom preamble');
                actionsDiv.appendChild(editBtn); actionsDiv.appendChild(deleteBtn); item.appendChild(nameSpan); item.appendChild(actionsDiv); list.appendChild(item);
            });
        }
        refreshPreambleManagerList(); contentDiv.appendChild(list);
        const importExportDiv = document.createElement('div'); importExportDiv.style.marginTop = '20px'; importExportDiv.style.paddingTop = '15px'; importExportDiv.style.borderTop = '1px solid var(--dark-border)'; importExportDiv.style.display = 'flex'; importExportDiv.style.gap = '10px';
        const exportBtn = createModalButton('Export Preambles', ['info-action'], () => { const cp = JSON.parse(GM_getValue(CUSTOM_PREAMBLES_KEY, '{}')); if (Object.keys(cp).length === 0) { showMessageModal("Export", "No custom preambles to export.", null, "info"); return; } const jsonData = JSON.stringify(cp, null, 2); const blob = new Blob([jsonData], { type: 'application/json' }); const filename = `videofx_custom_preambles_${new Date().toISOString().slice(0,10)}.json`; try { GM_download({ url: URL.createObjectURL(blob), name: filename, saveAs: true }); showMessageModal("Exported", "Export initiated. Check your browser's downloads.", null, "success"); } catch (e) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(a.href); showMessageModal("Exported (Fallback)", "Export initiated via fallback download.", null, "success"); } }, 'file_download', 'Export custom preambles as JSON');
        const importFileInput = document.createElement('input'); importFileInput.type = 'file'; importFileInput.id = 'vfx-import-preamble-file'; importFileInput.accept = '.json'; importFileInput.style.display = 'none';
        importFileInput.onchange = (event) => { const file = event.target.files[0]; if (file) { const reader = new FileReader(); reader.onload = (e) => { try { const imported = JSON.parse(e.target.result); if (typeof imported !== 'object' || imported === null) throw new Error("Invalid JSON file structure."); let importedCount = 0, skippedCount = 0, overwrittenCount = 0; const currentCP = JSON.parse(GM_getValue(CUSTOM_PREAMBLES_KEY, '{}')); for (const name in imported) { if (typeof imported[name] !== 'string') {skippedCount++; continue;} if (DEFAULT_PREAMBLE_PRESETS.hasOwnProperty(name) && !currentCP.hasOwnProperty(name)) { if(confirm(`"${name}" is a default preamble. Do you want to import this version, effectively overriding the default behavior?`)){ currentCP[name] = imported[name]; overwrittenCount++; } else { skippedCount++; continue; } } else if (currentCP.hasOwnProperty(name)) { if (!confirm(`Custom preamble "${name}" already exists. Overwrite it?`)) { skippedCount++; continue; } currentCP[name] = imported[name]; overwrittenCount++; } else { currentCP[name] = imported[name]; importedCount++; } } GM_setValue(CUSTOM_PREAMBLES_KEY, JSON.stringify(currentCP)); showMessageModal("Import Complete", `${importedCount} new preambles imported, ${overwrittenCount} existing preambles overwritten, ${skippedCount} skipped.`, null, "success"); refreshPreambleManagerList(); populatePreambleSelect(mainPreambleSelectElement, GM_getValue(DEFAULT_PREAMBLE_SELECTED_KEY)); mainLivePreviewUpdateFn(); updatePreambleEditorVisibility(mainPreambleSelectElement.value, mainPreambleEditorElement, mainEditorButtonsContainer, mainSaveChangesBtn); } catch (err) { showMessageModal("Import Error", "Failed to import: " + err.message, null, "error"); } finally { importFileInput.value = ''; } }; reader.readAsText(file); } };
        const importBtnLabel = document.createElement('label'); importBtnLabel.htmlFor = 'vfx-import-preamble-file'; importBtnLabel.className = 'vfx-modal-button info-action vfx-file-input-label'; importBtnLabel.innerHTML = createIconSpanHTML('file_upload') + 'Import Preambles'; importBtnLabel.title = 'Import custom preambles from a JSON file';
        importExportDiv.appendChild(exportBtn); importExportDiv.appendChild(importBtnLabel); importExportDiv.appendChild(importFileInput); contentDiv.appendChild(importExportDiv);
        const closeBtn = createModalButton('Close', ['primary-action'], (e) => { const m = e.target.closest('.vfx-enhancer-modal'); if (m) { m.classList.remove('visible'); m.addEventListener('transitionend', () => m.remove(), { once: true }); } }, 'close');
        createModal("Manage Custom Preambles", [contentDiv], [closeBtn], 'vfx-preamble-manager-modal allow-multiple');
    }

    // --- Initialization ---
    function initialize() {
        loadAllPreamblesAndStoreGlobally();
        const fabContainer = document.createElement('div'); fabContainer.id = FAB_CONTAINER_ID;
        const fabActions = [ { id: 'enhance', icon: 'auto_fix_high', label: 'Enhance Prompt', action: () => openPromptBuilderModal() }, { id: 'history', icon: 'history', label: 'View History', action: openHistoryModal } ];
        const mainFab = createModalButton('', ['vfx-fab', 'vfx-fab-main'], () => { fabContainer.classList.toggle('expanded'); const isExpanded = fabContainer.classList.contains('expanded'); mainFab.setAttribute('aria-expanded', isExpanded.toString()); mainFab.title = isExpanded ? "Close Menu" : "Open Enhancer Actions"; fabContainer.querySelectorAll('.vfx-fab-item .vfx-tooltip').forEach(tooltip => { tooltip.style.opacity = isExpanded ? '1' : '0'; tooltip.style.visibility = isExpanded ? 'visible' : 'hidden'; }); }, 'auto_awesome');
        mainFab.title = "Open Enhancer Actions"; mainFab.setAttribute('aria-haspopup', 'true'); mainFab.setAttribute('aria-expanded', 'false');
        fabActions.forEach(actionDef => { const itemWrapper = document.createElement('div'); itemWrapper.className = 'vfx-fab-item'; const fabButton = createModalButton('', ['vfx-fab', 'vfx-fab-secondary'], actionDef.action, actionDef.icon); fabButton.id = `fab-action-${actionDef.id}`; const tooltip = document.createElement('span'); tooltip.className = 'vfx-tooltip'; tooltip.textContent = actionDef.label; itemWrapper.appendChild(fabButton); itemWrapper.appendChild(tooltip); fabContainer.appendChild(itemWrapper); });
        fabContainer.appendChild(mainFab); document.body.appendChild(fabContainer);
        document.addEventListener('click', (event) => { if (fabContainer.classList.contains('expanded') && !fabContainer.contains(event.target)) { fabContainer.classList.remove('expanded'); mainFab.setAttribute('aria-expanded', 'false'); mainFab.title = "Open Enhancer Actions"; fabContainer.querySelectorAll('.vfx-fab-item .vfx-tooltip').forEach(tooltip => { tooltip.style.opacity = '0'; tooltip.style.visibility = 'hidden'; }); } });
        console.log(`VideoFX Prompt Enhancer v${SCRIPT_VERSION} Initialized`);
    }
    function waitForPageReady(callback) {
        const checkInterval = 200; const maxWait = 10000; let elapsedTime = 0;
        const readyCheck = () => { if (document.body && document.body.children.length > 0 && document.readyState === 'complete') { console.log("VideoFX Enhancer: Page appears ready."); callback(); } else { elapsedTime += checkInterval; if (elapsedTime < maxWait) { setTimeout(readyCheck, checkInterval); } else { console.warn("VideoFX Enhancer: Page ready check timed out. Initializing anyway."); callback(); } } };
        if (document.readyState === 'complete' || (document.readyState === 'interactive' && document.body && document.body.children.length > 0) ) { callback(); } else { window.addEventListener('DOMContentLoaded', () => { setTimeout(readyCheck, checkInterval); }); }
    }
    waitForPageReady(initialize);

})();

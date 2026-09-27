# Loading-screen artwork collection

Generated with the built-in image_gen tool. Ten distinct artist’s impressions, not historical reconstructions or documentary photos.

The source images are 1672×941. Delivered 4K files are **upscaled to 3840×2160**, with 1920×1080 and 960×540 responsive WebP variants. The app loads only the current image and preloads the next. Full-size originals are not fetched for small screens.

Assets: `public/arena/loading/`. Open `/arena/loading/index.html` for all ten artworks and 4K downloads. Verified facts and primary-source links are maintained in `src/research/arena/loadingArt.ts`.

The loading tour advances every five seconds while visible, unless paused or reduced motion is enabled. Previous/Next resets the five-second interval; Pause slideshow holds the image for reading. Report completion stays independent of artwork loading and navigation. The next opening continues the collection in the browser session.

## Generation prompts

Shared specification:

Use case: stylized-concept. Create ONE full-bleed 16:9 cinematic loading-screen artwork for a premium Roman arena app, requested delivery 4K 3840x2160. Highly detailed environmental concept art, believable architecture and stone, beautiful and imposing, premium AAA game loading screen mood. This is an artistic interpretation of the named real amphitheatre, not documentary photography. Strong focal architecture, quiet shadowed lower third for interface overlay. No text, no labels, no typography, no watermark, no logo, no interface, no prominent people, no gore. 

### 01-rome

Rome Colosseum, Italy. Interior from the arena floor, towering stacked Roman arches around the ellipse, intact imagined ancient setting. Deep midnight blue, bronze torchlight, crimson banners, shafts of moonlight through smoke. Dramatic low-angle composition.

### 02-pula

Pula amphitheatre, Croatia. Elevated exterior three-quarter view of pale limestone ellipse and its open arcade walls beside the Adriatic coastline. Turquoise twilight sea, copper sunset on stone, dramatic indigo clouds, coastal grandeur.

### 03-verona

Verona Arena, Italy. Elevated interior view of the immense oval amphitheatre prepared for an open-air opera: restrained crimson stage curtains at one end, warm rows of tiny amber lights around ancient pale stone seating, purple-blue twilight. Elegant monumental atmosphere.

### 04-nimes

Nimes amphitheatre, France. Street-level low-angle exterior of its two tiers of perfectly rhythmic Roman arcades, rain-darkened plaza reflecting bronze torchlike architectural lights, storm clearing into deep blue dusk. Powerful symmetry.

### 05-arles

Arles amphitheatre, France. Elevated three-quarter aerial view of the oval Roman arena and its distinctive medieval stone towers, ochre Provencal rooftops surrounding it, blazing orange sunset with violet shadows. Cinematic atmospheric haze.

### 06-el-djem

El Djem amphitheatre, Tunisia. Monumental golden sandstone elliptical arcade exterior rising from a quiet North African town. Wide low viewpoint, copper desert sunset, windblown sand haze, immense dark arched openings, spectacular monumental scale.

### 07-pompeii

Pompeii amphitheatre, Italy. Broad elevated interior view of a low ancient oval bowl of stone seats and grassy outer banks, Vesuvius looming in the distant mist. Dawn amber light, dark cypress silhouettes, rich crimson clouds, solemn cinematic grandeur. Do not depict a tall multistorey Colosseum facade.

### 08-capua

Capua amphitheatre, Italy. Atmospheric view through weathered Roman stone arch ruins into the exposed underground passage grid of the arena, surviving arcades and cypress landscape, blue hour and warm slanting sunlight. Archaeological grandeur, majestic broken architecture.

### 09-avenches

Avenches amphitheatre, Switzerland. Elevated wide view of the small oval amphitheatre, grassy banks, low stone seating, distinctive medieval square tower overlooking the arena, distant Swiss hills. Misty emerald landscape, golden dawn against indigo sky. No giant Roman facade.

### 10-uthina

Uthina amphitheatre, Tunisia. Elevated wide view of an ancient oval bowl partly cut into a hillside, low weathered sandstone seating and open arena, rolling North African countryside. Dramatic copper and violet sunset, cinematic dusty atmosphere. No intact towering Colosseum facade.

# Pixel UI redesign

Reference: user-provided home and mission images, 6 November 2026.

Unified locally hosted Pixelify Sans; bright sky, pixel clouds and garden, rounded ink borders and offset shadows. Existing generated council identities, mission persistence, sources, map, notebooks, uploads, and sync are retained. Additional perspectives remain available; the board adapts to council size. Demo content remains explicitly illustrative.

Each sprite has a different presenting gesture when new contribution IDs arrive. New contribution presentation is independent of saving or editing notes. Pointer stars have a maximum of 24 particles and are cleaned up after 650 ms. Both effects respect reduced motion.

## Art generation
Built-in image generation was used with the user's mission image as visual reference. Production asset: public/council-pixel-v2.png.

Prompt: transparent square 3-column by 2-row pixel character atlas; Buddy with red glasses and orange sweatshirt, Arty with red cap and blue sweatshirt, Skept with purple hair and magnifying glass sweatshirt, Plan with green cap and clipboard, curly-haired blue-overall companion, peach fox with scarf. Uniform reference proportions, crisp stepped pixel outlines, no text or scene, centered in equal cells.

Cleanup prompt: remove all gray/noisy background and grid artifacts, preserve exact six character positions, silhouettes and colors, fully transparent alpha outside the six characters.

Pixel clouds and garden are native SVG assets. Pixelify Sans license accompanies the font in public/fonts.

## Validation
- TypeScript --noEmit
- 32 existing Node tests
- Vinext production build
- Browser: create guest mission, Council, ThinkMap, Notes, Sources and follow-up workflow; responsive desktop/mobile inspection.

Local Windows development workers hit a pre-existing Cloudflare file-URL incompatibility; the compiled Vinext server provides the preview without modifying deployment configuration. No live paid API was invoked.

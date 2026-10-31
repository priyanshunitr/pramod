# Pramod guest experience — design QA

Date: 2026-11-01

Final result: passed

## Scope and reference

Adapt the user's [Pinterest reference](https://in.pinterest.com/pin/959477895677936736/) to the existing Pramod guest frontend. Preserve the real room catalog, availability search, live quote, guest account handoff, and gallery. Reception and owner frontends are separate apps and were not modified.

The source is a 17-second portrait video of a desktop real-estate website, not a mobile layout. Inspected the actual video and extracted its embedded desktop frames. The reference establishes the visual direction; Pramod branding, hotel copy, three database-backed room types, booking controls, and original photography replace the real-estate content.

Local research evidence (ignored by Git, not shipped with the website):

- `.local/reference/pinterest-reference.mp4`: 720 × 1280, 17 seconds, downloaded from the pin's observed public video asset.
- `.local/reference/pinterest-poster.jpg`: 720 × 1280.
- `.local/reference/collection-target.jpg`: 620 × 400 hero at approximately 3 seconds; this filename predates identifying the full animation sequence.
- `.local/reference/intro-target.jpg`: 620 × 400 introduction at approximately 6 seconds.
- `.local/reference/dark-target.jpg`: 620 × 400 collection at approximately 9 seconds.
- `.local/reference/guest-before.png`: original guest design before this change.

All source crops use the embedded desktop frame at x=50, y=436, width=620, height=400. The surrounding portrait-video texture is excluded. The reference was used for composition only; its video, property images, and Zillow branding are not bundled into the app.

## Implementation evidence and comparison

| Capture | Test viewport | State |
| --- | --- | --- |
| [Desktop hero](docs/design/guest-desktop.png) | 1280 × 720 CSS px | Initial entrance settled, page at top |
| [Introduction](docs/design/guest-introduction.png) | 1280 × 1100 CSS px | Section revealed, three room cards |
| [Room collection](docs/design/guest-collection.png) | 1280 × 1100 CSS px | Section revealed; pointer preview visible |
| [Mobile hero](docs/design/guest-mobile.png) | 390 × 844 CSS px | Entrance settled, compact navigation |

Browser screenshots exclude the scrollbar from image width: desktop raster width is 1265 px and phone raster width is 375 px. Compared the source and implementation images together in the same inspection pass. Focused implementation crops were normalized to 620 px width without stretching: the introduction is about 462 px high and the collection about 380 px high. Different heights reflect hotel copy, three rather than four collection rows, and the additional real booking controls.

Full-page screenshot mode changes the viewport used by viewport-relative hero sizing. Its distorted output was rejected. The retained evidence uses normal viewport captures and focused section crops. Inspected every chapter in the running page, including the pool amenity section, booking call to action, and footer.

### Visual checks

- **Typography:** DM Sans provides the reference's clean, oversized sans-serif treatment. Checked wordmark scale, four-line editorial heading, room-name hierarchy, wrapping, and supporting text at desktop, tablet, and phone widths.
- **Spacing and layout:** matched full-bleed hero, compact floating navigation, pale editorial chapter with overlapping cards, dark horizontal room rows, and photographic amenity chapter. Added adequate space beneath the card stack so it does not collide with the following chapter.
- **Color and surfaces:** cyan sky, white wordmark, neutral pale sections, near-black collection, thin dividers, compact pill controls. Small navigation text over the sky uses dark ink for legibility. Footer disclosure clearly identifies the demo content.
- **Imagery:** original 1672 × 941 transparent architectural foreground, compressed to 480,352-byte WebP. Inspected the roof silhouette, alpha integration, palms, pool, desktop sharpness, and phone crop. A clip path removes residual sky speckles above the generated roof; it does not replace the photograph with drawn artwork. Existing credited hotel/room photographs are reused.
- **Icons:** consistent Lucide stroke icons for arrows, calendar, people, menu, and amenities; checked visible icons, mobile menu states, and gallery controls.
- **Copy:** hotel-specific, coherent, and linked to real flows. Rates and maximum guests come from the catalog; missing rates display “Rate on request.” The old inaccurate homepage message saying availability was not checked was removed.

### Responsive and interaction checks

- Desktop 1280 × 720; tall desktop 1280 × 1100; tablet 768 × 1024; phone 390 × 844; narrow phone 320 × 740.
- At 320 px, document scroll width equals the 305 px content width after scrollbar subtraction. At 390 px it equals 375 px, at 768 px it equals 753 px, and at 1280 px it equals 1265 px. No horizontal page overflow.
- Mobile navigation opens, closes with Escape, and follows routes. Header changes to an opaque surface while scrolling.
- Native smooth anchor navigation, one-time section reveals, card lift/rotation, and row previews were inspected in the live browser. No scroll interception or animation dependency was added.
- Keyboard focus on a collection row reveals its corresponding image. Verified the focused Deluxe row had preview opacity 1 while the other two were 0. Focused links inside unrevealed sections force their content visible.
- Reduced-motion behavior reviewed in CSS and both animation components: no entrance animations or parallax, no smooth hash scrolling, and immediate visible content. Preference changes disconnect observers/listeners and reset transforms. OS-level reduced-motion emulation was not available in the browser tool; this part was verified by code review rather than a forced browser preference.
- Search for 8–10 November 2026 and two guests returned three available room types. Room detail preserved dates and guest count. Stay review returned a live ₹9,000 quote for two nights in Classic Room and one available room. “Sign in to reserve” preserved the complete stay in its return URL. No reservation or account was created by this visual QA.
- Gallery room filter, image dialog, ArrowRight navigation, Escape dismissal, and focus return passed.
- All eight homepage image elements loaded successfully. A fresh preview tab reported no browser console errors. An earlier transient development reload error while new files were being written did not recur.

## Findings and resolutions

| Severity | Finding | Resolution |
| --- | --- | --- |
| P2 | Initial phone crop left too much separation between wordmark and roof | Adjusted phone/tablet wordmark positions and verified final captures |
| P2 | Base 320 px body minimum width produced scrollbar-width overflow at the narrowest viewport | Removed the minimum width; reduced header gap and constrained editorial heading size; rechecked no overflow |
| P2 | Small white controls over the light sky lacked contrast | Changed small hero navigation/caption text to dark ink and strengthened the lower photograph shade |
| P2 | Tablet room-card stack crowded its caption and following section | Increased stack height and adjusted the third card position; recaptured introduction |
| P2 | Global smooth scrolling also animated route resets | Route changes now reset instantly; only in-page navigation scrolls smoothly |
| P2 | Full-page capture altered viewport-relative hero composition | Rejected that capture; retained normal viewport evidence and compared focused sections |

No unresolved P0, P1, or P2 product findings remain in the inspected scope. Mobile/tablet layouts are adaptations because the reference supplies only a desktop composition. Real hotel photographs and confirmed amenities remain a content requirement before launch.

## Validation

- `npm run typecheck`: seven package checks passed.
- `npm run test`: 15 existing tests passed (6 guest, 6 API, 3 owner; unchanged suites used Turborepo cache).
- `npm run build -- --filter=@hotel/guest`: production build passed, including TypeScript checking.
- `git diff --check`: passed.
- Database integration tests were not rerun because the API, schema, and reservation logic were unchanged.

Result: passed

## Follow-up: stronger parallax and condensed hero type

The user requested faster image-over-text scrolling and taller, narrower lettering. The hero now uses uppercase [Barlow Condensed](https://fonts.google.com/specimen/Barlow+Condensed), weight 600, with responsive sizing and placement. The surrounding interface continues to use DM Sans. The parallax multiplier increased from 0.14 to 0.9: the lettering stays nearly stationary in the viewport while the villa moves upward across it. Reduced-motion handling is preserved.

Verified the font loaded and checked the live layout at a normal 672 × 790 CSS-pixel viewport, desktop 1164 × 655, and phone 355 × 767 (the browser's existing zoom changes the requested viewport dimensions). No horizontal overflow. At 71.82 px scroll, the text layer had moved 64.64 px within the hero, confirming the new 0.9 multiplier. The header remained transparent over the image, also verifying the preceding header fix. A page reload was necessary to replace an older hot-reloaded effect closure before measuring.

Updated visual evidence: [condensed hero](docs/design/guest-hero-condensed.png) and [short-scroll parallax](docs/design/guest-parallax-scroll.png). The earlier desktop/mobile captures above document the original design pass. The guest production build, including TypeScript checking, and `git diff --check` passed for this follow-up.

## Follow-up: stable lettering, sequential entrance, and transparent navigation

The latest user direction supersedes the scroll multiplier and font above. The building enters first over 1.6 seconds; PRAMOD then rises from below over 0.85 seconds. Both animations start from the image load event, with an error fallback so missing artwork cannot leave the heading hidden indefinitely. The heading's entrance transform is released when it finishes. Native sticky positioning holds the wordmark still during scrolling, with the hero clipping it at its boundary. Chakra Petch supplies angular, chamfered corners; a fixed horizontal scale preserves the tall lettering without scroll-driven transforms.

The full-width header remains transparent on the homepage and inner routes. An intersection observer changes only the foreground contrast over dark sections. The navigation pill and expanded mobile menu retain their own reading surfaces.

Verification on 2026-11-01:

- During the building entrance, its measured opacity was 0.608 while the title remained hidden at opacity 0 and translated downward. The title's computed delay was 1.6 seconds, equal to the building's duration. After settling, both outer transforms were `none` and title opacity was 1.
- At the normal 672 × 790 viewport, the heading's top stayed at exactly 197.5 px for scroll positions 0, 71.82, and 143.64 px. The villa advanced over it without changing the heading opacity.
- Inspected the final angular lettering at 672 × 790, phone 355 × 767, and desktop 1309 × 818 CSS pixels. The font loaded, the full word fit, and none of these viewports had horizontal overflow. Temporary viewport overrides were reset.
- Header background stayed `rgba(0, 0, 0, 0)` over the hero, pale introduction, dark collection, and `/rooms`. No full-width backdrop blur or shadow. Foreground switched to white over the collection and dark ink over pale content. Mobile navigation opened, routed to rooms, closed, and reset scroll correctly.
- Reduced-motion CSS reviewed: immediate visible lettering/building, no entrance animation, and no sticky parallax. OS-level preference emulation was unavailable, so this remains a code-review check.
- `npm run build -w @hotel/guest` passed, including TypeScript; browser error logs were empty. The initial Turbo wrapper attempt exited with a Windows process error; direct workspace builds succeeded. `git diff --check` passed.

Evidence: [building first](docs/design/guest-building-first.png), [settled angular hero](docs/design/guest-stable-hero.png), and [transparent navigation beyond the hero](docs/design/guest-transparent-navigation.png).

## Follow-up: Anton wordmark

Switched the hero to the user's selected Anton font at its native 400 weight and removed the previous horizontal compression. The existing entrance sequence and sticky positioning are unchanged. Verified the font loaded, inspected the 672 × 790 preview, and confirmed the full word fits without horizontal overflow at 355 × 767. The guest production build, including TypeScript, passed. Updated evidence: [Anton hero](docs/design/guest-hero-anton.png).

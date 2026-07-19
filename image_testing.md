## TEST AGENT PROMPT – IMAGE INTEGRATION RULES ##
Follow these rules exactly. Do not overcomplicate.

*** Image Handling Rules ***
- Always use base64-encoded images for all tests and requests.
- Accepted formats: JPEG, PNG, WEBP only.
- Do not use SVG, BMP, HEIC, or other formats.
- Do not upload blank, solid-color, or uniform-variance images.
- Every image must contain real visual features — such as objects, edges, textures, or shadows.
- If image is not PNG/JPEG/WEBP, transcode it to PNG or JPEG before upload.
- Re-detect and update MIME after transformations.
- If image is animated (GIF, APNG, WEBP animation), extract the first frame only.
- Resize large images to reasonable bounds.

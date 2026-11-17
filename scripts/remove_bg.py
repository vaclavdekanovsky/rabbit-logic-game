import os
import sys
from collections import deque
from PIL import Image

def remove_background(image_path, threshold=242):
    if not os.path.exists(image_path):
        print(f"File not found: {image_path}")
        return

    img = Image.open(image_path).convert('RGBA')
    w, h = img.size
    pixels = img.load()

    def is_near_white(r, g, b):
        return r >= threshold and g >= threshold and b >= threshold

    # Edge-seeded flood fill so interior white features (e.g., polar bear fur, eye highlights) are preserved
    visited = [[False] * w for _ in range(h)]
    queue = deque()

    for x in range(w):
        for y in (0, h - 1):
            r, g, b, a = pixels[x, y]
            if is_near_white(r, g, b):
                visited[y][x] = True
                queue.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            if not visited[y][x]:
                r, g, b, a = pixels[x, y]
                if is_near_white(r, g, b):
                    visited[y][x] = True
                    queue.append((x, y))

    while queue:
        cx, cy = queue.popleft()
        pixels[cx, cy] = (255, 255, 255, 0)
        for nx, ny in ((cx - 1, cy), (cx + 1, cy), (cx, cy - 1), (cx, cy + 1)):
            if 0 <= nx < w and 0 <= ny < h and not visited[ny][nx]:
                r, g, b, a = pixels[nx, ny]
                if is_near_white(r, g, b):
                    visited[ny][nx] = True
                    queue.append((nx, ny))

    # Save as _nobg.png
    base, ext = os.path.splitext(image_path)
    if not base.endswith('_nobg'):
        new_path = f"{base}_nobg{ext}"
        img.save(new_path, 'PNG')
        print(f'Processed {image_path} -> {new_path}')
    else:
        print(f'Skipped {image_path} (already processed)')

if __name__ == "__main__":
    if len(sys.argv) > 1:
        for arg in sys.argv[1:]:
            remove_background(arg)
    else:
        # Default behavior: process all in art/source/ that don't have _nobg
        public_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'art', 'source')
        if os.path.exists(public_dir):
            for file in os.listdir(public_dir):
                if file.endswith('.png') and not file.endswith('_nobg.png') and 'background' not in file and 'border_overlay' not in file and 'stream_simple' not in file:
                    remove_background(os.path.join(public_dir, file))

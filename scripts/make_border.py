import os
from PIL import Image, ImageMath

def make_border_overlay(input_path, output_path):
    if not os.path.exists(input_path):
        print(f"File not found: {input_path}")
        return
        
    img = Image.open(input_path).convert("RGBA")
    w, h = img.size
    
    # Create an alpha mask
    mask = Image.new('L', (w, h), 0)
    
    # We want the outer 35 pixels solid, and fade out to 70 pixels.
    # We can adjust these thresholds if necessary.
    SOLID_DIST = 35
    FADE_DIST = 70
    
    for y in range(h):
        for x in range(w):
            # Distance to closest edge
            dist_x = min(x, w - 1 - x)
            dist_y = min(y, h - 1 - y)
            dist = min(dist_x, dist_y)
            
            if dist < SOLID_DIST:
                alpha = 255
            elif dist < FADE_DIST:
                # Linear fade
                ratio = (dist - SOLID_DIST) / (FADE_DIST - SOLID_DIST)
                alpha = int(255 * (1 - ratio))
            else:
                alpha = 0
                
            mask.putpixel((x, y), alpha)
            
    # Apply the mask to the image
    img.putalpha(mask)
    img.save(output_path)
    print(f"Created border overlay: {output_path}")

if __name__ == "__main__":
    base_dir = os.path.dirname(os.path.dirname(__file__))
    public_dir = os.path.join(base_dir, 'art', 'source')
    themes = [
        ('background_grass_surrounded.png', 'border_overlay.png'),
        ('background_ice_surrounded.png', 'border_overlay_ice.png'),
        ('background_volcanic_surrounded.png', 'border_overlay_volcanic.png'),
    ]
    for bg_file, out_file in themes:
        input_img = os.path.join(public_dir, bg_file)
        output_img = os.path.join(public_dir, out_file)
        if os.path.exists(input_img):
            make_border_overlay(input_img, output_img)

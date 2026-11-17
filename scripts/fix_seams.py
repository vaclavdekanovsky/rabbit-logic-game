import os
from PIL import Image

def create_gradient_mask(width, height):
    """Creates a gradient mask that is opaque at the top and transparent at the bottom."""
    mask = Image.new('L', (width, height))
    for y in range(height):
        # 255 at top (y=0), 0 at bottom (y=height-1)
        alpha = int(255 * (1 - (y / height)))
        for x in range(width):
            mask.putpixel((x, y), alpha)
    return mask

def make_symmetric(img):
    """Makes an image perfectly left-right symmetric by mirroring the left half."""
    W, H = img.size
    left_half = img.crop((0, 0, W // 2, H))
    right_half = left_half.transpose(Image.FLIP_LEFT_RIGHT)
    
    symmetric_img = Image.new('RGBA', (W, H))
    symmetric_img.paste(left_half, (0, 0))
    # Paste right half, taking care of odd widths
    symmetric_img.paste(right_half, (W - (W // 2), 0))
    return symmetric_img

def apply_edge(img, edge_master, mask, side):
    """Applies the master edge to the given side of the image."""
    W, H = img.size
    blend_size = edge_master.height

    if side == 'top':
        edge = edge_master
        m = mask
        pos = (0, 0)
    elif side == 'bottom':
        edge = edge_master.rotate(180)
        m = mask.rotate(180)
        pos = (0, H - blend_size)
    elif side == 'left':
        edge = edge_master.rotate(270, expand=True)
        m = mask.rotate(270, expand=True)
        pos = (0, 0)
    elif side == 'right':
        edge = edge_master.rotate(90, expand=True)
        m = mask.rotate(90, expand=True)
        pos = (W - blend_size, 0)
    
    # Paste using alpha compositing to preserve underlying image details
    img.paste(edge, pos, m)
    return img

def fix_seams(public_dir):
    straight_path = os.path.join(public_dir, 'stream_straight_nobg.png')
    if not os.path.exists(straight_path):
        print("Straight stream not found.")
        return

    # 1. Regenerate from ORIGINAL sliced tiles to avoid compounding blends
    # Wait, the current public files already have the previous fix_seams applied.
    # To get a clean result, let's re-slice them first, or just run over them.
    # Running over them is fine since the new symmetric mask will overwrite the edges.

    straight_img = Image.open(straight_path).convert("RGBA")
    W, H = straight_img.size
    BLEND_SIZE = 60 # Slightly larger blend for smoother transition

    # Crop the top edge to be the master edge
    edge_master_raw = straight_img.crop((0, 0, W, BLEND_SIZE))
    
    # Force Left-Right Symmetry to solve the CSS Rotation Point-Reflection problem!
    edge_master = make_symmetric(edge_master_raw)
    
    mask = create_gradient_mask(W, BLEND_SIZE)

    tiles_to_fix = {
        'stream_straight_nobg.png': ['top', 'bottom'],
        'stream_bridge_nobg.png': ['top', 'bottom'],
        'stream_bend_2_nobg.png': ['left', 'bottom'],
        'stream_ending_1_nobg.png': ['right'],
        'stream_bend_1_nobg.png': ['right', 'bottom'],
        'stream_bend_3_nobg.png': ['top', 'left'],
        'stream_start_nobg.png': ['bottom'],
        'stream_ending_2_nobg.png': ['right'],
        'stream_t_shape_nobg.png': ['left', 'right', 'top']
    }

    for filename, sides in tiles_to_fix.items():
        filepath = os.path.join(public_dir, filename)
        if os.path.exists(filepath):
            img = Image.open(filepath).convert("RGBA")
            for side in sides:
                img = apply_edge(img, edge_master, mask, side)
            img.save(filepath)
            print(f"Fixed symmetric seams for {filename}")

if __name__ == "__main__":
    base_dir = os.path.dirname(os.path.dirname(__file__))
    public_directory = os.path.join(base_dir, 'art', 'source')
    
    # Re-slice first to ensure we apply symmetry to the raw AI output!
    input_image = os.path.join(base_dir, 'art', 'source', 'stream_tileset_nobg.png')
    if os.path.exists(input_image):
        import slice_stream
        slice_stream.slice_image(input_image, public_directory)
        print("Re-sliced images to clean state.")

    fix_seams(public_directory)

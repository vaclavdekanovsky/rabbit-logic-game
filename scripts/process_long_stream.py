import sys
import os
from PIL import Image, ImageDraw, ImageFilter

img_path = sys.argv[1]
img = Image.open(img_path).convert("RGBA")
w, h = img.size
size = w // 3
y_offset = (h - size) // 2

tile_pool = img.crop((0, y_offset, size, y_offset + size))
tile_bridge = img.crop((size, y_offset, size*2, y_offset + size))
tile_bend = img.crop((size*2, y_offset, size*3, y_offset + size))

# Create a true seamless common edge using 50/50 blend (no mirroring)
edge_width = 80
left_strip = tile_bridge.crop((0, 0, edge_width, size))
right_strip = tile_bridge.crop((size - edge_width, 0, size, size))
common_edge = Image.blend(left_strip, right_strip, 0.5)

mask_left = Image.new("L", (edge_width, size))
mask_right = Image.new("L", (edge_width, size))
for x in range(edge_width):
    val_left = int(255 * ((edge_width - x) / float(edge_width)))
    val_right = int(255 * (x / float(edge_width)))
    for y in range(size):
        mask_left.putpixel((x, y), val_left)
        mask_right.putpixel((x, y), val_right)

def apply_right_edge(tile):
    out = tile.copy()
    out.paste(common_edge, (size - edge_width, 0), mask_right)
    return out

def apply_left_edge(tile):
    out = tile.copy()
    out.paste(common_edge, (0, 0), mask_left)
    return out

def apply_both(tile):
    return apply_right_edge(apply_left_edge(tile))

final_pool = apply_right_edge(tile_pool)
final_bridge = apply_both(tile_bridge)

bottom_edge = common_edge.transpose(Image.ROTATE_270)
bottom_mask = mask_right.transpose(Image.ROTATE_270)
final_bend = apply_left_edge(tile_bend)
final_bend.paste(bottom_edge, (0, size - edge_width), bottom_mask)

# Straight tile: tile the pure water with 60px crossfade overlaps
pure_water = tile_pool.crop((size - 170, 0, size, size))
straight = Image.new("RGBA", (size, size))
straight.paste(pure_water, (0, 0))

mask_fade_in = Image.new("L", (170, size))
for x in range(170):
    if x < 60: val = int(255 * (x / 60.0))
    else: val = 255
    for y in range(size): mask_fade_in.putpixel((x, y), val)

straight.paste(pure_water, (110, 0), mask_fade_in)
straight.paste(pure_water, (220, 0), mask_fade_in)

final_straight = apply_both(straight)

out_dir = r"C:\Vasa\Programming\rabbit_logic_gamert\source"
final_pool.save(os.path.join(out_dir, "stream_end.png"))
final_bridge.save(os.path.join(out_dir, "bridge.png"))
final_bend.save(os.path.join(out_dir, "stream_bend.png"))
final_straight.save(os.path.join(out_dir, "stream.png"))

print("Successfully created flawlessly blended non-mirrored tiles.")

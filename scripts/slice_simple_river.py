import os
from PIL import Image

def slice_simple_river(img_path, output_dir):
    img = Image.open(img_path).convert("RGBA")
    
    # Crop to the middle horizontal band where the river is (341 to 682)
    # The image is 1024x1024. 341 is exactly 1/3.
    w, h = img.size
    
    y0 = int(h / 3)
    y1 = int(2 * h / 3)
    
    band = img.crop((0, y0, w, y1))
    
    # Slice the band horizontally into 3 tiles
    tile_w = int(w / 3)
    
    t1 = band.crop((0, 0, tile_w, tile_w))
    t2 = band.crop((tile_w, 0, 2*tile_w, tile_w))
    t3 = band.crop((2*tile_w, 0, w, tile_w))
    
    t1.save(os.path.join(output_dir, 'stream_simple_end1.png'))
    t2.save(os.path.join(output_dir, 'stream_simple_bridge.png'))
    t3.save(os.path.join(output_dir, 'stream_simple_end2.png'))
    
    print("Saved stream_simple_end1.png, stream_simple_bridge.png, stream_simple_end2.png")

if __name__ == "__main__":
    base_dir = os.path.dirname(os.path.dirname(__file__))
    public_dir = os.path.join(base_dir, 'art', 'source')
    img_path = os.path.join(public_dir, 'simple_river_obstacle_nobg.png')
    slice_simple_river(img_path, public_dir)

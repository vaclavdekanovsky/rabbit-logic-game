import os
from PIL import Image

def slice_image(image_path, output_dir):
    if not os.path.exists(image_path):
        print(f"File not found: {image_path}")
        return

    img = Image.open(image_path)
    width, height = img.size
    
    # Calculate tile size
    tile_w = width // 3
    tile_h = height // 3

    # Define the mapping of grid index to output filenames
    mapping = {
        1: 'stream_bend_1_nobg.png',
        2: 'stream_bend_2_nobg.png',
        3: 'stream_start_nobg.png',
        4: 'stream_ending_2_nobg.png',
        5: 'stream_straight_nobg.png',
        6: 'stream_bridge_nobg.png',
        7: 'stream_ending_1_nobg.png',
        8: 'stream_t_shape_nobg.png',
        9: 'stream_bend_3_nobg.png'
    }

    # Iterate through the grid
    for row in range(3):
        for col in range(3):
            grid_index = row * 3 + col + 1
            if grid_index in mapping:
                left = col * tile_w
                top = row * tile_h
                right = left + tile_w
                bottom = top + tile_h

                tile = img.crop((left, top, right, bottom))
                output_path = os.path.join(output_dir, mapping[grid_index])
                tile.save(output_path)
                print(f"Saved {output_path}")

if __name__ == "__main__":
    base_dir = os.path.dirname(os.path.dirname(__file__))
    input_image = os.path.join(base_dir, 'art', 'source', 'stream_tileset_nobg.png')
    output_directory = os.path.join(base_dir, 'art', 'source')
    slice_image(input_image, output_directory)

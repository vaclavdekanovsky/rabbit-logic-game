from PIL import Image, ImageDraw

# Create a square image 1024x1024
img = Image.new('RGB', (1024, 1024), 'white')
draw = ImageDraw.Draw(img)

# We want a 3x1 river. 3 tiles of 341x341. 
# It will be vertically centered. 1024 / 3 = 341.
# Y offset = (1024 - 341) / 2 = 341.
# So the river goes from y=341 to y=682, and x=0 to x=1024.
# Wait, let's make it slightly padded.
margin = 50
x0 = margin
y0 = 341
x1 = 1024 - margin
y1 = 682

# Draw the river body (rounded blue rectangle)
draw.rounded_rectangle([x0, y0, x1, y1], radius=150, fill='#2080D0')

# Draw the bridge in the middle tile
# Middle tile x goes from 341 to 682
bridge_w = 200
bx0 = 512 - bridge_w//2
by0 = y0 - 20
bx1 = 512 + bridge_w//2
by1 = y1 + 20

draw.rectangle([bx0, by0, bx1, by1], fill='#8B4513')

img.save('art/source/river_guide.png')

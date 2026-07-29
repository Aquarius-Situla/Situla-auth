import os
import sys
import subprocess
import re
from PIL import Image

def convert_to_vector(input_image_path):
    temp_dir = os.path.dirname(os.path.abspath(__file__))
    base_name = os.path.splitext(os.path.basename(input_image_path))[0]
    
    print(f"Loading image from {input_image_path}...")
    try:
        img = Image.open(input_image_path).convert('RGBA')
        
        # We want to trace ONLY the white regions.
        # Potrace traces black (0) pixels.
        # So: Original White -> 0 (Black in BMP, will be traced)
        # Original Black lines -> 255 (White in BMP, will be transparent/ignored)
        # Original Transparent -> 255 (White in BMP, will be transparent/ignored)
        
        mask = Image.new('L', img.size, 255)
        pixels_mask = mask.load()
        
        img_gray = img.convert('L')
        pixels_rgba = img.load()
        pixels_gray = img_gray.load()
        
        width, height = img.size
        for y in range(height):
            for x in range(width):
                r, g, b, a = pixels_rgba[x, y]
                gray = pixels_gray[x, y]
                
                # If pixel is opaque AND it is light (white-ish)
                if a > 128 and gray > 128:
                    pixels_mask[x, y] = 0 # Trace this
                else:
                    pixels_mask[x, y] = 255 # Ignore this
                    
        # Convert to 1-bit before saving BMP for potrace
        mask = mask.convert('1')
        
        # Crop and center in a perfect square
        from PIL import ImageOps
        inverted_mask = Image.eval(mask, lambda x: 255 if x == 0 else 0)
        bbox = inverted_mask.getbbox()
        
        if bbox:
            mask = mask.crop(bbox)
            side = max(mask.width, mask.height)
            # Add 10% padding
            padding = int(side * 0.1)
            new_side = side + padding * 2
            
            square_mask = Image.new('1', (new_side, new_side), 255)
            offset_x = (new_side - mask.width) // 2
            offset_y = (new_side - mask.height) // 2
            square_mask.paste(mask, (offset_x, offset_y))
            mask = square_mask
        
        mask_bmp = os.path.join(temp_dir, f"{base_name}_mask.bmp")
        mask.save(mask_bmp)
        print("Generated white-region bitmap.")
        
    except Exception as e:
        print(f"Error processing image with Pillow: {e}")
        sys.exit(1)
        
    potrace_dir = os.path.join(temp_dir, 'potrace-1.16.win64')
    potrace_exe = os.path.join(potrace_dir, 'potrace.exe')
    
    if not os.path.exists(potrace_exe):
        print(f"Error: potrace.exe not found at {potrace_exe}")
        sys.exit(1)
        
    output_svg = os.path.join(temp_dir, f"{base_name}.svg")
    
    print("Running potrace...")
    try:
        subprocess.run([potrace_exe, '-s', '-o', output_svg, mask_bmp], check=True, capture_output=True)
    except subprocess.CalledProcessError as e:
        print(f"Error running potrace:\n{e.stderr}")
        sys.exit(1)

    print("Adjusting SVG color...")
    
    # Read the SVG and change fill from black to white
    with open(output_svg, 'r', encoding='utf-8') as f:
        svg_content = f.read()
        
    svg_content = svg_content.replace('fill="#000000"', 'fill="#FFFFFF"')
    
    with open(output_svg, 'w', encoding='utf-8') as f:
        f.write(svg_content)
        
    print(f"Success! Vector image saved to {output_svg}")
    
    # Clean up temp files
    try:
        os.remove(mask_bmp)
    except Exception as e:
        pass

if __name__ == "__main__":
    input_path = None
    if len(sys.argv) < 2:
        try:
            import tkinter as tk
            from tkinter import filedialog
            root = tk.Tk()
            root.withdraw()
            input_path = filedialog.askopenfilename(
                title="Select image to vectorize",
                filetypes=[("Image files", "*.png *.jpg *.jpeg *.bmp *.gif")]
            )
            if not input_path:
                print("No file selected.")
                sys.exit(1)
        except ImportError:
            print("Usage: python convert_to_vector.py <path_to_image>")
            sys.exit(1)
    else:
        input_path = sys.argv[1]
        
    if not os.path.exists(input_path):
        print(f"Error: Input file '{input_path}' does not exist.")
        sys.exit(1)
        
    convert_to_vector(input_path)

import tkinter as tk
from tkinter import filedialog
import os
import subprocess
import platform # Added for OS-specific commands
from PIL import Image, ImageTk
import cv2 # Added for video thumbnail generation

# Global variable to store the selected path
selected_directory = ""
# TODO: Load a default icon for missing thumbnails (e.g., for videos if thumbnail fails)
# default_video_icon = None # Placeholder

# Supported file extensions
VIDEO_EXTENSIONS = ['.mp4', '.avi', '.mov', '.mkv']
IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif']
HTML_EXTENSIONS = ['.html', '.htm']

# --- UI Setup ---
root = tk.Tk()
root.title("Local Media Browser")
root.geometry("800x600") # Set a default window size

# --- Main Frames ---
# Top frame for controls (select directory button)
top_control_frame = tk.Frame(root)
top_control_frame.pack(pady=10, padx=10, fill=tk.X)

# Main content frame (holds file list and preview area)
main_content_frame = tk.Frame(root)
main_content_frame.pack(pady=(0,5), padx=10, fill=tk.BOTH, expand=True) # Reduced bottom padding

# Bottom frame for status bar
status_bar_frame = tk.Frame(root)
status_bar_frame.pack(pady=(0,5), padx=10, fill=tk.X) # Reduced top padding


# --- Functions ---

# --- Thumbnail Generation ---
def generate_video_thumbnail(video_path, target_size=(120, 90)):
    """
    Generates a thumbnail for a video file using OpenCV.

    Args:
        video_path (str): Path to the video file.
        target_size (tuple): Desired (max_width, max_height) for the thumbnail.

    Returns:
        PIL.Image.Image or None: A Pillow Image object of the thumbnail,
                                 or None if thumbnail generation fails.
    """
    cap = None  # Initialize cap outside try to ensure it's available in finally-like block
    try:
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            print(f"Error: Could not open video file for thumbnail: {video_path}")
            return None

        ret, frame = cap.read()
        if not ret or frame is None:
            print(f"Error: Could not read first frame for thumbnail: {video_path}")
            return None

        # Convert frame from BGR (OpenCV default) to RGB (Pillow default)
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        pil_image = Image.fromarray(rgb_frame)

        # Resize the image to fit within target_size while maintaining aspect ratio
        original_width, original_height = pil_image.size
        target_width, target_height = target_size

        if original_width == 0 or original_height == 0:
            print(f"Error: Invalid frame dimensions for thumbnail: {video_path}")
            return None

        # Calculate aspect ratios
        img_aspect_ratio = original_width / original_height
        target_aspect_ratio = target_width / target_height

        if img_aspect_ratio > target_aspect_ratio:
            # Image is wider than target, scale by width
            new_width = target_width
            new_height = int(new_width / img_aspect_ratio)
        else:
            # Image is taller than or same aspect as target, scale by height
            new_height = target_height
            new_width = int(new_height * img_aspect_ratio)

        # Ensure new dimensions are at least 1x1
        new_width = max(1, new_width)
        new_height = max(1, new_height)

        resized_image = pil_image.resize((new_width, new_height), Image.LANCZOS)

        return resized_image

    except Exception as e:
        print(f"Error generating video thumbnail for {video_path}: {e}")
        return None
    finally:
        if cap is not None and cap.isOpened():
            cap.release()

def select_directory():
    """Opens a dialog to select a directory, stores the path, and lists supported files."""
    global selected_directory
    path = filedialog.askdirectory()
    if path:
        selected_directory = path
        # status_var is updated throughout list_files_in_directory and clear_media_display
        print(f"Selected directory: {selected_directory}")
        list_files_in_directory(selected_directory) # This will also update status
        # clear_media_display() # Called by list_files_in_directory if no files, or if selection changes
    else:
        status_var.set("No directory selected. Please select a directory.")


def list_files_in_directory(directory_path):
    """Clears the scrollable_frame and populates it with file items (thumbnail & name) from the directory."""
    for widget in scrollable_frame.winfo_children():
        widget.destroy()

    # Ensure media display is cleared when directory changes or is re-listed
    clear_media_display()

    global currently_selected_item_widget # Ensure we can reset this
    currently_selected_item_widget = None

    if not selected_directory:
        status_var.set("Error: No directory to list files from.")
        return

    try:
        files_found = 0
        # Sort items for consistent display
        sorted_items = sorted(os.listdir(directory_path), key=lambda s: s.lower())

        for item_name in sorted_items:
            full_file_path = os.path.join(directory_path, item_name)
            if os.path.isfile(full_file_path):
                _, ext = os.path.splitext(item_name)

                if not (ext.lower() in VIDEO_EXTENSIONS or \
                        ext.lower() in IMAGE_EXTENSIONS or \
                        ext.lower() in HTML_EXTENSIONS):
                    continue

                files_found += 1
                item_frame = tk.Frame(scrollable_frame, borderwidth=1, relief=tk.RAISED, height=85)
                item_frame.pack(fill=tk.X, pady=2, padx=2) # Adjusted padding
                item_frame.pack_propagate(False)

                thumbnail_image_pil = None
                thumbnail_label_width_px = 100 # Desired width for thumbnail display area
                thumbnail_label_height_px = 75  # Desired height for thumbnail display area

                if ext.lower() in VIDEO_EXTENSIONS:
                    thumbnail_image_pil = generate_video_thumbnail(full_file_path, target_size=(thumbnail_label_width_px, thumbnail_label_height_px))
                elif ext.lower() in IMAGE_EXTENSIONS:
                    try:
                        img = Image.open(full_file_path)
                        img.thumbnail((thumbnail_label_width_px, thumbnail_label_height_px), Image.LANCZOS)
                        thumbnail_image_pil = img
                    except Exception as e:
                        print(f"Error creating thumbnail for image {item_name}: {e}")
                        thumbnail_image_pil = None

                thumb_label = tk.Label(item_frame, width=thumbnail_label_width_px, height=thumbnail_label_height_px, bg="gray20") # Darker placeholder

                if thumbnail_image_pil:
                    try:
                        img_tk = ImageTk.PhotoImage(thumbnail_image_pil)
                        thumb_label.config(image=img_tk, width=thumbnail_image_pil.width, height=thumbnail_image_pil.height)
                        thumb_label.image = img_tk
                    except Exception as e:
                        print(f"Error creating Tkinter thumbnail for {item_name}: {e}")
                        thumb_label.config(text=ext.lower()[:4].upper())
                else:
                    display_text = ext.lower()[:4].upper()
                    if ext.lower() in HTML_EXTENSIONS:
                        display_text = "HTML"
                    thumb_label.config(text=display_text, fg="white")

                thumb_label.pack(side=tk.LEFT, padx=5, pady=5)

                name_label = tk.Label(item_frame, text=item_name, anchor="w", wraplength=120, font=("TkDefaultFont", 9)) # Added font
                name_label.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=5)

                click_handler = lambda event, path=full_file_path, item_w=item_frame: on_custom_item_click(event, path, item_w)

                item_frame.bind("<Button-1>", click_handler)
                thumb_label.bind("<Button-1>", click_handler)
                name_label.bind("<Button-1>", click_handler)

        if files_found == 0:
            status_var.set(f"Current directory: {selected_directory} | No supported files found.")
        else:
            status_var.set(f"Current directory: {selected_directory} | {files_found} files listed. Select an item.")

    except Exception as e:
        print(f"Error listing files: {e}")
        status_var.set(f"Error listing files in {selected_directory}. Error: {e}")

    file_canvas.update_idletasks()
    file_canvas.config(scrollregion=file_canvas.bbox("all"))


# Keep track of the currently selected item_frame for visual feedback
currently_selected_item_widget = None

def on_custom_item_click(event, file_path, item_widget):
    """Handles click events on items in the custom file list."""
    global currently_selected_item_widget

    # Visual feedback for selection
    if currently_selected_item_widget and currently_selected_item_widget != item_widget : # Check if not clicking the same widget
        # Attempt to reset background color; requires knowing original color or using a standard one
        try:
            original_bg = scrollable_frame.cget("bg") # Or root.cget('bg') if scrollable_frame has no specific bg
        except tk.TclError: # In case cget("bg") is not suitable for the widget
            original_bg = "SystemButtonFace" # A common default color
        if currently_selected_item_widget.winfo_exists(): # Check if widget still exists
             currently_selected_item_widget.config(relief=tk.RAISED, bg=original_bg)

    if item_widget.winfo_exists():
        item_widget.config(relief=tk.SUNKEN, bg="lightblue")
    currently_selected_item_widget = item_widget

    print(f"Item clicked: {file_path}")
    status_var.set(f"Selected: {os.path.basename(file_path)}")

    _, ext = os.path.splitext(file_path)
    if ext.lower() in IMAGE_EXTENSIONS:
        print(f"DEBUG: Routing to display_image for {file_path}")
        display_image(file_path)
    elif ext.lower() in VIDEO_EXTENSIONS:
        print(f"DEBUG: Routing to play_video for {file_path}")
        clear_media_display(message_if_cleared=False)
        play_video(file_path)
    elif ext.lower() in HTML_EXTENSIONS:
        print(f"DEBUG: Routing to view_html for {file_path}")
        clear_media_display(message_if_cleared=False)
        view_html(file_path)
    else:
        print(f"DEBUG: No specific action for {file_path}")
        clear_media_display(message_if_cleared=False)
        status_var.set(f"Selected: {os.path.basename(file_path)} (no preview or action defined)")


def view_html(filepath):
    """Opens the selected HTML file in the system's default web browser using OS-specific commands."""
    # clear_media_display() is called by on_file_select before this
    print(f"Attempting to open HTML file: {filepath}")
    command_used = ""
    try:
        current_os = platform.system()
        if current_os == "Windows":
            command_used = f"os.startfile({os.path.basename(filepath)})"
            os.startfile(filepath)
        elif current_os == "Darwin": # macOS
            command_used = f"open {os.path.basename(filepath)}"
            subprocess.run(['open', filepath], check=True)
        else: # Linux and other Unix-like systems
            command_used = f"xdg-open {os.path.basename(filepath)}"
            subprocess.run(['xdg-open', filepath], check=True)

        print(f"HTML file '{os.path.basename(filepath)}' opened using '{command_used}'.")
        status_var.set(f"Viewing: {os.path.basename(filepath)} in browser")
    except FileNotFoundError: # Primarily for 'open' or 'xdg-open' not found
        error_msg = f"Error: Command for '{command_used}' not found. Cannot open HTML file."
        print(error_msg)
        status_var.set(f"Error: Command not found for {os.path.basename(filepath)}")
    except subprocess.CalledProcessError as e: # For errors from subprocess.run
        error_msg = f"Error opening HTML file '{os.path.basename(filepath)}' using '{command_used}': {e}"
        print(error_msg)
        status_var.set(f"Error opening {os.path.basename(filepath)}")
    except Exception as e: # Catch-all for other errors, including os.startfile issues
        error_msg = f"An unexpected error occurred with '{command_used}' for '{os.path.basename(filepath)}': {e}"
        print(error_msg)
        status_var.set(f"Error with {os.path.basename(filepath)}")


def play_video(filepath):
    """Plays the selected video file using the system's default player using OS-specific commands."""
    # clear_media_display() is called by on_file_select before this
    print(f"Attempting to play video: {filepath}")
    command_used = ""
    try:
        current_os = platform.system()
        if current_os == "Windows":
            command_used = f"os.startfile({os.path.basename(filepath)})"
            os.startfile(filepath)
        elif current_os == "Darwin": # macOS
            command_used = f"open {os.path.basename(filepath)}"
            subprocess.run(['open', filepath], check=True)
        else: # Linux and other Unix-like systems
            command_used = f"xdg-open {os.path.basename(filepath)}"
            subprocess.run(['xdg-open', filepath], check=True)

        print(f"Video '{os.path.basename(filepath)}' opened using '{command_used}'.")
        status_var.set(f"Playing: {os.path.basename(filepath)} in external player")
    except FileNotFoundError: # Primarily for 'open' or 'xdg-open' not found
        error_msg = f"Error: Command for '{command_used}' not found. Cannot open video."
        print(error_msg)
        status_var.set(f"Error: Command not found for {os.path.basename(filepath)}")
    except subprocess.CalledProcessError as e: # For errors from subprocess.run
        error_msg = f"Error opening video '{os.path.basename(filepath)}' using '{command_used}': {e}"
        print(error_msg)
        status_var.set(f"Error opening {os.path.basename(filepath)}")
    except Exception as e: # Catch-all for other errors, including os.startfile issues
        error_msg = f"An unexpected error occurred with '{command_used}' for '{os.path.basename(filepath)}': {e}"
        print(error_msg)
        status_var.set(f"Error with {os.path.basename(filepath)}")


def display_image(filepath):
    """Loads, resizes, and displays an image in the preview_label."""
    try:
        img = Image.open(filepath)
        # Ensure the preview_label has had a chance to be drawn and get its size
        root.update_idletasks()

        # Use actual label width/height if available and reasonable, else default
        max_width = preview_label.winfo_width() if preview_label.winfo_width() > 20 else 500
        max_height = preview_label.winfo_height() if preview_label.winfo_height() > 20 else 380

        img_width, img_height = img.size
        ratio = min(max_width/img_width, max_height/img_height)

        if ratio < 1: # Only resize if image is larger than max dimensions or to fit
            new_width = int(img_width * ratio)
            new_height = int(img_height * ratio)
            img = img.resize((new_width, new_height), Image.LANCZOS)

        photo_img = ImageTk.PhotoImage(img)
        preview_label.config(image=photo_img, text="") # Clear text when image is shown
        preview_label.image = photo_img # Keep a reference!
        status_var.set(f"Displaying: {os.path.basename(filepath)}")
    except Exception as e:
        print(f"Error displaying image {filepath}: {e}")
        clear_media_display(message_if_cleared=False) # Keep current status text if possible
        status_var.set(f"Error displaying image: {os.path.basename(filepath)}")

def clear_media_display(message_if_cleared=True):
    """Clears the preview display label and optionally updates status."""
    preview_label.config(image='', text="Select a file to preview or open.")
    preview_label.image = None # Clear reference
    if message_if_cleared:
        if selected_directory:
            status_var.set(f"Current directory: {selected_directory} | Preview cleared. Select a file.")
        else:
            status_var.set("Ready. Please select a directory.")


# --- Widgets ---

# Button to select a directory (in top_control_frame)
select_button = tk.Button(top_control_frame, text="Select Directory", command=select_directory)
select_button.pack(side=tk.LEFT, padx=(0, 10))

# --- Main Content Area Widgets (Canvas for scrollable file list and Preview in main_content_frame) ---

# Frame for the File List (Canvas with Scrollbar)
file_list_frame = tk.Frame(main_content_frame)
# expand=False for file_list_frame, so it takes its width, preview_frame will expand
file_list_frame.pack(side=tk.LEFT, fill=tk.BOTH, expand=False, padx=(0,5))

tk.Label(file_list_frame, text="Files", font=('Helvetica', 10, 'bold')).pack(anchor=tk.NW, padx=5, pady=(0,2))

file_canvas = tk.Canvas(file_list_frame, borderwidth=0, width=250) # Set a default width for the canvas area
file_scrollbar = tk.Scrollbar(file_list_frame, orient=tk.VERTICAL, command=file_canvas.yview)
scrollable_frame = tk.Frame(file_canvas) # This frame will hold the file items

scrollable_frame.bind(
    "<Configure>",
    lambda e: file_canvas.configure(
        scrollregion=file_canvas.bbox("all")
    )
)

file_canvas.create_window((0, 0), window=scrollable_frame, anchor="nw")
file_canvas.configure(yscrollcommand=file_scrollbar.set)

file_canvas.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
file_scrollbar.pack(side=tk.RIGHT, fill=tk.Y)


# Frame for the Preview Area
preview_frame = tk.Frame(main_content_frame)
preview_frame.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=(5,0))

tk.Label(preview_frame, text="Preview / Media Output", font=('Helvetica', 10, 'bold')).pack(anchor=tk.NW, padx=5, pady=(0,2))
preview_label = tk.Label(preview_frame, bg='lightgrey', text="Select a file to preview or open.")
preview_label.pack(fill=tk.BOTH, expand=True)


# --- Status Bar (in status_bar_frame) ---
status_var = tk.StringVar()
# Initial message set by clear_media_display
status_label = tk.Label(status_bar_frame, textvariable=status_var, relief=tk.SUNKEN, anchor=tk.W)
status_label.pack(fill=tk.X, expand=True)

# Initialize
clear_media_display()

# Start the Tkinter event loop
root.mainloop()

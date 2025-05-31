import tkinter as tk
from tkinter import filedialog
import os
import subprocess
import platform # Added for OS-specific commands
from PIL import Image, ImageTk

# Global variable to store the selected path
selected_directory = ""

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
    """Clears the listbox and populates it with supported files from the directory."""
    file_listbox.delete(0, tk.END)
    clear_media_display() # Clear preview before listing new files
    if not selected_directory: # Should not happen if called correctly
        status_var.set("Error: No directory to list files from.")
        return
    try:
        files_found = 0
        for item in os.listdir(directory_path):
            full_path = os.path.join(directory_path, item)
            if os.path.isfile(full_path):
                _, ext = os.path.splitext(item)
                if ext.lower() in VIDEO_EXTENSIONS or \
                   ext.lower() in IMAGE_EXTENSIONS or \
                   ext.lower() in HTML_EXTENSIONS:
                    file_listbox.insert(tk.END, item)
                    files_found +=1

        if files_found == 0:
            status_var.set(f"Current directory: {selected_directory} | No supported files found.")
        else:
            status_var.set(f"Current directory: {selected_directory} | {files_found} files listed. Select a file.")

    except Exception as e:
        print(f"Error listing files: {e}")
        status_var.set(f"Error listing files in {selected_directory}.")
        # Consider showing an error in the GUI

def on_file_select(event):
    """Handles file selection from the listbox to display images or play videos."""
    if not file_listbox.curselection():
        # This case might not be hit if selection is always present when event fires
        if selected_directory:
            status_var.set(f"Current directory: {selected_directory} | No file selected.")
        else:
            status_var.set("Ready. Please select a directory.")
        return

    selected_index = file_listbox.curselection()[0]
    selected_file = file_listbox.get(selected_index)
    full_file_path = os.path.join(selected_directory, selected_file)
    # Status will be updated by display_image, play_video, view_html or if no preview

    _, ext = os.path.splitext(selected_file)
    if ext.lower() in IMAGE_EXTENSIONS:
        display_image(full_file_path) # This will update status_var
    elif ext.lower() in VIDEO_EXTENSIONS:
        clear_media_display(message_if_cleared=False) # Clear preview area
        play_video(full_file_path) # This will update status_var
    elif ext.lower() in HTML_EXTENSIONS:
        clear_media_display(message_if_cleared=False) # Clear preview area
        view_html(full_file_path) # This will update status_var
    else:
        clear_media_display(message_if_cleared=False)
        status_var.set(f"Selected: {selected_file} (no preview available)")


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

# --- Main Content Area Widgets (Listbox and Preview in main_content_frame) ---

# Frame for the File List
file_list_frame = tk.Frame(main_content_frame)
# Changed expand to False for file_list_frame, True for preview_frame
file_list_frame.pack(side=tk.LEFT, fill=tk.BOTH, expand=False, padx=(0,5))

tk.Label(file_list_frame, text="Files", font=('Helvetica', 10, 'bold')).pack(anchor=tk.NW, padx=5, pady=(0,2))
file_listbox = tk.Listbox(file_list_frame, width=30, height=20)
file_listbox.pack(side=tk.LEFT, fill=tk.BOTH, expand=True) # Listbox fills its frame
file_listbox.bind('<<ListboxSelect>>', on_file_select)

# Frame for the Preview Area
preview_frame = tk.Frame(main_content_frame) # Removed bg color, let preview_label handle it
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

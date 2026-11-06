from roboflow import Roboflow
from ultralytics import YOLO
import shutil
import os

print("Step 1: Connecting to Roboflow...")
# 1. Authenticate with your API key
rf = Roboflow(api_key="Gg0MacHyCLCcQybgIfKm")

print("Step 2: Downloading the Spaghetti Dataset...")
# 2. Define the workspace and project
project = rf.workspace("3d-printing-failure").project("spaghetti-3d")
version = project.version(1)

# 3. Download the dataset to your computer in YOLOv8 format
dataset = version.download("yolov8")
print(f"Dataset downloaded to: {dataset.location}")

print("Step 3: Starting YOLOv8 Training on your GPU...")
# 4. Load the base YOLOv8 "Nano" model (fastest and best for edge devices)
model = YOLO("yolov8n.pt")

# 5. Train the model on your dataset for 50 epochs using your GPU (device=0)
model.train(
    data=f"{dataset.location}/data.yaml",
    epochs=50,
    imgsz=640,
    device=0,
    batch=16,
    project="watch_guard",
    name="spaghetti_detector"
)

print("Step 4: Extracting optimal weights (best.pt)...")
# Block 4: Weight Extraction and Export
source_weights = "watch_guard/spaghetti_detector/weights/best.pt"

# Auto-detect destination: Google Colab (/content) or local working directory
if os.path.exists("/content"):
    destination_weights = "/content/best.pt"
else:
    destination_weights = "best.pt"

if os.path.exists(source_weights):
    shutil.copy(source_weights, destination_weights)
    print(f"Training sequence complete. Optimal model weights exported to: {destination_weights}")
else:
    print(f"Warning: {source_weights} was not found. Check the runs directory.")

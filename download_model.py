"""
download_model.py — Helper to fetch model weights and dataset.
Reads ROBOFLOW_API_KEY from environment or .env file.
"""

import os
import sys

# Load environment if dotenv available
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

ROBOFLOW_API_KEY = os.getenv("ROBOFLOW_API_KEY", "")

def download_roboflow_dataset():
    print("=" * 60)
    print("📥 Watch Guard — Dataset & Model Fetcher")
    print("=" * 60)
    if not ROBOFLOW_API_KEY:
        print("❌ ROBOFLOW_API_KEY not found in .env. Please set it first.")
        return

    try:
        from roboflow import Roboflow
    except ImportError:
        print("Installing roboflow SDK...")
        import subprocess
        subprocess.check_call([sys.executable, "-m", "pip", "install", "roboflow", "ultralytics"])
        from roboflow import Roboflow

    print(f"Connecting to Roboflow (Key: {ROBOFLOW_API_KEY[:4]}...)...")
    rf = Roboflow(api_key=ROBOFLOW_API_KEY)
    project = rf.workspace("3d-printing-failure").project("spaghetti-3d")
    version = project.version(1)

    print("Downloading dataset in YOLOv8 format...")
    dataset = version.download("yolov8")
    print(f"✅ Dataset successfully downloaded to: {dataset.location}")
    print("=" * 60)

if __name__ == "__main__":
    download_roboflow_dataset()

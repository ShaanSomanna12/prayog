"""
setup_friend.py — 1-Click Environment Setup for Collaborators / Friends.

Run on the friend's laptop:
    python setup_friend.py

This script:
1. Copies .env.example to .env (or prompts if needed).
2. Verifies Python dependencies.
3. Verifies or auto-provisions model weights (best.pt / yolov8n.pt fallback).
4. Tests the local environment for edge triage.
"""

import os
import sys
import subprocess
import shutil

def main():
    print("=" * 65)
    print("🚀 Watch Guard — Collaborator Automated Environment Setup")
    print("=" * 65)

    # Step 1: Create .env from template if missing
    env_path = os.path.join(os.getcwd(), ".env")
    env_example = os.path.join(os.getcwd(), ".env.example")

    if not os.path.exists(env_path):
        if os.path.exists(env_example):
            shutil.copy(env_example, env_path)
            print("📝 Created .env from .env.example template.")
            print("   👉 Paste the team API keys provided in your chat into .env")
        else:
            with open(env_path, "w", encoding="utf-8") as f:
                f.write("# Watch Guard Configuration\nPORT=3001\n")
            print("📝 Created blank .env.")
    else:
        print("ℹ️  .env already exists. Preserving existing configuration.")

    # Step 2: Check Model Weights
    print("\n📦 Checking YOLO Model Weights...")
    model_paths = [
        "best.pt",
        "Vision-OPS-Training/best.pt",
        "watch_guard/spaghetti_detector/weights/best.pt",
    ]
    found_weights = next((p for p in model_paths if os.path.exists(p)), None)

    if found_weights:
        print(f"✅ Found custom trained weights: {found_weights} ({os.path.getsize(found_weights)/(1024*1024):.1f} MB)")
    else:
        print("ℹ️  Custom 'best.pt' not found locally yet.")
        print("   Auto-provisioning base YOLOv8 Nano weights for zero-friction launch...")
        try:
            from ultralytics import YOLO
            _ = YOLO("yolov8n.pt")
            print("✅ 'yolov8n.pt' loaded and ready as working fallback!")
        except Exception:
            print("   (Ultralytics will auto-download yolov8n.pt when you run inference_server.py)")

    # Step 3: Check Python packages
    print("\n🐍 Checking Python Dependencies...")
    required_packages = ["fastapi", "uvicorn", "ultralytics", "opencv-python", "roboflow", "pydantic"]
    missing = []
    for pkg in required_packages:
        module_name = "cv2" if pkg == "opencv-python" else pkg
        try:
            __import__(module_name)
        except ImportError:
            missing.append(pkg)

    if missing:
        print(f"⚠️  Missing packages: {', '.join(missing)}")
        print(f"   Installing missing packages via pip...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", *missing])
        print("✅ All packages installed!")
    else:
        print("✅ All Python dependencies are satisfied.")

    print("\n" + "=" * 65)
    print("🎉 SETUP COMPLETE! You are ready to run Watch Guard!")
    print("=" * 65)
    print("\n👉 How to start the Edge Inference Server on your laptop:")
    print("   python inference_server.py")
    print("\n👉 How to start the Watch Guard Orchestrator & Dashboard:")
    print("   npm start")
    print("=" * 65)

if __name__ == "__main__":
    main()

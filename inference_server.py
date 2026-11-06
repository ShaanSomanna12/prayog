import base64
import os
import cv2
import tempfile
import numpy as np
import uvicorn
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from ultralytics import YOLO
from ultralytics.utils import ThreadingLocked

# Initialize the FastAPI application framework
app = FastAPI(title="Watch Guard Edge Inference Triage")

# Locate model weights: search locally, in subdirectories, or fallback gracefully
model_paths = [
    "best.pt",
    "watch_guard/spaghetti_detector/weights/best.pt",
    "Vision-OPS-Training/best.pt",
    "Vision-OPS-Training/watch_guard/spaghetti_detector/weights/best.pt",
    "yolov8n.pt",
]

model_path = next((p for p in model_paths if os.path.exists(p)), None)
if not model_path:
    print("[Watch Guard] Notice: Custom 'best.pt' not found locally yet.")
    print("[Watch Guard] Auto-provisioning base 'yolov8n.pt' fallback...")
    model_path = "yolov8n.pt"

# Load YOLO model into memory
try:
    print(f"[Watch Guard] Loading YOLO model weights from: {model_path}")
    model = YOLO(model_path)
    print(f"[Watch Guard] YOLO model loaded successfully. (Weights: {model_path})")
except Exception as e:
    print(f"Fatal error loading model weights from '{model_path}': {e}")
    exit(1)

# Check if model has custom 'spaghetti' classes or if it is the base COCO model
classes = getattr(model, "names", {})
is_custom_spaghetti = any("spaghetti" in str(v).lower() for v in classes.values())

roboflow_model = None
if is_custom_spaghetti:
    print("[Watch Guard] 🎯 Confirmed: Local weights contain custom 'spaghetti' class.")
else:
    print("[Watch Guard] Notice: Local 'best.pt' is generic COCO base weights (classes: person, car, dog...).")
    print("[Watch Guard] 🚀 Connecting to trained Roboflow Spaghetti Detector (spaghetti-3d/1)...")
    try:
        from roboflow import Roboflow
        rf_key = os.getenv("ROBOFLOW_API_KEY", "Gg0MacHyCLCcQybgIfKm")
        rf = Roboflow(api_key=rf_key)
        roboflow_model = rf.workspace("3d-printing-failure").project("spaghetti-3d").version(1).model
        print("[Watch Guard] ✅ Roboflow Spaghetti Detector active (86.9% confidence)!")
    except Exception as rf_err:
        print(f"[Watch Guard] Roboflow fallback connection failed: {rf_err}")

# Define the expected JSON payload schema via Pydantic
class FramePayload(BaseModel):
    image: str  # Base64 encoded image string representing the webcam frame

# Define the structured response schema
class BoundingBox(BaseModel):
    class_name: str
    confidence: float
    coordinates: list

class AnalysisResponse(BaseModel):
    status: str
    highest_confidence: float
    detections: list[BoundingBox]

# Thread-safe prediction wrapper to prevent memory leaks and race conditions
@ThreadingLocked()
def safe_predict(image_matrix):
    return model.predict(source=image_matrix, conf=0.4, save=False, verbose=False)

@app.get("/")
def health_check():
    return {
        "status": "online",
        "service": "Watch Guard Edge Inference Triage",
        "model_loaded": model_path,
        "is_custom_spaghetti_weights": is_custom_spaghetti,
        "roboflow_detector_active": Boolean(roboflow_model) if 'Boolean' in globals() else bool(roboflow_model),
        "target_class": "spaghetti"
    }

@app.post("/analyze", response_model=AnalysisResponse)
async def analyze_frame(payload: FramePayload):
    try:
        # Step 1: Sanitize the base64 string, stripping data URI scheme headers if present
        base64_data = payload.image
        if "," in base64_data:
            base64_data = base64_data.split(",")[1]

        # Step 2: Decode the Base64 string into raw binary bytes
        img_bytes = base64.b64decode(base64_data)

        # Step 3: Transform binary bytes into a flat NumPy array of unsigned 8-bit integers
        np_arr = np.frombuffer(img_bytes, np.uint8)

        # Step 4: Decode the flat array into a spatial OpenCV BGR image matrix
        img_cv2 = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

        if img_cv2 is None:
            raise ValueError("Failed to decode the image matrix from the provided payload.")

        detected_status = "nominal"
        max_conf = 0.0
        bounding_boxes = []

        if is_custom_spaghetti:
            # ── 1. Local Custom YOLO Spaghetti Inference ───────────────────────
            results = safe_predict(img_cv2)
            for result in results:
                boxes = result.boxes
                for box in boxes:
                    cls_id = int(box.cls[0].item())
                    conf = float(box.conf[0].item())
                    c_name = model.names[cls_id]
                    xywh = box.xywh[0].tolist()

                    bounding_boxes.append(BoundingBox(
                        class_name=c_name,
                        confidence=conf,
                        coordinates=xywh
                    ))

                    if "spaghetti" in c_name.lower():
                        detected_status = "failure"
                        if conf > max_conf:
                            max_conf = conf

        elif roboflow_model:
            # ── 2. Roboflow Spaghetti Detector (86.9% accuracy) ───────────────
            with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp:
                cv2.imwrite(tmp.name, img_cv2)
                tmp_path = tmp.name

            try:
                preds = roboflow_model.predict(tmp_path, confidence=35).json().get("predictions", [])
                for p in preds:
                    c_name = p.get("class", "spaghetti")
                    conf = float(p.get("confidence", 0.0))
                    coords = [float(p.get("x", 0)), float(p.get("y", 0)), float(p.get("width", 0)), float(p.get("height", 0))]

                    bounding_boxes.append(BoundingBox(
                        class_name=c_name,
                        confidence=conf,
                        coordinates=coords
                    ))

                    if "spaghetti" in c_name.lower():
                        detected_status = "failure"
                        if conf > max_conf:
                            max_conf = conf
            finally:
                if os.path.exists(tmp_path):
                    os.remove(tmp_path)

        else:
            # Fallback local inference
            results = safe_predict(img_cv2)
            for result in results:
                for box in result.boxes:
                    cls_id = int(box.cls[0].item())
                    conf = float(box.conf[0].item())
                    c_name = model.names[cls_id]
                    bounding_boxes.append(BoundingBox(
                        class_name=c_name,
                        confidence=conf,
                        coordinates=box.xywh[0].tolist()
                    ))
                    if "spaghetti" in c_name.lower():
                        detected_status = "failure"
                        if conf > max_conf:
                            max_conf = conf

        return AnalysisResponse(
            status=detected_status,
            highest_confidence=max_conf,
            detections=bounding_boxes
        )

    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Inference failure: {str(e)}")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)

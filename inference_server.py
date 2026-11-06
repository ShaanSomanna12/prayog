import base64
import os
import cv2
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

model_path = next((p for p in model_paths if os.path.exists(p)), "best.pt")

# Load the trained YOLO model into memory upon startup
try:
    print(f"[Watch Guard] Loading YOLO model weights from: {model_path}")
    model = YOLO(model_path)
    print("[Watch Guard] YOLO model loaded successfully into memory.")
except Exception as e:
    print(f"Fatal error loading model weights from '{model_path}': {e}")
    exit(1)

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
    # conf=0.5 acts as a threshold filter, returning only high-confidence anomalies
    return model.predict(source=image_matrix, conf=0.5, save=False, verbose=False)

@app.get("/")
def health_check():
    return {
        "status": "online",
        "service": "Watch Guard Edge Inference Triage",
        "model_loaded": model_path,
        "classes": model.names if hasattr(model, "names") else []
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

        # Step 5: Execute thread-safe YOLO inference
        results = safe_predict(img_cv2)

        detected_status = "nominal"
        max_conf = 0.0
        bounding_boxes = []

        # Step 6: Parse the resulting PyTorch tensors into JSON-serializable structures
        for result in results:
            boxes = result.boxes
            for box in boxes:
                # Extract the class index and scalar confidence value
                cls_id = int(box.cls[0].item())
                conf = float(box.conf[0].item())
                class_name = model.names[cls_id]

                # Extract xywh (center x, center y, width, height) coordinates
                xywh = box.xywh[0].tolist()

                bounding_boxes.append(BoundingBox(
                    class_name=class_name,
                    confidence=conf,
                    coordinates=xywh
                ))

                # Escalate the global status if a critical anomaly is detected
                if class_name in ["spaghetti", "failure", "defect"]:
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
    # Bind the ASGI server to all local interfaces on port 8000
    uvicorn.run(app, host="0.0.0.0", port=8000)


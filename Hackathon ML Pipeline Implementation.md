# **Hybrid Cascade Inference Pipeline: Edge-to-Cloud Triage Architecture for Autonomous Fabrication Monitoring**

The deployment of autonomous fabrication monitoring systems, designed to oversee Fused Deposition Modeling (FDM) 3D printers and Computer Numerical Control (CNC) machinery, represents a critical intersection of computer vision, edge computing, and hardware orchestration. Standard paradigms for visual anomaly detection often rely on transmitting every captured webcam frame to a remote Large Language Model (LLM) or Vision-Language Model (VLM) for continuous analysis. While highly effective in terms of spatial reasoning and semantic understanding, this cloud-only approach is remarkably inefficient. It introduces massive token consumption, severe API rate-limiting vulnerabilities, and unacceptable latency bottlenecks that can delay critical hardware interruptions during a catastrophic failure.  
To resolve these architectural limitations and construct a highly defensible, production-grade system within strict temporal and budgetary constraints, a Hybrid Cascade Inference Pipeline provides the optimal solution. This edge-to-cloud triage architecture leverages a lightweight, locally hosted Convolutional Neural Network (CNN) to process high-frequency webcam frames in real time at the edge. The cloud-based VLM is exclusively invoked as a secondary reasoning engine when the local edge model detects a definitive anomaly. This comprehensive analysis details the step-by-step implementation of this architecture using Roboflow for dataset curation, Ultralytics YOLOv11 for edge detection, FastAPI for local inference serving, Node.js for pipeline orchestration, and the Groq Vision API for advanced semantic diagnostics.

## **Architectural Topology and Triage Rationale**

The core philosophy of a cascade inference pipeline is to route simple, repetitive classification and detection tasks to cost-effective, low-latency edge models, reserving computationally expensive, high-latency cloud models for complex reasoning and diagnostic reporting. In the context of 3D printer monitoring, the vast majority of captured frames represent nominal, healthy printing operations. Transmitting these nominal frames to a cloud VLM wastes bandwidth, consumes processing power, and generates unnecessary API costs.  
By implementing an Ultralytics YOLOv11 model as a first-stage triage gatekeeper, the local system achieves inference times often falling below 50 milliseconds, bypassing network latency entirely. If the local YOLO model detects a critical failure, such as detached filament extrusion commonly referred to as "spaghetti," it flags that specific frame. The Node.js orchestrator subsequently halts the hardware via its native API to prevent physical damage or thermal hazards, and simultaneously forwards the flagged frame to the Groq Vision API. The Groq API, executing advanced models such as llama-3.2-11b-vision-preview, performs a detailed root-cause analysis based on the visual evidence, generating a comprehensive incident report for the end-user1.  
The structural advantages of this approach become highly apparent when comparing the cascade pipeline to a monolithic cloud architecture.

| Metric | Cloud-Only VLM Architecture | Hybrid Cascade Architecture (YOLO \+ Groq) |
| :---- | :---- | :---- |
| **Inference Frequency** | \~1 FPS (Constrained by network latency and API limits) | \~30 FPS (Constrained only by local CPU/GPU throughput) |
| **API Cost and Token Consumption** | Extremely High (Continuous token usage for every frame) | Negligible (Tokens consumed exclusively upon anomaly detection) |
| **Reaction Latency** | 2,000ms to 5,000ms (Round-trip network delay) | \< 100ms (Local edge detection triggers immediate pause) |
| **Hardware Pausing Mechanism** | Delayed (Requires full VLM response parsing) | Immediate (Triggered directly by YOLO bounding box confidence) |
| **Diagnostic Detail** | High (VLM analyzes every frame, largely redundantly) | High (VLM analyzes the exact point of failure with targeted context) |

This hybrid configuration ensures that the physical hardware is protected with millisecond-level responsiveness, while still providing the user with the deep, natural-language diagnostic capabilities characteristic of a massive multimodal model.

## **Phase 1: Dataset Acquisition and Annotation Strategy**

The foundational accuracy of the edge detection model relies entirely on a highly curated, domain-specific dataset. Given a maximum execution window of twelve hours, manually collecting, curating, and annotating hundreds of images of 3D print failures is logistically impossible. The strategic imperative dictates sourcing high-quality, open-source datasets and refining them through targeted data augmentations.  
Roboflow Universe serves as a vast repository for pre-annotated computer vision datasets, providing an ideal starting point for rapid prototyping4. The objective is to acquire a dataset comprising 200 to 300 high-quality images of 3D print failures, specifically focusing on "spaghetti" (tangled, detached filament extrusions) and severe stringing anomalies. Search queries within the Roboflow Universe platform reveal several highly viable datasets, such as the "3d printer fail detection" dataset, which contains hundreds of images of failed prints complete with pre-trained models and bounding box annotations6. Another excellent candidate is the "Spaghetti 3D" dataset, which focuses exclusively on catastrophic filament adhesion failures8.  
The selected dataset must be cloned into a free Roboflow workspace. It is critical during this phase to verify that the dataset utilizes bounding box annotations for object detection, rather than polygon annotations for instance segmentation. While instance segmentation provides pixel-perfect masking of the anomaly, object detection models are significantly faster to train and execute on edge hardware, which aligns perfectly with the triage philosophy of prioritizing speed over granular pixel mapping5.

### **Labeling Taxonomy Consolidation**

A simplified labeling taxonomy is crucial for small datasets. Overcomplicating the classes leads to class imbalance, where the neural network struggles to converge on underrepresented labels. The Roboflow dataset should be consolidated into a strict, streamlined taxonomy.

| Class ID | Class Name | Description | Cascade Response Action |
| :---- | :---- | :---- | :---- |
| 0 | nominal | A healthy, successfully printing object adhering to the build plate. | Ignore; continue local monitoring at high frame rate. |
| 1 | spaghetti | Tangled, extruded filament not adhering to the print, indicating catastrophic failure. | Trigger Auto-Pause; invoke Groq API for incident report. |
| 2 | stringing | Thin, wispy strands of plastic traversing between travel moves, indicating retraction issues. | Optional Warning; do not halt hardware; do not invoke Groq. |

For maximum efficiency and the highest probability of model convergence within a limited timeframe, consolidating the taxonomy to a binary spaghetti and nominal setup is highly recommended. This binary classification forces the model to focus entirely on the morphological differences between structured geometric prints and chaotic filament tangles.

### **Augmentation Strategy for Small Datasets**

To ensure the YOLOv11 model generalizes robustly across different 3D printer enclosures, ambient lighting conditions, and diverse filament colors, sophisticated image augmentations must be applied within the Roboflow pipeline prior to exporting the dataset. Deep learning models trained on highly constrained data volumes (such as 200 to 300 images) are highly susceptible to overfitting, where the model memorizes the training data but fails to recognize anomalies in novel environments.  
The augmentation strategy must employ several geometric and color-space transformations. Hue, Saturation, and Value (HSV) adjustments are paramount; modifying the intensity of colors through hsv\_s and hsv\_h hyperparameters ensures the model does not overfit to a specific filament color12. This allows a model trained predominantly on red or white spaghetti failures to accurately detect black or translucent filament failures in a production setting. Furthermore, translation, scaling, and shearing transformations simulate different webcam mounting angles and focal lengths, ensuring spatial invariance12.  
Integrating Albumentations-based transformations, specifically median blur and Contrast Limited Adaptive Histogram Equalization (CLAHE), significantly enhances model robustness. A slight median blur mimics the focal aberrations and sensor noise common in inexpensive webcams, while CLAHE boosts localized contrast in dark or unevenly lit enclosures13. This forces the convolutional layers to identify the physical structure and chaotic edges of the spaghetti, rather than relying on perfect illumination. Once these generation steps are configured, the dataset must be exported in the "YOLOv8" or "YOLOv11" PyTorch format, which produces a compressed archive containing the augmented images, the corresponding .txt bounding box coordinate files, and a data.yaml configuration file required by the Ultralytics training engine5.

## **Phase 2: Edge Model Training Pipeline via Google Colab**

With the dataset curated, augmented, and formatted, the subsequent phase involves executing the model training pipeline. Google Colab provides access to a free NVIDIA T4 GPU, which delivers more than sufficient computational throughput to train a lightweight YOLO model for 50 epochs in a fraction of an hour. Ultralytics YOLOv11 is selected for its state-of-the-art accuracy-to-parameter ratio, highly optimized PyTorch backend, and seamless Python integration16.  
The "Nano" variant (yolo11n.pt) is specifically chosen for this architecture. While larger models (such as yolo11l.pt or yolo11x.pt) offer marginal gains in absolute mean Average Precision (mAP), the Nano model is aggressively optimized for edge inference. This ensures the FastAPI server can process incoming webcam frames instantly on standard CPU hardware without necessitating a dedicated local GPU, preserving the edge-triage latency budget16.  
The following Python notebook code sequence documents the precise operations required to provision the environment, ingest the dataset, initialize the training loop, and extract the optimized weights.  
The environment setup requires the installation of the Ultralytics framework and the Roboflow SDK. The Ultralytics package furnishes the YOLO training algorithms, while the Roboflow package enables programmatic downloading of the curated dataset directly into the Colab ephemeral storage, bypassing manual file transfers5.

Python  
\# Block 1: Environment Provisioning  
\!pip install ultralytics roboflow

The dataset ingestion block utilizes the Roboflow SDK to authenticate and download the specific project version. The developer must insert their unique API key, workspace name, and project nomenclature. The SDK automatically extracts the compressed archive, structuring the images and labels alongside the critical data.yaml file, which maps the class indices to their human-readable strings14.

Python  
\# Block 2: Dataset Ingestion  
from roboflow import Roboflow

\# Initialize Roboflow SDK and fetch the YOLO formatted dataset  
rf \= Roboflow(api\_key="YOUR\_API\_KEY")  
project \= rf.workspace("YOUR\_WORKSPACE").project("YOUR\_PROJECT")  
dataset \= project.version(1).download("yolov8")

print(f"Dataset successfully staged at: {dataset.location}")

The training initialization block instantiates the YOLO model utilizing the pre-trained COCO weights (yolo11n.pt). Transfer learning is then applied by directing the model to train against the custom data.yaml file. The training duration is constrained to 50 epochs, which is generally sufficient for convergence on a small dataset without inducing severe overfitting. The image size (imgsz) is defined as 640x640 pixels, a standard resolution that balances feature extraction fidelity with memory consumption. The device=0 parameter explicitly forces the utilization of the Colab T4 GPU, dramatically accelerating the matrix multiplications required for backpropagation16.

Python  
\# Block 3: Model Initialization and Training Execution  
from ultralytics import YOLO

\# Load the pre-trained YOLOv11 Nano architecture  
model \= YOLO('yolo11n.pt')

\# Initiate the transfer learning training sequence  
results \= model.train(  
    data=f"{dataset.location}/data.yaml",  
    epochs=50,  
    imgsz=640,  
    batch=16,  
    device=0,   
    project="watch\_guard",  
    name="spaghetti\_detector"  
)

Following the completion of the 50 epochs, the Ultralytics training loop automatically evaluates the model against the validation set, tracking metrics such as precision, recall, and bounding box regression loss. The weights file representing the lowest validation loss across all epochs, designated as best.pt, is saved to the local directory structure. This file must be extracted from the Colab environment for deployment on the local edge server.

Python  
\# Block 4: Weight Extraction and Export  
import shutil

\# Locate the optimal weights file generated by the training loop  
source\_weights \= "watch\_guard/spaghetti\_detector/weights/best.pt"  
destination\_weights \= "/content/best.pt"

\# Copy to the root content directory for streamlined downloading  
shutil.copy(source\_weights, destination\_weights)  
print("Training sequence complete. Download 'best.pt' from the Colab file explorer.")

The resulting best.pt file is a highly compressed, serialized representation of the trained neural network. It encapsulates the entire edge intelligence of the Watch Guard system and forms the core of the local triage server.

## **Phase 3: High-Performance FastAPI Edge Inference Server**

The local machine situated adjacent to the 3D printer—typically hosting the webcam feed and the Node.js application—must operate a dedicated inference server to evaluate frames in real time. FastAPI is selected as the optimal framework for this task due to its asynchronous capabilities, exceptional routing performance, and native data validation via Pydantic20. This Python-based server loads the best.pt file into local memory and exposes an HTTP POST endpoint capable of receiving base64-encoded webcam frames, returning a structured JSON payload containing bounding box coordinates and classification statuses.

### **Memory Management and Thread Safety Considerations**

Running continuous, high-frequency inference loops on edge hardware introduces complex memory management challenges, particularly concerning PyTorch tensors and CUDA state contexts. If the FastAPI server is configured to handle concurrent asynchronous requests—for instance, if the system is scaled to monitor multiple 3D printers simultaneously—thread safety becomes a critical operational hazard. Python's Global Interpreter Lock (GIL) and the way PyTorch manages memory pools across threads can induce race conditions, silent memory leaks, or complete deadlocks22.  
Research indicates that instantiating a single YOLO model and sharing it across multiple threads without explicit locking mechanisms frequently leads to GPU memory accumulation, where tensors are not fully released between inference sessions, eventually triggering Out-Of-Memory (OOM) errors22. To mitigate these systemic risks, the YOLO model is instantiated globally upon server startup, but the inference execution must be carefully managed. The Ultralytics framework provides a ThreadingLocked() decorator to ensure that inference operations do not overlap, guaranteeing that each thread accesses the model sequentially and safely22. Alternatively, for purely sequential setups, the asynchronous endpoint can rely on FastAPI's underlying thread pool management, but explicit error handling remains necessary.

### **Implementation of the FastAPI Inference Endpoint**

The following Python script establishes the edge inference server. It utilizes Pydantic models to strictly define the expected incoming JSON payload structure and the outgoing response schema. The core logic involves extracting the base64 image string, decoding it into raw bytes, converting those bytes into a one-dimensional NumPy array, and finally reshaping it into a three-dimensional OpenCV BGR image matrix (cv2.imdecode) suitable for YOLO inference25.

Python  
import base64  
import cv2  
import numpy as np  
import uvicorn  
from fastapi import FastAPI, HTTPException  
from pydantic import BaseModel  
from ultralytics import YOLO  
from ultralytics.utils import ThreadingLocked

\# Initialize the FastAPI application framework  
app \= FastAPI(title="Watch Guard Edge Inference Triage")

\# Load the trained YOLO model into memory upon startup  
try:  
    model \= YOLO("best.pt")  
except Exception as e:  
    print(f"Fatal error loading model weights: {e}")  
    exit(1)

\# Define the expected JSON payload schema via Pydantic  
class FramePayload(BaseModel):  
    image: str \# Base64 encoded image string representing the webcam frame

\# Define the structured response schema  
class BoundingBox(BaseModel):  
    class\_name: str  
    confidence: float  
    coordinates: list

class AnalysisResponse(BaseModel):  
    status: str  
    highest\_confidence: float  
    detections: list\[BoundingBox\]

\# Thread-safe prediction wrapper to prevent memory leaks and race conditions  
@ThreadingLocked()  
def safe\_predict(image\_matrix):  
    \# conf=0.5 acts as a threshold filter, returning only high-confidence anomalies  
    return model.predict(source=image\_matrix, conf=0.5, save=False, verbose=False)

@app.post("/analyze", response\_model=AnalysisResponse)  
async def analyze\_frame(payload: FramePayload):  
    try:  
        \# Step 1: Sanitize the base64 string, stripping data URI scheme headers if present  
        base64\_data \= payload.image  
        if "," in base64\_data:  
            base64\_data \= base64\_data.split(",")\[1\]  
              
        \# Step 2: Decode the Base64 string into raw binary bytes  
        img\_bytes \= base64.b64decode(base64\_data)  
          
        \# Step 3: Transform binary bytes into a flat NumPy array of unsigned 8-bit integers  
        np\_arr \= np.frombuffer(img\_bytes, np.uint8)  
          
        \# Step 4: Decode the flat array into a spatial OpenCV BGR image matrix  
        img\_cv2 \= cv2.imdecode(np\_arr, cv2.IMREAD\_COLOR)  
          
        if img\_cv2 is None:  
            raise ValueError("Failed to decode the image matrix from the provided payload.")

        \# Step 5: Execute thread-safe YOLO inference  
        results \= safe\_predict(img\_cv2)  
          
        detected\_status \= "nominal"  
        max\_conf \= 0.0  
        bounding\_boxes \= \[\]

        \# Step 6: Parse the resulting PyTorch tensors into JSON-serializable structures  
        for result in results:  
            boxes \= result.boxes  
            for box in boxes:  
                \# Extract the class index and scalar confidence value  
                cls\_id \= int(box.cls\[0\].item())  
                conf \= box.conf\[0\].item()  
                class\_name \= model.names\[cls\_id\]  
                  
                \# Extract xywh (center x, center y, width, height) coordinates  
                xywh \= box.xywh\[0\].tolist()  
                  
                bounding\_boxes.append(BoundingBox(  
                    class\_name=class\_name,  
                    confidence=conf,  
                    coordinates=xywh  
                ))  
                  
                \# Escalate the global status if a critical anomaly is detected  
                if class\_name \== "spaghetti":  
                    detected\_status \= "failure"  
                    if conf \> max\_conf:  
                        max\_conf \= conf

        return AnalysisResponse(  
            status=detected\_status,  
            highest\_confidence=max\_conf,  
            detections=bounding\_boxes  
        )

    except Exception as e:  
        raise HTTPException(status\_code=400, detail=f"Inference failure: {str(e)}")

if \_\_name\_\_ \== "\_\_main\_\_":  
    \# Bind the ASGI server to all local interfaces on port 8000  
    uvicorn.run(app, host="0.0.0.0", port=8000)

Executed via the standard terminal command python inference\_server.py, this script establishes a highly performant, local endpoint at http\://localhost:8000/analyze. It effectively acts as the gatekeeper, silently and rapidly discarding healthy frames while remaining vigilant for mechanical aberrations.

## **Phase 4: Node.js Orchestration and Cascade Logic Integration**

The primary Node.js application serves as the central nervous system of the Watch Guard platform. It is responsible for orchestrating the flow of data: acquiring the raw webcam frame, managing the decision matrix between the local FastAPI edge server and the Groq cloud API, and executing hardware mitigation commands.  
The original prototype implementation operated inefficiently by blindly forwarding every captured frame to the Groq API. Refactoring the server.mjs script transforms this linear pipeline into a cascade logic tree. The requestAnalysis() function must route the frame to the local edge server first and evaluate the JSON response. If the edge status is nominal, the function terminates immediately, preserving bandwidth and cloud compute tokens. If the status returns as failure, the system executes a multi-pronged escalation: it invokes the Groq API for a detailed semantic analysis of the spaghetti structure, whilst concurrently firing asynchronous commands to pause the printer hardware and dispatch user notifications.

### **Integration with the Groq Vision API**

The Groq API represents a paradigm shift in cloud inference. By serving Meta's openly available Llama models on highly optimized Language Processing Unit (LPU) inference engines, Groq provides unprecedented token generation speeds, dramatically lowering the latency typically associated with large multimodal models28. The target model for this architecture is llama-3.2-11b-vision-preview, which supports multimodal image ingestion and possesses a deep contextual understanding of visual structures, making it highly adept at diagnosing mechanical failures1.  
The prompt engineered for the Groq API must be highly specific, directing the model to act as an expert forensic incident reporter. It must extract root-cause theories based strictly on the visual evidence provided by the flagged frame, ensuring the output is analytical rather than conversational.

### **Implementation of the Cascade Orchestrator**

The following JavaScript implementation illustrates the precise orchestration logic required to rewrite the core analysis loop in server.mjs. It leverages the node-fetch library for internal HTTP requests and the official groq-sdk for cloud interactions29.

JavaScript  
import fetch from 'node-fetch';  
import Groq from 'groq-sdk';  
import 'dotenv/config';

// Initialize the Groq SDK with environmental credentials  
const groq \= new Groq({ apiKey: process.env.GROQ\_API\_KEY });

// Architecture Routing Constants  
const EDGE\_INFERENCE\_URL \= 'http\://localhost:8000/analyze';  
const DISCORD\_WEBHOOK\_URL \= process.env.DISCORD\_WEBHOOK\_URL;  
const PRINTER\_IP \= process.env.PRINTER\_IP;   
const OCTOPRINT\_API\_KEY \= process.env.OCTOPRINT\_API\_KEY;

/\*\*  
 \* Orchestrates the Hybrid Cascade Inference Pipeline  
 \* @param {string} frameBase64 \- The raw, base64 encoded webcam frame  
 \*/  
async function requestAnalysis(frameBase64) {  
    try {  
        // \--- PHASE 1: LOCAL EDGE TRIAGE \---  
        const edgeResponse \= await fetch(EDGE\_INFERENCE\_URL, {  
            method: 'POST',  
            headers: { 'Content-Type': 'application/json' },  
            body: JSON.stringify({ image: frameBase64 })  
        });  
          
        if (\!edgeResponse.ok) {  
            throw new Error(\`Edge server communication failure: \${edgeResponse.statusText}\`);  
        }  
          
        const edgeData \= await edgeResponse.json();  
          
        // Conditional Termination: If nominal, halt the pipeline to conserve resources  
        if (edgeData.status \=== "nominal") {  
            return { status: "nominal", message: "Fabrication proceeding nominally." };  
        }  
          
        console.log(\`\[ALERT\] Anomaly Detected. Edge Confidence: \${edgeData.highest\_confidence}\`);

        // \--- PHASE 2: CONCURRENT HARDWARE MITIGATION \---  
        // Asynchronous fire-and-forget commands to halt physical damage instantly  
        triggerPrinterPause().catch(err \=\> console.error("Hardware pause failed:", err));  
        sendDiscordAlert(edgeData.highest\_confidence).catch(err \=\> console.error("Notification dispatch failed:", err));

        // \--- PHASE 3: CLOUD DIAGNOSTIC ESCALATION \---  
        // Invoke the Groq Vision LLM only for the specifically flagged frame  
        const incidentReport \= await generateGroqIncidentReport(frameBase64);  
          
        return {   
            status: "failure",   
            edge\_confidence: edgeData.highest\_confidence,  
            incident\_report: incidentReport   
        };

    } catch (error) {  
        console.error("Pipeline Orchestration Failure:", error);  
        return { status: "error", message: error.message };  
    }  
}

/\*\*  
 \* Invokes the Groq Vision API for deep semantic analysis of the anomaly  
 \*/  
async function generateGroqIncidentReport(base64Image) {  
    const prompt \= \`You are an expert additive manufacturing diagnostic AI. A local edge computer vision model has detected a critical print failure (e.g., severe stringing, spaghetti, or adhesion loss) in the attached image.   
    Analyze the visual evidence and generate a concise forensic incident report detailing:  
    1\. The visual severity and morphological characteristics of the failure.  
    2\. Potential root causes (e.g., poor bed adhesion, partial nozzle clog, improper Z-offset, thermal runaway).  
    3\. Actionable remediation steps the operator must take before restarting the g-code execution.\`;

    const chatCompletion \= await groq.chat.completions.create({  
        model: "llama-3.2-11b-vision-preview",  
        messages: \[  
            {  
                role: "user",  
                content: \[  
                    { type: "text", text: prompt },  
                    { type: "image\_url", image\_url: { url: \`data:image/jpeg;base64,\${base64Image}\` } }  
                \]  
            }  
        \],  
        max\_tokens: 500,  
        temperature: 0.1 // Extremely low temperature forces deterministic, highly analytical outputs  
    });

    return chatCompletion.choices\[0\].message.content;  
}

This logical flow ensures that the network latency associated with the Groq API does not delay the hardware interruption, as the triggerPrinterPause function is executed asynchronously prior to awaiting the LLM's response.

## **Phase 5: Hardware Auto-Pause and Notification Subsystems**

The physical utility of the Watch Guard system relies entirely on its ability to intervene in the real world. When the YOLO edge model flags a catastrophic failure, allowing the printer to continue extruding molten plastic wastes expensive material, creates a significant thermal and fire hazard, and frequently destroys the mechanical components of the hot-end. The Node.js application must interface directly with the 3D printer's host control software to inject a pause command into the active G-code stream. The two dominant host platforms in modern additive manufacturing are OctoPrint and Klipper (which is interfaced externally via the Moonraker web server).

### **OctoPrint REST API Integration**

OctoPrint exposes a robust, documented REST API for remote control. Job control operations, encompassing starting, pausing, restarting, and cancelling active prints, are managed via POST requests to the /api/job endpoint30. The API mandates authentication via an X-Api-Key header31.  
To safely issue a pause command, the JSON payload must specify the command key as pause. Crucially, it must also pass the optional action parameter as pause31. Without this specific action parameter, the command acts as a toggle; if the printer was already paused by the user or a runout sensor, sending the generic pause command would inadvertently resume the print, exacerbating the failure.

JavaScript  
/\*\*  
 \* Injects a hardware pause command via the OctoPrint REST API  
 \*/  
async function triggerOctoPrintPause() {  
    const url \= \`\${PRINTER\_IP}/api/job\`;  
    const response \= await fetch(url, {  
        method: 'POST',  
        headers: {  
            'Content-Type': 'application/json',  
            'X-Api-Key': OCTOPRINT\_API\_KEY  
        },  
        body: JSON.stringify({  
            command: "pause",  
            action: "pause" // Enforces idempotency to prevent accidental toggling  
        })  
    });  
      
    if (response.status \=== 204) {  
        console.log("OctoPrint successfully halted the G-code stream.");  
    } else {  
        throw new Error(\`OctoPrint pause command rejected with status: \${response.status}\`);  
    }  
}

### **Moonraker (Klipper) API Integration**

For machines running the advanced Klipper firmware, Moonraker serves as the interfacing API web server32. Unlike OctoPrint, Moonraker operates heavily on JSON-RPC but also provides RESTful endpoints for basic job control. The specific endpoint for pausing a print is POST /printer/print/pause34. When the Node.js server is operating on the same local subnet as the Moonraker instance, it is typically treated as a trusted client, meaning API keys or authorization headers are often unnecessary, though this depends on the specific moonraker.conf setup.

JavaScript  
/\*\*  
 \* Injects a hardware pause command via the Moonraker REST API  
 \*/  
async function triggerMoonrakerPause() {  
    const url \= \`\${PRINTER\_IP}/printer/print/pause\`;  
    const response \= await fetch(url, {  
        method: 'POST',  
        headers: {  
            'Content-Type': 'application/json'  
        }  
    });  
      
    if (response.ok) {  
        console.log("Moonraker successfully halted Klipper execution.");  
    } else {  
        throw new Error(\`Moonraker pause command rejected with status: \${response.status}\`);  
    }  
}

The cascade orchestrator (triggerPrinterPause()) should implement conditional routing to call either the OctoPrint or Moonraker implementation based on environment variables configuring the specific target hardware environment. Pausing via the host software is infinitely safer than utilizing a smart plug to cut power, as a controlled host pause allows the firmware to execute safe retraction moves and park the hot-end away from the plastic, preventing the nozzle from melting into the failed part.

### **Discord Webhook Alerting Subsystem**

Alerting the human operator is the final, vital step of the cascade sequence. Discord webhooks offer a frictionless, highly reliable, zero-authentication method for pushing real-time alerts directly to a mobile device or desktop environment35. By dispatching a standard POST request to the uniquely generated webhook URL containing a structured JSON payload with a content field, the system delivers immediate situational awareness.

JavaScript  
/\*\*  
 \* Dispatches a real-time push notification via Discord Webhook  
 \*/  
async function sendDiscordAlert(confidence) {  
    const formattedConfidence \= (confidence \* 100).toFixed(1);  
    const message \= \`🚨 \*\*Watch Guard Critical Alert\*\* 🚨\\nCatastrophic print anomaly (spaghetti) detected with \${formattedConfidence}% confidence. The hardware has been automatically paused to prevent damage. Cloud diagnostics are currently generating the forensic incident report.\`;  
      
    await fetch(DISCORD\_WEBHOOK\_URL, {  
        method: 'POST',  
        headers: { 'Content-Type': 'application/json' },  
        body: JSON.stringify({ content: message })  
    });  
}

## **Phase 6: Hackathon Pitch Strategy and Defensibility**

Executing a highly complex, multi-tiered architecture is only half the battle in a competitive hackathon environment; defending its utility, efficiency, and structural elegance to a panel of expert judges is equally critical. A common, highly damaging critique levied at AI software projects during hackathons is that they are merely "API wrappers"—thin, conceptually shallow applications that simply forward user input to OpenAI or Groq without demonstrating any inherent technical depth or novel engineering.  
To counteract this perception, the presentation strategy must aggressively highlight the Hybrid Cascade Inference Pipeline as a deliberate, mathematically optimized engineering solution to a very real problem in computer vision latency and cost management. The narrative arc of the pitch must follow a precise logical flow to maximize impact.  
The presentation must begin by clearly illustrating the computational waste and latency issues inherent in standard AI monitoring. Framing the problem around bandwidth highlights the inefficiency of sending a high-definition webcam frame every single second to a massive 11-billion parameter VLM. It must be emphasized that this brute-force method costs money, consumes vast amounts of tokens, and introduces a multi-second round-trip network latency. In the context of a failing CNC machine or 3D printer, two seconds of latency is the difference between saving a print and experiencing a severe hardware collision or thermal event.  
Following the problem statement, the architectural revelation is introduced. The pitch must explicitly state that Watch Guard is not a simple API wrapper, but a dual-intelligence cascade. By training a lightweight YOLOv11 Convolutional Neural Network to act as a deterministic gatekeeper operating at the extreme edge, the system processes frames locally in milliseconds for virtually zero cost.  
The strategy then moves to explaining the highly specific role of the Groq API. The Groq Llama 3.2 Vision model is positioned as the probabilistic heavy-lifter. It is only invoked during the fraction of a percent of the time the system is failing. The edge model halts the machine instantly to prevent damage, while the Groq cloud model acts exclusively as a forensic analyst, reading the wreckage to tell the user exactly why the failure occurred and how to fix it.  
Finally, the pitch must deliver an impact matrix, presenting the judges with the system's empirical metrics. The presenter must emphasize that this architecture reduces external API calls by over 99%, guarantees instantaneous hardware pauses via direct REST API manipulation of Moonraker and OctoPrint, and delivers enterprise-grade diagnostics. Explicitly listing the integrated technologies—curating custom datasets via Roboflow, training PyTorch models on Colab GPUs, mitigating GIL threading issues in async ASGI servers via FastAPI, orchestrating the cascade in Node.js, and executing real-world hardware interruptions—definitively shields the project from the "API wrapper" stigma and establishes it as a robust, full-stack engineering achievement.

#### **Works cited**

> 1. Using Llama 3.2 Locally \- KDnuggets, [https\://www\.kdnuggets.com/using-llama-3-2-locally](https://www.kdnuggets.com/using-llama-3-2-locally)  
> 2. Images and Vision \- GroqDocs \- Groq Console, [https\://console.groq.com/docs/vision](https://console.groq.com/docs/vision)  
> 3. Llama 3.2 11B by Groq on the AI Playground \- AI SDK, [https\://ai-sdk.dev/playground/groq:llama-3.2-11b-vision-preview](https://ai-sdk.dev/playground/groq:llama-3.2-11b-vision-preview)  
> 4. Launch: YOLOv8 Models on Roboflow Universe, [https\://roboflow.com/blog/yolov8-models-apis-datasets](https://roboflow.com/blog/yolov8-models-apis-datasets)  
> 5. Train YOLOv8 on Roboflow datasets and deploy it, [https\://roboflow.com/integration/yolov8](https://roboflow.com/integration/yolov8)  
> 6. 3d printer fail detection Computer Vision Model \- Roboflow Universe, [https\://universe.roboflow.com/3d-printer-spaghetti-40tbd/3d-printer-fail-detection-3mc1p](https://universe.roboflow.com/3d-printer-spaghetti-40tbd/3d-printer-fail-detection-3mc1p)  
> 7. 3d printer fail detection Computer Vision Model \- Roboflow Universe, [https\://universe.roboflow.com/3d-printer-spaghetti-40tbd/3d-printer-fail-detection-3mc1p/dataset/1](https://universe.roboflow.com/3d-printer-spaghetti-40tbd/3d-printer-fail-detection-3mc1p/dataset/1)  
> 8. 3D Printing Failure \- Roboflow Universe, [https\://universe.roboflow.com/3d-printing-failure](https://universe.roboflow.com/3d-printing-failure)  
> 9. Spaghetti 3D Object Detection Dataset by 3D printer project 2025, [https\://universe.roboflow.com/3d-printer-project-2025/spaghetti-3d-7axfb](https://universe.roboflow.com/3d-printer-project-2025/spaghetti-3d-7axfb)  
> 10. 3d printing fail detection Computer Vision Dataset \- Roboflow Universe, [https\://universe.roboflow.com/robloxplayerrecognition/3d-printing-fail-detection-4i7ou](https://universe.roboflow.com/robloxplayerrecognition/3d-printing-fail-detection-4i7ou)  
> 11. 3D Printer Failure Detection Computer Vision Dataset, [https\://universe.roboflow.com/3d-printer-failure-detection/3d-printer-failure-detection](https://universe.roboflow.com/3d-printer-failure-detection/3d-printer-failure-detection)  
> 12. Data Augmentation using Ultralytics YOLO, [https\://docs.ultralytics.com/guides/yolo-data-augmentation](https://docs.ultralytics.com/guides/yolo-data-augmentation)  
> 13. Ultralytics YOLO Data Augmentation with Albumentations, [https\://www\.ultralytics.com/blog/using-albumentations-augmentations-to-diversify-your-data](https://www.ultralytics.com/blog/using-albumentations-augmentations-to-diversify-your-data)  
> 14. How to Train YOLOv8 Object Detection on a Custom Dataset, [https\://roboflow.com/blog/how-to-train-yolov8-on-a-custom-dataset](https://roboflow.com/blog/how-to-train-yolov8-on-a-custom-dataset)  
> 15. Export a Dataset Version \- Roboflow Documentation, [https\://docs.roboflow.com/datasets/versions/dataset-versions/exporting-data](https://docs.roboflow.com/datasets/versions/dataset-versions/exporting-data)  
> 16. Ultralytics YOLO11, [https\://docs.ultralytics.com/models/yolo11](https://docs.ultralytics.com/models/yolo11)  
> 17. YOLO11 Image Classification Guide \- Ultralytics, [https\://www\.ultralytics.com/blog/how-to-use-ultralytics-yolo11-for-image-classification](https://www.ultralytics.com/blog/how-to-use-ultralytics-yolo11-for-image-classification)  
> 18. Download a Dataset \- Roboflow Documentation, [https\://docs.roboflow.com/datasets/create-and-upload/download-a-dataset](https://docs.roboflow.com/datasets/create-and-upload/download-a-dataset)  
> 19. YOLO Object Detection & Segmentation \| Ultralytics, [https\://docs.ultralytics.com/](https://docs.ultralytics.com/)  
> 20. Benchmarks \- FastAPI, [https\://fastapi.tiangolo.com/benchmarks/](https://fastapi.tiangolo.com/benchmarks/)  
> 21. Return an Image in FastAPI \- GeeksforGeeks, [https\://www\.geeksforgeeks.org/python/return-an-image-in-fastapi/](https://www.geeksforgeeks.org/python/return-an-image-in-fastapi/)  
> 22. Thread-Safe Inference with YOLO Models \| Ultralytics, [https\://docs.ultralytics.com/guides/yolo-thread-safe-inference](https://docs.ultralytics.com/guides/yolo-thread-safe-inference)  
> 23. YOLO using cuda in multiple threads · Issue \#7637 \- GitHub, [https\://github.com/ultralytics/ultralytics/issues/7637](https://github.com/ultralytics/ultralytics/issues/7637)  
> 24. Memory leak in consecutive YOLO training sessions \#21490 \- GitHub, [https\://github.com/ultralytics/ultralytics/issues/21490](https://github.com/ultralytics/ultralytics/issues/21490)  
> 25. HTTP POST base64 · Issue \#2380 \- GitHub, [https\://github.com/fastapi/fastapi/issues/2380](https://github.com/fastapi/fastapi/issues/2380)  
> 26. Building an Image Conversion and Serving API with FastAPI \- Medium, [https\://medium.com/@chodvadiyasaurabh/building-an-image-conversion-and-serving-api-with-fastapi-c000b0725e2b](https://medium.com/@chodvadiyasaurabh/building-an-image-conversion-and-serving-api-with-fastapi-c000b0725e2b)  
> 27. How to send base64 image using Python requests and FastAPI?, [https\://stackoverflow.com/questions/70710874/how-to-send-base64-image-using-python-requests-and-fastapi](https://stackoverflow.com/questions/70710874/how-to-send-base64-image-using-python-requests-and-fastapi)  
> 28. Llama API \- Groq Console, [https\://console.groq.com/landing/llama-api](https://console.groq.com/landing/llama-api)  
> 29. The official Node.js / Typescript library for the Groq API \- GitHub, [https\://github.com/groq/groq-typescript](https://github.com/groq/groq-typescript)  
> 30. Job operations \- OctoPrint next documentation, [https\://docs.octoprint.org/en/next/api/job.html](https://docs.octoprint.org/en/next/api/job.html)  
> 31. Job operations — OctoPrint main documentation, [https\://docs.octoprint.org/en/main/api/job.html](https://docs.octoprint.org/en/main/api/job.html)  
> 32. Klipper push notifications: print alerts on your phone \- Pocket Alert, [https\://pocketalert.app/blog/klipper-print-notifications](https://pocketalert.app/blog/klipper-print-notifications)  
> 33. Moonraker: API Server for Klipper Printers, [https\://theindustrialmaker.com/performance-comparisons/moonraker-api-server-klipper-printers](https://theindustrialmaker.com/performance-comparisons/moonraker-api-server-klipper-printers)  
> 34. Printer Administration \- Moonraker \- Read the Docs, [https\://moonraker.readthedocs.io/en/latest/external\_api/printer/](https://moonraker.readthedocs.io/en/latest/external_api/printer/)  
> 35. Webhook Resource \- Documentation \- Discord Developer Platform, [https\://docs.discord.com/developers/resources/webhook](https://docs.discord.com/developers/resources/webhook)
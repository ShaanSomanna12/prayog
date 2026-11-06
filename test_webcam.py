from ultralytics import YOLO

# Load your custom trained brain
model = YOLO('best.pt')

print('Opening webcam... Press q to quit.')
# Run live inference on your webcam (source=0)
model.predict(source=0, show=True, conf=0.5)

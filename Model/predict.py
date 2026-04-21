import sys
import json
import os
import numpy as np

# Suppress TensorFlow logging
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'

try:
    from tensorflow.keras.models import load_model
    from tensorflow.keras.preprocessing import image
    from tensorflow.keras.applications.mobilenet_v2 import preprocess_input
except Exception as e:
    print(json.dumps({"error": f"Failed to import tensorflow: {str(e)}"}))
    sys.exit(1)

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No image path provided."}))
        sys.exit(1)

    img_path = sys.argv[1]
    
    if not os.path.exists(img_path):
        print(json.dumps({"error": f"Image not found at {img_path}"}))
        sys.exit(1)

    model_path = os.path.join(os.path.dirname(__file__), "durian_model_clean.keras")
    if not os.path.exists(model_path):
        print(json.dumps({"error": f"Model not found at {model_path}"}))
        sys.exit(1)

    try:
        model = load_model(model_path)
    except Exception as e:
        print(json.dumps({"error": f"Failed to load model: {str(e)}"}))
        sys.exit(1)

    class_names = [
        "Leaf_Algal",
        "Leaf_Blight",
        "Leaf_Colletotrichum",
        "Leaf_Healthy",
        "Leaf_Phomopsis",
        "Leaf_Rhizoctonia"
    ]

    try:
        img = image.load_img(img_path, target_size=(224, 224))
        img_array = image.img_to_array(img)
        img_array = np.expand_dims(img_array, axis=0)
        # Note: Do NOT call preprocess_input here because it's built into the model.

        pred = model.predict(img_array, verbose=0)
        conf = float(np.max(pred))
        cls = class_names[np.argmax(pred)]

        if conf > 0.85:
            sev = "High"
        elif conf > 0.65:
            sev = "Medium"
        else:
            sev = "Low"

        # Determine category for frontend
        if cls == "Leaf_Healthy":
            category = "healthy"
        elif conf < 0.5:
            category = "warning"
        else:
            category = "disease"

        print(json.dumps({
            "disease": cls,
            "confidence": conf * 100,
            "severity": sev,
            "category": category
        }))

    except Exception as e:
        print(json.dumps({"error": f"Prediction failed: {str(e)}"}))
        sys.exit(1)

if __name__ == "__main__":
    main()

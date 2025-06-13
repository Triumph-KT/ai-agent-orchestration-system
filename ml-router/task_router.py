# ml-router/task_router.py

"""
AI Task Router Service (ML-Powered)

This service provides an intelligent routing endpoint for the main orchestration server.
It loads a pre-trained scikit-learn model to predict the optimal agent for a given
task based on historical performance data.

Architecture:
- Flask-based microservice for easy integration.
- Loads a joblib model file on startup for efficient prediction.
- Provides predictions in real-time via the '/route' endpoint.

@author Triumph Kia Teh
@version 2.0.0
"""

import joblib
import pandas as pd
from flask import Flask, request, jsonify
import json
import random

app = Flask(__name__)

# --- Load Model and Columns on Startup ---
try:
    model_pipeline = joblib.load("router_model.joblib")
    with open('model_columns.json', 'r') as f:
        model_columns = json.load(f)
    print("Machine learning model loaded successfully.")
except FileNotFoundError:
    model_pipeline = None
    model_columns = None
    print("ERROR: Model files not found. Router will not be able to make predictions.")
except Exception as e:
    model_pipeline = None
    model_columns = None
    print(f"An error occurred loading the model: {e}")


@app.route('/route', methods=['POST'])
def route_task():
    """
    Main routing endpoint. Uses the loaded ML model to predict the best agent.
    """
    if not model_pipeline:
        return jsonify({"error": "Model is not loaded, cannot process request."}), 500

    data = request.get_json()
    if not data or 'agents' not in data or 'task' not in data:
        return jsonify({"error": "Invalid request body. 'agents' and 'task' are required."}), 400

    available_agents = data['agents']
    task_to_assign = data['task']
    
    best_agent_id = None
    min_predicted_duration = float('inf')

    if not available_agents:
        return jsonify({"error": "No agents available"}), 200

    # For each available agent, create a feature set and predict the duration
    for agent in available_agents:
        # Create a single-row DataFrame for prediction
        # It must match the structure the model was trained on
        
        # We need to simulate some features that aren't passed from the server
        # In a true production system, the server would provide these.
        agent_current_load = random.randint(0, 3)
        agent_success_rate = random.uniform(0.9, 0.99)
        capability_match = 1 if task_to_assign['requiredCapabilities'][0] in agent['capabilities'] else 0

        prediction_data = {
            'agent_id': agent['id'],
            'task_type': task_to_assign['type'],
            'capability_match': capability_match,
            'agent_current_load': agent_current_load,
            'agent_success_rate': agent_success_rate,
            'task_complexity': TASK_TYPES.get(task_to_assign['type'], {}).get('complexity', 1.0)
        }

        # Create DataFrame with the correct column order
        live_df = pd.DataFrame([prediction_data], columns=model_columns)
        
        # Predict the duration using the loaded model pipeline
        predicted_duration = model_pipeline.predict(live_df)[0]
        
        print(f"Agent {agent['id']}: Predicted Duration = {predicted_duration:.2f} ms")

        if predicted_duration < min_predicted_duration:
            min_predicted_duration = predicted_duration
            best_agent_id = agent['id']

    response = {
        "best_agent_id": best_agent_id,
        "predicted_duration_ms": min_predicted_duration
    }
        
    return jsonify(response)


# --- Supporting Data (should match generate_training_data.py) ---
TASK_TYPES = {
    'text_processing': {'complexity': 1.0, 'required_capability': 'text_processing'},
    'code_generation': {'complexity': 1.5, 'required_capability': 'code_generation'},
    'data_analysis': {'complexity': 1.2, 'required_capability': 'data_analysis'},
    'image_analysis': {'complexity': 1.8, 'required_capability': 'image_analysis'}
}

if __name__ == '__main__':
    app.run(port=5001, debug=True)
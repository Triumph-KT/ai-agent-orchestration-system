# ml-router/task_router.py

"""
AI Task Router Service (ML-Powered)

This microservice provides an intelligent routing API for the main orchestration server.
It loads a pre-trained scikit-learn model on startup and uses it to predict
the optimal agent for a given task based on performance-related features.

Key Architecture:
- A lightweight Flask-based web server for easy integration.
- A single '/route' endpoint that accepts task and agent data.
- Uses a pre-trained model (`.joblib`) for efficient, real-time predictions.

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
# This block runs only once when the Flask service starts, making the model
# and column data readily available for all incoming prediction requests.
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
    The main routing endpoint. It receives a task and a list of candidate agents,
    predicts the task duration for each agent using the loaded ML model, and
    returns the ID of the agent predicted to be the fastest.
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
        return jsonify({"best_agent_id": None, "message": "No agents available for routing."}), 200

    # Iterate through each candidate agent to generate a prediction.
    for agent in available_agents:
        # To make a prediction, we must construct a feature set (a DataFrame row)
        # that exactly matches the structure the model was trained on.
        
        # NOTE: In a full production system, metrics like agent load and success rate
        # would be tracked by the orchestrator and passed in the API call.
        # Here, we simulate them to provide the model with the necessary features.
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

        # Create a single-row DataFrame with columns in the correct order.
        live_df = pd.DataFrame([prediction_data], columns=model_columns)
        
        # Use the loaded model pipeline to predict the task duration.
        predicted_duration = model_pipeline.predict(live_df)[0]
        
        print(f"Agent {agent['id']}: Predicted Duration = {predicted_duration:.2f} ms")

        # Track the agent with the lowest predicted completion time.
        if predicted_duration < min_predicted_duration:
            min_predicted_duration = predicted_duration
            best_agent_id = agent['id']

    response = {
        "best_agent_id": best_agent_id,
        "predicted_duration_ms": min_predicted_duration
    }
        
    return jsonify(response)


# --- Supporting Data ---
# A simple configuration map to look up metadata about task types.
# This should be consistent with the data used in generate_training_data.py.
TASK_TYPES = {
    'text_processing': {'complexity': 1.0, 'required_capability': 'text_processing'},
    'code_generation': {'complexity': 1.5, 'required_capability': 'code_generation'},
    'data_analysis': {'complexity': 1.2, 'required_capability': 'data_analysis'},
    'image_analysis': {'complexity': 1.8, 'required_capability': 'image_analysis'}
}

# Standard Python entry point. This block runs when the script is executed directly.
if __name__ == '__main__':
    # Starts the Flask development server. In a production environment,
    # a proper WSGI server like Gunicorn or uWSGI would be used.
    app.run(port=5001, debug=False)
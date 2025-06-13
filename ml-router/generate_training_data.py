# ml-router/generate_training_data.py

"""
Synthetic Data Generation Script for ML Router Training

This script creates a synthetic dataset to train the machine learning model
for the AI Task Router. Since no real-world historical data exists for this new
system, we generate a realistic dataset by simulating thousands of task assignments.

The simulation models how different factors (agent skills, task complexity,
agent load) would likely influence the time it takes to complete a task.
The resulting CSV file is the input for the `train_model.ipynb` notebook.
"""

import csv
import random
import time

# --- Configuration ---
NUM_SAMPLES = 5000
OUTPUT_FILE = 'training_data.csv'

# --- Simulation Parameters ---
# Defines the profile of each agent, including their unique skills and a
# base speed multiplier (lower is faster).
AGENT_PROFILES = {
    'agent_1': {'capabilities': ['text_processing', 'data_analysis'], 'base_speed': 1.0},
    'agent_2': {'capabilities': ['code_generation', 'text_processing'], 'base_speed': 1.2},
    'agent_3': {'capabilities': ['image_analysis', 'data_analysis'], 'base_speed': 0.9}
}

# Defines the properties of each task type, including its inherent complexity
# and the primary skill required to perform it efficiently.
TASK_TYPES = {
    'text_processing': {'complexity': 1.0, 'required_capability': 'text_processing'},
    'code_generation': {'complexity': 1.5, 'required_capability': 'code_generation'},
    'data_analysis': {'complexity': 1.2, 'required_capability': 'data_analysis'},
    'image_analysis': {'complexity': 1.8, 'required_capability': 'image_analysis'}
}

# --- Data Generation Logic ---
def generate_data_point():
    """
    Generates a single, realistic row of simulated training data by pairing
    a random agent with a random task and calculating a plausible completion time.
    
    Returns:
        dict: A dictionary representing one row of data for the CSV file.
    """
    
    # 1. Randomly select an agent and a task for this data point.
    agent_id = random.choice(list(AGENT_PROFILES.keys()))
    agent = AGENT_PROFILES[agent_id]
    
    task_type = random.choice(list(TASK_TYPES.keys()))
    task = TASK_TYPES[task_type]
    
    # 2. Engineer the feature values based on this random pairing.
    # 'capability_match' is a critical feature: does the agent have the right skill?
    capability_match = 1 if task['required_capability'] in agent['capabilities'] else 0
    
    # Simulate other real-world agent metrics that would affect performance.
    agent_current_load = random.randint(0, 3) # 0 = idle, 3 = very busy
    agent_success_rate = random.uniform(0.90, 0.99)
    
    # 3. Calculate the outcome (the 'duration_ms' target variable).
    # This logic aims to create a pattern for the ML model to learn.
    
    # Start with a base duration determined by task difficulty and agent's raw speed.
    base_duration = task['complexity'] * agent['base_speed'] * 2000 # Base time in ms
    
    # The agent's skill match has the biggest impact on duration.
    if capability_match == 0:
        # Agent attempting a task without the right skill incurs a significant time penalty.
        duration_modifier = 3.0 
    else:
        # Agent has the right skill, so it's efficient.
        duration_modifier = 1.0
        
    # The agent's current load has a smaller, linear impact on performance.
    load_modifier = 1 + (agent_current_load * 0.15)
    
    # Combine the factors and add some random noise to make the data less perfect and more realistic.
    final_duration = base_duration * duration_modifier * load_modifier
    final_duration *= random.uniform(0.9, 1.1)
    
    # Return the complete record for this simulated event.
    return {
        'agent_id': agent_id,
        'task_type': task_type,
        'capability_match': capability_match,
        'agent_current_load': agent_current_load,
        'agent_success_rate': round(agent_success_rate, 4),
        'task_complexity': task['complexity'],
        'duration_ms': int(final_duration)
    }

# --- Main Execution Block ---
# This code runs only when the script is executed directly from the command line.
if __name__ == "__main__":
    print(f"Generating {NUM_SAMPLES} samples for training data...")
    start_time = time.time()
    
    # Open the output CSV file for writing.
    with open(OUTPUT_FILE, 'w', newline='') as f:
        # Define the column headers for the CSV file.
        fieldnames = [
            'agent_id', 
            'task_type', 
            'capability_match', 
            'agent_current_load', 
            'agent_success_rate', 
            'task_complexity', 
            'duration_ms'
        ]
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        
        # Loop to generate and write the specified number of samples.
        for i in range(NUM_SAMPLES):
            writer.writerow(generate_data_point())
            
    end_time = time.time()
    print(f"Successfully generated '{OUTPUT_FILE}' in {end_time - start_time:.2f} seconds.")
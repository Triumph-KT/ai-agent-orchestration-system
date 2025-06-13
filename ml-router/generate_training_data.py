# ml-router/generate_training_data.py

import csv
import random
import time

# --- Configuration ---
NUM_SAMPLES = 5000
OUTPUT_FILE = 'training_data.csv'

# --- Simulation Parameters ---
AGENT_PROFILES = {
    'agent_1': {'capabilities': ['text_processing', 'data_analysis'], 'base_speed': 1.0},
    'agent_2': {'capabilities': ['code_generation', 'text_processing'], 'base_speed': 1.2},
    'agent_3': {'capabilities': ['image_analysis', 'data_analysis'], 'base_speed': 0.9}
}

TASK_TYPES = {
    'text_processing': {'complexity': 1.0, 'required_capability': 'text_processing'},
    'code_generation': {'complexity': 1.5, 'required_capability': 'code_generation'},
    'data_analysis': {'complexity': 1.2, 'required_capability': 'data_analysis'},
    'image_analysis': {'complexity': 1.8, 'required_capability': 'image_analysis'}
}

# --- Data Generation Logic ---
def generate_data_point():
    """Generates a single row of simulated training data."""
    
    # 1. Select a random agent and task
    agent_id = random.choice(list(AGENT_PROFILES.keys()))
    agent = AGENT_PROFILES[agent_id]
    
    task_type = random.choice(list(TASK_TYPES.keys()))
    task = TASK_TYPES[task_type]
    
    # 2. Engineer features based on the agent-task pair
    capability_match = 1 if task['required_capability'] in agent['capabilities'] else 0
    
    # Simulate other agent metrics
    agent_current_load = random.randint(0, 3) # 0 = idle, 3 = very busy
    agent_success_rate = random.uniform(0.90, 0.99)
    
    # 3. Calculate the outcome (duration) - This is our target variable
    # Start with a base duration influenced by task complexity and agent speed
    base_duration = task['complexity'] * agent['base_speed'] * 2000 # in ms
    
    # Capability match has the biggest impact
    if capability_match == 0:
        # Agent doesn't have the skill, so it's much slower (or fails)
        duration_modifier = 3.0 
    else:
        # Agent has the skill, so it's efficient
        duration_modifier = 1.0
        
    # Load has a smaller impact
    load_modifier = 1 + (agent_current_load * 0.15)
    
    # Calculate final duration with some random noise
    final_duration = base_duration * duration_modifier * load_modifier
    final_duration *= random.uniform(0.9, 1.1) # Add noise
    
    return {
        'agent_id': agent_id,
        'task_type': task_type,
        'capability_match': capability_match,
        'agent_current_load': agent_current_load,
        'agent_success_rate': round(agent_success_rate, 4),
        'task_complexity': task['complexity'],
        'duration_ms': int(final_duration)
    }

# --- Main Execution ---
if __name__ == "__main__":
    print(f"Generating {NUM_SAMPLES} samples for training data...")
    start_time = time.time()
    
    with open(OUTPUT_FILE, 'w', newline='') as f:
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
        
        for i in range(NUM_SAMPLES):
            writer.writerow(generate_data_point())
            
    end_time = time.time()
    print(f"Successfully generated '{OUTPUT_FILE}' in {end_time - start_time:.2f} seconds.")
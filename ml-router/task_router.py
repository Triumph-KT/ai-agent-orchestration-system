# ml-router/task_router.py

"""
AI Task Router Service

This service provides an intelligent routing endpoint for the main orchestration server.
It accepts a task and a list of available agents, then uses a scoring model
to determine the optimal agent for the task.

Architecture:
- Flask-based microservice for easy integration.
- A single '/route' endpoint for decision making.
- Implements the same performance-based scoring heuristic as the main server,
  creating an extensible intelligence layer.

@author Triumph Kia Teh
@version 1.0.0
"""

import time
from flask import Flask, request, jsonify

app = Flask(__name__)

def get_priority_value(priority_str):
    """Converts priority string to a numeric value."""
    priority_map = {
        'low': 1,
        'normal': 2,
        'high': 3,
        'urgent': 4
    }
    return priority_map.get(priority_str, 2)

def calculate_task_agent_score(task, agent):
    """
    Calculates a compatibility score between a task and an agent.
    This is a direct Python implementation of the heuristic model
    from the Node.js AgentManager.
    """
    score = 0
    
    # 1. Capability Matching Bonus: Check if agent has all required capabilities.
    task_reqs = set(task.get('requiredCapabilities', []))
    agent_caps = set(agent.get('capabilities', []))
    
    if not task_reqs.issubset(agent_caps):
        return -1 # Agent is not qualified for this task.

    score += len(task_reqs) * 20

    # 2. Load Balancing Bonus: Prefer agents that have been idle longer.
    last_task_ms = agent.get('lastTaskCompletedAt', 0)
    if last_task_ms:
        # Assuming lastTaskCompletedAt is a millisecond timestamp
        time_since_last_task_sec = (time.time() * 1000 - last_task_ms) / 1000
        score += min(time_since_last_task_sec, 100)
    else:
        # Agent has never completed a task, give max bonus
        score += 100
        
    # 3. Task Priority Bonus: Add weight for high-priority tasks.
    if get_priority_value(task.get('priority', 'normal')) >= 3:
        score += 50
        
    return score

@app.route('/route', methods=['POST'])
def route_task():
    """
    Main routing endpoint. Receives agent and task data, returns the best agent.
    """
    data = request.get_json()
    
    if not data or 'agents' not in data or 'task' not in data:
        return jsonify({"error": "Invalid request body. 'agents' and 'task' are required."}), 400

    available_agents = data['agents']
    task_to_assign = data['task']
    
    best_agent = None
    max_score = -1

    if not available_agents:
        return jsonify({"error": "No agents available"}), 200

    for agent in available_agents:
        score = calculate_task_agent_score(task_to_assign, agent)
        print(f"Agent {agent.get('id')} scored {score} for task {task_to_assign.get('id')}")
        if score > max_score:
            max_score = score
            best_agent = agent

    if best_agent:
        response = {
            "best_agent_id": best_agent.get('id'),
            "score": max_score
        }
    else:
        response = {
            "best_agent_id": None,
            "message": "No suitable agent found for the task requirements."
        }
        
    return jsonify(response)

if __name__ == '__main__':
    # Runs the Flask server on port 5001 in debug mode.
    # The port is different from the main server to avoid conflicts.
    app.run(port=5001, debug=True)

    
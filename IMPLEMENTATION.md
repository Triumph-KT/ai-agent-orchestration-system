# Implementation Specifications

---
***author: Triumph Kia Teh***
---

This document provides the implementation-specific details for the AI Agent Orchestration System, referencing the project's [Requirements](README.md) and [Architecture](ARCHITECTURE.md). The final product is a **full-stack, multi-service, containerized application** that demonstrates a complete, end-to-end workflow for intelligent AI task management. The system is architected using modern, production-ready principles, including microservices, data-driven decision-making, and containerized deployment. We focus on the core implementation details: data structures, control flow, API definitions, error handling, and the testing plan.

---

## Final System Overview

The core components are:
* **A Node.js Orchestration Server** that manages state and communication via WebSockets.
* **A Python ML Router Service** that uses a trained Scikit-learn model to predict optimal task assignments.
* **A fleet of Node.js Agents** that execute real tasks using the **GPT-4 API**.
* **Two distinct web interfaces:** a `client.html` for user interaction and a `dashboard.html` for system monitoring.
* **A Docker Compose setup** that builds and launches the entire backend with a single command.

---

## Iterative Development Log (Branch-by-Branch)

The project was developed following a professional, iterative Git workflow. Each major feature was built on its own dedicated branch to ensure stability and isolation.

### 1. `main` Branch (Initial MVP)
* **Goal:** Establish a functional Minimum Viable Product.
* **Implementation:**
    * A core Node.js WebSocket server was created to manage agent connections.
    * A basic in-memory task queue and agent manager were implemented.
    * Initial routing logic was based on a simple heuristic score calculated within the Node.js server.
    * A command-line test agent script was created to simulate agent behavior.

### 2. `feature/true-ml-router` Branch
* **Goal:** Upgrade the routing logic from a simple heuristic to a data-driven machine learning model.
* **Implementation:**
    * A new Python microservice was created using **Flask**.
    * A `generate_training_data.py` script was built to create a synthetic dataset of 5,000 task completions.
    * A `train_model.ipynb` Jupyter Notebook was used to load the data with **Pandas** and train a `RandomForestRegressor` model with **Scikit-learn** to predict task durations.
    * The trained model was saved to `router_model.joblib`.
    * The Flask API was upgraded to load the saved model and use it for live predictions.
    * The main Node.js orchestrator was modified to call this Python service via an HTTP request for all routing decisions.

### 3. `feature/gpt4-agents` Branch
* **Goal:** Upgrade the simulated agents to perform real work using the GPT-4 API.
* **Implementation:**
    * The `test-agents` project was updated with the `openai` and `dotenv` packages.
    * The agent logic in `simple-agent.js` was rewritten to construct prompts based on task payloads and make real API calls to `gpt-4`.
    * The mock processing delay was replaced with the actual latency of the OpenAI API call.
    * A robust heartbeat mechanism was implemented to prevent agents from being marked 'offline' during long-running GPT-4 requests.

### 4. `feature/user-input-ui` Branch
* **Goal:** Build a complete, end-to-end user experience with polished web interfaces.
* **Implementation:**
    * The original dashboard concept was split into two distinct UIs for clarity:
        1.  **`dashboard.html`:** A dedicated monitoring dashboard for administrators to see system-wide metrics and live agent statuses.
        2.  **`client.html`:** A user-facing application for submitting new tasks and viewing a history of responses.
    * The server was updated to broadcast task completion events to update the client UI in real-time.
    * The client UI JavaScript was enhanced to create a running history of prompts and their corresponding GPT-4 answers.

### 5. `feature/docker-deployment` Branch
* **Goal:** Package the entire multi-language backend for easy, reliable, one-command deployment.
* **Implementation:**
    * A `Dockerfile` was created for the Node.js orchestrator service.
    * A `Dockerfile` was created for the Python ML router service.
    * A root `docker-compose.yml` file was written to define and link the two services.
    * The server's code was updated to use Docker's internal service networking (`http://router:5001`).
    * Volume mounts were configured to make the UI files available to the server and to persist log files from inside the container to the host machine.

---

## Data-Driven Routing Implementation

The final routing mechanism is powered by a machine learning model trained to predict task duration.

* **Model Type:** `RandomForestRegressor` from Scikit-learn.
* **Features Used for Training:**
    ```
    - agent_id (One-Hot Encoded)
    - task_type (One-Hot Encoded)
    - capability_match (1 or 0)
    - agent_current_load (Simulated)
    - agent_success_rate (Simulated)
    - task_complexity (Pre-defined)
    ```
* **Target Variable:** `duration_ms`
* **Evaluation:** The model achieved a **Mean Absolute Error of ~400ms** on the test set, indicating it is highly effective at predicting the relative speed of different agents for different tasks.

---

## Data Structures

The system relies on several core in-memory data structures within the Node.js **Orchestration Server** to manage state in real-time.

* **AgentManager (`agentManager.js`):**
    * `agents`: A **Map** to provide O(1) access to agent objects using their unique ID as the key. `agentId -> agentObject`.
    * `capabilities`: A **Map of Sets** used as a reverse index for O(1) lookup of agents with a specific skill. `capability -> Set<agentId>`.

* **TaskQueue (`taskQueue.js`):**
    * `tasks`: A **Map** holding the complete data for every task, keyed by task ID. `taskId -> taskObject`.
    * `pendingTasks`: An **Array**, maintained in sorted order of priority, holding the IDs of tasks waiting for assignment. This acts as a priority queue.
    * `activeTasks`: A **Map** tracking tasks currently being processed. `taskId -> agentId`.
    * `taskHistory`: An **Array** acting as a sliding-window log of completed tasks, used for calculating system statistics and providing a data source for future model retraining.

## Control Flow

The system operates as a set of coordinated services. The primary control flow is event-driven, managed by the Orchestration Server.

### Main Orchestration Flow (`server.js`)

The server initializes all modules and then enters an event loop, listening for WebSocket messages and HTTP requests.

**Pseudocode for `server.start()`:**
```
initialize Express server
initialize WebSocket server and attach to HTTP server
initialize AgentManager
initialize TaskQueue
setup API routes (/api/tasks, /api/status)
setup WebSocket message handlers
setup periodic tasks (heartbeat checks, stats broadcasts)
start listening for connections on port 8080
```

### WebSocket Message Handling (`server.js: handleMessage`)

This is the central router for all real-time communication.

**Pseudocode:**
```
upon receiving a WebSocket message:
  parse the message as JSON
  switch on message.type:
    case 'agent_register':
      call handleAgentRegistration(ws, data)
    case 'agent_status':
      call handleAgentStatus(agentId, status)
    case 'task_result':
      call handleTaskResult(data)
    case 'dashboard_connect':
      flag connection as a dashboard client
      send initial state to the new dashboard
```

### Task Assignment Flow (`server.js: tryAssignTask`)

This is the core logic that matches an idle agent with a pending task.

**Pseudocode:**
```
given an idle agentId:
  get the full agent object from AgentManager
  if agent is not idle, return
  
  ask TaskQueue for the next available task matching the agent's capabilities
  if no suitable task exists, return

  update agent status to 'busy' in AgentManager
  update task state to 'assigned' in TaskQueue
  send 'task_assignment' message to the agent via WebSocket
```

### ML Routing Flow (`task_router.py: /route`)

The Python service exposes a single endpoint to make intelligent routing decisions.

**Pseudocode:**
```
upon receiving a POST request to /route:
  get JSON data containing 'task' and available 'agents'
  
  initialize best_agent to null and min_duration to infinity
  
  for each agent in available 'agents':
    construct a feature vector (DataFrame row) for the agent-task pair
    use the loaded Scikit-learn model to predict the task duration
    
    if predicted_duration < min_duration:
      update min_duration
      update best_agent to the current agent
  
  return the ID of the best_agent as a JSON response
```

## API and Protocol Definitions

### REST API

* **`POST /api/tasks`**: Submits a new task to the orchestrator.
    * **Body:** A JSON object with `type` and `payload`.
    * **Response:** `{ "success": true, "taskId": "..." }`

* **`GET /api/status`**: Retrieves system-wide health and metrics.
    * **Response:** A JSON object containing agent and task statistics.

### WebSocket Protocol

* **Client -> Server:**
    * `{ "type": "agent_register", "capabilities": [...] }`: An agent introduces itself.
    * `{ "type": "agent_status", "agentId": "...", "status": "..." }`: An agent reports its status (used for heartbeats).
    * `{ "type": "task_result", "taskId": "...", "result": {...} }`: An agent returns the result of a completed task.
    * `{ "type": "dashboard_connect" }`: A UI identifies itself as a dashboard to receive broadcasts.

* **Server -> Client:**
    * `{ "type": "registration_success", "agentId": "..." }`: Server confirms registration and assigns an ID.
    * `{ "type": "task_assignment", "task": {...} }`: Server assigns a task to a specific agent.
    * `{ "type": "stats_update", ... }`: Server broadcasts system-wide stats to dashboards.
    * `{ "type": "task_completed", "taskId": "...", "result": {...} }`: Server broadcasts a specific task's result to UIs.

## Error Handling and Recovery

* **Agent Disconnection:** The `ws.on('close')` handler immediately removes the agent from the `AgentManager`, ensuring it is not assigned new tasks.
* **Heartbeat Timeout:** A periodic `setInterval` task in `server.js` checks the `lastHeartbeat` timestamp of each agent. If an agent has been silent for over 60 seconds, it is marked 'offline' and removed from the pool of available workers.
* **API Errors:** All primary message and route handlers are wrapped in `try...catch` blocks to prevent the server from crashing due to malformed input. Errors are logged to the console.
* **ML Router Failure:** If the Node.js server fails to get a response from the Python router service, it logs an error and the task simply remains in the queue to be assigned later, ensuring no work is lost.

## Testing Plan

A multi-layered testing strategy was used to validate the system.

### 1. Manual UI Testing
* **Method:** The `client.html` interface was used to manually submit tasks of different types (`text_processing`, `code_generation`, etc.) with various prompts.
* **Purpose:** To validate the complete end-to-end user journey, from form submission to the final GPT-4 result being displayed in the history panel. This also confirmed the live status updates on the `dashboard.html` page.

### 2. Automated Stress Testing
* **Method:** A bash script, `stress_test.sh`, was created to submit 20 tasks to the `/api/tasks` endpoint in rapid succession.
* **Purpose:** To verify the system's performance under load. This test specifically validates that:
    * All agents can work in parallel.
    * The `TaskQueue` correctly queues tasks when all agents are busy.
    * The orchestrator correctly assigns queued tasks as agents become available.
    * The system remains stable and responsive under a heavy workload.

### 3. Model Evaluation
* **Method:** The machine learning model was evaluated within the `train_model.ipynb` Jupyter Notebook.
* **Purpose:** To validate the model's accuracy before deployment. Using a train-test split, the model's Mean Absolute Error (MAE) was calculated to be ~400ms, proving its effectiveness at predicting task durations.

### 4. Containerized Environment Testing
* **Method:** The entire application was run using `docker-compose up`. All manual and automated tests were re-run against the containerized services.
* **Purpose:** To confirm that the application is correctly configured for deployment and that all inter-service communication (Node.js -> Python) and volume mounts (for UIs and logs) function as expected.

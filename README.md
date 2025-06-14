# AI Agent Orchestration System

A full-stack, containerized application demonstrating a real-time, distributed system for coordinating a fleet of AI agents. The system features an intelligent, machine-learning-powered router that assigns tasks to the optimal GPT-4 agent based on predicted performance.

---

***author: Triumph Kia Teh***

---

## 🎥 Live Demo

A complete walkthrough of the system, from submitting tasks via the UI to stress-testing the containerized backend.

**[Watch the Full Demo on YouTube]**[AI-Ochestrator-System-YouTube](https://youtu.be/kqTNjzzjrQw)

---

## Key Components

* **Orchestration Server (Node.js/Express):** The central "nervous" system, managing agent connections, a priority task queue, and system state via WebSockets.
* **ML Task Router (Python/Flask/Scikit-learn):** A separate microservice that uses our trained regression model to predict the fastest agent for a given task, ensuring efficient distribution of work.
* **GPT-4 Agents (Node.js):** A fleet of worker agents that perform real AI tasks by processing prompts with the OpenAI GPT-4 API.
* **Web Interfaces (HTML/CSS/JS):** Two distinct UIs: a client-facing portal for submitting tasks and viewing results, and a monitoring dashboard for observing system-wide health and performance in real-time.
* **Containerized Deployment (Docker):** The entire multi-language backend is containerized using Docker and managed with Docker Compose, allowing for a consistent, one-command launch on any machine.

---

## Accessing the Application

With the system running via Docker, the UIs are available in your browser:

* **Client UI (for submitting tasks):** `http://localhost:8080/client.html`
* **Monitoring Dashboard:** `http://localhost:8080/dashboard.html`

---

## Final Architecture

```
┌────────────────────────────────────────────────────────────┐
│                      End User / Admin                      │
└───────────┬──────────────────────────────────┬─────────────┘
            │ HTTP/S                           │ WebSocket
┌───────────▼──────────┐           ┌───────────▼──────────┐
│     Client UI        │           │ Monitoring Dashboard │
│ (client.html)        │           │  (dashboard.html)    │
└──────────────────────┘           └──────────────────────┘
            │ REST API (Tasks)                 │ WebSocket (Live Stats)
┌───────────▼──────────────────────────────────▼───────────┐
│ DOCKERIZED ENVIRONMENT (Docker Compose)                  │
│                                                          │
│ ┌────────────────────┐   HTTP    ┌─────────────────────┐ │
│ │ Orchestrator       ├──────────►│ ML Router           │ │
│ │ (Node.js)          │ (Routing) │ (Python/Flask)      │ │
│ │ - Agent Manager    │           │ - Scikit-learn Model│ │
│ │ - Task Queue       │           └─────────────────────┘ │
│ └───────┬────────────┘                                   │
│         │ WebSocket (Assignments & Heartbeats)           │
│ ┌───────▼────────────┐                                   │
│ │ GPT-4 Agent Fleet  │  HTTPS  ┌───────────────────────┐  │
│ │ (Node.js)          ├────────►│    OpenAI API       │  │
│ │ - Agent 1          │         │       (GPT-4)       │  │
│ │ - Agent 2          │         └───────────────────────┘  │
│ │ - Agent 3          │                                    │
│ └────────────────────┘                                   │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

---

## Quick Start

### Prerequisites
* **Docker Desktop:** Must be installed and running on your machine.
* **OpenAI API Key:** You must have a valid API key from OpenAI.

### 1. Configuration

1.  Clone the repository.
2.  Navigate into the `test-agents` directory.
3.  Create a file named `.env`.
4.  Add your OpenAI API key to this file like so:
    ```
    OPENAI_API_KEY=your_secret_api_key_here
    ```

### 2. Running the System

The entire application is launched with a single command.

1.  From the project's **root directory**, run:
    ```bash
    docker-compose up --build
    ```
    This will build the container images and start the Orchestrator and ML Router services.

2.  In a **new terminal window**, start the AI agents:
    ```bash
    # Navigate to the test-agents directory
    cd test-agents

    # Start the agents
    node simple-agent.js
    ```

3.  Open your web browser and navigate to `http://localhost:8080/client.html` to begin submitting tasks.

---

## Testing

An automated stress test script is included to demonstrate the system's ability to handle a large queue of tasks.

1.  Ensure the system is running via `docker-compose up` and the test agents are running.
2.  From the project's **root directory**, first make the script executable:
    ```bash
    chmod +x stress_test.sh
    ```
3.  Then, run the script:
    ```bash
    ./stress_test.sh
    ```
4.  Watch the **Monitoring Dashboard** at `http://localhost:8080/dashboard.html` to see the system process the queue in real-time.

---

## Technology Stack

* **Backend:** Node.js, Express, WebSockets, Python, Flask
* **AI & Machine Learning:** OpenAI GPT-4, Scikit-learn, Pandas
* **Frontend:** HTML5, CSS3, Vanilla JavaScript
* **Deployment & DevOps:** Docker, Docker Compose

---

*Built as part of the Moccet AI technical assessment.*

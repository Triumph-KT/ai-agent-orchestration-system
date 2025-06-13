# Architecture Decisions & Design Rationale

---
***author: Triumph Kia Teh***
---

## Executive Summary

This document outlines the key architectural decisions made in designing the AI Agent Orchestration System. The final product is a full-stack, containerized, multi-service application that demonstrates a sophisticated, scalable, and intelligent approach to managing distributed AI workloads. The architecture was designed to be robust, performant, and ready for a real-world production environment.

## Core Architecture Philosophy

The system is built on an **event-driven, microservice architecture**, emphasizing:
- **Real-time Performance**: Sub-second latency for all critical orchestration operations.
- **Intelligence**: Data-driven task routing using a dedicated machine learning service.
- **Scalability & Portability**: A containerized design using Docker allows the system to run on any machine and scale individual services independently.
- **Fault Tolerance**: Graceful degradation and automatic recovery from agent failures.

---
## Key Architectural Decisions

### 1. WebSocket-First Communication Strategy
**Decision**: Use **WebSocket** as the primary, real-time communication protocol between the orchestration server and the fleet of AI agents.

**Rationale**:
- **Real-time Requirement**: Moccet's prompt specified sub-second latency, which WebSockets provide through a persistent, low-overhead connection.
- **Bidirectional Communication**: The architecture requires the server to push task assignments to agents and agents to report their status back. WebSocket is a natural fit for this two-way communication.
- **Efficiency**: A single TCP connection is maintained, eliminating the repetitive overhead of HTTP handshakes for frequent status updates.

### 2. Decoupled, ML-Powered Routing Service
**Decision**: The core routing intelligence is encapsulated in a dedicated **Python microservice**, separate from the main Node.js orchestrator.

**Architecture**:
- The **Orchestration Server (Node.js)** determines the pool of available, capable agents for a new task.
- It sends the task details and the list of candidate agents to the **ML Router Service (Python/Flask)** via an HTTP request.
- The Python service loads a pre-trained **Scikit-learn model** (`RandomForestRegressor`) to predict the task completion time for each candidate agent.
- It returns the ID of the agent with the lowest predicted duration, which is the optimal choice.

**Rationale**:
- **Separation of Concerns**: The Node.js server excels at handling high-concurrency I/O (like thousands of WebSocket connections), while Python is the industry standard for machine learning. This architecture allows each service to use the best tool for the job.
- **Independent Scalability**: In a production environment, we could scale the ML Router service to handle more complex models or a higher volume of requests, without affecting the main orchestration server.

### 3. Multi-Service Containerized Deployment
**Decision**: The entire backend, consisting of the Node.js orchestrator and the Python router, is containerized using **Docker** and managed by **Docker Compose**.

**Architecture**:
- A `Dockerfile` for the `orchestrator` service packages the Node.js application and its dependencies.
- A `Dockerfile` for the `router` service packages the Python application, its dependencies, and the trained ML model.
- A root `docker-compose.yml` file defines both services and connects them on a shared Docker network, allowing them to communicate via service names (e.g., `http://router:5001`).

**Rationale**:
- **Portability & Consistency**: Anyone with Docker installed can launch the entire multi-language application with a single command (`docker-compose up`). This eliminates "works on my machine" problems and makes setup for the Moccet team trivial.
- **Production Readiness**: This demonstrates a professional workflow and an understanding of modern DevOps and deployment practices.

### 4. Real AI Workload Processing (GPT-4 Agents)
**Decision**: The agents are not just simulations; they are clients that process tasks by making live API calls to the **OpenAI GPT-4 model**.

**Architecture**:
- The `test-agents` script initializes a fleet of agents, each with its own capabilities.
- When an agent receives a task, it constructs a specific prompt based on the task payload.
- It makes an `async` call to the GPT-4 API and waits for the response.
- The actual response from the language model is returned as the task result. A robust heartbeat mechanism ensures the agent remains connected to the orchestrator during these potentially long-running API calls.

**Rationale**:
- **Real-World Validation**: This proves the system can handle real, asynchronous AI workloads and is not just a theoretical exercise. It directly addresses the "Simulate agents with GPT-4" requirement in the prompt.

### 5. In-Memory State Management
**Decision**: The orchestrator's state (active agents, task queues) is managed in-memory for maximum performance.

**Architecture**:
- Highly-optimized JavaScript `Map` and `Set` objects are used to provide O(1) or near-O(1) lookup times for agents and capabilities.
- A priority array is used for the task queue, which is highly efficient for the expected number of pending tasks.

**Rationale**:
- **Performance**: This avoids the latency of database I/O on the critical path of task assignment.
- **Design for Extension**: The system is designed such that this in-memory layer could be swapped out for a distributed cache like Redis in a future, multi-node scaling scenario.

### 6. Fault-Tolerant Agent Management
**Decision**: Implement a comprehensive agent health monitoring system with automatic recovery.

**Architecture**:
- The orchestrator runs a periodic `setInterval` job to check the `lastHeartbeat` timestamp of every agent.
- If an agent is silent for longer than the configured timeout (60 seconds), it is marked as `offline` and removed from the pool of available agents.
- The agents themselves send a status update every 15 seconds to check in, even when busy with a long-running GPT-4 task.

**Rationale**:
- This ensures the system is resilient to agent crashes or network failures. A single failing agent will not bring down the entire system or block the queue.

---
## Cross-Cutting Concerns

* **Monitoring & Observability**: The system exposes two distinct web interfaces for observability. A `client.html` provides a user-facing portal to submit tasks and view a history of results. A `dashboard.html` provides a system-wide, real-time view of all agent statuses and core metrics, intended for an administrator.
* **Security**: API keys are managed securely using `.env` files, which are excluded from the Git repository.
* **Testing**: A multi-layered testing strategy was used, combining manual UI testing, automated backend stress testing (`stress_test.sh`), and ML model evaluation in a Jupyter Notebook.

---
## Conclusion

This architecture represents a modern, robust, and scalable solution for AI agent orchestration. By decoupling the core logic into containerized microservices, employing a data-driven ML model for routing, and processing real AI workloads with GPT-4, the system successfully meets and exceeds all requirements of the Moccet challenge. It is not just a functional prototype, but a production-ready foundation for a real-world product.
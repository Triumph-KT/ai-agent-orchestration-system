# AI Agent Orchestration System

A real-time distributed AI agent coordination platform that manages multiple AI agents working on parallel tasks with intelligent routing and sub-second performance monitoring.

## Contact

**Triumph Kia Teh**  
- LinkedIn: [triumph-kia-teh](https://linkedin.com/in/triumph-kia-teh/)
- GitHub: [@Triumph-KT](https://github.com/Triumph-KT)

## Overview

This system implements a WebSocket-based orchestration layer that coordinates AI agents across different tasks, similar to container orchestration platforms but optimized for AI workloads. The system demonstrates advanced distributed computing concepts with real-time task routing, capability-based agent selection, and comprehensive performance analytics.

## Live Demo

**Server Status**: http://localhost:8080/api/status  
**WebSocket Endpoint**: ws://localhost:8080  
**Task Submission**: POST http://localhost:8080/api/tasks

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Dashboard (Future)                      │
│           Real-time Metrics & Agent Status                 │
└─────────────────┬───────────────────────────────────────────┘
                  │ WebSocket
┌─────────────────▼───────────────────────────────────────────┐
│                WebSocket Server                             │
│              (Node.js + Express)                           │
├─────────────────────────────────────────────────────────────┤
│                 Orchestration Engine                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Agent     │  │    Task     │  │   ML-Based Router   │  │
│  │  Manager    │  │   Queue     │  │    (In Progress)    │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────┬───────────────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────────────┐
│              AI Agents (WebSocket Clients)                 │
│    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐   │
│    │ Text Proc.  │    │ Code Gen.   │    │ Data Anal.  │   │
│    │   Agent     │    │   Agent     │    │   Agent     │   │
│    └─────────────┘    └─────────────┘    └─────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Core Features

### Real-time Agent Orchestration
- **WebSocket Communication**: Sub-second latency for task assignment and progress updates
- **Capability-based Routing**: Intelligent matching of tasks to agents based on skill requirements
- **Load Balancing**: Automatic distribution across available agents with performance optimization
- **Health Monitoring**: Heartbeat tracking with automatic offline detection

### Task Management
- **Priority Queue**: High-priority tasks get precedence in assignment
- **Automatic Retry**: Failed tasks are retried up to 3 times with exponential backoff
- **Progress Tracking**: Real-time progress updates from agents during task execution
- **Performance Analytics**: Comprehensive metrics on completion times and success rates

### Agent Management
- **Dynamic Registration**: Agents can join/leave the system at runtime
- **Capability Indexing**: O(1) lookup for agents with specific capabilities
- **Performance Scoring**: Agents ranked by availability and historical performance
- **Connection Management**: Graceful handling of disconnections and reconnections

## Performance Metrics

**Demonstrated Performance** (from live testing):
- **Task Assignment Latency**: < 50ms
- **Progress Update Frequency**: Every 400-1000ms
- **Concurrent Agents**: 3+ agents simultaneously
- **Task Completion**: 2-5 seconds (simulated processing)
- **Success Rate**: 100% (all tasks completed successfully)

## Quick Start

### Prerequisites
- Node.js 18+ 
- Python 3.8+
- npm/yarn

### Installation

```bash
# Clone repository
git clone https://github.com/Triumph-KT/ai-agent-orchestration-system.git
cd ai-agent-orchestration-system

# Install server dependencies
cd server
npm install

# Install agent simulation dependencies  
cd ../test-agents
npm install

# Install ML dependencies
cd ../ml-router
pip install -r requirements.txt
```

### Running the System

1. **Start the Orchestration Server**:
```bash
cd server
npm run dev
# Server runs on http://localhost:8080
```

2. **Start Test Agents** (new terminal):
```bash
cd test-agents
node simple-agent.js
# Connects 3 simulated agents with different capabilities
```

3. **Submit Tasks** (new terminal):
```bash
# Text processing task
curl -X POST http://localhost:8080/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"type": "text_processing", "payload": {"text": "Hello world"}, "priority": "high", "requiredCapabilities": ["text_processing"]}'

# Code generation task  
curl -X POST http://localhost:8080/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"type": "code_generation", "payload": {"description": "Create fibonacci function"}, "requiredCapabilities": ["code_generation"]}'
```

4. **Monitor System**:
```bash
curl http://localhost:8080/api/status
```

## API Reference

### REST Endpoints

**POST /api/tasks** - Submit new task
```json
{
  "type": "text_processing",
  "payload": {"text": "sample text"},
  "priority": "high",
  "requiredCapabilities": ["text_processing"]
}
```

**GET /api/status** - Get system statistics
```json
{
  "agents": {"total": 3, "idle": 2, "busy": 1},
  "tasks": {"pending": 0, "active": 1, "completed": 5},
  "uptime": 1234.56
}
```

### WebSocket Messages

**Agent Registration**:
```json
{"type": "agent_register", "capabilities": ["text_processing", "data_analysis"]}
```

**Task Assignment**:
```json
{"type": "task_assignment", "task": {"id": "task_123", "type": "text_processing", "payload": {...}}}
```

**Task Result**:
```json
{"type": "task_result", "taskId": "task_123", "agentId": "agent_456", "result": {"success": true, "output": "..."}}
```

## Development Roadmap

### Phase 1: Core Infrastructure 
- [x] WebSocket orchestration server
- [x] Agent management with capability routing
- [x] Priority-based task queue
- [x] Real-time progress tracking
- [x] Comprehensive testing framework

### Phase 2: Intelligence Layer 
- [ ] ML-based task-agent matching
- [ ] Performance prediction models
- [ ] Dynamic load balancing optimization
- [ ] GPT-4 integration for real AI processing

### Phase 3: Production Features 
- [ ] Web dashboard with real-time visualization
- [ ] Advanced analytics and reporting
- [ ] Horizontal scaling capabilities
- [ ] Comprehensive monitoring and alerting

## Technical Decisions

### Why WebSocket Over HTTP Polling?
WebSocket provides true bidirectional communication with sub-second latency, essential for real-time orchestration. HTTP polling would introduce unnecessary latency and server overhead.

### Why Capability-based Routing?
Different AI models excel at different tasks. Capability-based routing ensures optimal task-agent matching, similar to how Kubernetes schedules containers based on resource requirements.

### Why Priority Queue Implementation?
Real-world AI workloads have varying urgency levels. The priority queue ensures critical tasks get immediate attention while maintaining fairness for normal-priority work.

### Why In-Memory State Management?
For the current scale (dozens of agents), in-memory storage provides optimal performance. The system is designed to easily migrate to distributed storage (Redis, etc.) as it scales.

## Testing

```bash
# Run integration tests
npm test

# Load testing with multiple agents
cd test-agents
node load-test.js

# Performance benchmarking
npm run benchmark
```

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## License

MIT License - see LICENSE file for details.

---

*Built as part of Moccet AI technical assessment - demonstrating real-time AI agent orchestration capabilities.*

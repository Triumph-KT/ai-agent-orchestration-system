// server/server.js

/**
 * @file Main entry point for the AI Agent Orchestration Server.
 * @author Triumph Kia Teh
 * @version 1.4.1 - Finalized portable logging path.
 *
 * @description
 * This server acts as the central nervous system for a distributed fleet of AI agents.
 * It manages agent connections, queues incoming tasks, and delegates routing
 * decisions to a dedicated machine learning service. It also serves the client-side
 * UIs for user interaction and system monitoring.
 */

const express = require('express');
const WebSocket = require('ws');
const http = require('http');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const AgentManager = require('./agentManager');
const TaskQueue = require('./taskQueue');

/**
 * The main server class that encapsulates all orchestration logic.
 */
class AIOrchestrationServer {
    /**
     * Initializes all server components, managers, and necessary paths.
     * @param {number} [port=8080] - The port on which the server will listen.
     */
    constructor(port = 8080) {
        this.port = port;
        this.routerUrl = 'http://router:5001/route';
        this.logPath = './logs'; // The log directory, relative to the container's working directory
        this.logFile = path.join(this.logPath, 'task_outputs.jsonl');

        // On startup, ensure the log directory exists inside the container.
        fs.mkdirSync(this.logPath, { recursive: true });
        
        this.app = express();
        this.server = http.createServer(this.app);
        this.wss = new WebSocket.Server({ server: this.server });
        
        // Instantiate modular components for managing state.
        this.agentManager = new AgentManager();
        this.taskQueue = new TaskQueue();
        
        // Sequentially set up all parts of the application.
        this.setupMiddleware();
        this.setupWebSocketHandlers();
        this.setupRoutes();
        this.setupPeriodicTasks();
    }
    
    /**
     * Configures the Express middleware for handling HTTP requests.
     * This includes CORS for cross-origin requests, JSON body parsing,
     * and serving the static front-end files.
     */
    setupMiddleware() {
        this.app.use(cors());
        this.app.use(express.json());
        this.app.use(express.static('dashboard'));
    }
    
    /**
     * Sets up the WebSocket server and its event listeners for handling
     * real-time communication with agents and dashboard clients.
     */
    setupWebSocketHandlers() {
        this.wss.on('connection', (ws) => {
            console.log('New WebSocket connection established');
            
            ws.on('message', async (message) => {
                try {
                    const data = JSON.parse(message);
                    await this.handleMessage(ws, data);
                } catch (error) {
                    console.error('Error handling message:', error);
                }
            });

            ws.on('close', () => this.agentManager.removeAgent(ws));
            ws.on('error', (error) => console.error('WebSocket error:', error));
        });
    }
    
    /**
     * Acts as the central router for all incoming WebSocket messages,
     * delegating to the appropriate handler based on message type.
     * @param {WebSocket} ws - The WebSocket client connection instance.
     * @param {object} data - The parsed JSON data from the message.
     */
    async handleMessage(ws, data) {
        switch (data.type) {
            case 'agent_register':
                await this.handleAgentRegistration(ws, data);
                break;
            case 'agent_status':
                await this.handleAgentStatus(data.agentId, data.status);
                break;
            case 'task_result':
                await this.handleTaskResult(data);
                break;
            case 'dashboard_connect':
                ws.isDashboard = true;
                this.broadcastToDashboards({ type: 'stats_update', agents: this.agentManager.getStats(), agentList: this.agentManager.getAllAgents(), tasks: this.taskQueue.getStats() }, ws);
                break;
        }
    }

    /**
     * Onboards a new agent, assigns it a unique ID, registers it with the
     * AgentManager, and immediately attempts to assign it a pending task.
     * @param {WebSocket} ws - The agent's WebSocket connection.
     * @param {object} data - The registration data, including capabilities.
     */
    async handleAgentRegistration(ws, data) {
        const agentId = uuidv4();
        const agent = { id: agentId, ws, capabilities: data.capabilities || [], status: 'idle', registeredAt: new Date(), lastHeartbeat: new Date() };
        this.agentManager.addAgent(agent);
        ws.send(JSON.stringify({ type: 'registration_success', agentId }));
        await this.tryAssignTask(agentId);
    }

    /**
     * Handles status updates from agents, which also serve as heartbeats.
     * If an agent becomes idle, it triggers an attempt to assign it a new task.
     * @param {string} agentId - The ID of the agent reporting its status.
     * @param {string} status - The new status ('idle' or 'busy').
     */
    async handleAgentStatus(agentId, status) {
        this.agentManager.updateAgentStatus(agentId, status);
        if (status === 'idle') {
            await this.tryAssignTask(agentId);
        }
    }

    /**
     * Processes the result from a completed task. It persists the result to a
     * log file, broadcasts the result to UIs, and attempts to give the newly
     * idle agent another task.
     * @param {object} data - The result data from the agent.
     */
    async handleTaskResult(data) {
        console.log(`Task ${data.taskId} completed by agent ${data.agentId}`);
        this.taskQueue.completeTask(data.taskId, data.result);

        // Persist the full result to a structured log file for record-keeping.
        const logEntry = { taskId: data.taskId, result: data.result, timestamp: new Date().toISOString() };
        fs.appendFile(this.logFile, JSON.stringify(logEntry) + '\n', (err) => {
            if (err) console.error('Failed to write task output to file:', err);
        });
        
        // Notify any connected client UIs that this specific task is finished.
        this.broadcastToDashboards({
            type: 'task_completed',
            taskId: data.taskId,
            result: data.result
        });

        await this.tryAssignTask(data.agentId);
    }
    
    /**
     * The core assignment logic. Finds a suitable pending task for a specific
     * idle agent and dispatches it.
     * @param {string} agentId - The ID of the idle agent to assign a task to.
     */
    async tryAssignTask(agentId) {
        const agent = this.agentManager.getAgent(agentId);
        if (!agent || agent.status !== 'idle') return;

        const task = this.taskQueue.getNextTask(agent.capabilities);
        if (!task) return;
        
        this.agentManager.updateAgentStatus(agentId, 'busy');
        this.taskQueue.assignTask(task.id, agentId);
        agent.ws.send(JSON.stringify({ type: 'task_assignment', task }));
        console.log(`Task ${task.id} assigned to agent ${agentId}`);
    }
    
    /**
     * Configures the REST API endpoints for external interactions, such as
     * task submission from the client UI or other services.
     */
    setupRoutes() {
        // Endpoint for submitting new tasks.
        this.app.post('/api/tasks', async (req, res) => {
            const requiredCapabilities = req.body.type ? [req.body.type] : [];
            const task = { id: uuidv4(), type: req.body.type, payload: req.body.payload, priority: 'high', requiredCapabilities, createdAt: new Date(), status: 'pending' };
            
            this.taskQueue.addTask(task);
            res.json({ success: true, taskId: task.id });
            await this.tryAssignToAnyAgent(task);
        });
        
        // Endpoint for getting high-level system statistics.
        this.app.get('/api/status', (req, res) => {
            res.json({ agents: this.agentManager.getStats(), tasks: this.taskQueue.getStats(), uptime: process.uptime() });
        });
    }
    
    /**
     * Handles a newly created task by finding all capable, idle agents and
     * querying the external Python ML service to determine the optimal agent.
     * @param {object} task - The new task to be assigned.
     */
    async tryAssignToAnyAgent(task) {
        const availableAgents = this.agentManager.getIdleAgents(task.requiredCapabilities);
        if (availableAgents.length > 0) {
            try {
                // Call the external ML router for an intelligent decision.
                const payload = { agents: availableAgents.map(a => ({ id: a.id, capabilities: a.capabilities, lastTaskCompletedAt: a.lastTaskCompletedAt ? a.lastTaskCompletedAt.getTime() : 0 })), task };
                const response = await axios.post(this.routerUrl, payload);
                const bestAgentId = response.data.best_agent_id;

                if (bestAgentId) {
                    await this.tryAssignTask(bestAgentId);
                }
            } catch (error) {
                console.error('Error calling task router service:', error.message);
            }
        }
    }
    
    /**
     * Sets up periodic background tasks for system maintenance and monitoring.
     */
    setupPeriodicTasks() {
        // Check for unresponsive agents every 30 seconds.
        setInterval(() => this.agentManager.checkHeartbeats(), 30000);
        // Broadcast system-wide stats to all connected dashboards every 5 seconds.
        setInterval(() => this.broadcastToDashboards({ type: 'stats_update', agents: this.agentManager.getStats(), agentList: this.agentManager.getAllAgents(), tasks: this.taskQueue.getStats() }), 5000);
    }

    /**
     * Helper function to send data to all connected dashboard/UI clients.
     * @param {object} data - The data to be broadcast.
     * @param {WebSocket} [singleClient=null] - If specified, sends only to this client.
     */
    broadcastToDashboards(data, singleClient = null) {
        const message = JSON.stringify(data);
        if (singleClient) {
            if (singleClient.readyState === WebSocket.OPEN) {
                singleClient.send(message);
            }
            return;
        }
        this.wss.clients.forEach(client => {
            if (client.isDashboard && client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        });
    }
    
    /**
     * Starts the HTTP and WebSocket servers.
     */
    start() {
        this.server.listen(this.port, () => {
            console.log(`AI Orchestration Server running on port ${this.port}`);
        });
    }
}

// Entry point: if this file is run directly, create and start the server.
if (require.main === module) {
    const server = new AIOrchestrationServer();
    server.start();
}

module.exports = AIOrchestrationServer;
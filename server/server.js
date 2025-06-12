// server/server.js

/**
 * AI Agent Orchestration Server
 * * This is the main server component that coordinates multiple AI agents working on parallel tasks.
 * It implements a WebSocket-based real-time communication system for task distribution and
 * progress monitoring, and delegates routing decisions to an external ML service.
 * * @author Triumph Kia Teh
 * @version 1.1.0
 */

const express = require('express');
const WebSocket = require('ws');
const http = require('http');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios'); // Import axios for HTTP requests

const AgentManager = require('./agentManager');
const TaskQueue = require('./taskQueue');

/**
 * Main orchestration server class that manages the entire AI agent ecosystem
 */
class AIOrchestrationServer {
    /**
     * Initialize the orchestration server with all necessary components
     * @param {number} port - Server port (default: 8080)
     */
    constructor(port = 8080) {
        this.port = port;
        this.routerUrl = 'http://127.0.0.1:5001/route'; // Define Python router URL
        this.app = express();
        this.server = http.createServer(this.app);
        
        this.wss = new WebSocket.Server({ server: this.server });
        
        this.agentManager = new AgentManager();
        this.taskQueue = new TaskQueue();
        
        this.setupMiddleware();
        this.setupWebSocketHandlers();
        this.setupRoutes();
        this.setupPeriodicTasks();
    }
    
    /**
     * Configure Express middleware for CORS, JSON parsing, and static files
     */
    setupMiddleware() {
        this.app.use(cors());
        this.app.use(express.json());
        this.app.use(express.static('public'));
    }
    
    /**
     * Setup WebSocket connection handlers for real-time agent communication
     */
    setupWebSocketHandlers() {
        this.wss.on('connection', (ws, req) => {
            console.log('New WebSocket connection established');
            
            ws.on('message', async (message) => {
                try {
                    const data = JSON.parse(message);
                    await this.handleMessage(ws, data);
                } catch (error) {
                    console.error('Error handling message:', error);
                    ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
                }
            });
            
            ws.on('close', () => {
                this.agentManager.removeAgent(ws);
                console.log('WebSocket connection closed');
            });
            
            ws.on('error', (error) => {
                console.error('WebSocket error:', error);
            });
        });
    }
    
    /**
     * Central message routing system for all WebSocket communications
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
                await this.handleDashboardConnection(ws);
                break;
            default:
                ws.send(JSON.stringify({ type: 'error', message: 'Unknown message type' }));
        }
    }
    
    /**
     * Handle new agent registration with capability indexing
     */
    async handleAgentRegistration(ws, data) {
        const agentId = uuidv4();
        const agent = {
            id: agentId,
            ws: ws,
            capabilities: data.capabilities || [],
            status: 'idle',
            registeredAt: new Date(),
            lastHeartbeat: new Date()
        };
        
        this.agentManager.addAgent(agent);
        ws.send(JSON.stringify({ type: 'registration_success', agentId: agentId, message: 'Agent registered successfully' }));
        console.log(`Agent ${agentId} registered with capabilities:`, data.capabilities);
        await this.tryAssignTask(agentId);
    }
    
    /**
     * Handle agent status updates and trigger task assignment for idle agents
     */
    async handleAgentStatus(agentId, status) {
        this.agentManager.updateAgentStatus(agentId, status);
        if (status === 'idle') {
            await this.tryAssignTask(agentId);
        }
    }
    
    /**
     * Handle task completion results and attempt next task assignment
     */
    async handleTaskResult(data) {
        console.log(`Task ${data.taskId} completed by agent ${data.agentId}`);
        this.taskQueue.completeTask(data.taskId, data.result);
        await this.tryAssignTask(data.agentId);
    }
    
    /**
     * Handle dashboard connections for real-time monitoring
     */
    async handleDashboardConnection(ws) {
        ws.isDashboard = true;
        ws.send(JSON.stringify({
            type: 'dashboard_init',
            agents: this.agentManager.getAllAgents(),
            tasks: this.taskQueue.getAllTasks()
        }));
    }
    
    /**
     * Attempt to assign a task to a specific agent based on capabilities
     */
    async tryAssignTask(agentId) {
        const agent = this.agentManager.getAgent(agentId);
        if (!agent || agent.status !== 'idle') return;
        
        const task = this.taskQueue.getNextTask(agent.capabilities);
        if (!task) return;
        
        this.agentManager.updateAgentStatus(agentId, 'busy');
        this.taskQueue.assignTask(task.id, agentId);
        
        agent.ws.send(JSON.stringify({ type: 'task_assignment', task: task }));
        console.log(`Task ${task.id} assigned to agent ${agentId}`);
    }
    
    /**
     * Setup REST API endpoints for external system integration
     */
    setupRoutes() {
        this.app.post('/api/tasks', async (req, res) => {
            const task = {
                id: uuidv4(),
                type: req.body.type,
                payload: req.body.payload,
                priority: req.body.priority || 'normal',
                requiredCapabilities: req.body.requiredCapabilities || [],
                createdAt: new Date(),
                status: 'pending'
            };
            
            this.taskQueue.addTask(task);
            res.json({ success: true, taskId: task.id });
            
            await this.tryAssignToAnyAgent(task);
        });
        
        this.app.get('/api/status', (req, res) => {
            res.json({
                agents: this.agentManager.getStats(),
                tasks: this.taskQueue.getStats(),
                uptime: process.uptime()
            });
        });
    }
    
    /**
     * NEW LOGIC: Tries to assign a new task by querying the Python router service.
     */
    async tryAssignToAnyAgent(task) {
        const availableAgents = this.agentManager.getIdleAgents(task.requiredCapabilities);
        
        if (availableAgents.length > 0) {
            console.log(`Querying Python router for task ${task.id} with ${availableAgents.length} candidate(s)...`);
            try {
                const payload = {
                    agents: availableAgents.map(agent => ({
                        id: agent.id,
                        capabilities: agent.capabilities,
                        lastTaskCompletedAt: agent.lastTaskCompletedAt ? agent.lastTaskCompletedAt.getTime() : 0
                    })),
                    task: task
                };
                
                const response = await axios.post(this.routerUrl, payload);
                const bestAgentId = response.data.best_agent_id;

                if (bestAgentId) {
                    console.log(`Router selected agent ${bestAgentId}. Assigning task...`);
                    // The task is already in the queue, we just need to trigger assignment
                    // to the specific agent if it's still idle.
                    const bestAgent = this.agentManager.getAgent(bestAgentId);
                    if (bestAgent && bestAgent.status === 'idle') {
                        await this.tryAssignTask(bestAgentId);
                    }
                } else {
                    console.log('Router did not select an agent. Task remains in queue.');
                }
            } catch (error) {
                console.error('Error calling task router service:', error.message);
                console.error('Could not delegate routing. Task remains in queue.');
            }
        }
    }
    
    /**
     * Setup periodic maintenance tasks for system health
     */
    setupPeriodicTasks() {
        setInterval(() => this.agentManager.checkHeartbeats(), 30000);
        setInterval(() => this.broadcastStats(), 5000);
    }
    
    /**
     * Broadcast current system statistics to all connected dashboards
     */
    broadcastStats() {
        const stats = {
            type: 'stats_update',
            agents: this.agentManager.getStats(),
            tasks: this.taskQueue.getStats(),
            timestamp: new Date()
        };
        
        this.wss.clients.forEach(client => {
            if (client.isDashboard && client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(stats));
            }
        });
    }
    
    /**
     * Start the orchestration server
     */
    start() {
        this.server.listen(this.port, () => {
            console.log(`AI Orchestration Server running on port ${this.port}`);
        });
    }
}

if (require.main === module) {
    const server = new AIOrchestrationServer();
    server.start();
}

module.exports = AIOrchestrationServer;
/**
 * AI Agent Orchestration Server
 * 
 * This is the main server component that coordinates multiple AI agents working on parallel tasks.
 * It implements a WebSocket-based real-time communication system for task distribution and
 * progress monitoring, similar to distributed computing systems used in production environments.
 * 
 * Architecture:
 * - WebSocket server for real-time bidirectional communication
 * - REST API for task submission and system monitoring
 * - Agent management with capability-based routing
 * - Priority-based task queue with automatic assignment
 * 
 * @author Triumph Kia Teh
 * @version 1.0.0
 */

const express = require('express');
const WebSocket = require('ws');
const http = require('http');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

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
        this.app = express();
        this.server = http.createServer(this.app);
        
        // Initialize WebSocket server for real-time agent communication
        this.wss = new WebSocket.Server({ server: this.server });
        
        // Initialize core management systems
        this.agentManager = new AgentManager();
        this.taskQueue = new TaskQueue();
        
        // Setup all server components
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
     * Handles agent registration, task assignment, and status updates
     */
    setupWebSocketHandlers() {
        this.wss.on('connection', (ws, req) => {
            console.log('New WebSocket connection established');
            
            // Handle incoming messages from agents or dashboard
            ws.on('message', async (message) => {
                try {
                    const data = JSON.parse(message);
                    await this.handleMessage(ws, data);
                } catch (error) {
                    console.error('Error handling message:', error);
                    ws.send(JSON.stringify({ 
                        type: 'error', 
                        message: 'Invalid message format' 
                    }));
                }
            });
            
            // Handle agent disconnections and cleanup
            ws.on('close', () => {
                this.agentManager.removeAgent(ws);
                console.log('WebSocket connection closed');
            });
            
            // Handle WebSocket errors
            ws.on('error', (error) => {
                console.error('WebSocket error:', error);
            });
        });
    }
    
    /**
     * Central message routing system for all WebSocket communications
     * @param {WebSocket} ws - The WebSocket connection
     * @param {Object} data - Parsed message data
     */
    async handleMessage(ws, data) {
        switch (data.type) {
            case 'agent_register':
                await this.handleAgentRegistration(ws, data);
                break;
            case 'agent_status':
                await this.handleAgentStatus(ws, data);
                break;
            case 'task_result':
                await this.handleTaskResult(ws, data);
                break;
            case 'dashboard_connect':
                await this.handleDashboardConnection(ws);
                break;
            default:
                ws.send(JSON.stringify({ 
                    type: 'error', 
                    message: 'Unknown message type' 
                }));
        }
    }
    
    /**
     * Handle new agent registration with capability indexing
     * @param {WebSocket} ws - Agent's WebSocket connection
     * @param {Object} data - Registration data including capabilities
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
        
        // Confirm registration to agent
        ws.send(JSON.stringify({
            type: 'registration_success',
            agentId: agentId,
            message: 'Agent registered successfully'
        }));
        
        console.log(`Agent ${agentId} registered with capabilities:`, data.capabilities);
    }
    
    /**
     * Handle agent status updates and trigger task assignment for idle agents
     * @param {WebSocket} ws - Agent's WebSocket connection
     * @param {Object} data - Status update data
     */
    async handleAgentStatus(ws, data) {
        this.agentManager.updateAgentStatus(data.agentId, data.status);
        
        // Attempt immediate task assignment when agent becomes available
        if (data.status === 'idle') {
            await this.tryAssignTask(data.agentId);
        }
    }
    
    /**
     * Handle task completion results and attempt next task assignment
     * @param {WebSocket} ws - Agent's WebSocket connection
     * @param {Object} data - Task completion data
     */
    async handleTaskResult(ws, data) {
        console.log(`Task ${data.taskId} completed by agent ${data.agentId}`);
        this.taskQueue.completeTask(data.taskId, data.result);
        
        // Immediately try to assign the next available task
        await this.tryAssignTask(data.agentId);
    }
    
    /**
     * Handle dashboard connections for real-time monitoring
     * @param {WebSocket} ws - Dashboard WebSocket connection
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
     * This implements the core orchestration logic
     * @param {string} agentId - Target agent identifier
     */
    async tryAssignTask(agentId) {
        const agent = this.agentManager.getAgent(agentId);
        if (!agent || agent.status !== 'idle') return;
        
        // Get next available task that matches agent capabilities
        const task = this.taskQueue.getNextTask(agent.capabilities);
        if (!task) return;
        
        // Execute task assignment atomically
        this.agentManager.updateAgentStatus(agentId, 'busy');
        this.taskQueue.assignTask(task.id, agentId);
        
        // Send task to agent for processing
        agent.ws.send(JSON.stringify({
            type: 'task_assignment',
            task: task
        }));
        
        console.log(`Task ${task.id} assigned to agent ${agentId}`);
    }
    
    /**
     * Setup REST API endpoints for external system integration
     */
    setupRoutes() {
        // Task submission endpoint for external systems
        this.app.post('/api/tasks', (req, res) => {
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
            
            // Attempt immediate assignment to available agents
            this.tryAssignToAnyAgent(task);
        });
        
        // System status endpoint for monitoring
        this.app.get('/api/status', (req, res) => {
            res.json({
                agents: this.agentManager.getStats(),
                tasks: this.taskQueue.getStats(),
                uptime: process.uptime()
            });
        });
    }
    
    /**
     * Try to assign a new task to any available agent with matching capabilities
     * @param {Object} task - Task object to assign
     */
    async tryAssignToAnyAgent(task) {
        const availableAgents = this.agentManager.getIdleAgents(task.requiredCapabilities);
        if (availableAgents.length > 0) {
            // Use first available agent (will be enhanced with ML-based selection)
            const agent = availableAgents[0];
            await this.tryAssignTask(agent.id);
        }
    }
    
    /**
     * Setup periodic maintenance tasks for system health
     */
    setupPeriodicTasks() {
        // Monitor agent connectivity every 30 seconds
        setInterval(() => {
            this.agentManager.checkHeartbeats();
        }, 30000);
        
        // Broadcast real-time stats to dashboards every 5 seconds
        setInterval(() => {
            this.broadcastStats();
        }, 5000);
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
        
        // Send to all dashboard connections
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
            console.log(`WebSocket endpoint: ws://localhost:${this.port}`);
            console.log(`HTTP endpoint: http://localhost:${this.port}`);
        });
    }
}

// Auto-start server when run directly
if (require.main === module) {
    const server = new AIOrchestrationServer();
    server.start();
}

module.exports = AIOrchestrationServer;
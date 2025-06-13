// server/server.js

/**
 * AI Agent Orchestration Server
 * @version 1.3.0 - Added task result persistence to file
 */

const express = require('express');
const WebSocket = require('ws');
const http = require('http');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const fs = require('fs'); // Import the File System module

const AgentManager = require('./agentManager');
const TaskQueue = require('./taskQueue');

class AIOrchestrationServer {
    // ... constructor and other functions remain the same ...
    constructor(port = 8080) {
        this.port = port;
        this.routerUrl = 'http://127.0.0.1:5001/route';
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
    
    setupMiddleware() {
        this.app.use(cors());
        this.app.use(express.json());
        this.app.use(express.static('../dashboard'));
    }
    
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

    async handleAgentRegistration(ws, data) {
        const agentId = uuidv4();
        const agent = { id: agentId, ws, capabilities: data.capabilities || [], status: 'idle', registeredAt: new Date(), lastHeartbeat: new Date() };
        this.agentManager.addAgent(agent);
        ws.send(JSON.stringify({ type: 'registration_success', agentId }));
        await this.tryAssignTask(agentId);
    }

    async handleAgentStatus(agentId, status) {
        this.agentManager.updateAgentStatus(agentId, status);
        if (status === 'idle') {
            await this.tryAssignTask(agentId);
        }
    }

    async handleTaskResult(data) {
        console.log(`Task ${data.taskId} completed by agent ${data.agentId}`);
        this.taskQueue.completeTask(data.taskId, data.result);

        // NEW: Persist the result to a log file
        const logEntry = { taskId: data.taskId, result: data.result, timestamp: new Date().toISOString() };
        fs.appendFile('../task_outputs.jsonl', JSON.stringify(logEntry) + '\n', (err) => {
            if (err) console.error('Failed to write task output to file:', err);
        });
        
        this.broadcastToDashboards({
            type: 'task_completed',
            taskId: data.taskId,
            result: data.result
        });

        await this.tryAssignTask(data.agentId);
    }
    
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
    
    setupRoutes() {
        this.app.post('/api/tasks', async (req, res) => {
            const requiredCapabilities = req.body.type ? [req.body.type] : [];
            const task = { id: uuidv4(), type: req.body.type, payload: req.body.payload, priority: 'high', requiredCapabilities, createdAt: new Date(), status: 'pending' };
            
            this.taskQueue.addTask(task);
            res.json({ success: true, taskId: task.id });
            await this.tryAssignToAnyAgent(task);
        });
        
        this.app.get('/api/status', (req, res) => {
            res.json({ agents: this.agentManager.getStats(), tasks: this.taskQueue.getStats(), uptime: process.uptime() });
        });
    }
    
    async tryAssignToAnyAgent(task) {
        const availableAgents = this.agentManager.getIdleAgents(task.requiredCapabilities);
        if (availableAgents.length > 0) {
            try {
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
    
    setupPeriodicTasks() {
        setInterval(() => this.agentManager.checkHeartbeats(), 30000);
        setInterval(() => this.broadcastToDashboards({ type: 'stats_update', agents: this.agentManager.getStats(), agentList: this.agentManager.getAllAgents(), tasks: this.taskQueue.getStats() }), 5000);
    }

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
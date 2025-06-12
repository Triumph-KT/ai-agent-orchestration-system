/**
 * AI Agent Simulation System
 * 
 * Simulates AI agents for testing the orchestration system. Each agent connects
 * via WebSocket, registers capabilities, receives tasks, and simulates realistic
 * processing behavior with progress updates. This provides a complete testing
 * environment for the orchestration system before integrating real AI models.
 * 
 * Features:
 * - WebSocket-based real-time communication
 * - Capability-based agent registration
 * - Realistic task processing simulation with progress tracking
 * - Automatic heartbeat and status management
 * - Multiple concurrent agent support
 * 
 * @author Triumph Kia Teh
 * @version 1.0.0
 */

const WebSocket = require('ws');

/**
 * Simulated AI agent that mimics real agent behavior for system testing
 */
class TestAgent {
    /**
     * Initialize a test agent with specified capabilities
     * @param {string} agentId - Initial agent identifier (will be replaced by server)
     * @param {Array<string>} capabilities - List of agent capabilities
     * @param {string} serverUrl - WebSocket server URL
     */
    constructor(agentId, capabilities, serverUrl = 'ws://localhost:8080') {
        this.agentId = agentId;
        this.capabilities = capabilities;
        this.serverUrl = serverUrl;
        this.ws = null;
        this.isRegistered = false;
        this.currentTask = null;
        this.heartbeatInterval = null;
    }
    
    /**
     * Establish WebSocket connection to the orchestration server
     * Sets up all event handlers for bidirectional communication
     */
    connect() {
        console.log(`Agent ${this.agentId} connecting to ${this.serverUrl}...`);
        
        this.ws = new WebSocket(this.serverUrl);
        
        // Handle successful connection
        this.ws.on('open', () => {
            console.log(`Agent ${this.agentId} connected`);
            this.register();
        });
        
        // Handle incoming messages from server
        this.ws.on('message', (data) => {
            try {
                const message = JSON.parse(data);
                this.handleMessage(message);
            } catch (error) {
                console.error('Error parsing message:', error);
            }
        });
        
        // Handle connection termination
        this.ws.on('close', () => {
            console.log(`Agent ${this.agentId} disconnected`);
            this.isRegistered = false;
            this.stopHeartbeat();
        });
        
        // Handle connection errors
        this.ws.on('error', (error) => {
            console.error(`Agent ${this.agentId} error:`, error);
        });
    }
    
    /**
     * Register agent capabilities with the orchestration server
     */
    register() {
        const message = {
            type: 'agent_register',
            capabilities: this.capabilities
        };
        
        this.send(message);
        console.log(`Agent ${this.agentId} registering with capabilities:`, this.capabilities);
    }
    
    /**
     * Start periodic heartbeat to maintain connection health
     * Sends status updates every 15 seconds to prevent timeout
     */
    startHeartbeat() {
        this.heartbeatInterval = setInterval(() => {
            this.reportStatus('idle');
        }, 15000);
    }
    
    /**
     * Stop heartbeat interval on disconnection
     */
    stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }
    
    /**
     * Central message handler for all server communications
     * @param {Object} message - Parsed message from server
     */
    handleMessage(message) {
        console.log(`Agent ${this.agentId} received:`, message.type);
        
        switch (message.type) {
            case 'registration_success':
                this.agentId = message.agentId; // Use server-assigned ID
                this.isRegistered = true;
                console.log(`Agent ${this.agentId} successfully registered`);
                this.reportStatus('idle');
                this.startHeartbeat(); // Begin health monitoring
                break;
                
            case 'task_assignment':
                this.handleTaskAssignment(message.task);
                break;
                
            case 'error':
                console.error(`Agent ${this.agentId} server error:`, message.message);
                break;
                
            default:
                console.log(`Agent ${this.agentId} unknown message type:`, message.type);
        }
    }
    
    /**
     * Handle new task assignment from server
     * @param {Object} task - Task object containing type, payload, and requirements
     */
    handleTaskAssignment(task) {
        console.log(`Agent ${this.agentId} received task ${task.id}: ${task.type}`);
        this.currentTask = task;
        this.reportStatus('busy');
        this.processTask(task);
    }
    
    /**
     * Simulate realistic task processing with progress updates
     * @param {Object} task - Task to process
     */
    async processTask(task) {
        console.log(`Agent ${this.agentId} processing task ${task.id}...`);
        
        const processingTime = this.getProcessingTime(task.type);
        await this.simulateWork(processingTime);
        
        const result = this.generateTaskResult(task);
        this.reportTaskCompletion(task.id, result);
    }
    
    /**
     * Get realistic processing time based on task type
     * Simulates different computational complexities
     * @param {string} taskType - Type of task being processed
     * @returns {number} Processing time in milliseconds
     */
    getProcessingTime(taskType) {
        const times = {
            'text_processing': 2000,     // 2 seconds - natural language processing
            'code_generation': 5000,     // 5 seconds - code synthesis complexity
            'data_analysis': 3000,       // 3 seconds - data computation time
            'image_analysis': 4000,      // 4 seconds - computer vision processing
            'default': 2500              // 2.5 seconds - general AI task baseline
        };
        return times[taskType] || times.default;
    }
    
    /**
     * Simulate incremental work progress with realistic timing
     * @param {number} duration - Total processing duration in milliseconds
     * @returns {Promise} Resolves when work simulation is complete
     */
    async simulateWork(duration) {
        return new Promise(resolve => {
            const steps = 5;
            const stepDuration = duration / steps;
            
            let step = 0;
            const interval = setInterval(() => {
                step++;
                const progress = (step / steps) * 100;
                console.log(`Agent ${this.agentId} progress: ${progress.toFixed(0)}%`);
                
                if (step >= steps) {
                    clearInterval(interval);
                    resolve();
                }
            }, stepDuration);
        });
    }
    
    /**
     * Generate realistic task results based on task type
     * Simulates different AI model outputs and response formats
     * @param {Object} task - Completed task object
     * @returns {Object} Simulated task result with success status and output
     */
    generateTaskResult(task) {
        // Safe payload extraction with fallback values
        let textToProcess = 'default text';
        if (task.payload && task.payload.text) {
            textToProcess = task.payload.text;
        }
        
        const results = {
            'text_processing': {
                success: true,
                output: `Processed text: "${textToProcess}" - Word count: ${textToProcess.split(' ').length}`,
                metadata: { processingTime: Date.now() }
            },
            'code_generation': {
                success: true,
                output: `// Generated code for: ${task.payload?.description || 'unknown task'}\nfunction generatedFunction() {\n    return 'Hello World';\n}`,
                metadata: { language: 'javascript' }
            },
            'data_analysis': {
                success: true,
                output: `Analysis complete. Found ${Math.floor(Math.random() * 100)} patterns in the data.`,
                metadata: { confidence: 0.95 }
            },
            'default': {
                success: true,
                output: `Task completed successfully`,
                metadata: { timestamp: new Date().toISOString() }
            }
        };
        
        return results[task.type] || results.default;
    }
    
    /**
     * Report task completion to server with results
     * @param {string} taskId - Completed task identifier
     * @param {Object} result - Task execution result
     */
    reportTaskCompletion(taskId, result) {
        const message = {
            type: 'task_result',
            taskId: taskId,
            agentId: this.agentId,
            result: result
        };
        
        this.send(message);
        console.log(`Agent ${this.agentId} completed task ${taskId}`);
        
        // Reset agent state for next task
        this.currentTask = null;
        this.reportStatus('idle');
    }
    
    /**
     * Send status update to server for orchestration decisions
     * @param {string} status - Agent status ('idle', 'busy', 'offline')
     */
    reportStatus(status) {
        if (!this.isRegistered) return;
        
        const message = {
            type: 'agent_status',
            agentId: this.agentId,
            status: status
        };
        
        this.send(message);
    }
    
    /**
     * Send message to server via WebSocket with connection validation
     * @param {Object} message - Message object to send
     */
    send(message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        }
    }
    
    /**
     * Gracefully disconnect from server with cleanup
     */
    disconnect() {
        this.stopHeartbeat();
        if (this.ws) {
            this.ws.close();
        }
    }
}

/**
 * Agent fleet initialization for testing multiple concurrent agents
 * Creates diverse agents with different capability sets for comprehensive testing
 */
if (require.main === module) {
    const agents = [
        new TestAgent('agent-1', ['text_processing', 'data_analysis']),
        new TestAgent('agent-2', ['code_generation', 'text_processing']),
        new TestAgent('agent-3', ['image_analysis', 'data_analysis'])
    ];
    
    // Connect all agents to server
    agents.forEach(agent => {
        agent.connect();
    });
    
    // Graceful shutdown handler for clean testing cycles
    process.on('SIGINT', () => {
        console.log('\nShutting down agents...');
        agents.forEach(agent => agent.disconnect());
        process.exit(0);
    });
}

module.exports = TestAgent;
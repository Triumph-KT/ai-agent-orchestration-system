// test-agents/simple-agent.js

/**
 * @file Implements a GPT-4 powered AI Agent client for the orchestration system.
 * @author Triumph Kia Teh
 * @version 2.2.0
 *
 * @description
 * This script defines and launches a fleet of AI agents. Each agent is an
 * independent worker that connects to the central orchestrator via WebSockets.
 * It registers its capabilities, receives tasks, processes them by making live
 * API calls to the OpenAI GPT-4 model, and reports the results back.
 * A persistent heartbeat is used to maintain connection health during long-running tasks.
 */

// Load environment variables (like the API key) from the .env file
require('dotenv').config();
const WebSocket = require('ws');
const OpenAI = require('openai');

// Initialize the OpenAI client with the API key.
// It will automatically find the OPENAI_API_KEY in process.env.
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Represents a single, independent AI agent that connects to the orchestrator.
 */
class GPTAgent {
    /**
     * Creates an instance of a GPTAgent.
     * @param {string} agentId - A temporary ID for logging before registration.
     * @param {string[]} capabilities - A list of skills this agent possesses.
     * @param {string} [serverUrl='ws://localhost:8080'] - The WebSocket URL of the orchestrator.
     */
    constructor(agentId, capabilities, serverUrl = 'ws://localhost:8080') {
        this.agentId = agentId;
        this.capabilities = capabilities;
        this.serverUrl = serverUrl;
        this.ws = null;
        this.isRegistered = false;
        this.status = 'connecting'; // Internal state for the agent
        this.heartbeatInterval = null; // Holds the reference to the heartbeat timer
    }
    
    /**
     * Initiates the WebSocket connection to the server and sets up all
     * event listeners that govern the agent's lifecycle.
     */
    connect() {
        console.log(`Agent ${this.agentId} connecting to ${this.serverUrl}...`);
        this.ws = new WebSocket(this.serverUrl);

        this.ws.on('open', () => this.register());
        this.ws.on('message', (data) => this.handleMessage(JSON.parse(data)));
        this.ws.on('close', () => {
            console.log(`Agent ${this.agentId} disconnected.`);
            this.stopHeartbeat();
        });
        this.ws.on('error', (error) => {
            console.error(`Agent ${this.agentId} error:`, error);
            this.stopHeartbeat();
        });
    }

    /**
     * Starts a periodic heartbeat to inform the orchestrator that the agent
     * is still alive and responsive, preventing timeouts during long tasks.
     */
    startHeartbeat() {
        console.log(`Agent ${this.agentId} starting heartbeat.`);
        this.stopHeartbeat(); // Clear any existing interval to prevent duplicates.
        this.heartbeatInterval = setInterval(() => {
            // Periodically send the current status.
            this.reportStatus(this.status);
        }, 15000); // Send a status update every 15 seconds.
    }

    /**
     * Clears the heartbeat interval timer, typically on disconnection.
     */
    stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }
    
    /**
     * Sends the initial registration message to the server upon a successful connection,
     * declaring its capabilities to the orchestrator.
     */
    register() {
        console.log(`Agent ${this.agentId} connected. Registering with capabilities:`, this.capabilities);
        this.send({ type: 'agent_register', capabilities: this.capabilities });
    }
    
    /**
     * The main message handler. Acts as a router for all commands received
     * from the orchestration server.
     * @param {object} message - The parsed JSON message from the server.
     */
    handleMessage(message) {
        console.log(`Agent ${this.agentId} received message: ${message.type}`);
        switch (message.type) {
            case 'registration_success':
                // The server confirms registration and assigns a permanent, unique ID.
                this.agentId = message.agentId;
                this.isRegistered = true;
                console.log(`Agent ${this.agentId} successfully registered.`);
                this.reportStatus('idle');
                this.startHeartbeat(); // The agent is now fully online, begin heartbeats.
                break;
            case 'task_assignment':
                // The server has assigned a new task to this agent.
                this.handleTaskAssignment(message.task);
                break;
        }
    }
    
    /**
     * Handles a new task assignment. It updates its status to 'busy' and then
     * begins the process of executing the task with GPT-4.
     * @param {object} task - The task object received from the server.
     */
    async handleTaskAssignment(task) {
        console.log(`Agent ${this.agentId} received task ${task.id}: ${task.type}`);
        this.reportStatus('busy');
        
        try {
            // Execute the core logic and wait for the result.
            const result = await this.processTaskWithGPT4(task);
            this.reportTaskCompletion(task.id, result);
        } catch (error) {
            // If the GPT-4 call or any other part fails, report an error.
            console.error(`Agent ${this.agentId} failed to process task ${task.id}:`, error.message);
            const errorResult = { success: false, error: error.message };
            this.reportTaskCompletion(task.id, errorResult);
        }
    }

    /**
     * The core work function. It constructs a prompt based on the task payload
     * and makes an asynchronous API call to the OpenAI GPT-4 model.
     * @param {object} task - The task to be processed.
     * @returns {Promise<object>} A promise that resolves to the formatted result object.
     */
    async processTaskWithGPT4(task) {
        console.log(`Agent ${this.agentId} sending task to GPT-4...`);
        
        // 1. Prompt Engineering: Create a system prompt to define the AI's role
        //    and a user prompt with the specific instructions.
        let system_prompt = `You are a specialized AI agent. Your capabilities are: ${this.capabilities.join(', ')}.`;
        let user_prompt = `Perform the task of type '${task.type}'. Task details: ${JSON.stringify(task.payload)}`;

        // Create more specific prompts for known task types for better results.
        if (task.type === 'text_processing') {
            user_prompt = `Process the following text: "${task.payload.text}"`;
        } else if (task.type === 'code_generation') {
            user_prompt = `Generate a code snippet for the following description: "${task.payload.description}"`;
        } else if (task.type === 'data_analysis') {
            user_prompt = `Provide a brief analysis of the following data: ${JSON.stringify(task.payload)}`;
        }

        // 2. Make the asynchronous API call to OpenAI.
        const completion = await openai.chat.completions.create({
            model: "gpt-4",
            messages: [{ role: "system", content: system_prompt }, { role: "user", content: user_prompt }],
            max_tokens: 300,
        });

        const gptResponse = completion.choices[0].message.content;
        console.log(`Agent ${this.agentId} received response from GPT-4.`);

        // 3. Format the response into the standard result object for the orchestrator.
        return {
            success: true,
            output: gptResponse,
            metadata: { modelUsed: 'gpt-4', finish_reason: completion.choices[0].finish_reason }
        };
    }
    
    /**
     * Reports the final result of a task back to the orchestrator and sets
     * the agent's status back to 'idle' so it can receive new work.
     * @param {string} taskId - The ID of the task that was completed.
     * @param {object} result - The result object to send back.
     */
    reportTaskCompletion(taskId, result) {
        this.send({ type: 'task_result', taskId, agentId: this.agentId, result });
        console.log(`Agent ${this.agentId} completed task ${taskId}.`);
        this.reportStatus('idle');
    }
    
    /**
     * Sends a status update to the server. This is used for both immediate
     * state changes (e.g., to 'busy') and for periodic heartbeats.
     * @param {string} status - The current status of the agent.
     */
    reportStatus(status) {
        this.status = status; // Update the agent's internal state.
        if (!this.isRegistered) return;
        this.send({ type: 'agent_status', agentId: this.agentId, status: this.status });
    }
    
    /**
     * A helper function to send a JSON message to the server, with a check
     * to ensure the WebSocket connection is open.
     * @param {object} message - The JSON object to send.
     */
    send(message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        }
    }
}

// --- Agent Fleet Initialization ---
// This block runs when the script is executed directly via `node simple-agent.js`.
// It creates and connects a fleet of agents with different skill sets to test the system.
if (require.main === module) {
    const agents = [
        new GPTAgent('gpt-agent-1', ['text_processing', 'data_analysis']),
        new GPTAgent('gpt-agent-2', ['code_generation', 'text_processing']),
        new GPTAgent('gpt-agent-3', ['image_analysis', 'data_analysis'])
    ];
    
    agents.forEach(agent => agent.connect());

    // Handles graceful shutdown when you press CTRL+C in the terminal.
    process.on('SIGINT', () => {
        console.log('\nShutting down agents...');
        process.exit(0);
    });
}
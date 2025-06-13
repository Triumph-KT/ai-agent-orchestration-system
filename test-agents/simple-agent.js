/**
 * AI Agent (GPT-4 Powered)
 * * Simulates AI agents for the orchestration system by processing tasks using
 * real calls to the OpenAI GPT-4 API.
 * * @author Triumph Kia Teh
 * @version 2.0.0
 */

require('dotenv').config(); // Loads environment variables from .env file
const WebSocket = require('ws');
const OpenAI = require('openai');

// Initialize the OpenAI client with the API key from the .env file
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

class GPTAgent {
    constructor(agentId, capabilities, serverUrl = 'ws://localhost:8080') {
        this.agentId = agentId;
        this.capabilities = capabilities;
        this.serverUrl = serverUrl;
        this.ws = null;
        this.isRegistered = false;
    }
    
    connect() {
        console.log(`Agent ${this.agentId} connecting to ${this.serverUrl}...`);
        this.ws = new WebSocket(this.serverUrl);

        this.ws.on('open', () => this.register());
        this.ws.on('message', (data) => this.handleMessage(JSON.parse(data)));
        this.ws.on('close', () => console.log(`Agent ${this.agentId} disconnected.`));
        this.ws.on('error', (error) => console.error(`Agent ${this.agentId} error:`, error));
    }
    
    register() {
        console.log(`Agent ${this.agentId} connected. Registering with capabilities:`, this.capabilities);
        this.send({ type: 'agent_register', capabilities: this.capabilities });
    }
    
    handleMessage(message) {
        console.log(`Agent ${this.agentId} received message: ${message.type}`);
        switch (message.type) {
            case 'registration_success':
                this.agentId = message.agentId;
                this.isRegistered = true;
                console.log(`Agent ${this.agentId} successfully registered.`);
                this.reportStatus('idle');
                break;
            case 'task_assignment':
                this.handleTaskAssignment(message.task);
                break;
        }
    }
    
    async handleTaskAssignment(task) {
        console.log(`Agent ${this.agentId} received task ${task.id}: ${task.type}`);
        this.reportStatus('busy');
        
        try {
            // This now calls the REAL GPT-4 API
            const result = await this.processTaskWithGPT4(task);
            this.reportTaskCompletion(task.id, result);
        } catch (error) {
            console.error(`Agent ${this.agentId} failed to process task ${task.id}:`, error.message);
            const errorResult = { success: false, error: error.message };
            this.reportTaskCompletion(task.id, errorResult);
        }
    }

    /**
     * Generates a prompt and processes the task using the GPT-4 API.
     * @param {Object} task - The task to process.
     * @returns {Object} The result from GPT-4.
     */
    async processTaskWithGPT4(task) {
        console.log(`Agent ${this.agentId} sending task to GPT-4...`);
        
        // 1. Create a prompt based on the task type and payload
        let system_prompt = `You are a specialized AI agent. Your capabilities are: ${this.capabilities.join(', ')}.`;
        let user_prompt = `Perform the task of type '${task.type}'. Task details: ${JSON.stringify(task.payload)}`;

        if (task.type === 'text_processing') {
            user_prompt = `Process the following text: "${task.payload.text}"`;
        } else if (task.type === 'code_generation') {
            user_prompt = `Generate a code snippet for the following description: "${task.payload.description}"`;
        } else if (task.type === 'data_analysis') {
            user_prompt = `Provide a brief analysis of the following data: ${JSON.stringify(task.payload)}`;
        }

        // 2. Call the OpenAI API
        const completion = await openai.chat.completions.create({
            model: "gpt-4",
            messages: [
                { role: "system", content: system_prompt },
                { role: "user", content: user_prompt },
            ],
            max_tokens: 150,
        });

        const gptResponse = completion.choices[0].message.content;
        console.log(`Agent ${this.agentId} received response from GPT-4.`);

        // 3. Format the result
        return {
            success: true,
            output: gptResponse,
            metadata: {
                modelUsed: 'gpt-4',
                finish_reason: completion.choices[0].finish_reason,
            }
        };
    }
    
    reportTaskCompletion(taskId, result) {
        this.send({ type: 'task_result', taskId, agentId: this.agentId, result });
        console.log(`Agent ${this.agentId} completed task ${taskId}.`);
        this.reportStatus('idle');
    }
    
    reportStatus(status) {
        if (!this.isRegistered) return;
        this.send({ type: 'agent_status', agentId: this.agentId, status });
    }
    
    send(message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        }
    }
}

// --- Agent Fleet Initialization ---
if (require.main === module) {
    const agents = [
        new GPTAgent('agent-1', ['text_processing', 'data_analysis']),
        new GPTAgent('agent-2', ['code_generation', 'text_processing']),
        new GPTAgent('agent-3', ['image_analysis', 'data_analysis'])
    ];
    
    agents.forEach(agent => agent.connect());

    process.on('SIGINT', () => {
        console.log('\nShutting down agents...');
        process.exit(0);
    });
}
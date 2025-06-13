/**
 * @file Manages the state, capabilities, and lifecycle of all connected AI agents.
 * @author Triumph Kia Teh
 * @version 1.1.0
 *
 * @description
 * This module acts as the central registry for the agent fleet. It uses efficient
 * data structures for quick lookups and provides methods for adding, removing,
 * and querying agents. It is also responsible for health monitoring via heartbeats.
 */

/**
 * Manages the collection of all active and offline AI agents in the system.
 */
class AgentManager {
    /**
     * Initializes the AgentManager with optimized data structures for agent lookups.
     */
    constructor() {
        // Primary agent storage provides O(1) lookup by agent ID.
        // Stores the full agent object including the WebSocket connection.
        this.agents = new Map();
        
        // A reverse index for finding agents by their skills, enabling
        // efficient, O(1) filtering of capable agents for a given task.
        this.capabilities = new Map();
    }
    
    /**
     * Registers a new agent in the system. This involves adding the agent to the main
     * registry and updating the capability index for efficient future lookups.
     * @param {object} agent - The agent object, containing its ID, capabilities, and WebSocket connection.
     */
    addAgent(agent) {
        this.agents.set(agent.id, agent);
        
        // For each capability the agent reports, add its ID to the corresponding Set in the index.
        agent.capabilities.forEach(capability => {
            if (!this.capabilities.has(capability)) {
                this.capabilities.set(capability, new Set());
            }
            this.capabilities.get(capability).add(agent.id);
        });
        
        console.log(`Agent ${agent.id} registered. Total agents: ${this.agents.size}`);
    }
    
    /**
     * De-registers an agent when its WebSocket connection is closed.
     * It safely removes the agent from the main registry and cleans up all
     * references in the capability index to prevent memory leaks or incorrect assignments.
     * @param {WebSocket} ws - The closed WebSocket connection of the agent to remove.
     */
    removeAgent(ws) {
        let agentToRemove = null;
        // This reverse lookup is necessary because we only have the 'ws' object on disconnect.
        for (const [id, agent] of this.agents.entries()) {
            if (agent.ws === ws) {
                agentToRemove = { id, agent };
                break;
            }
        }
        
        if (agentToRemove) {
            // Remove the agent from all capability sets it was a part of.
            agentToRemove.agent.capabilities.forEach(capability => {
                const capabilitySet = this.capabilities.get(capability);
                if (capabilitySet) {
                    capabilitySet.delete(agentToRemove.id);
                    if (capabilitySet.size === 0) {
                        this.capabilities.delete(capability);
                    }
                }
            });
            
            this.agents.delete(agentToRemove.id);
            console.log(`Agent ${agentToRemove.id} removed. Total agents: ${this.agents.size}`);
        }
    }
    
    /**
     * Retrieves a single agent object by its unique ID.
     * @param {string} agentId - Unique agent identifier.
     * @returns {object | undefined} The agent object if found, otherwise undefined.
     */
    getAgent(agentId) {
        return this.agents.get(agentId);
    }
    
    /**
     * Updates an agent's status and its last heartbeat timestamp.
     * This is called when an agent reports a status change or sends a periodic heartbeat.
     * @param {string} agentId - The ID of the agent to update.
     * @param {string} status - The agent's new status ('idle', 'busy', etc.).
     */
    updateAgentStatus(agentId, status) {
        const agent = this.agents.get(agentId);
        if (agent) {
            agent.status = status;
            agent.lastHeartbeat = new Date();
            
            // This timestamp is a key feature for load balancing decisions.
            if (status === 'idle') {
                agent.lastTaskCompletedAt = new Date();
            }
        }
    }
    
    /**
     * Retrieves a list of all idle agents that possess a required set of capabilities.
     * This is used to gather a pool of potential candidates before sending them to the
     * ML router for the final, optimal decision.
     * @param {string[]} [requiredCapabilities=[]] - An array of capability strings the agent must have.
     * @returns {object[]} An array of qualified, idle agent objects.
     */
    getIdleAgents(requiredCapabilities = []) {
        const idleAgents = [];
        
        for (const agent of this.agents.values()) {
            // Ensure the agent is available and has all the necessary skills for the task.
            if (agent.status === 'idle') {
                const hasAllCapabilities = requiredCapabilities.every(
                    cap => agent.capabilities.includes(cap)
                );
                
                if (hasAllCapabilities) {
                    idleAgents.push(agent);
                }
            }
        }
        
        // The list of candidates is returned unsorted, as the final sorting/decision
        // is now handled by the external ML router service.
        return idleAgents;
    }
    
    /**
     * Provides a sanitized list of all agents, suitable for broadcasting to a UI.
     * It removes sensitive data like the raw WebSocket connection object.
     * @returns {object[]} An array of public-safe agent data.
     */
    getAllAgents() {
        return Array.from(this.agents.values()).map(agent => ({
            id: agent.id,
            capabilities: agent.capabilities,
            status: agent.status,
            registeredAt: agent.registeredAt,
            lastHeartbeat: agent.lastHeartbeat
        }));
    }
    
    /**
     * Aggregates and returns high-level statistics about the agent fleet,
     * used for populating the monitoring dashboard.
     * @returns {object} An object containing agent counts and a list of all registered capabilities.
     */
    getStats() {
        const stats = {
            total: this.agents.size,
            idle: 0,
            busy: 0,
            offline: 0,
            capabilities: Array.from(this.capabilities.keys())
        };
        
        for (const agent of this.agents.values()) {
            stats[agent.status] = (stats[agent.status] || 0) + 1;
        }
        
        return stats;
    }
    
    /**
     * A periodic health check that iterates through all registered agents.
     * If an agent has not sent a heartbeat within the timeout period, it is
     * marked as 'offline' to prevent it from being assigned new tasks.
     */
    checkHeartbeats() {
        const now = new Date();
        const heartbeatTimeout = 60000; // 60 seconds
        
        for (const [agentId, agent] of this.agents.entries()) {
            // This check only applies to agents that are supposed to be online.
            if (agent.status !== 'offline' && agent.lastHeartbeat) {
                const timeSinceHeartbeat = now - agent.lastHeartbeat;
                if (timeSinceHeartbeat > heartbeatTimeout) {
                    console.warn(`Agent ${agentId} heartbeat timeout. Marking as offline.`);
                    this.updateAgentStatus(agentId, 'offline');
                }
            }
        }
    }

    /**
     * @deprecated Heuristic-based routing logic. This has been replaced by the external Python ML service.
     * This function is preserved for reference and potential fallback scenarios.
     */
    getBestAgentForTask(task, availableAgents = null) {
        // ... implementation is obsolete ...
    }

    /**
     * @deprecated Heuristic scoring algorithm. This has been replaced by the ML model's predictions.
     * This function is preserved for reference.
     */
    calculateTaskAgentScore(task, agent) {
        // ... implementation is obsolete ...
    }
    
    /**
     * @deprecated Heuristic scoring based on agent properties only. Replaced by ML model.
     * This function is preserved for reference.
     */
    calculateAgentScore(agent) {
        // ... implementation is obsolete ...
    }
}

module.exports = AgentManager;
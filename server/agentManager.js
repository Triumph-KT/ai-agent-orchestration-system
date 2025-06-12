/**
 * Agent Management System
 * 
 * Manages the lifecycle, capabilities, and performance tracking of AI agents
 * in the orchestration system. Implements efficient agent lookup, load balancing,
 * and health monitoring similar to container orchestration platforms.
 * 
 * Key Features:
 * - Capability-based agent indexing for O(1) capability lookups
 * - Performance-based agent scoring for optimal task assignment
 * - Health monitoring with heartbeat tracking
 * - Load balancing across available agents
 * 
 * @author Triumph Kia Teh
 * @version 1.0.0
 */

/**
 * Centralized agent management system for the AI orchestration platform
 */
class AgentManager {
    /**
     * Initialize agent management with optimized data structures
     */
    constructor() {
        // Primary agent storage: agentId -> agent object
        this.agents = new Map();
        
        // Capability index for fast agent lookup: capability -> Set of agentIds
        this.capabilities = new Map();
    }
    
    /**
     * Register a new agent in the system with capability indexing
     * @param {Object} agent - Agent object containing id, capabilities, ws connection, etc.
     */
    addAgent(agent) {
        this.agents.set(agent.id, agent);
        
        // Build capability index for efficient task-agent matching
        agent.capabilities.forEach(capability => {
            if (!this.capabilities.has(capability)) {
                this.capabilities.set(capability, new Set());
            }
            this.capabilities.get(capability).add(agent.id);
        });
        
        console.log(`Agent ${agent.id} added. Total agents: ${this.agents.size}`);
    }
    
    /**
     * Remove an agent from the system using WebSocket connection lookup
     * Cleans up all indexes and references
     * @param {WebSocket} ws - WebSocket connection of the agent to remove
     */
    removeAgent(ws) {
        // Find agent by WebSocket connection (reverse lookup)
        let agentToRemove = null;
        for (const [id, agent] of this.agents.entries()) {
            if (agent.ws === ws) {
                agentToRemove = { id, agent };
                break;
            }
        }
        
        if (agentToRemove) {
            // Clean up capability index
            agentToRemove.agent.capabilities.forEach(capability => {
                const capabilitySet = this.capabilities.get(capability);
                if (capabilitySet) {
                    capabilitySet.delete(agentToRemove.id);
                    // Remove empty capability entries
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
     * Retrieve agent by ID
     * @param {string} agentId - Unique agent identifier
     * @returns {Object|undefined} Agent object or undefined if not found
     */
    getAgent(agentId) {
        return this.agents.get(agentId);
    }
    
    /**
     * Update agent status and performance metrics
     * @param {string} agentId - Agent identifier
     * @param {string} status - New status ('idle', 'busy', 'offline')
     */
    updateAgentStatus(agentId, status) {
        const agent = this.agents.get(agentId);
        if (agent) {
            agent.status = status;
            agent.lastHeartbeat = new Date();
            
            // Track performance metrics for load balancing
            if (status === 'idle') {
                agent.lastTaskCompletedAt = new Date();
            }
        }
    }
    
    /**
     * Get all idle agents that match required capabilities, sorted by performance
     * @param {Array<string>} requiredCapabilities - List of required capabilities
     * @returns {Array<Object>} Sorted list of qualified idle agents
     */
    getIdleAgents(requiredCapabilities = []) {
        const idleAgents = [];
        
        // Filter agents by status and capability requirements
        for (const agent of this.agents.values()) {
            if (agent.status === 'idle') {
                // Verify agent has all required capabilities
                const hasCapabilities = requiredCapabilities.every(
                    capability => agent.capabilities.includes(capability)
                );
                
                if (hasCapabilities) {
                    idleAgents.push(agent);
                }
            }
        }
        
        // Sort by performance score (highest score first for optimal assignment)
        return idleAgents.sort((a, b) => {
            const aScore = this.calculateAgentScore(a);
            const bScore = this.calculateAgentScore(b);
            return bScore - aScore;
        });
    }
    
    /**
     * Calculate agent performance score for load balancing
     * Higher scores indicate better candidates for task assignment
     * @param {Object} agent - Agent object
     * @returns {number} Performance score
     */
    calculateAgentScore(agent) {
        // Time-based availability scoring for load distribution
        const timeSinceLastTask = agent.lastTaskCompletedAt 
            ? Date.now() - agent.lastTaskCompletedAt.getTime()
            : 0;
        
        // Prefer agents that haven't worked recently (load balancing)
        const availabilityScore = Math.min(timeSinceLastTask / (1000 * 60), 100);
        
        // Capability diversity bonus (agents with more capabilities get higher scores)
        const capabilityScore = agent.capabilities.length * 10;
        
        return availabilityScore + capabilityScore;
    }
    
    /**
     * Get sanitized agent data for external consumption
     * @returns {Array<Object>} Array of agent data without sensitive information
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
     * Generate system statistics for monitoring and dashboard
     * @returns {Object} Comprehensive agent statistics
     */
    getStats() {
        const stats = {
            total: this.agents.size,
            idle: 0,
            busy: 0,
            offline: 0,
            capabilities: Array.from(this.capabilities.keys())
        };
        
        // Count agents by status
        for (const agent of this.agents.values()) {
            stats[agent.status] = (stats[agent.status] || 0) + 1;
        }
        
        return stats;
    }
    
    /**
     * Monitor agent health via heartbeat timeouts
     * Marks unresponsive agents as offline
     */
    checkHeartbeats() {
        const now = new Date();
        const heartbeatTimeout = 60000; // 60 seconds timeout
        
        for (const [agentId, agent] of this.agents.entries()) {
            const timeSinceHeartbeat = now - agent.lastHeartbeat;
            
            if (timeSinceHeartbeat > heartbeatTimeout) {
                console.log(`Agent ${agentId} heartbeat timeout, marking as offline`);
                agent.status = 'offline';
                
                // Future enhancement: implement automatic reconnection logic
            }
        }
    }
    
    /**
     * Advanced agent selection for ML-based task routing
     * This method will be enhanced with machine learning models
     * @param {Object} task - Task object with requirements
     * @param {Array<Object>} availableAgents - Optional pre-filtered agent list
     * @returns {Object|null} Best agent for the task or null if none available
     */
    getBestAgentForTask(task, availableAgents = null) {
        const candidates = availableAgents || this.getIdleAgents(task.requiredCapabilities);
        
        if (candidates.length === 0) return null;
        
        // Current implementation uses heuristic scoring
        // Future: integrate machine learning model for optimal selection
        let bestAgent = null;
        let bestScore = -1;
        
        candidates.forEach(agent => {
            const score = this.calculateTaskAgentScore(task, agent);
            if (score > bestScore) {
                bestScore = score;
                bestAgent = agent;
            }
        });
        
        return bestAgent;
    }
    
    /**
     * Calculate task-specific agent compatibility score
     * Will be replaced with ML model predictions
     * @param {Object} task - Task object
     * @param {Object} agent - Agent object
     * @returns {number} Compatibility score
     */
    calculateTaskAgentScore(task, agent) {
        let score = 0;
        
        // Capability matching bonus
        const matchingCapabilities = task.requiredCapabilities.filter(
            cap => agent.capabilities.includes(cap)
        ).length;
        score += matchingCapabilities * 20;
        
        // Load balancing consideration
        const timeSinceLastTask = agent.lastTaskCompletedAt 
            ? Date.now() - agent.lastTaskCompletedAt.getTime()
            : Infinity;
        score += Math.min(timeSinceLastTask / 1000, 100);
        
        // Priority-based urgency bonus
        if (task.priority === 'high') {
            score += 50;
        }
        
        return score;
    }
}

module.exports = AgentManager;
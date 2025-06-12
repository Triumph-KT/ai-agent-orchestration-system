/**
 * Task Queue Management System
 * 
 * Implements a priority-based task queue with real-time assignment capabilities.
 * Handles task lifecycle management, performance analytics, and provides data
 * for machine learning model training. Similar to job queue systems used in
 * distributed computing environments.
 * 
 * Key Features:
 * - Priority-based task ordering with dynamic insertion
 * - Capability-based task filtering for agent matching
 * - Comprehensive task lifecycle tracking
 * - Performance metrics calculation for system optimization
 * - ML training data generation from historical task data
 * 
 * @author Triumph Kia Teh
 * @version 1.0.0
 */

/**
 * Advanced task queue system for AI agent orchestration
 */
class TaskQueue {
    /**
     * Initialize task queue with optimized data structures for different task states
     */
    constructor() {
        // Primary task storage: taskId -> complete task object
        this.tasks = new Map();
        
        // Priority-ordered pending tasks (task IDs only for memory efficiency)
        this.pendingTasks = [];
        
        // Currently executing tasks: taskId -> agentId
        this.activeTasks = new Map();
        
        // Completed task results: taskId -> result object
        this.completedTasks = new Map();
        
        // Historical data for analytics and ML model training
        this.taskHistory = [];
    }
    
    /**
     * Add a new task to the queue with automatic priority insertion
     * @param {Object} task - Task object containing type, payload, priority, etc.
     * @returns {string} Task ID
     */
    addTask(task) {
        // Initialize task state management fields
        task.status = 'pending';
        task.assignedAgent = null;
        task.assignedAt = null;
        task.completedAt = null;
        task.result = null;
        
        this.tasks.set(task.id, task);
        this.insertTaskByPriority(task.id);
        
        console.log(`Task ${task.id} added to queue. Queue size: ${this.pendingTasks.length}`);
        return task.id;
    }
    
    /**
     * Insert task into priority-ordered queue maintaining sort order
     * Uses insertion sort for small queues, efficient for real-time systems
     * @param {string} taskId - Task identifier to insert
     */
    insertTaskByPriority(taskId) {
        const task = this.tasks.get(taskId);
        const priority = this.getPriorityValue(task.priority);
        
        // Find correct insertion point (higher priority first)
        let insertIndex = 0;
        while (insertIndex < this.pendingTasks.length) {
            const existingTask = this.tasks.get(this.pendingTasks[insertIndex]);
            const existingPriority = this.getPriorityValue(existingTask.priority);
            
            if (priority > existingPriority) {
                break;
            }
            insertIndex++;
        }
        
        this.pendingTasks.splice(insertIndex, 0, taskId);
    }
    
    /**
     * Convert priority string to numeric value for comparison
     * @param {string} priority - Priority level ('low', 'normal', 'high', 'urgent')
     * @returns {number} Numeric priority value
     */
    getPriorityValue(priority) {
        const priorityMap = {
            'low': 1,
            'normal': 2,
            'high': 3,
            'urgent': 4
        };
        return priorityMap[priority] || 2;
    }
    
    /**
     * Get the next highest priority task that matches agent capabilities
     * Implements capability-based filtering for efficient agent-task matching
     * @param {Array<string>} agentCapabilities - List of agent capabilities
     * @returns {Object|null} Next assignable task or null if none available
     */
    getNextTask(agentCapabilities = []) {
        // Search priority-ordered queue for first matching task
        for (let i = 0; i < this.pendingTasks.length; i++) {
            const taskId = this.pendingTasks[i];
            const task = this.tasks.get(taskId);
            
            if (this.canAgentHandleTask(task, agentCapabilities)) {
                // Remove from pending queue atomically
                this.pendingTasks.splice(i, 1);
                return task;
            }
        }
        
        return null; // No compatible tasks available
    }
    
    /**
     * Verify if agent capabilities satisfy task requirements
     * @param {Object} task - Task object with requiredCapabilities array
     * @param {Array<string>} agentCapabilities - Agent's capability list
     * @returns {boolean} True if agent can handle the task
     */
    canAgentHandleTask(task, agentCapabilities) {
        // All required capabilities must be present in agent's capability set
        return task.requiredCapabilities.every(
            capability => agentCapabilities.includes(capability)
        );
    }
    
    /**
     * Assign a task to a specific agent with timestamp tracking
     * @param {string} taskId - Task identifier
     * @param {string} agentId - Agent identifier
     * @returns {boolean} Success status of assignment
     */
    assignTask(taskId, agentId) {
        const task = this.tasks.get(taskId);
        if (!task) {
            console.error(`Task ${taskId} not found`);
            return false;
        }
        
        // Update task state atomically
        task.status = 'assigned';
        task.assignedAgent = agentId;
        task.assignedAt = new Date();
        
        // Move to active task tracking
        this.activeTasks.set(taskId, agentId);
        
        console.log(`Task ${taskId} assigned to agent ${agentId}`);
        return true;
    }
    
    /**
     * Mark task as completed and collect performance metrics
     * @param {string} taskId - Task identifier
     * @param {Object} result - Task execution result
     * @returns {boolean} Success status of completion
     */
    completeTask(taskId, result) {
        const task = this.tasks.get(taskId);
        if (!task) {
            console.error(`Task ${taskId} not found`);
            return false;
        }
        
        // Finalize task state
        task.status = 'completed';
        task.completedAt = new Date();
        task.result = result;
        
        // Move from active to completed tracking
        this.activeTasks.delete(taskId);
        this.completedTasks.set(taskId, result);
        
        // Archive for performance analysis and ML training
        this.addToHistory(task);
        
        console.log(`Task ${taskId} completed. Duration: ${task.completedAt - task.assignedAt}ms`);
        return true;
    }
    
    /**
     * Archive completed task data for analytics and ML model training
     * @param {Object} task - Completed task object
     */
    addToHistory(task) {
        const historyEntry = {
            taskId: task.id,
            type: task.type,
            priority: task.priority,
            requiredCapabilities: task.requiredCapabilities,
            assignedAgent: task.assignedAgent,
            assignedAt: task.assignedAt,
            completedAt: task.completedAt,
            duration: task.completedAt - task.assignedAt,
            success: task.result && task.result.success !== false
        };
        
        this.taskHistory.push(historyEntry);
        
        // Implement sliding window to prevent memory growth
        if (this.taskHistory.length > 1000) {
            this.taskHistory = this.taskHistory.slice(-1000);
        }
    }
    
    /**
     * Handle task failure with automatic retry logic
     * @param {string} taskId - Failed task identifier
     * @param {Error} error - Error object describing the failure
     * @returns {boolean} Success status of failure handling
     */
    failTask(taskId, error) {
        const task = this.tasks.get(taskId);
        if (!task) {
            console.error(`Task ${taskId} not found`);
            return false;
        }
        
        task.status = 'failed';
        task.completedAt = new Date();
        task.error = error;
        
        this.activeTasks.delete(taskId);
        
        // Implement exponential backoff retry strategy
        task.retryCount = (task.retryCount || 0) + 1;
        
        if (task.retryCount < 3) {
            // Reset for retry
            task.status = 'pending';
            task.assignedAgent = null;
            task.assignedAt = null;
            this.insertTaskByPriority(taskId);
            console.log(`Task ${taskId} failed, retrying (attempt ${task.retryCount + 1})`);
        } else {
            console.log(`Task ${taskId} permanently failed after ${task.retryCount} attempts`);
            this.addToHistory(task);
        }
        
        return true;
    }
    
    /**
     * Get sanitized task data for external monitoring systems
     * @returns {Array<Object>} Array of task objects without sensitive data
     */
    getAllTasks() {
        return Array.from(this.tasks.values()).map(task => ({
            id: task.id,
            type: task.type,
            priority: task.priority,
            status: task.status,
            requiredCapabilities: task.requiredCapabilities,
            createdAt: task.createdAt,
            assignedAt: task.assignedAt,
            completedAt: task.completedAt,
            assignedAgent: task.assignedAgent
        }));
    }
    
    /**
     * Calculate comprehensive queue performance statistics
     * @returns {Object} Performance metrics for monitoring and optimization
     */
    getStats() {
        const stats = {
            pending: this.pendingTasks.length,
            active: this.activeTasks.size,
            completed: this.completedTasks.size,
            total: this.tasks.size,
            averageWaitTime: 0,
            averageCompletionTime: 0,
            successRate: 0
        };
        
        // Calculate performance metrics from historical data
        const completedTasks = this.taskHistory.filter(task => task.completedAt);
        
        if (completedTasks.length > 0) {
            // Average wait time (task creation to agent assignment)
            const waitTimes = completedTasks
                .filter(task => task.assignedAt)
                .map(task => task.assignedAt - task.createdAt);
            
            if (waitTimes.length > 0) {
                stats.averageWaitTime = waitTimes.reduce((a, b) => a + b, 0) / waitTimes.length;
            }
            
            // Average execution time (assignment to completion)
            const completionTimes = completedTasks.map(task => task.duration);
            stats.averageCompletionTime = completionTimes.reduce((a, b) => a + b, 0) / completionTimes.length;
            
            // Success rate calculation
            const successfulTasks = completedTasks.filter(task => task.success);
            stats.successRate = successfulTasks.length / completedTasks.length;
        }
        
        return stats;
    }
    
    /**
     * Export historical data in format suitable for ML model training
     * @returns {Array<Object>} Training data with features and target variables
     */
    getTrainingData() {
        return this.taskHistory.map(entry => ({
            // Feature variables for ML model
            taskType: entry.type,
            priority: this.getPriorityValue(entry.priority),
            requiredCapabilities: entry.requiredCapabilities,
            
            // Target variables for optimization
            assignedAgent: entry.assignedAgent,
            duration: entry.duration,
            success: entry.success
        }));
    }
    
    /**
     * Get task performance data for specific agent analysis
     * @param {string} agentId - Agent identifier
     * @returns {Array<Object>} Tasks completed by the specified agent
     */
    getTasksByAgent(agentId) {
        return this.taskHistory.filter(task => task.assignedAgent === agentId);
    }
    
    /**
     * Get pending tasks that match specific capability requirements
     * @param {Array<string>} capabilities - Required capability list
     * @returns {Array<Object>} Filtered pending tasks
     */
    getPendingTasksForCapabilities(capabilities) {
        return this.pendingTasks
            .map(taskId => this.tasks.get(taskId))
            .filter(task => this.canAgentHandleTask(task, capabilities));
    }
    
    /**
     * Periodic cleanup of old completed tasks to prevent memory leaks
     * Should be called periodically by the server maintenance system
     */
    cleanup() {
        const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
        
        for (const [taskId, task] of this.tasks.entries()) {
            if (task.status === 'completed' && task.completedAt < cutoffTime) {
                this.tasks.delete(taskId);
                this.completedTasks.delete(taskId);
            }
        }
    }
}

module.exports = TaskQueue;
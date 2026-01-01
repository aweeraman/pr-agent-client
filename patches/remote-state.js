/**
 * Remote conversation state management
 *
 * PATCHED: Fixed getAgentStatus() to use execution_status instead of agent_status
 * See RCA.md for details.
 */
import { RemoteEventsList } from '../events/remote-events-list';
const FULL_STATE_KEY = '__full_state__';
export class RemoteState {
    constructor(client, conversationId) {
        this.cachedState = null;
        this.lock = new AsyncLock();
        this.client = client;
        this.conversationId = conversationId;
        this._events = new RemoteEventsList(client, conversationId);
    }
    async getConversationInfo() {
        return await this.lock.acquire(async () => {
            // Return cached state if available
            if (this.cachedState !== null) {
                return this.cachedState;
            }
            // Fallback to REST API if no cached state
            const response = await this.client.get(`/api/conversations/${this.conversationId}`);
            // Handle the case where the API returns a full_state wrapper
            let conversationInfo;
            if (response.data.full_state) {
                conversationInfo = response.data.full_state;
            }
            else {
                conversationInfo = response.data;
            }
            this.cachedState = conversationInfo;
            return conversationInfo;
        });
    }
    async updateStateFromEvent(event) {
        await this.lock.acquire(async () => {
            // Handle full state snapshot
            if (event.key === FULL_STATE_KEY) {
                // Update cached state with the full snapshot
                if (this.cachedState === null) {
                    this.cachedState = {};
                }
                Object.assign(this.cachedState, event.value);
            }
            else {
                // Handle individual field updates
                if (this.cachedState === null) {
                    this.cachedState = {};
                }
                this.cachedState[event.key] = event.value;
            }
        });
    }
    createStateUpdateCallback() {
        return (event) => {
            if (event.kind === 'ConversationStateUpdateEvent') {
                this.updateStateFromEvent(event).catch((error) => {
                    console.error('Error updating state from event:', error);
                });
            }
        };
    }
    get events() {
        return this._events;
    }
    get id() {
        return this.conversationId;
    }
    async getAgentStatus() {
        const info = await this.getConversationInfo();
        // PATCHED: API returns execution_status, not agent_status
        const statusStr = info.execution_status || info.agent_status;
        if (statusStr === undefined || statusStr === null) {
            throw new Error(`execution_status/agent_status missing in conversation info: ${JSON.stringify(info)}`);
        }
        return statusStr;
    }
    async setAgentStatus(value) {
        throw new Error(`Setting agent_status on RemoteState has no effect. ` +
            `Remote agent status is managed server-side. Attempted to set: ${value}`);
    }
    async getConfirmationPolicy() {
        const info = await this.getConversationInfo();
        const policyData = info.confirmation_policy;
        if (policyData === undefined || policyData === null) {
            throw new Error(`confirmation_policy missing in conversation info: ${JSON.stringify(info)}`);
        }
        return policyData;
    }
    async getActivatedKnowledgeSkills() {
        const info = await this.getConversationInfo();
        return info.activated_knowledge_skills || [];
    }
    async getAgent() {
        const info = await this.getConversationInfo();
        const agentData = info.agent;
        if (agentData === undefined || agentData === null) {
            throw new Error(`agent missing in conversation info: ${JSON.stringify(info)}`);
        }
        return agentData;
    }
    async getWorkspace() {
        const info = await this.getConversationInfo();
        const workspace = info.workspace;
        if (workspace === undefined || workspace === null) {
            throw new Error(`workspace missing in conversation info: ${JSON.stringify(info)}`);
        }
        return workspace;
    }
    async getPersistenceDir() {
        const info = await this.getConversationInfo();
        const persistenceDir = info.persistence_dir;
        if (persistenceDir === undefined || persistenceDir === null) {
            throw new Error(`persistence_dir missing in conversation info: ${JSON.stringify(info)}`);
        }
        return persistenceDir;
    }
    async modelDump() {
        const info = await this.getConversationInfo();
        return info;
    }
    async modelDumpJson() {
        const data = await this.modelDump();
        return JSON.stringify(data);
    }
}
// Simple async lock implementation (reused from remote-events-list.ts)
class AsyncLock {
    constructor() {
        this.locked = false;
        this.queue = [];
    }
    async acquire(fn) {
        return new Promise((resolve, reject) => {
            const execute = async () => {
                try {
                    const result = await fn();
                    resolve(result);
                }
                catch (error) {
                    reject(error);
                }
                finally {
                    this.locked = false;
                    const next = this.queue.shift();
                    if (next) {
                        next();
                    }
                }
            };
            if (this.locked) {
                this.queue.push(execute);
            }
            else {
                this.locked = true;
                execute();
            }
        });
    }
}

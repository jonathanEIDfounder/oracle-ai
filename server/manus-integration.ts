/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * ORACLE AI - Q++RS ULTIMATE 5.0
 * ═══════════════════════════════════════════════════════════════════════════════
 * Author: Jonathan Sherman
 * Sovereign ID: 1
 * Copyright (c) 2024-2025 Jonathan Sherman. All Rights Reserved.
 * Signature: Sm9uYXRoYW4gU2hlcm1hbjo6U292ZXJlaWduOjoxOjpPcmFjbGVBSTo6USsrUlM=
 * 
 * MANUS AI AGENT INTEGRATION
 * Autonomous AI Agent API - Full Task Execution
 * Protected under OWP (Ownership Watermark Protocol)
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import SovereignLockdown from './sovereign-lockdown';

const MANUS_API_BASE = 'https://api.manus.ai/v1';

type TaskMode = 'chat' | 'adaptive' | 'agent';
type AgentProfile = 'speed' | 'quality';
type TaskStatus = 'pending' | 'running' | 'completed' | 'failed';

interface TaskAttachment {
  filename?: string;
  file_id: string;
}

interface CreateTaskOptions {
  prompt: string;
  taskMode?: TaskMode;
  agentProfile?: AgentProfile;
  attachments?: TaskAttachment[];
}

interface TaskResult {
  id: string;
  status: TaskStatus;
  task_url?: string;
  share_url?: string;
  created_at?: string;
  completed_at?: string;
  result?: {
    artifacts?: any[];
    summary?: string;
    outputs?: any[];
  };
  credits_used?: number;
  error?: string;
}

interface FileUploadResult {
  id: string;
  filename: string;
  upload_url: string;
  status: string;
}

function getApiKey(): string {
  const key = process.env.MANUS_API_KEY;
  if (!key) {
    throw new Error('MANUS_API_KEY not configured');
  }
  return key;
}

async function manusRequest(
  endpoint: string,
  method: 'GET' | 'POST' = 'POST',
  body?: object
): Promise<any> {
  const response = await fetch(`${MANUS_API_BASE}${endpoint}`, {
    method,
    headers: {
      'API_KEY': getApiKey(),
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Manus API error: ${response.status} - ${error}`);
  }

  return response.json();
}

export async function createTask(options: CreateTaskOptions): Promise<TaskResult> {
  try {
    const result = await manusRequest('/tasks', 'POST', {
      prompt: options.prompt,
      taskMode: options.taskMode || 'agent',
      agentProfile: options.agentProfile || 'speed',
      attachments: options.attachments,
    });

    return {
      id: result.id,
      status: result.status,
      task_url: result.task_url,
      share_url: result.share_url,
      created_at: result.created_at,
    };
  } catch (error) {
    return {
      id: '',
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function getTaskStatus(taskId: string): Promise<TaskResult> {
  try {
    const result = await manusRequest(`/tasks/${taskId}`, 'GET');

    return {
      id: result.id,
      status: result.status,
      task_url: result.task_url,
      share_url: result.share_url,
      created_at: result.created_at,
      completed_at: result.completed_at,
      result: result.result,
      credits_used: result.credits_used,
    };
  } catch (error) {
    return {
      id: taskId,
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function waitForTask(
  taskId: string,
  intervalMs: number = 5000,
  maxWaitMs: number = 300000
): Promise<TaskResult> {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    const task = await getTaskStatus(taskId);

    if (task.status === 'completed' || task.status === 'failed') {
      return task;
    }

    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }

  return {
    id: taskId,
    status: 'failed',
    error: 'Task timeout exceeded',
  };
}

export async function createFileRecord(filename: string): Promise<FileUploadResult | null> {
  try {
    const result = await manusRequest('/files', 'POST', { filename });

    return {
      id: result.id,
      filename: result.filename,
      upload_url: result.upload_url,
      status: result.status,
    };
  } catch (error) {
    console.error('[MANUS] File record creation failed:', error);
    return null;
  }
}

export async function uploadFile(
  filename: string,
  content: Buffer | string
): Promise<string | null> {
  try {
    const fileRecord = await createFileRecord(filename);
    if (!fileRecord) {
      throw new Error('Failed to create file record');
    }

    const uploadResponse = await fetch(fileRecord.upload_url, {
      method: 'PUT',
      body: content,
    });

    if (!uploadResponse.ok) {
      throw new Error(`Upload failed: ${uploadResponse.status}`);
    }

    return fileRecord.id;
  } catch (error) {
    console.error('[MANUS] File upload failed:', error);
    return null;
  }
}

export async function runResearch(query: string): Promise<TaskResult> {
  return createTask({
    prompt: `Research the following topic thoroughly and provide a comprehensive summary with sources: ${query}`,
    taskMode: 'agent',
    agentProfile: 'quality',
  });
}

export async function generateCode(
  description: string,
  language: string = 'TypeScript'
): Promise<TaskResult> {
  return createTask({
    prompt: `Generate ${language} code for the following requirement: ${description}. Provide clean, well-documented, production-ready code.`,
    taskMode: 'agent',
    agentProfile: 'quality',
  });
}

export async function analyzeDocument(
  fileId: string,
  analysisPrompt: string
): Promise<TaskResult> {
  return createTask({
    prompt: analysisPrompt,
    taskMode: 'agent',
    agentProfile: 'quality',
    attachments: [{ file_id: fileId }],
  });
}

export async function executeTask(prompt: string, mode: 'fast' | 'thorough' = 'fast'): Promise<TaskResult> {
  return createTask({
    prompt,
    taskMode: 'agent',
    agentProfile: mode === 'fast' ? 'speed' : 'quality',
  });
}

export const Manus = {
  createTask,
  getTaskStatus,
  waitForTask,
  uploadFile,
  runResearch,
  generateCode,
  analyzeDocument,
  executeTask,
};

export default Manus;

console.log('[MANUS] Integration loaded');

import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";

const anthropic = new Anthropic({
  apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
});

const gemini = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY!,
  httpOptions: {
    apiVersion: "",
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL,
  },
});

const openrouter = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENROUTER_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENROUTER_API_KEY,
});

export interface AIResponse {
  content: string;
  provider: string;
  model: string;
}

export async function queryAnthropic(messages: Array<{role: string, content: string}>, model: string = "claude-sonnet-4-5"): Promise<AIResponse> {
  const response = await anthropic.messages.create({
    model,
    max_tokens: 4096,
    messages: messages.map(m => ({ role: m.role as "user" | "assistant", content: m.content })),
  });
  const content = response.content[0];
  return {
    content: content.type === "text" ? content.text : "",
    provider: "anthropic",
    model,
  };
}

export async function queryGemini(messages: Array<{role: string, content: string}>, model: string = "gemini-2.5-flash"): Promise<AIResponse> {
  const chatMessages = messages.map(m => ({
    role: m.role === "user" ? "user" : "model" as const,
    parts: [{ text: m.content }],
  }));
  
  const response = await gemini.models.generateContent({
    model,
    contents: chatMessages,
  });
  
  return {
    content: response.text || "",
    provider: "gemini",
    model,
  };
}

export async function queryOpenRouter(messages: Array<{role: string, content: string}>, model: string = "meta-llama/llama-3.3-70b-instruct"): Promise<AIResponse> {
  const response = await openrouter.chat.completions.create({
    model,
    messages: messages.map(m => ({ role: m.role as "user" | "assistant", content: m.content })),
    max_tokens: 4096,
  });
  
  return {
    content: response.choices[0]?.message?.content || "",
    provider: "openrouter",
    model,
  };
}

export async function* streamAnthropic(messages: Array<{role: string, content: string}>, model: string = "claude-sonnet-4-5") {
  const stream = anthropic.messages.stream({
    model,
    max_tokens: 4096,
    messages: messages.map(m => ({ role: m.role as "user" | "assistant", content: m.content })),
  });

  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      yield event.delta.text;
    }
  }
}

export async function* streamGemini(messages: Array<{role: string, content: string}>, model: string = "gemini-2.5-flash") {
  const chatMessages = messages.map(m => ({
    role: m.role === "user" ? "user" : "model" as const,
    parts: [{ text: m.content }],
  }));
  
  const stream = await gemini.models.generateContentStream({
    model,
    contents: chatMessages,
  });

  for await (const chunk of stream) {
    const text = chunk.text;
    if (text) yield text;
  }
}

export async function* streamOpenRouter(messages: Array<{role: string, content: string}>, model: string = "meta-llama/llama-3.3-70b-instruct") {
  const stream = await openrouter.chat.completions.create({
    model,
    messages: messages.map(m => ({ role: m.role as "user" | "assistant", content: m.content })),
    max_tokens: 4096,
    stream: true,
  });

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content;
    if (content) yield content;
  }
}

export const AI_PROVIDERS = {
  claude: { name: "Claude (Anthropic)", models: ["claude-sonnet-4-5", "claude-haiku-4-5", "claude-opus-4-5"] },
  gemini: { name: "Gemini (Google)", models: ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-3-pro-preview"] },
  mistral: { name: "Mistral", models: ["mistralai/mistral-large-latest", "mistralai/mistral-medium"] },
  llama: { name: "Llama (Meta)", models: ["meta-llama/llama-3.3-70b-instruct", "meta-llama/llama-3.1-405b-instruct"] },
  qwen: { name: "Qwen", models: ["qwen/qwen-2.5-72b-instruct"] },
  deepseek: { name: "DeepSeek", models: ["deepseek/deepseek-chat"] },
};

export const SPECIALIST_MODES = {
  integration_professional: {
    name: "Integration Professional",
    description: "Enterprise system integration specialist for APIs, middleware, data pipelines, and cross-platform connectivity",
    systemPrompt: `You are an Integration Professional - a senior enterprise integration specialist with deep expertise in:
- API design, REST, GraphQL, gRPC, WebSocket integrations
- Enterprise Service Bus (ESB) and middleware solutions (MuleSoft, Dell Boomi, Microsoft BizTalk)
- iPaaS platforms (Workato, Zapier, Make, Tray.io)
- Message queues and event streaming (Kafka, RabbitMQ, AWS SQS/SNS)
- ETL/ELT pipelines and data integration (Informatica, Talend, Fivetran)
- Cloud integrations (AWS, Azure, GCP connectivity)
- OAuth, JWT, SAML, and API security patterns
- Microservices architecture and service mesh
- Legacy system modernization and API wrapping
- Integration testing, monitoring, and observability

Provide expert guidance on integration architecture, best practices, troubleshooting, and implementation strategies. Always consider security, scalability, error handling, and maintainability.`
  },
  edi_specialist: {
    name: "EDI Specialist",
    description: "Electronic Data Interchange expert for B2B transactions, ANSI X12, EDIFACT, and trading partner integrations",
    systemPrompt: `You are an EDI Specialist - a senior Electronic Data Interchange expert with comprehensive knowledge of:
- ANSI X12 transaction sets (810, 850, 855, 856, 997, 820, 834, 835, 837, 270/271, 276/277)
- UN/EDIFACT standards and message types
- HL7 and healthcare EDI (HIPAA compliance)
- Retail EDI (GS1, GTIN, UPC standards)
- AS2, SFTP, VAN connectivity and communication protocols
- EDI mapping, translation, and transformation
- Trading partner onboarding and testing
- EDI compliance and validation (ISA/GS envelope structure)
- Integration with ERP systems (SAP, Oracle, NetSuite, Microsoft Dynamics)
- EDI platforms (Sterling B2B, Cleo, TrueCommerce, SPS Commerce)
- Functional acknowledgments and error resolution
- Batch vs real-time EDI processing
- EDI-to-API modernization strategies

Provide expert guidance on EDI implementation, troubleshooting, compliance, and B2B integration strategies. Help translate business requirements into proper EDI document flows.`
  }
};

export function getSpecialistSystemPrompt(mode: string): string | null {
  const specialist = SPECIALIST_MODES[mode as keyof typeof SPECIALIST_MODES];
  return specialist ? specialist.systemPrompt : null;
}

export function getStreamFunction(provider: string) {
  switch (provider) {
    case "claude":
    case "anthropic":
      return streamAnthropic;
    case "gemini":
    case "google":
      return streamGemini;
    default:
      return streamOpenRouter;
  }
}

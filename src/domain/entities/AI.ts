import type { AIProviderName } from '../enums/AIProviderName';
import type { IAIAdapter } from '../ports/IAIAdapter';

// Domain Entity — AI là thực thể hệ thống, không phải SDK cụ thể.
// Hôm nay Claude/Gemini/Grok/OpenAI, mai thêm provider mới chỉ cần:
//   1. Thêm giá trị vào AIProviderName enum
//   2. Tạo adapter mới implement IAIAdapter trong infrastructure/ai/
//   3. Đăng ký trong AiRouterFactory — không đụng domain.
export interface AIEntity {
  provider: AIProviderName;
  model: string;
  adapter: IAIAdapter;
}

export interface AIRequest {
  provider: AIProviderName;
  model?: string;
  content: import('../../types').FileContent;
  systemPrompt: string;
}

export function isSupportedProvider(value: string): value is AIProviderName {
  return ['claude', 'gemini', 'grok', 'openai'].includes(value);
}

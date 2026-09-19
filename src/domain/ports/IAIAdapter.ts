import type { FileContent } from '../../types';

// Domain Port — AI là thực thể pluggable của hệ thống.
// Bất kỳ AI mới (hôm nay Claude, mai Grok, mốt provider khác) chỉ cần implement port này
// và đăng ký trong factory, không đụng domain/application.
export interface IAIAdapter {
  process(content: FileContent, systemPrompt: string, model: string): Promise<string>;
  validate(): Promise<void>;
}

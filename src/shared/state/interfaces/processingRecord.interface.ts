import { ProcessingStatus } from '../enums/processingRecord.enums';

export interface ProcessingRecord {
  fileId: string;
  fileName: string;
  accountIndex: number;
  status: ProcessingStatus;
  retryCount: number;
  updatedAt: string;
  error?: string;
}

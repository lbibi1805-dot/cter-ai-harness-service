// Thin controller — delegates to VaultApplicationService (extracted from api/server.ts:243)
import type { IncomingMessage, ServerResponse } from 'http';
import { VaultApplicationService } from '../../../application/VaultApplicationService';

export class VaultController {
  constructor(private vaultService: VaultApplicationService) {}

  async handle(req: IncomingMessage, res: ServerResponse, pathname: string, query: Record<string, string>): Promise<void> {
    // Placeholder: delegates to service; full routing kept in api/server.ts for Phase 3 compatibility.
    // Phase 3 will move handleVault() logic here incrementally.
    res.writeHead(501, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'VaultController not yet wired — use api/server.ts handleVault' }));
  }
}

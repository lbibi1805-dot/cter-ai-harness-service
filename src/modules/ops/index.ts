import { Router } from '../../shared/http/router';
import { HeartbeatCron } from './application/heartbeatCron.service';
import { OpsService } from './application/ops.service';
import { OpsController } from './presentation/ops.controller';
import { createOpsRoutes } from './presentation/ops.routes';
import { HeartbeatSettings } from './application/interfaces/heartbeatCron.interface';
import { OpsStatusSource } from './application/interfaces/ops.interface';

export interface OpsModuleConfig {
  port: number;
  heartbeat: HeartbeatSettings;
  adminToken?: string;
}

export interface OpsModule {
  router: Router;
  heartbeat: HeartbeatCron;
}

export function createOpsModule(config: OpsModuleConfig, source: OpsStatusSource): OpsModule {
  const heartbeat = new HeartbeatCron(config.heartbeat, config.port);
  const router = new Router(createOpsRoutes(new OpsController(new OpsService(source), heartbeat)), config.adminToken);
  return { router, heartbeat };
}

export { HeartbeatCron } from './application/heartbeatCron.service';
export { OpsService } from './application/ops.service';
export { maskEmail } from './domain/emailMask';
export * from './domain/constants/ops.constants';
export type { HeartbeatSettings } from './application/interfaces/heartbeatCron.interface';
export type { OpsStatusSource } from './application/interfaces/ops.interface';

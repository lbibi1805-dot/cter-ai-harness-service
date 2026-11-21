import type { Router } from '../../../shared/http/router';
import type { HeartbeatCron } from '../application/heartbeatCron.service';
import type { HeartbeatSettings } from '../application/interfaces/heartbeatCron.interface';

export interface OpsModuleConfig {
  port: number;
  heartbeat: HeartbeatSettings;
  adminToken?: string;
}

export interface OpsModule {
  router: Router;
  heartbeat: HeartbeatCron;
}

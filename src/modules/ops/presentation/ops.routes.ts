import { HttpMethod } from '../../../shared/http/enums/http.enums';
import type { OpsController } from './ops.controller';
import { exactPath } from '../../../shared/http/helpers/router.helper';
import { Route } from '../../../shared/http/interfaces/router.interface';
import { OpsApiPath } from '../domain/enums/ops.enums';
import { anyOf } from './helpers/ops.helper';

export function createOpsRoutes(controller: OpsController): Route[] {
  return [
    { method: HttpMethod.GET, match: exactPath(OpsApiPath.ROOT), handler: controller.root },
    { method: HttpMethod.GET, match: exactPath(OpsApiPath.PING), handler: controller.ping },
    { method: HttpMethod.GET, match: exactPath(OpsApiPath.HEALTH), handler: controller.health },
    { method: HttpMethod.GET, match: exactPath(OpsApiPath.HEALTH_DEEP), requiresAuth: true, handler: controller.deepHealth },
    { method: HttpMethod.GET, match: exactPath(OpsApiPath.OPENAPI), handler: controller.openApiSpec },
    { method: HttpMethod.GET, match: anyOf(OpsApiPath.DOCS, OpsApiPath.DOCS_SLASH), handler: controller.docs },
    { method: HttpMethod.GET, match: exactPath(OpsApiPath.LOGS), handler: controller.logs },
    { method: HttpMethod.DELETE, match: exactPath(OpsApiPath.LOGS), requiresAuth: true, handler: controller.clearLogs },
    { method: HttpMethod.GET, match: exactPath(OpsApiPath.AI_USAGE), handler: controller.aiUsage },
    { method: HttpMethod.GET, match: exactPath(OpsApiPath.CANVAS_ACCOUNTS), handler: controller.canvasAccounts },
    { method: HttpMethod.GET, match: exactPath(OpsApiPath.STORAGE_CHECK), requiresAuth: true, handler: controller.storageCheck },
    { method: HttpMethod.GET, match: exactPath(OpsApiPath.STORAGE_STATS), requiresAuth: true, handler: controller.storageStats },
    { method: HttpMethod.GET, match: exactPath(OpsApiPath.METRICS_DB), requiresAuth: true, handler: controller.dbMetrics },
    { method: HttpMethod.GET, match: exactPath(OpsApiPath.METRICS_LATENCY), requiresAuth: true, handler: controller.latency },
    { method: HttpMethod.GET, match: exactPath(OpsApiPath.PROMPTS), requiresAuth: true, handler: controller.prompts },
    { method: HttpMethod.GET, match: exactPath(OpsApiPath.EVALS), requiresAuth: true, handler: controller.evals },
    { method: HttpMethod.GET, match: exactPath(OpsApiPath.CONFIG), requiresAuth: true, handler: controller.config },
    { method: HttpMethod.GET, match: exactPath(OpsApiPath.CRON), handler: controller.cronStatus },
    { method: HttpMethod.POST, match: exactPath(OpsApiPath.CRON), requiresAuth: true, handler: controller.updateCron },
  ];
}

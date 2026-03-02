import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { HEALTH_RESPONSE_SCHEMA } from './docs/swagger.schemas';

@ApiTags('Health')
@Controller()
export class HealthController {
  @Get()
  @ApiOperation({
    summary: 'API root status',
    description:
      'Returns a simple status payload and useful links for API consumers.',
  })
  @ApiOkResponse({
    description: 'Root endpoint is reachable.',
    schema: {
      type: 'object',
      properties: {
        service: { type: 'string', example: 'Comfort API' },
        status: { type: 'string', example: 'ok' },
        docs_url: { type: 'string', example: '/docs' },
        health_url: { type: 'string', example: '/health' },
      },
      required: ['service', 'status', 'docs_url', 'health_url'],
    },
  })
  public getRoot() {
    return {
      service: 'Comfort API',
      status: 'ok',
      docs_url: '/docs',
      health_url: '/health',
    };
  }

  @Get('health')
  @ApiOperation({
    summary: 'Health check',
    description:
      'Returns service liveness data for operations and monitoring probes.',
  })
  @ApiOkResponse({
    description: 'Service is alive.',
    schema: HEALTH_RESPONSE_SCHEMA,
  })
  public getHealth() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime_in_seconds: Math.floor(process.uptime()),
    };
  }
}

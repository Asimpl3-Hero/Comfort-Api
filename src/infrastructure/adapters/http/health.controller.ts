import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { HEALTH_RESPONSE_SCHEMA } from './docs/swagger.schemas';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  @Get()
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

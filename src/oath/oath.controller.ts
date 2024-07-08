import { Controller, Get } from '@nestjs/common';
import { OathService } from './oath.service';

@Controller()
export class OathController {
  constructor(private readonly service: OathService) {}

  @Get()
  getHello(): string {
    return this.service.getHello();
  }
}

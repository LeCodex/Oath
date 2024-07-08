import { Module } from '@nestjs/common';
import { OathController } from './oath.controller';
import { OathService } from './oath.service';

@Module({
  imports: [],
  controllers: [OathController],
  providers: [OathService],
})
export class OathModule {}
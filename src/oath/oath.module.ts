import { Module } from '@nestjs/common';
import { OathNestController } from './oath.controller';
import { OathNestService } from './oath.service';

@Module({
    imports: [],
    controllers: [OathNestController],
    providers: [OathNestService],
})
export class OathNestModule {}
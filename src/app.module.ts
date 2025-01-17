import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { OathNestModule } from './oath/oath.module';

@Module({
    imports: [OathNestModule],
    controllers: [AppController],
    providers: [AppService],
})
export class AppModule {}

import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { OathModule } from './oath/oath.module';

@Module({
    imports: [OathModule],
    controllers: [AppController],
    providers: [AppService],
})
export class AppModule {}

import { Injectable } from '@nestjs/common';

@Injectable()
export class OathService {
    getHello(): string {
        return 'Hello World!';
    }
}


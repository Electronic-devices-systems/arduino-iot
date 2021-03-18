import { ContainerModule } from 'inversify';
import { BackendApplicationContribution } from '@theia/core/lib/node/backend-application';

import * as http from 'http';

const port = 9876;

export default new ContainerModule((bind, unbind, isBound, rebind) => {
    bind(BackendApplicationContribution).toConstantValue(<BackendApplicationContribution>{
        onStart: () => {
            const server = http.createServer((request, response) => {
                console.log(request.url);
                response.statusCode = 200;
                response.end('OK')
            });
            server.listen(port, '127.0.0.1', () => {
                console.log(`Dummy Auth0 redirect-to-server listen on port ${port}.`);
            });
        }
    });
});

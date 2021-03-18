import { FileUri } from '@theia/core/lib/node/file-uri';
import { inject, injectable } from 'inversify';
import { dirname } from 'path';
import { CoreService } from '../common/protocol/core-service';
import { CompileReq, CompileResp } from './cli-protocol/commands/compile_pb';
import { CoreClientProvider } from './core-client-provider';
import { UploadReq, UploadResp, BurnBootloaderReq, BurnBootloaderResp } from './cli-protocol/commands/upload_pb';
import { OutputService } from '../common/protocol/output-service';
import { NotificationServiceServer } from '../common/protocol';

@injectable()
export class CoreServiceImpl implements CoreService {

    @inject(CoreClientProvider)
    protected readonly coreClientProvider: CoreClientProvider;

    @inject(OutputService)
    protected readonly outputService: OutputService;

    @inject(NotificationServiceServer)
    protected readonly notificationService: NotificationServiceServer;

    async compile(options: CoreService.Compile.Options): Promise<void> {
        this.outputService.append({ name: 'compile', chunk: 'Compiling...\n' + JSON.stringify(options, null, 2) + '\n--------------------------\n' });
        const { sketchUri, fqbn } = options;
        const sketchFilePath = FileUri.fsPath(sketchUri);
        const sketchpath = dirname(sketchFilePath);

        const coreClient = await this.coreClientProvider.client();
        if (!coreClient) {
            return;
        }
        const { client, instance } = coreClient;

        if (!fqbn) {
            throw new Error('The selected board has no FQBN.');
        }

        const compilerReq = new CompileReq();
        compilerReq.setInstance(instance);
        compilerReq.setSketchpath(sketchpath);
        compilerReq.setFqbn(fqbn);
        compilerReq.setOptimizefordebug(options.optimizeForDebug);
        compilerReq.setPreprocess(false);
        compilerReq.setVerbose(true);
        compilerReq.setQuiet(false);

        const result = client.compile(compilerReq);
        try {
            await new Promise<void>((resolve, reject) => {
                result.on('data', (cr: CompileResp) => {
                    this.outputService.append({ name: 'compile', chunk: Buffer.from(cr.getOutStream_asU8()).toString() });
                    this.outputService.append({ name: 'compile', chunk: Buffer.from(cr.getErrStream_asU8()).toString() });
                });
                result.on('error', error => reject(error));
                result.on('end', () => resolve());
            });
            this.outputService.append({ name: 'compile', chunk: '\n--------------------------\nCompilation complete.\n' });
        } catch (e) {
            this.outputService.append({ name: 'compile', chunk: `Compilation error: ${e}\n`, severity: 'error' });
            throw e;
        }
    }

    async upload(options: CoreService.Upload.Options): Promise<void> {
        await this.compile(options);
        this.outputService.append({ name: 'upload', chunk: 'Uploading...\n' + JSON.stringify(options, null, 2) + '\n--------------------------\n' });
        const { sketchUri, fqbn } = options;
        const sketchFilePath = FileUri.fsPath(sketchUri);
        const sketchpath = dirname(sketchFilePath);

        const coreClient = await this.coreClientProvider.client();
        if (!coreClient) {
            return;
        }
        const { client, instance } = coreClient;

        if (!fqbn) {
            throw new Error('The selected board has no FQBN.');
        }

        const uploadReq = new UploadReq();
        uploadReq.setInstance(instance);
        uploadReq.setSketchPath(sketchpath);
        uploadReq.setFqbn(fqbn);
        if ('programmer' in options) {
            uploadReq.setProgrammer(options.programmer.id);
        }
        if (options.port) {
            uploadReq.setPort(options.port);
        }
        const result = client.upload(uploadReq);

        try {
            await new Promise<void>((resolve, reject) => {
                result.on('data', (resp: UploadResp) => {
                    this.outputService.append({ name: 'upload', chunk: Buffer.from(resp.getOutStream_asU8()).toString() });
                    this.outputService.append({ name: 'upload', chunk: Buffer.from(resp.getErrStream_asU8()).toString() });
                });
                result.on('error', error => reject(error));
                result.on('end', () => resolve());
            });
            this.outputService.append({ name: 'upload', chunk: '\n--------------------------\nUpload complete.\n' });
        } catch (e) {
            this.outputService.append({ name: 'upload', chunk: `Upload error: ${e}\n`, severity: 'error' });
            throw e;
        }
    }

    async burnBootloader(options: CoreService.Bootloader.Options): Promise<void> {
        const coreClient = await this.coreClientProvider.client();
        if (!coreClient) {
            return;
        }
        const { fqbn, port, programmer } = options;
        if (!fqbn) {
            throw new Error('The selected board has no FQBN.');
        }
        if (!port) {
            throw new Error('Port must be specified.');
        }
        const { client, instance } = coreClient;
        const req = new BurnBootloaderReq();
        req.setFqbn(fqbn);
        req.setPort(port);
        req.setProgrammer(programmer.id);
        req.setInstance(instance);
        const result = client.burnBootloader(req);
        try {
            await new Promise<void>((resolve, reject) => {
                result.on('data', (resp: BurnBootloaderResp) => {
                    this.outputService.append({ name: 'bootloader', chunk: Buffer.from(resp.getOutStream_asU8()).toString() });
                    this.outputService.append({ name: 'bootloader', chunk: Buffer.from(resp.getErrStream_asU8()).toString() });
                });
                result.on('error', error => reject(error));
                result.on('end', () => resolve());
            });
        } catch (e) {
            this.outputService.append({ name: 'bootloader', chunk: `Error while burning the bootloader: ${e}\n`, severity: 'error' });
            throw e;
        }
    }

}

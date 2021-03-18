import { ArduinoCreateSketch, ArduinoCreateFile, ArduinoCreateUploadSketch, ArduinoCreateUploadFile, ArduinoCreateConflictResponse } from '../arduino-create-service';
import { inject, injectable } from 'inversify';
import { AuthService } from '../auth/auth-service';
import { Path, Disposable } from '@theia/core';
import { Event } from '@theia/core/lib/common/event';
import { FileSystemProvider, FileType, WatchOptions, FileDeleteOptions, FileWriteOptions, FileOverwriteOptions, Stat, FileChange, FileSystemProviderCapabilities } from '@theia/filesystem/lib/common/files';
import URI from '@theia/core/lib/common/uri';
import { CreateUri } from '../../common/create-uri';
import { FileService, FileServiceContribution } from '@theia/filesystem/lib/browser/file-service';

@injectable()
export class ArduinoCreateAPI implements FileSystemProvider, FileServiceContribution {

    readonly capabilities: FileSystemProviderCapabilities =
        FileSystemProviderCapabilities.FileReadWrite
        | FileSystemProviderCapabilities.PathCaseSensitive;
    readonly onDidChangeCapabilities: Event<void> = Event.None;

    protected userId: string;

    @inject(AuthService)
    protected authService: AuthService;

    readonly onDidChangeFile: Event<readonly FileChange[]>;
    readonly onFileWatchError: Event<void>;

    registerFileSystemProviders(service: FileService): void {
        service.onWillActivateFileSystemProvider(event => {
            if (event.scheme === CreateUri.SCHEME) {
                event.waitUntil((async () => {
                    service.registerProvider(CreateUri.SCHEME, this);
                })());
            }
        });
    }

    watch(resource: URI, opts: WatchOptions): Disposable {
        return Disposable.NULL;
    }

    // To calculate the file size, we use the following formula.
    // x = (n * (3/4)) - y
    // x: file size
    // n: length of the Base64 content
    // y: 2 if Base64 content ends with `==`. Otherwise it's 1.
    protected size(base64String: string): number {
        const n = base64String.length;
        const y = base64String.endsWith('==') ? 2 : 1;
        return (n * (3 / 4)) - y;
    }

    async stat(resource: URI): Promise<Stat> {
        try {
            // Assume, this resource is a file.
            const { data, modified_at } = await this.run({
                method: 'GET',
                endpoint: '/v2/files/f/' + encodeURI(CreateUri.path(resource)),
                operation: json => json
            });
            const size = this.size(btoa(data));
            const mtime = new Date(modified_at).getMilliseconds();
            const ctime = mtime;
            return {
                mtime,
                ctime,
                size,
                type: FileType.File
            }
        } catch (error) {
            if (error instanceof CreateError) {
                // The resource is a folder.
                // https://typefox.slack.com/archives/C01698YT7S4/p1602681540232600?thread_ts=1602592883.218600&cid=C01698YT7S4
                if (error.status === 422 || error.status === 500) {
                    const files = await this.readdir(resource);
                    const stats = await Promise.all(files.map(([name]) => this.stat(resource.resolve(name))));
                    const size = stats.map((size) => size).reduce((total, currentStat) => total + currentStat.size, 0);
                    const ctime = Math.min(...stats.map(stat => stat.ctime));
                    const mtime = Math.min(...stats.map(stat => stat.mtime));
                    return {
                        mtime,
                        ctime,
                        size,
                        type: FileType.Directory
                    }
                }
            }
            throw error;
        }

    }

    async mkdir(resource: URI): Promise<void> {

    }

    async delete(resource: URI, opts: FileDeleteOptions): Promise<void> {

    }

    async rename(from: URI, to: URI, opts: FileOverwriteOptions): Promise<void> {

    }

    async copy(from: URI, to: URI, opts: FileOverwriteOptions): Promise<void> {

    }

    async readdir(resource: URI): Promise<[string, FileType][]> {
        const files = await this.listFiles(CreateUri.path(resource));
        return files.map(file => ([file.name, FileType.Unknown]));
    }

    async readFile(resource: URI): Promise<Uint8Array> {
        const content = await this.readFile2(CreateUri.path(resource));
        return new TextEncoder().encode(content);
    }

    async writeFile(resource: URI, content: Uint8Array, opts: FileWriteOptions): Promise<void> {
        return this.writeFile2(CreateUri.path(resource), new TextDecoder().decode(content));
    }

    protected async run<T>(req: ArduinoCreateAPIRequestWithPayload<T> | ArduinoCreateAPIRequestWithoutPayload<T>): Promise<T> {
        const authToken = await this.authService.getToken();
        const param: { [key: string]: any } = {
            method: req.method,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': `Bearer ${authToken.access_token}`
            }
        };
        if (req.method === 'POST' || req.method === 'PUT') {
            param.body = JSON.stringify(req.payload);
        }
        const response = await fetch('https://api2.arduino.cc/create' + req.endpoint, param);
        if (!response.ok) {
            throw new CreateError(response.statusText, response.status)
        }
        const json = await response.json();
        return req.operation(json);
    }

    async getSketches(): Promise<ArduinoCreateSketch[]> {
        const sketches = await this.run({
            method: 'GET',
            endpoint: '/v2/sketches?user_id=me',
            operation: json => json.sketches
        });
        return sketches;
    }

    async getSketchByPath(path: string): Promise<ArduinoCreateSketch> {
        const sketches = await this.run({
            method: 'GET',
            endpoint: '/v2/sketches/byPath/' + encodeURI(path),
            operation: json => json
        });
        return sketches;
    }

    async addCreateSketch(sketch: ArduinoCreateUploadSketch, files: ArduinoCreateUploadFile[]): Promise<ArduinoCreateSketch | ArduinoCreateConflictResponse> {
        const sketchResponse: ArduinoCreateSketch = await this.run({
            method: 'PUT',
            endpoint: '/v2/sketches',
            payload: sketch,
            operation: json => json
        });
        if (sketchResponse && ArduinoCreateSketch.is(sketchResponse)) {
            await Promise.all(files.map(async file => {
                const sketchPath = new Path(sketchResponse.path);
                const filePath = sketchPath.join(file.name);
                await this.writeFile2(filePath.toString(), file.data);
            }));
        }
        console.log('ADD SKETCH', sketchResponse);
        return sketchResponse;
    }

    async deleteCreateSketch(path: string): Promise<void> {
        const res = await this.run({
            method: 'DELETE',
            endpoint: '/v2/sketches/byPath/' + encodeURI(path),
            operation: json => json
        });

        console.log('Delete Sketch', res);
    }

    async listFiles(sketchOrPath: string | ArduinoCreateSketch): Promise<ArduinoCreateFile[]> {
        const filePath = encodeURI(typeof sketchOrPath === 'string' ? sketchOrPath : sketchOrPath.path);
        const arduinoCreateFiles: ArduinoCreateFile[] = await this.run({
            method: 'GET',
            endpoint: '/v2/files/d/' + filePath,
            operation: json => json
        })
        return arduinoCreateFiles;
    }

    async readFile2(filePath: string): Promise<string> {
        const data: string = await this.run({
            method: 'GET',
            endpoint: '/v2/files/f/' + encodeURI(filePath),
            operation: json => json.data
        })
        return data;
    }

    /**
     * filePath: the relative path of the sketch  
     */
    async writeFile2(filePath: string, data: string): Promise<void> {
        const sketchPath = filePath.substr(0, filePath.lastIndexOf('/'));
        const before = await this.listFiles(sketchPath);

        let tries = 0;
        const time = Date.now();
        while (true) {
            const res = await this.run({
                method: 'POST',
                payload: { data },
                endpoint: '/v2/files/f/' + encodeURI(filePath),
                operation: json => json
            });
            await this.listFiles(sketchPath);
            const after = await this.listFiles(sketchPath);
            for (const f of after) {
                if (filePath.endsWith(f.name)) {
                    if (!before.find(b => b.name === f.name)) {
                        console.log('WRITTEN FILE:' + filePath, res);
                        return;
                    }
                    for (const x of before) {
                        if (x.name === f.name) {
                            if (x.modified_at === f.modified_at) {
                                console.error(x.name + '!!! ' + x.modified_at + ' - ' + f.modified_at);
                            } else {
                                console.log('WRITTEN FILE:' + filePath, res);
                                console.log(`updating took ${Date.now() - time} ms`);
                                return;
                            }
                        }
                    }
                }
            }
            if (tries++ > 20) {
                console.error("Coudln't update ", after, before);
                throw new Error('could not update');
            }
        }
    }

    async deleteFile(filePath: string): Promise<void> {
        await this.run({
            method: 'DELETE',
            endpoint: '/v2/files/f/' + encodeURI(filePath),
            operation: json => json
        });

        console.log('Delete File', filePath);
    }
}

export class CreateError extends Error {
    constructor(message: string, readonly status: number) {
        super(message);
        Object.setPrototypeOf(this, CreateError.prototype);
    }
}

export interface ArduinoCreateAPIRequest<T> {
    endpoint: string,
    operation: (json: any) => T
}

export interface ArduinoCreateAPIRequestWithoutPayload<T> extends ArduinoCreateAPIRequest<T> {
    method: 'GET' | 'DELETE'
}

export interface ArduinoCreateAPIRequestWithPayload<T> extends ArduinoCreateAPIRequest<T> {
    method: 'POST' | 'PUT',
    payload: any
}

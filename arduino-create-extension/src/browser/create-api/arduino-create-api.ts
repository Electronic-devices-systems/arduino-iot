import { ArduinoCreateSketch, ArduinoCreateFile, ArduinoCreateUploadSketch, ArduinoCreateUploadFile, ArduinoCreateConflictResponse } from "../arduino-create-service";
import { inject, injectable } from "inversify";
import { AuthService } from "../auth/auth-service";
import { Path } from "@theia/core";

@injectable()
export class ArduinoCreateAPI {

    protected userId: string;

    @inject(AuthService)
    protected authService: AuthService;

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
            console.log("ERROR");
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
                await this.writeFile(filePath.toString(), file.data);
            }));
        }
        console.log("ADD SKETCH", sketchResponse);
        return sketchResponse;
    }

    async deleteCreateSketch(path: string): Promise<void> {
        const res = await this.run({
            method: 'DELETE',
            endpoint: '/v2/sketches/byPath/' + encodeURI(path),
            operation: json => json
        });

        console.log("Delete Sketch", res);
    }

    async listFiles(sketchPath: string): Promise<ArduinoCreateFile[]> {
        const arduinoCreateFiles: ArduinoCreateFile[] = await this.run({
            method: 'GET',
            endpoint: '/v2/files/d/' + encodeURI(sketchPath),
            operation: json => json
        })
        return arduinoCreateFiles;
    }

    async readFile(filePath: string): Promise<string> {
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
    async writeFile(filePath: string, data: string): Promise<void> {
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
                        console.log("WRITTEN FILE:" + filePath, res);
                        return;
                    }
                    for (const x of before) {
                        if (x.name === f.name) {
                            if (x.modified_at === f.modified_at) {
                                console.error(x.name + "!!! " + x.modified_at + " - " + f.modified_at);
                            } else {
                                console.log("WRITTEN FILE:" + filePath, res);
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

        console.log("Delete File", filePath);
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

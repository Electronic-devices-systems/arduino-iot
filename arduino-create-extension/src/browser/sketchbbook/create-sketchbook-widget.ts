import { inject, injectable } from 'inversify';
import { naturalCompare } from 'arduino-ide-extension/lib/common/utils';
import { SketchbookWidget } from 'arduino-ide-extension/lib/browser/sketchbook/sketchbook-widget';
import { SketchbookWidgetFrontendContribution } from 'arduino-ide-extension/lib/browser/sketchbook/sketchbook-widget-frontend-contribution';
import { AuthService } from '../auth/auth-service';
import { ArduinoCreateAPI } from '../create-api/arduino-create-api';
import { Sketch } from 'arduino-ide-extension/lib/common/protocol';
import { ArduinoCreateSketch, ArduinoCreateFile } from '../arduino-create-service';
import { CreateUri } from '../../common/create-uri';

export interface RemoteSketch extends Sketch {
    readonly scheme: string;
    readonly localSketch?: Sketch;
}
export interface CreateSketch extends RemoteSketch {
    readonly scheme: 'create';
}

@injectable()
export class CreateSketchbookWidgetFrontendContribution extends SketchbookWidgetFrontendContribution {

}

@injectable()
export class CreateSketchbookWidget extends SketchbookWidget {

    @inject(AuthService)
    protected readonly authService: AuthService;

    @inject(ArduinoCreateAPI)
    protected readonly create: ArduinoCreateAPI;

    async sketches(): Promise<Sketch[]> {
        const [localSketches, remoteSketches] = await Promise.all([
            super.sketches(),
            this.remoteSketches()
        ]);
        for (const remoteSketch of remoteSketches) {
            const files = await this.create.listFiles(remoteSketch);
            const mainSketchFile = files.find(file => file.name === `${remoteSketch.name}.ino`);
            if (!mainSketchFile) {
                console.log(`Could not find main sketch file in remote sketch: ${remoteSketch}.`);
                continue;
            }
            const sort = (left: ArduinoCreateFile, right: ArduinoCreateFile) => naturalCompare(left.name, right.name);
            const otherSketchFiles = files.filter(file => file.name.endsWith('.ino') && file !== mainSketchFile).sort(sort);
            const additionalFiles = files.filter(file => !file.name.endsWith('.ino')).sort(sort);
            const createSketch: CreateSketch = {
                uri: CreateUri.create(remoteSketch.path).toString(),
                name: remoteSketch.name,
                mainFileUri: CreateUri.create(mainSketchFile.path).toString(),
                otherSketchFileUris: otherSketchFiles.map(({ path }) => CreateUri.create(path).toString()),
                additionalFileUris: additionalFiles.map(({ path }) => CreateUri.create(path).toString()),
                scheme: 'create'
            };
            const index = localSketches.findIndex(sketch => sketch.name === createSketch.name);
            if (index !== -1) {
                const localSketch = localSketches[index];
                localSketches.splice(index, 1, { ...createSketch, localSketch } as RemoteSketch);
            } else {
                localSketches.push(createSketch);
            }
        }
        return localSketches;
    }

    protected async remoteSketches(): Promise<ArduinoCreateSketch[]> {
        if (!this.authService.isAuthorized) {
            return [];
        }
        return this.create.getSketches();
    }

}

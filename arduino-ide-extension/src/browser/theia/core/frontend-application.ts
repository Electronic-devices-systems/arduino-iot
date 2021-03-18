import { injectable, inject } from 'inversify';
import { CommandService } from '@theia/core/lib/common/command';
import { FrontendApplication as TheiaFrontendApplication } from '@theia/core/lib/browser/frontend-application';
import { OpenSketch } from '../../contributions/open-sketch';
import { SketchesServiceClientImpl } from '../../../common/protocol/sketches-service-client-impl';

@injectable()
export class FrontendApplication extends TheiaFrontendApplication {

    @inject(CommandService)
    protected readonly commandService: CommandService;

    @inject(SketchesServiceClientImpl)
    protected readonly sketchesServiceClient: SketchesServiceClientImpl;

    protected async initializeLayout(): Promise<void> {
        const [sketch] = await Promise.all([
            this.sketchesServiceClient.currentSketch(),
            super.initializeLayout()
        ]);
        if (sketch) {
            await this.commandService.executeCommand(OpenSketch.Commands.OPEN_SKETCH.id, { sketch, preserveWindow: true });
        }
    }

}

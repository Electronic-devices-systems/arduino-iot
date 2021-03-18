import { injectable, inject } from 'inversify';
import { FileService } from '@theia/filesystem/lib/browser/file-service';
import { CommandService } from '@theia/core/lib/common/command';
import { WorkspaceService } from '@theia/workspace/lib/browser/workspace-service';
import { FrontendApplication as TheiaFrontendApplication } from '@theia/core/lib/browser/frontend-application';
import { SketchesService } from '../../../common/protocol';
import { ArduinoCommands } from '../../arduino-commands';

@injectable()
export class FrontendApplication extends TheiaFrontendApplication {

    @inject(FileService)
    protected readonly fileService: FileService;

    @inject(WorkspaceService)
    protected readonly workspaceService: WorkspaceService;

    @inject(CommandService)
    protected readonly commandService: CommandService;

    @inject(SketchesService)
    protected readonly sketchesService: SketchesService;

    protected async initializeLayout(): Promise<void> {
        await super.initializeLayout();
        const roots = await this.workspaceService.roots;
        for (const root of roots) {
            const exists = await this.fileService.exists(root.resource);
            if (exists) {
                this.sketchesService.markAsRecentlyOpened(root.resource.toString()); // no await, will get the notification later and rebuild the menu
                await this.commandService.executeCommand(ArduinoCommands.OPEN_SKETCH_FILES.id, root.resource);
            }
        }
    }

}

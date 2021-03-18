import { injectable, inject } from 'inversify';
import { EditorWidget } from '@theia/editor/lib/browser';
import { MaybePromise } from '@theia/core/lib/common/types';
import { LabelProvider } from '@theia/core/lib/browser/label-provider';
import { MessageService } from '@theia/core/lib/common/message-service';
import { ApplicationServer } from '@theia/core/lib/common/application-protocol';
import { FrontendApplication } from '@theia/core/lib/browser/frontend-application';
import { FocusTracker, Widget } from '@theia/core/lib/browser';
import { WorkspaceService as TheiaWorkspaceService } from '@theia/workspace/lib/browser/workspace-service';
import { ConfigService } from '../../../common/protocol/config-service';
import { SketchesService } from '../../../common/protocol/sketches-service';

@injectable()
export class WorkspaceService extends TheiaWorkspaceService {

    @inject(SketchesService)
    protected readonly sketchService: SketchesService;

    @inject(ConfigService)
    protected readonly configService: ConfigService;

    @inject(LabelProvider)
    protected readonly labelProvider: LabelProvider;

    @inject(MessageService)
    protected readonly messageService: MessageService;

    @inject(ApplicationServer)
    protected readonly applicationServer: ApplicationServer;

    private workspaceUri?: MaybePromise<string | undefined>;
    private version?: string

    async onStart(application: FrontendApplication): Promise<void> {
        const info = await this.applicationServer.getApplicationInfo();
        this.version = info?.version;
        application.shell.onDidChangeCurrentWidget(this.onCurrentWidgetChange.bind(this));
        const newValue = application.shell.currentWidget ? application.shell.currentWidget : null;
        this.onCurrentWidgetChange({ newValue, oldValue: null });
    }

    protected async getDefaultWorkspaceUri(): Promise<string | undefined> {
        if (this.workspaceUri) {
            // Avoid creating a new sketch twice
            return this.workspaceUri;
        }
        const config = await this.configService.getConfiguration();
        this.workspaceUri = config.sketchDirUri;
        return this.workspaceUri;
    }

    protected onCurrentWidgetChange({ newValue }: FocusTracker.IChangedArgs<Widget>): void {
        if (newValue instanceof EditorWidget) {
            const { uri } = newValue.editor;
            if (uri.toString().endsWith('.ino')) {
                this.updateTitle();
            } else {
                const title = this.workspaceTitle;
                const fileName = this.labelProvider.getName(uri);
                document.title = this.formatTitle(title ? `${title} - ${fileName}` : fileName);
            }
        } else {
            this.updateTitle();
        }
    }

    protected formatTitle(title?: string): string {
        const version = this.version ? ` ${this.version}` : '';
        const name = `${this.applicationName} ${version}`;
        return title ? `${title} | ${name}` : name;
    }

    protected get workspaceTitle(): string | undefined {
        if (this.workspace) {
            return this.labelProvider.getName(this.workspace.resource);
        }
    }

}

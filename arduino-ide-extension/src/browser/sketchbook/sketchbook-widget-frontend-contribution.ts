import { inject, injectable } from 'inversify';
import URI from '@theia/core/lib/common/uri';
import { FileService } from '@theia/filesystem/lib/browser/file-service';
import { FileChangeType } from '@theia/filesystem/lib/common/files';
import { DisposableCollection } from '@theia/core/lib/common/disposable';
import { AbstractViewContribution } from '@theia/core/lib/browser/shell/view-contribution';
import { FrontendApplicationContribution } from '@theia/core/lib/browser/frontend-application';
import { SketchbookWidget } from './sketchbook-widget';
import { ConfigService } from '../../common/protocol';
import { SketchesServiceClientImpl } from '../../common/protocol/sketches-service-client-impl';

@injectable()
export class SketchbookWidgetFrontendContribution extends AbstractViewContribution<SketchbookWidget> implements FrontendApplicationContribution {

    @inject(FileService)
    protected readonly fileService: FileService;

    @inject(ConfigService)
    protected readonly configService: ConfigService;

    @inject(SketchesServiceClientImpl)
    protected readonly sketchService: SketchesServiceClientImpl;

    protected readonly toDispose = new DisposableCollection();

    constructor() {
        super({
            widgetId: SketchbookWidget.WIDGET_ID,
            widgetName: SketchbookWidget.WIDGET_LABEL,
            defaultWidgetOptions: {
                area: 'left',
                rank: 100
            },
            toggleCommandId: `${SketchbookWidget.WIDGET_ID}:toggle`,
            toggleKeybinding: 'CtrlCmd+Shift+K'
        });
    }

    async initializeLayout(): Promise<void> {
        this.openView();
    }

    onStart(): void {
        this.configService.getConfiguration().then(config => {
            const sketchbookUri = new URI(config.sketchDirUri);
            this.toDispose.pushAll([
                this.fileService.watch(sketchbookUri),
                this.fileService.onDidFilesChange(({ changes }) => {
                    for (const { type, resource } of changes) {
                        if (type === FileChangeType.UPDATED) {
                            return;
                        }
                        // XXX: this is unsafe here. I can create a folder `FooBar.ino` in the sketchbook without any sketch files.
                        // TODO: check with file service whether the `resource` is a file or not.
                        if (resource.path.ext === '.ino' && sketchbookUri.isEqualOrParent(resource)) {
                            const widget = this.tryGetWidget();
                            if (!widget) {
                                return;
                            }
                            if (type === FileChangeType.ADDED) {
                                this.sketchService.loadSketch(resource).then(sketch => widget.addWidget(sketch, true));
                            } else if (type === FileChangeType.DELETED) {
                                widget.removeWidget(resource.toString());
                            }
                        }
                    }
                })
            ]);
        });
    }

    onStop(): void {
        this.toDispose.dispose();
    }

}

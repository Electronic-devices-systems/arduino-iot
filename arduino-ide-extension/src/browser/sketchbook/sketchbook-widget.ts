import { injectable, postConstruct, inject } from 'inversify';
import { Deferred } from '@theia/core/lib/common/promise-util';
import { Disposable } from '@theia/core/lib/common/disposable'
import { MaybePromise } from '@theia/core/lib/common/types';
import { ViewContainer } from '@theia/core/lib/browser/view-container';
import { StatefulWidget } from '@theia/core/lib/browser/shell/shell-layout-restorer';
import { CommandRegistry } from '@theia/core/lib/common/command';
import { ApplicationShell } from '@theia/core/lib/browser/shell/application-shell';
import { BaseWidget, Message, Widget, MessageLoop } from '@theia/core/lib/browser/widgets/widget';
import { OpenSketch } from '../contributions/open-sketch';
import { TabBarToolbarRegistry } from '../contributions/contribution';
import { SketchesService, Sketch } from '../../common/protocol';
import { SketchbookViewContainerFactory } from './sketchbook-view-container';
import { SketchWidgetFactory, SketchWidget } from './sketch-widget';
import { SketchesServiceClientImpl } from '../../common/protocol/sketches-service-client-impl';

@injectable()
export class SketchbookWidget extends BaseWidget implements StatefulWidget, ApplicationShell.TrackableWidgetProvider {

    static WIDGET_ID = 'sketchbook-widget';
    static WIDGET_LABEL = 'Sketchbook';

    @inject(SketchesService)
    protected readonly sketchesService: SketchesService;

    @inject(SketchesServiceClientImpl)
    protected readonly sketchesServiceClient: SketchesServiceClientImpl;

    @inject(SketchbookViewContainerFactory)
    protected readonly viewContainerFactory: SketchbookViewContainerFactory;

    @inject(SketchWidgetFactory)
    protected readonly widgetFactory: SketchWidgetFactory;

    @inject(CommandRegistry)
    protected readonly commandRegistry: CommandRegistry;

    @inject(TabBarToolbarRegistry)
    protected readonly toolbarRegistry: TabBarToolbarRegistry;

    protected viewContainer: ViewContainer;
    protected readonly deferredContainer = new Deferred<HTMLElement>();

    protected toolbar: Widget;
    protected contentNode: HTMLElement;
    protected toolbarNode: HTMLElement;

    @postConstruct()
    protected init(): void {
        this.id = SketchbookWidget.WIDGET_ID;
        this.title.label = SketchbookWidget.WIDGET_LABEL;
        this.title.caption = SketchbookWidget.WIDGET_LABEL;
        this.title.closable = true;
        this.title.iconClass = 'fa fa-book';
        this.addClass('sketchbook-widget');

        this.contentNode = document.createElement('div');
        this.contentNode.classList.add('sketchbook-content');
        this.toolbarNode = document.createElement('div');
        this.toolbarNode.classList.add('sketchbook-toolbar');
        this.contentNode.appendChild(this.toolbarNode);
        this.node.appendChild(this.contentNode);

        this.toolbar = new Widget();
        this.toolbar.title.caption = 'Toolbar';
        this.toolbar.title.label = 'Toolbar';
        this.toolbar.addClass('sketchbook-widget-toolbar');

        this.viewContainer = this.viewContainerFactory({
            id: `${SketchbookWidget.WIDGET_ID}-view-container`
        });
        this.scrollOptions = {
            suppressScrollX: true,
            minScrollbarLength: 35
        };

        this.loadSketches();

        const openCommand = { id: 'arduino-sketchbook--open-sketch' };
        const openInNewWindowCommand = { id: 'arduino-sketchbook--open-sketch-in-new-window' };
        this.toDispose.pushAll([
            this.viewContainer,
            this.commandRegistry.registerCommand(openCommand, {
                execute: widget => {
                    if (widget instanceof SketchWidget) {
                        return this.commandRegistry.executeCommand(OpenSketch.Commands.OPEN_SKETCH.id, { sketch: widget.sketch, preserveWindow: true });
                    }
                },
                isEnabled: widget => widget instanceof SketchWidget,
                isVisible: widget => widget instanceof SketchWidget
            }),
            this.commandRegistry.registerCommand(openInNewWindowCommand, {
                execute: widget => {
                    if (widget instanceof SketchWidget) {
                        return this.commandRegistry.executeCommand(OpenSketch.Commands.OPEN_SKETCH.id, { sketch: widget.sketch });
                    }
                },
                isEnabled: widget => widget instanceof SketchWidget,
                isVisible: widget => widget instanceof SketchWidget
            }),
            this.toolbarRegistry.registerItem({
                id: openCommand.id,
                command: openCommand.id,
                icon: 'fa fa-folder-open-o',
                priority: 1
            }),
            this.toolbarRegistry.registerItem({
                id: openInNewWindowCommand.id,
                command: openInNewWindowCommand.id,
                icon: 'fa fa-external-link',
                priority: 2
            })
        ]);
        this.update();
    }

    protected async sketches(): Promise<Sketch[]> {
        return this.sketchesServiceClient.getSketches();
    }

    protected async loadSketches(sketches: MaybePromise<Sketch[]> = this.sketches()): Promise<void> {
        for (const sketch of await sketches) {
            await this.addWidget(sketch);
        }
        this.update();
        this.updateScrollBar();
    }

    async removeWidget(sketchUri: string): Promise<void> {
        let shouldUpdate = false;
        for (const part of this.viewContainer.getParts()) {
            const wrapped = part.wrapped;
            if (wrapped instanceof SketchWidget) {
                if (Sketch.isInSketch(sketchUri, wrapped.sketch)) {
                    // TODO: Update `window.location.href` or switch to another sketch maybe.
                    this.viewContainer.removeWidget(wrapped);
                    shouldUpdate = true;
                }
            }
        }
        if (shouldUpdate) {
            this.update();
            this.updateScrollBar();
        }
    }

    async addWidget(s: MaybePromise<Sketch | undefined>, update: boolean = false): Promise<void> {
        const sketch = await s;
        if (!sketch) {
            return;
        }
        const widget = this.widgetFactory({ sketch });
        this.viewContainer.addWidget(widget, {
            canHide: false,
            initiallyCollapsed: true
        });
        if (update) {
            this.update();
            this.updateScrollBar();
        }
    }

    protected onAfterAttach(msg: Message): void {
        super.onAfterAttach(msg);
        Widget.attach(this.toolbar, this.toolbarNode);
        Widget.attach(this.viewContainer, this.contentNode);
        this.toDisposeOnDetach.push(Disposable.create(() => Widget.detach(this.toolbar)));
        this.toDisposeOnDetach.push(Disposable.create(() => Widget.detach(this.viewContainer)));
        this.updateScrollBar();
        this.deferredContainer.resolve(this.viewContainer.node);
        // TODO: focus the desired HTMLElement
    }

    protected onResize(message: Widget.ResizeMessage): void {
        super.onResize(message);
        MessageLoop.sendMessage(this.viewContainer, Widget.ResizeMessage.UnknownSize);
    }

    protected onAfterShow(msg: Message): void {
        super.onAfterShow(msg);
        this.onResize(Widget.ResizeMessage.UnknownSize);
    }

    getTrackableWidgets(): Widget[] {
        return this.viewContainer.getTrackableWidgets();
    }

    storeState(): object {
        return this.viewContainer.storeState();
    }

    restoreState(oldState: ViewContainer.State): void {
        this.viewContainer.restoreState(oldState);
    }

    protected getScrollContainer(): MaybePromise<HTMLElement> {
        return this.deferredContainer.promise;
    }

    updateScrollBar(): void {
        if (this.scrollBar) {
            this.scrollBar.update();
        }
    }

}

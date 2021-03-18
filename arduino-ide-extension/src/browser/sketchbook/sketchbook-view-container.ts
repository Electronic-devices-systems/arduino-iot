import { injectable } from 'inversify';
import { Widget } from '@theia/core/lib/browser';
import { Disposable, DisposableCollection } from '@theia/core/lib/common/disposable';
import { ViewContainer, ViewContainerPart } from '@theia/core/lib/browser/view-container';

@injectable()
export class SketchbookViewContainer extends ViewContainer {

    protected registerDND(_: ViewContainerPart): Disposable {
        return Disposable.NULL;
    }

    addWidget(widget: Widget, options?: ViewContainer.Factory.WidgetOptions): Disposable {
        const existing = this.toRemoveWidgets.get(widget.id);
        if (existing) {
            return existing;
        }
        const toRemoveWidget = new DisposableCollection();
        this.toDispose.push(toRemoveWidget);
        this.toRemoveWidgets.set(widget.id, toRemoveWidget);
        toRemoveWidget.push(Disposable.create(() => this.toRemoveWidgets.delete(widget.id)));

        const description = this.widgetManager.getDescription(widget);
        const partId = description ? JSON.stringify(description) : widget.id;
        const newPart = new SketchBookViewContainerPart(widget, partId, this.id, this.toolbarRegistry, this.toolbarFactory, options);
        this.registerPart(newPart);
        if (newPart.options && newPart.options.order !== undefined) {
            const index = this.getParts().findIndex(part => part.options.order === undefined || part.options.order > newPart.options.order!);
            if (index >= 0) {
                this.containerLayout.insertWidget(index, newPart);
            } else {
                this.containerLayout.addWidget(newPart);
            }
        } else {
            this.containerLayout.addWidget(newPart);
        }
        this.refreshMenu(newPart);
        this.updateTitle();
        this.updateCurrentPart();
        this.update();
        this.fireDidChangeTrackableWidgets();
        toRemoveWidget.pushAll([
            newPart,
            Disposable.create(() => {
                this.unregisterPart(newPart);
                if (!newPart.isDisposed) {
                    this.containerLayout.removeWidget(newPart);
                }
                if (!this.isDisposed) {
                    this.update();
                    this.updateTitle();
                    this.updateCurrentPart();
                    this.fireDidChangeTrackableWidgets();
                }
            }),
            this.registerDND(newPart),
            newPart.onVisibilityChanged(() => {
                this.updateTitle();
                this.updateCurrentPart();
            }),
            newPart.onCollapsed(() => {
                this.containerLayout.updateCollapsed(newPart, this.enableAnimation);
                this.updateCurrentPart();
            }),
            newPart.onContextMenu(event => {
                if (event.button === 2) {
                    event.preventDefault();
                    event.stopPropagation();
                    this.contextMenuRenderer.render({ menuPath: this.contextMenuPath, anchor: event });
                }
            }),
            newPart.onTitleChanged(() => this.refreshMenu(newPart)),
            newPart.onDidFocus(() => this.updateCurrentPart(newPart))
        ]);

        newPart.disposed.connect(() => toRemoveWidget.dispose());
        return toRemoveWidget;
    }

}

export class SketchBookViewContainerPart extends ViewContainerPart {

    get titleHidden(): boolean {
        return !this.toShowHeader.disposed;
    }

}

export const SketchbookViewContainerFactory = Symbol('SketchbookViewContainerFactory');
export interface SketchbookViewContainerFactory extends ViewContainer.Factory {
}

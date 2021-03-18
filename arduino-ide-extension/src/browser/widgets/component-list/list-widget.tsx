import * as React from 'react';
import { injectable, postConstruct, inject } from 'inversify';
import { Widget } from '@phosphor/widgets';
import { Message } from '@phosphor/messaging';
import { Emitter } from '@theia/core/lib/common/event';
import { Deferred } from '@theia/core/lib/common/promise-util';
import { ReactWidget } from '@theia/core/lib/browser/widgets/react-widget';
import { MaybePromise } from '@theia/core/lib/common/types';
import { MessageService } from '@theia/core/lib/common/message-service';
import { Searchable } from '../../../common/protocol/searchable';
import { Installable } from '../../../common/protocol/installable';
import { ArduinoComponent } from '../../../common/protocol/arduino-component';
import { NotificationCenter } from '../../notification-center';
import { ResponseServiceImpl } from '../../response-service-impl';
import { ListItemRenderer } from './list-item-renderer';
import { FilterableListContainer } from './filterable-list-container';

@injectable()
export abstract class ListWidget<T extends ArduinoComponent> extends ReactWidget {

    @inject(MessageService)
    protected readonly messageService: MessageService;

    @inject(NotificationCenter)
    protected readonly notificationCenter: NotificationCenter;

    @inject(ResponseServiceImpl)
    protected readonly responseService: ResponseServiceImpl;

    /**
     * Do not touch or use it. It is for setting the focus on the `input` after the widget activation.
     */
    protected focusNode: HTMLElement | undefined;
    protected readonly deferredContainer = new Deferred<HTMLElement>();
    protected readonly filterTextChangeEmitter = new Emitter<string | undefined>();

    constructor(protected options: ListWidget.Options<T>) {
        super();
        const { id, label, iconClass } = options;
        this.id = id;
        this.title.label = label;
        this.title.caption = label;
        this.title.iconClass = iconClass
        this.title.closable = true;
        this.addClass('arduino-list-widget');
        this.node.tabIndex = 0; // To be able to set the focus on the widget.
        this.scrollOptions = {
            suppressScrollX: true
        }
        this.toDispose.push(this.filterTextChangeEmitter);
    }

    @postConstruct()
    protected init(): void {
        this.update();
        this.toDispose.pushAll([
            this.notificationCenter.onIndexUpdated(() => this.refresh(undefined)),
            this.notificationCenter.onDaemonStarted(() => this.refresh(undefined)),
            this.notificationCenter.onDaemonStopped(() => this.refresh(undefined))
        ]);
    }

    protected getScrollContainer(): MaybePromise<HTMLElement> {
        return this.deferredContainer.promise;
    }

    protected onActivateRequest(message: Message): void {
        super.onActivateRequest(message);
        (this.focusNode || this.node).focus();
    }

    protected onUpdateRequest(message: Message): void {
        super.onUpdateRequest(message);
        this.render();
    }

    protected onResize(message: Widget.ResizeMessage): void {
        super.onResize(message);
        this.updateScrollBar();
    }

    protected onFocusResolved = (element: HTMLElement | undefined) => {
        this.focusNode = element;
    }

    render(): React.ReactNode {
        return <FilterableListContainer<T>
            container={this}
            resolveContainer={this.deferredContainer.resolve}
            resolveFocus={this.onFocusResolved}
            searchable={this.options.searchable}
            installable={this.options.installable}
            itemLabel={this.options.itemLabel}
            itemRenderer={this.options.itemRenderer}
            filterTextChangeEvent={this.filterTextChangeEmitter.event}
            messageService={this.messageService}
            responseService={this.responseService} />;
    }

    /**
     * If `filterText` is defined, sets the filter text to the argument.
     * If it is `undefined`, updates the view state by re-running the search with the current `filterText` term.
     */
    refresh(filterText: string | undefined): void {
        this.deferredContainer.promise.then(() => this.filterTextChangeEmitter.fire(filterText));
    }

    updateScrollBar(): void {
        if (this.scrollBar) {
            this.scrollBar.update();
        }
    }

}

export namespace ListWidget {
    export interface Options<T extends ArduinoComponent> {
        readonly id: string;
        readonly label: string;
        readonly iconClass: string;
        readonly installable: Installable<T>;
        readonly searchable: Searchable<T>;
        readonly itemLabel: (item: T) => string;
        readonly itemRenderer: ListItemRenderer<T>;
    }
}

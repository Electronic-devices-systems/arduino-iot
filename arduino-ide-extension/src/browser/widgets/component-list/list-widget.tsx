import * as React from 'react';
import { injectable, postConstruct, inject } from 'inversify';
import { Message } from '@phosphor/messaging';
import { Deferred } from '@theia/core/lib/common/promise-util';
import { Emitter } from '@theia/core/lib/common/event';
import { MaybePromise } from '@theia/core/lib/common/types';
import { ReactWidget } from '@theia/core/lib/browser/widgets/react-widget';
import { CommandService } from '@theia/core/lib/common/command';
import { MessageService } from '@theia/core/lib/common/message-service';
import { Installable } from '../../../common/protocol/installable';
import { Searchable } from '../../../common/protocol/searchable';
import { ArduinoComponent } from '../../../common/protocol/arduino-component';
import { FilterableListContainer } from './filterable-list-container';
import { ListItemRenderer } from './list-item-renderer';
import { NotificationCenter } from '../../notification-center';

@injectable()
export abstract class ListWidget<T extends ArduinoComponent> extends ReactWidget {

    @inject(MessageService)
    protected readonly messageService: MessageService;

    @inject(CommandService)
    protected readonly commandService: CommandService;

    @inject(NotificationCenter)
    protected readonly notificationCenter: NotificationCenter;

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

    protected onActivateRequest(msg: Message): void {
        super.onActivateRequest(msg);
        (this.focusNode || this.node).focus();
    }

    protected onUpdateRequest(msg: Message): void {
        super.onUpdateRequest(msg);
        this.render();
    }

    protected onFocusResolved = (element: HTMLElement | undefined) => {
        this.focusNode = element;
    };

    protected async install({ item, version }: { item: T, version: Installable.Version }): Promise<void> {
        return this.options.installable.install({ item, version });
    }

    protected async uninstall({ item }: { item: T }): Promise<void> {
        return this.options.installable.uninstall({ item });
    }

    render(): React.ReactNode {
        return <FilterableListContainer<T>
            container={this}
            resolveContainer={this.deferredContainer.resolve}
            resolveFocus={this.onFocusResolved}
            searchable={this.options.searchable}
            install={this.install.bind(this)}
            uninstall={this.uninstall.bind(this)}
            itemLabel={this.options.itemLabel}
            itemRenderer={this.options.itemRenderer}
            filterTextChangeEvent={this.filterTextChangeEmitter.event}
            messageService={this.messageService}
            commandService={this.commandService} />;
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

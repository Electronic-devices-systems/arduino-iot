import * as React from 'react';
import debounce = require('lodash.debounce');
import { Event } from '@theia/core/lib/common/event';
import { ConfirmDialog } from '@theia/core/lib/browser/dialogs';
import { MessageService } from '@theia/core/lib/common/message-service';
import { Progress } from '@theia/core/lib/common/message-service-protocol';
import { CancellationToken, CancellationTokenSource } from '@theia/core/lib/common/cancellation';
import { Searchable } from '../../../common/protocol/searchable';
import { Installable } from '../../../common/protocol/installable';
import { ArduinoComponent } from '../../../common/protocol/arduino-component';
import { UninstallationProgressDialog } from '../progress-dialog';
import { SearchBar } from './search-bar';
import { ListWidget } from './list-widget';
import { ComponentList } from './component-list';
import { ListItemRenderer } from './list-item-renderer';
import { ResponseServiceImpl } from '../../response-service-impl';

export class FilterableListContainer<T extends ArduinoComponent> extends React.Component<FilterableListContainer.Props<T>, FilterableListContainer.State<T>> {

    constructor(props: Readonly<FilterableListContainer.Props<T>>) {
        super(props);
        this.state = {
            filterText: '',
            items: []
        };
    }

    componentDidMount(): void {
        this.search = debounce(this.search, 500);
        this.handleFilterTextChange('');
        this.props.filterTextChangeEvent(this.handleFilterTextChange.bind(this));
    }

    componentDidUpdate(): void {
        // See: arduino/arduino-pro-ide#101
        // Resets the top of the perfect scroll-bar's thumb.
        this.props.container.updateScrollBar();
    }

    render(): React.ReactNode {
        return <div className={'filterable-list-container'}>
            {this.renderSearchFilter()}
            {this.renderSearchBar()}
            {this.renderComponentList()}
        </div>
    }

    protected renderSearchFilter(): React.ReactNode {
        return undefined;
    }

    protected renderSearchBar(): React.ReactNode {
        return <SearchBar
            resolveFocus={this.props.resolveFocus}
            filterText={this.state.filterText}
            onFilterTextChanged={this.handleFilterTextChange}
        />
    }

    protected renderComponentList(): React.ReactNode {
        const { itemLabel, resolveContainer, itemRenderer } = this.props;
        return <ComponentList<T>
            items={this.state.items}
            itemLabel={itemLabel}
            itemRenderer={itemRenderer}
            install={this.install.bind(this)}
            uninstall={this.uninstall.bind(this)}
            resolveContainer={resolveContainer}
        />
    }

    protected handleFilterTextChange = (filterText: string = this.state.filterText) => {
        this.setState({ filterText });
        this.search(filterText);
    }

    protected search(query: string): void {
        const { searchable } = this.props;
        searchable.search({ query: query.trim() }).then(items => this.setState({ items: this.sort(items) }));
    }

    protected sort(items: T[]): T[] {
        const { itemLabel } = this.props;
        return items.sort((left, right) => itemLabel(left).localeCompare(itemLabel(right)));
    }

    protected async install(item: T, version: Installable.Version): Promise<void> {
        const { installable, searchable } = this.props;
        await this.withProgress(async progress => {
            const progressId = progress.id;
            const toDispose = this.props.responseService.onProgressDidChange(progressMessage => {
                if (progressId === progressMessage.progressId) {
                    const { message, work } = progressMessage;
                    progress.report({ message, work });
                }
            });
            try {
                await installable.install({ item, progressId, version });
            } finally {
                toDispose.dispose();
            }
        });
        const items = await searchable.search({ query: this.state.filterText });
        this.setState({ items: this.sort(items) });
    }

    protected async uninstall(item: T): Promise<void> {
        const uninstall = await new ConfirmDialog({
            title: 'Uninstall',
            msg: `Do you want to uninstall ${item.name}?`,
            ok: 'Yes',
            cancel: 'No'
        }).open();
        if (!uninstall) {
            return;
        }
        const { installable, searchable, itemLabel } = this.props;
        const dialog = new UninstallationProgressDialog(itemLabel(item));
        dialog.open();
        try {
            await installable.uninstall({ item });
            const items = await searchable.search({ query: this.state.filterText });
            this.setState({ items: this.sort(items) });
        } finally {
            dialog.close();
        }
    }

    protected async withProgress(cb: (progress: Progress, token: CancellationToken) => Promise<void>): Promise<void> {
        const cancellationSource = new CancellationTokenSource();
        const { token } = cancellationSource;
        const progress = await this.props.messageService.showProgress({ text: '', options: { cancelable: false } }, () => cancellationSource.cancel());
        try {
            await cb(progress, token);
        } finally {
            progress.cancel();
        }
    }

}

export namespace FilterableListContainer {

    export interface Props<T extends ArduinoComponent> {
        readonly container: ListWidget<T>;
        readonly installable: Installable<T>;
        readonly searchable: Searchable<T>;
        readonly itemLabel: (item: T) => string;
        readonly itemRenderer: ListItemRenderer<T>;
        readonly resolveContainer: (element: HTMLElement) => void;
        readonly resolveFocus: (element: HTMLElement | undefined) => void;
        readonly filterTextChangeEvent: Event<string | undefined>;
        readonly messageService: MessageService;
        readonly responseService: ResponseServiceImpl;
    }

    export interface State<T> {
        filterText: string;
        items: T[];
    }

}

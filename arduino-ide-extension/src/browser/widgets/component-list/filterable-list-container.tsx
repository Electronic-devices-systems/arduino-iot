import * as React from 'react';
import debounce = require('lodash.debounce');
import { Event } from '@theia/core/lib/common/event';
import { CommandService } from '@theia/core/lib/common/command';
import { MessageService } from '@theia/core/lib/common/message-service';
import { OutputCommands } from '@theia/output/lib/browser/output-commands';
import { ConfirmDialog } from '@theia/core/lib/browser/dialogs';
import { Searchable } from '../../../common/protocol/searchable';
import { Installable } from '../../../common/protocol/installable';
import { ArduinoComponent } from '../../../common/protocol/arduino-component';
import { InstallationProgressDialog, UninstallationProgressDialog } from '../progress-dialog';
import { SearchBar } from './search-bar';
import { ListWidget } from './list-widget';
import { ComponentList } from './component-list';
import { ListItemRenderer } from './list-item-renderer';

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
        const { install, searchable, itemLabel } = this.props;
        const dialog = new InstallationProgressDialog(itemLabel(item), version);
        try {
            dialog.open();
            await this.clearArduinoChannel();
            await install({ item, version });
            const items = await searchable.search({ query: this.state.filterText });
            this.setState({ items: this.sort(items) });
        } catch (error) {
            this.props.messageService.error(error instanceof Error ? error.message : String(error));
            throw error;
        } finally {
            dialog.close();
        }
    }

    protected async uninstall(item: T): Promise<void> {
        const ok = await new ConfirmDialog({
            title: 'Uninstall',
            msg: `Do you want to uninstall ${item.name}?`,
            ok: 'Yes',
            cancel: 'No'
        }).open();
        if (!ok) {
            return;
        }
        const { uninstall, searchable, itemLabel } = this.props;
        const dialog = new UninstallationProgressDialog(itemLabel(item));
        try {
            await this.clearArduinoChannel();
            dialog.open();
            await uninstall({ item });
            const items = await searchable.search({ query: this.state.filterText });
            this.setState({ items: this.sort(items) });
        } finally {
            dialog.close();
        }
    }

    private async clearArduinoChannel(): Promise<void> {
        return this.props.commandService.executeCommand(OutputCommands.CLEAR.id, { name: 'Arduino' });
    }

}

export namespace FilterableListContainer {

    export interface Props<T extends ArduinoComponent> {
        readonly container: ListWidget<T>;
        readonly searchable: Searchable<T>;
        readonly itemLabel: (item: T) => string;
        readonly itemRenderer: ListItemRenderer<T>;
        readonly resolveContainer: (element: HTMLElement) => void;
        readonly resolveFocus: (element: HTMLElement | undefined) => void;
        readonly filterTextChangeEvent: Event<string | undefined>;
        readonly install: ({ item, version }: { item: T, version: Installable.Version }) => Promise<void>;
        readonly uninstall: ({ item }: { item: T }) => Promise<void>;
        readonly messageService: MessageService;
        readonly commandService: CommandService;
    }

    export interface State<T> {
        filterText: string;
        items: T[];
    }

}

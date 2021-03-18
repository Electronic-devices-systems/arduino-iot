import { injectable } from 'inversify';
import { MenuModelRegistry } from '@theia/core';
import { KeymapsFrontendContribution as TheiaKeymapsFrontendContribution, KeymapsCommands } from '@theia/keymaps/lib/browser/keymaps-frontend-contribution';
import { ArduinoMenus } from '../../menu/arduino-menus';


@injectable()
export class KeymapsFrontendContribution extends TheiaKeymapsFrontendContribution {

    constructor() {
        super();
    }

    registerMenus(menus: MenuModelRegistry): void {

        menus.registerMenuAction(ArduinoMenus.FILE__SETTINGS_SUBMENU, {
            commandId: KeymapsCommands.OPEN_KEYMAPS.id,
            order: 'a20'
        });

        // menus.registerMenuAction(CommonMenus.FILE_SETTINGS_SUBMENU_OPEN, {
        //     commandId: KeymapsCommands.OPEN_KEYMAPS.id,
        //     order: 'a20'
        // });
        // menus.registerMenuAction(CommonMenus.SETTINGS_OPEN, {
        //     commandId: KeymapsCommands.OPEN_KEYMAPS.id,
        //     order: 'a20'
        // });
    }

    // CAN WE GET RID OF registerToolbarItems?

    // async registerToolbarItems(toolbar: TabBarToolbarRegistry): Promise<void> {
    //     const widget = await this.widget;
    //     const onDidChange = widget.onDidUpdate;
    //     toolbar.registerItem({
    //         id: KeymapsCommands.OPEN_KEYMAPS_JSON_TOOLBAR.id,
    //         command: KeymapsCommands.OPEN_KEYMAPS_JSON_TOOLBAR.id,
    //         tooltip: 'Open Keyboard Shortcuts in JSON',
    //         priority: 0,
    //     });
    //     toolbar.registerItem({
    //         id: KeymapsCommands.CLEAR_KEYBINDINGS_SEARCH.id,
    //         command: KeymapsCommands.CLEAR_KEYBINDINGS_SEARCH.id,
    //         tooltip: 'Clear Keybindings Search Input',
    //         priority: 1,
    //         onDidChange,
    //     });
    // }
}

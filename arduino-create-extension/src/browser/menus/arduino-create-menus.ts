import { MAIN_MENU_BAR } from '@theia/core/lib/common/menu';
import { ArduinoMenus } from 'arduino-ide-extension/lib/browser/menu/arduino-menus';

export namespace ArduinoCreateMenus {

    // -- Create
    // XXX: The `3_create` main-menu group is reserved for the Arduino Create extension.
    export const CREATE = [...MAIN_MENU_BAR, '3_create'];
    export const CREATE__LOGIN_GROUP = [...CREATE, '0_login'];
    export const CREATE__CONTROL_GROUP = [...CREATE, '1_control'];
    export const CREATE__SKETCHES_GROUP = [...CREATE, '2_sketches'];

    // Context menu
    // -- Open
    export const OPEN_SKETCH__CONTEXT__CREATE_GROUP = [...ArduinoMenus.OPEN_SKETCH__CONTEXT, '2_create'];
    export const OPEN_SKETCH__CONTEXT__LOGIN_GROUP = [...ArduinoMenus.OPEN_SKETCH__CONTEXT, '3_login'];

}

import { injectable, inject } from "inversify";
import { Command, /* MenuPath */ CommandRegistry, MenuModelRegistry } from "@theia/core/lib/common";
import { ArduinoFrontendContribution } from "arduino-ide-extension/lib/browser/arduino-frontend-contribution";
// import { ArduinoCommands } from 'arduino-ide-extension/lib/browser/arduino-commands';
// import { ArduinoToolbar } from 'arduino-ide-extension/lib/browser/toolbar/arduino-toolbar';
import { AuthService } from "./auth/auth-service";
import { ArduinoCreateService, /* ARDUINO_CREATE_SKETCH_MARKER_FILE */ } from "./arduino-create-service";
// import URI from "@theia/core/lib/common/uri";
import { FrontendApplicationContribution, FrontendApplication, /* Widget */ } from "@theia/core/lib/browser";
import { ArduinoCreateMenus } from "./menus/arduino-create-menus";
// import { Sketch } from "arduino-ide-extension/lib/common/protocol/sketches-service";

export namespace ArduinoCreateCommands {
    export const OPEN_CREATE_LOGIN: Command = {
        id: 'arduino-create-open-login',
        label: 'Arduino Create Login',
        iconClass: 'fa fa-sign-in'
    };

    export const ADD_TO_ARDUINO_CREATE: Command = {
        id: 'arduino-create-add-sketch',
        label: 'Sync Sketch with Arduino Create',
        iconClass: 'fa fa-cloud-upload'
    }

    export const SYNC_SKETCH: Command = {
        id: 'arduino-create-sync-sketch',
        label: 'Synchronize Arduino Create Sketch'
    }

    export const LOGOUT: Command = {
        id: 'arduino-create-logout',
        label: 'Arduino Create Logout'
    }
}

// export namespace ArduinoCreateContextMenu {
//     export const ARDUINO_CREATE_GROUP: MenuPath = [...ArduinoToolbarContextMenu.OPEN_SKETCH_PATH, '4_create'];
// }

@injectable()
export class ArduinoCreateExtensionFrontendContribution extends ArduinoFrontendContribution implements FrontendApplicationContribution {

    @inject(ArduinoCreateService) service: ArduinoCreateService;
    @inject(AuthService) authService: AuthService;
    @inject(CommandRegistry) commands: CommandRegistry;
    @inject(MenuModelRegistry) menuRegistry: MenuModelRegistry;

    protected syncMenuItemExists = false;

    // automatic sync
    protected refreshSync = async () => {
        const ws = this.workspaceService.workspace;
        if (ws && this.authService.isAuthorized) {
            const wsURI = ws.resource;
            await this.service.sync(wsURI.path.toString());
            setTimeout(this.refreshSync, 3000);
        }
    };

    onStart(app: FrontendApplication) {
        setTimeout(this.refreshSync, 3000);
    }

    onDidInitializeLayout(app: FrontendApplication) {
        this.initializeMenu();
    }

    initializeMenu() {
        // if (this.authService.isAuthorized) {
        //     this.menuRegistry.unregisterMenuAction(ArduinoCreateCommands.OPEN_CREATE_LOGIN.id);
        //     this.registerCreateSketchesInMenu();
        //     this.reregisterOpenContextCommand();
        // } else {
        //     this.registerLogInMenuItem();
        // }
    }

    // reregisterOpenContextCommand() {
    //     const registry = this.commands;
    //     registry.unregisterCommand(ArduinoCommands.SHOW_OPEN_CONTEXT_MENU);
    //     registry.registerCommand(ArduinoCommands.SHOW_OPEN_CONTEXT_MENU, {
    //         isVisible: widget => ArduinoToolbar.is(widget) && widget.side === 'left',
    //         isEnabled: widget => ArduinoToolbar.is(widget) && widget.side === 'left',
    //         execute: async (widget: Widget, target: EventTarget) => {
    //             if (this.wsSketchCount) {
    //                 await this.registerCreateSketchesInMenu();
    //                 const el = (target as HTMLElement).parentElement;
    //                 if (el) {
    //                     this.contextMenuRenderer.render(ArduinoToolbarContextMenu.OPEN_SKETCH_PATH, {
    //                         x: el.getBoundingClientRect().left,
    //                         y: el.getBoundingClientRect().top + el.offsetHeight
    //                     });
    //                 }
    //             } else {
    //                 this.commands.executeCommand(ArduinoCommands.OPEN_FILE_NAVIGATOR.id);
    //             }
    //         }
    //     });
    // }

    // protected registerLogInMenuItem() {
    //     this.menuRegistry.registerMenuAction(ArduinoCreateContextMenu.ARDUINO_CREATE_GROUP, {
    //         commandId: ArduinoCreateCommands.OPEN_CREATE_LOGIN.id
    //     });
    // }

    // protected async registerSketchesInMenu(registry: MenuModelRegistry): Promise<void> {
    //     await this.sketchService.getSketches().then(async sketches => {
    //         if (this.authService.isAuthorized) {
    //             const createSketches = await this.service.getCreateSketches();
    //             this.wsSketchCount += sketches.length;
    //             await Promise.all(sketches.map(async sketch => {
    //                 const markerFile = new URI(sketch.uri).resolve(ARDUINO_CREATE_SKETCH_MARKER_FILE).toString();
    //                 const isCreateSketch = await this.fileSystem.exists(markerFile);
    //                 const commandId = 'openSketch' + sketch.name;
    //                 if (isCreateSketch) {
    //                     if (createSketches.find(cs => cs.name === sketch.name)) {
    //                         this.registerSketchCommandAndMenuItem(sketch, commandId, true);
    //                     } else {
    //                         this.fileSystem.delete(markerFile);
    //                     }
    //                 } else {
    //                     this.registerSketchCommandAndMenuItem(sketch, commandId, false);
    //                 }
    //             }));
    //         }
    //     })
    // }

    // protected registerSketchCommandAndMenuItem(sketch: Sketch, commandId: string, isCreateSketch: boolean) {
    //     const registry = this.menuRegistry;
    //     const command: Command = {
    //         id: commandId
    //     }
    //     this.commands.unregisterCommand(command);
    //     this.commands.registerCommand(command, {
    //         execute: async () => {
    //             const sketchURI = new URI(sketch.uri);
    //             await this.workspaceService.open(sketchURI);
    //         }
    //     });
    //     registry.registerMenuAction(ArduinoToolbarContextMenu.WS_SKETCHES_GROUP, {
    //         commandId: commandId,
    //         label: sketch.name,
    //         icon: isCreateSketch ? 'fa fa-cloud' : ''
    //     });
    // }

    // protected async registerCreateSketchesInMenu() {
    //     const registry = this.menuRegistry;
    //     this.purgeMenuGroup(ArduinoToolbarContextMenu.WS_SKETCHES_GROUP);
    //     this.purgeMenuGroup(ArduinoCreateContextMenu.ARDUINO_CREATE_GROUP);
    //     if (this.authService.isAuthorized) {
    //         await this.registerSketchesInMenu(this.menuRegistry);
    //         const sketches = await this.service.getCreateSketches()
    //         const config = await this.configService.getConfiguration();
    //         this.wsSketchCount += sketches.length;
    //         const sketchbookURI = new URI(config.sketchDirUri);
    //         await Promise.all(sketches.map(async sketch => {
    //             const sketchURI = sketchbookURI.resolve(sketch.name);
    //             const sketchMarkerFileURI = sketchURI.resolve(ARDUINO_CREATE_SKETCH_MARKER_FILE);
    //             const sketchbookUriStr = sketchMarkerFileURI.toString();
    //             if (!(await this.fileSystem.exists(sketchbookUriStr))) {
    //                 const commandId = 'openSketch' + sketch.name;
    //                 const command: Command = {
    //                     id: commandId
    //                 }
    //                 this.commands.unregisterCommand(command);
    //                 this.commands.registerCommand(command, {
    //                     execute: async () => {
    //                         const sketchURI = await this.service.downloadSketch(sketch);
    //                         await this.service.sync(sketchURI.path.toString());
    //                         await this.workspaceService.open(sketchURI);
    //                     }
    //                 });
    //                 registry.registerMenuAction(ArduinoCreateContextMenu.ARDUINO_CREATE_GROUP, {
    //                     commandId: command.id,
    //                     label: sketch.name,
    //                     icon: 'fa fa-cloud-download'
    //                 });
    //             }
    //         }));
    //     } else {
    //         await super.registerSketchesInMenu(this.menuRegistry);
    //     }
    // }

    protected purgeMenuGroup(group: string[]) {
        const menu = this.menuRegistry.getMenu(group);
        const ids = menu.children.map(c => c.id);
        ids.forEach(id => {
            this.commands.unregisterCommand(id);
            this.menuRegistry.unregisterMenuAction(id, group);
        });
    }

    registerMenus(registry: MenuModelRegistry): void {
        registry.registerSubmenu(ArduinoCreateMenus.CREATE, 'Create');
    }

    registerCommands(registry: CommandRegistry): void {
        registry.registerCommand(ArduinoCreateCommands.OPEN_CREATE_LOGIN, {
            execute: () => {
                this.authService.authorize().then(async () => {
                    this.initializeMenu();
                    setTimeout(this.refreshSync, 3000);
                });
            },
            isEnabled: () => !this.authService.isAuthorized,
            isVisible: () => !this.authService.isAuthorized
        });

        registry.registerCommand(ArduinoCreateCommands.ADD_TO_ARDUINO_CREATE, {
            execute: () => this.service.addCreateSketch()
        });

        registry.registerCommand(ArduinoCreateCommands.SYNC_SKETCH, {
            execute: async () => {
                const ws = this.workspaceService.workspace;
                if (ws) {
                    const wsURI = ws.resource;
                    await this.service.sync(wsURI.path.toString());
                    // this.openSketchFiles(wsURI);
                    // this.registerCreateSketchesInMenu();
                }
            }
        });
    }
}

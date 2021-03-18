import { inject, injectable } from 'inversify';
import { Emitter } from '@theia/core/lib/common/event';
import { CoreService } from '../../common/protocol';
import { ArduinoMenus } from '../menu/arduino-menus';
import { ArduinoToolbar } from '../toolbar/arduino-toolbar';
import { BoardsDataStore } from '../boards/boards-data-store';
import { BoardsServiceProvider } from '../boards/boards-service-provider';
import { SketchContribution, Command, CommandRegistry, MenuModelRegistry, KeybindingRegistry, TabBarToolbarRegistry } from './contribution';

@injectable()
export class VerifySketch extends SketchContribution {

    @inject(CoreService)
    protected readonly coreService: CoreService;

    @inject(BoardsDataStore)
    protected readonly boardsDataStore: BoardsDataStore;

    @inject(BoardsServiceProvider)
    protected readonly boardsServiceClientImpl: BoardsServiceProvider;

    protected readonly onDidChangeEmitter = new Emitter<Readonly<void>>();
    readonly onDidChange = this.onDidChangeEmitter.event;

    protected verifyInProgress = false;

    registerCommands(registry: CommandRegistry): void {
        registry.registerCommand(VerifySketch.Commands.VERIFY_SKETCH, {
            execute: () => this.verifySketch(),
            isEnabled: () => !this.verifyInProgress,
        });
        registry.registerCommand(VerifySketch.Commands.EXPORT_BINARIES, {
            execute: () => this.verifySketch(true),
            isEnabled: () => !this.verifyInProgress,
        });
        registry.registerCommand(VerifySketch.Commands.VERIFY_SKETCH_TOOLBAR, {
            isVisible: widget => ArduinoToolbar.is(widget) && widget.side === 'left',
            isEnabled: () => !this.verifyInProgress,
            isToggled: () => this.verifyInProgress,
            execute: () => registry.executeCommand(VerifySketch.Commands.VERIFY_SKETCH.id)
        });
    }

    registerMenus(registry: MenuModelRegistry): void {
        registry.registerMenuAction(ArduinoMenus.SKETCH__MAIN_GROUP, {
            commandId: VerifySketch.Commands.VERIFY_SKETCH.id,
            label: 'Verify/Compile',
            order: '0'
        });
        registry.registerMenuAction(ArduinoMenus.SKETCH__MAIN_GROUP, {
            commandId: VerifySketch.Commands.EXPORT_BINARIES.id,
            label: 'Export compiled Binary',
            order: '3'
        });
    }

    registerKeybindings(registry: KeybindingRegistry): void {
        registry.registerKeybinding({
            command: VerifySketch.Commands.VERIFY_SKETCH.id,
            keybinding: 'CtrlCmd+R'
        });
        registry.registerKeybinding({
            command: VerifySketch.Commands.EXPORT_BINARIES.id,
            keybinding: 'CtrlCmd+Alt+S'
        });
    }

    registerToolbarItems(registry: TabBarToolbarRegistry): void {
        registry.registerItem({
            id: VerifySketch.Commands.VERIFY_SKETCH_TOOLBAR.id,
            command: VerifySketch.Commands.VERIFY_SKETCH_TOOLBAR.id,
            tooltip: 'Verify',
            priority: 0,
            onDidChange: this.onDidChange
        });
    }

    async verifySketch(exportBinaries?: boolean): Promise<void> {

        // even with buttons disabled, better to double check if a verify is already in progress
        if (this.verifyInProgress) {
            return;
        }
        
        // toggle the toolbar button and menu item state.
        // verifyInProgress will be set to false whether the compilation fails or not
        this.verifyInProgress = true;
        this.onDidChangeEmitter.fire();
        const sketch = await this.sketchServiceClient.currentSketch();
        
        if (!sketch) {
            return;
        }
        try {
            const { boardsConfig } = this.boardsServiceClientImpl;
            const [fqbn, sourceOverride] = await Promise.all([
                this.boardsDataStore.appendConfigToFqbn(boardsConfig.selectedBoard?.fqbn),
                this.sourceOverride()
            ]);
            const verbose = this.preferences.get('arduino.compile.verbose');
            const compilerWarnings = this.preferences.get('arduino.compile.warnings');
            this.outputChannelManager.getChannel('Arduino').clear();
            await this.coreService.compile({
                sketchUri: sketch.uri,
                fqbn,
                optimizeForDebug: this.editorMode.compileForDebug,
                verbose,
                exportBinaries,
                sourceOverride,
                compilerWarnings
            });
            this.messageService.info('Done compiling.', { timeout: 1000 });
        } catch (e) {
            this.messageService.error(e.toString());
        } finally {
            this.verifyInProgress = false;
            this.onDidChangeEmitter.fire();
        }
    }

}

export namespace VerifySketch {
    export namespace Commands {
        export const VERIFY_SKETCH: Command = {
            id: 'arduino-verify-sketch'
        };
        export const EXPORT_BINARIES: Command = {
            id: 'arduino-export-binaries'
        };
        export const VERIFY_SKETCH_TOOLBAR: Command = {
            id: 'arduino-verify-sketch--toolbar'
        };
    }
}

import { injectable } from 'inversify';
import { remote } from 'electron';
import * as dateFormat from 'dateformat';
import { ArduinoMenus } from '../menu/arduino-menus';
import { OpenSketch } from './open-sketch';
import { SketchContribution, URI, Command, CommandRegistry, MenuModelRegistry, KeybindingRegistry } from './contribution';

@injectable()
export class SaveAsSketch extends SketchContribution {

    registerCommands(registry: CommandRegistry): void {
        registry.registerCommand(SaveAsSketch.Commands.SAVE_AS_SKETCH, {
            execute: args => this.saveAs(args)
        });
    }

    registerMenus(registry: MenuModelRegistry): void {
        registry.registerMenuAction(ArduinoMenus.FILE__SKETCH_GROUP, {
            commandId: SaveAsSketch.Commands.SAVE_AS_SKETCH.id,
            label: 'Save As...',
            order: '7'
        });
    }

    registerKeybindings(registry: KeybindingRegistry): void {
        registry.registerKeybinding({
            command: SaveAsSketch.Commands.SAVE_AS_SKETCH.id,
            keybinding: 'CtrlCmd+Shift+S'
        });
    }

    /**
     * Resolves `true` if the sketch was successfully saved as something.
     */
    async saveAs({ execOnlyIfTemp, openAfterMove, wipeOriginal }: SaveAsSketch.Options = SaveAsSketch.Options.DEFAULT): Promise<boolean> {
        const sketch = await this.sketchServiceClient.currentSketch();
        if (!sketch) {
            return false;
        }

        const isTemp = await this.sketchService.isTemp(sketch);
        if (!isTemp && !!execOnlyIfTemp) {
            return false;
        }

        // If target does not exist, propose a `directories.user`/${sketch.name} path
        // If target exists, propose `directories.user`/${sketch.name}_copy_${yyyymmddHHMMss}
        const sketchDirUri = new URI((await this.configService.getConfiguration()).sketchDirUri);
        const exists = await this.fileService.exists(sketchDirUri.resolve(sketch.name));
        const defaultUri = exists
            ? sketchDirUri.resolve(sketchDirUri.resolve(`${sketch.name}_copy_${dateFormat(new Date(), 'yyyymmddHHMMss')}`).toString())
            : sketchDirUri.resolve(sketch.name);
        const defaultPath = await this.fileService.fsPath(defaultUri);
        const { filePath, canceled } = await remote.dialog.showSaveDialog({ title: 'Save sketch folder as...', defaultPath });
        if (!filePath || canceled) {
            return false;
        }
        const destinationUri = await this.fileSystemExt.getUri(filePath);
        if (!destinationUri) {
            return false;
        }
        const newSketchUri = await this.sketchService.copy(sketch, { destinationUri });
        if (newSketchUri && openAfterMove) {
            if (wipeOriginal) {
                await this.fileService.delete(new URI(sketch.uri));
            }
            const newSketch = await this.sketchServiceClient.loadSketch(new URI(newSketchUri));
            this.commandService.executeCommand(OpenSketch.Commands.OPEN_SKETCH.id, { sketch: newSketch, preserveWindow: true })
        }
        return !!newSketchUri;
    }

}

export namespace SaveAsSketch {
    export namespace Commands {
        export const SAVE_AS_SKETCH: Command = {
            id: 'arduino-save-as-sketch'
        };
    }
    export interface Options {
        readonly execOnlyIfTemp?: boolean;
        readonly openAfterMove?: boolean;
        /**
         * Ignored if `openAfterMove` is `false`.
         */
        readonly wipeOriginal?: boolean;
    }
    export namespace Options {
        export const DEFAULT: Options = {
            execOnlyIfTemp: false,
            openAfterMove: true,
            wipeOriginal: false
        };
    }
}

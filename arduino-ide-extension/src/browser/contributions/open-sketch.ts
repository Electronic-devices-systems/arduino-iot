import { inject, injectable } from 'inversify';
import { remote } from 'electron';
import { MaybePromise } from '@theia/core/lib/common/types';
import { EditorManager } from '@theia/editor/lib/browser/editor-manager';
import { WindowService } from '@theia/core/lib/browser/window/window-service';
import { Widget, ContextMenuRenderer } from '@theia/core/lib/browser';
import { Disposable, DisposableCollection } from '@theia/core/lib/common/disposable';
import { ArduinoMenus } from '../menu/arduino-menus';
import { ArduinoToolbar } from '../toolbar/arduino-toolbar';
import { ExamplesService } from '../../common/protocol/examples-service';
import { SketchContribution, Sketch, URI, Command, CommandRegistry, MenuModelRegistry, KeybindingRegistry, TabBarToolbarRegistry } from './contribution';
import { BuiltInExamples } from './examples';

@injectable()
export class OpenSketch extends SketchContribution {

    @inject(MenuModelRegistry)
    protected readonly menuRegistry: MenuModelRegistry;

    @inject(ContextMenuRenderer)
    protected readonly contextMenuRenderer: ContextMenuRenderer;

    @inject(BuiltInExamples)
    protected readonly builtInExamples: BuiltInExamples;

    @inject(ExamplesService)
    protected readonly examplesService: ExamplesService;

    @inject(EditorManager)
    protected readonly editorManager: EditorManager;

    @inject(WindowService)
    protected readonly windowService: WindowService;

    protected readonly toDisposeBeforeCreateNewContextMenu = new DisposableCollection();

    registerCommands(registry: CommandRegistry): void {
        registry.registerCommand(OpenSketch.Commands.OPEN_SKETCH, {
            execute: arg => {
                if (OpenSketch.Options.is(arg)) {
                    return this.openSketch(arg.sketch, !!arg.preserveWindow);
                }
                return this.openSketch();
            }
        });
        registry.registerCommand(OpenSketch.Commands.OPEN_SKETCH__TOOLBAR, {
            isVisible: widget => ArduinoToolbar.is(widget) && widget.side === 'left',
            execute: async (_: Widget, target: EventTarget) => {
                const sketches = await this.sketchServiceClient.getSketches();
                if (!sketches.length) {
                    this.openSketch();
                } else {
                    this.toDisposeBeforeCreateNewContextMenu.dispose();
                    if (!(target instanceof HTMLElement)) {
                        return;
                    }
                    const { parentElement } = target;
                    if (!parentElement) {
                        return;
                    }

                    this.menuRegistry.registerMenuAction(ArduinoMenus.OPEN_SKETCH__CONTEXT__OPEN_GROUP, {
                        commandId: OpenSketch.Commands.OPEN_SKETCH.id,
                        label: 'Open...'
                    });
                    this.toDisposeBeforeCreateNewContextMenu.push(Disposable.create(() => this.menuRegistry.unregisterMenuAction(OpenSketch.Commands.OPEN_SKETCH)));
                    for (const sketch of sketches) {
                        const command = { id: `arduino-open-sketch--${sketch.uri}` };
                        const handler = { execute: () => this.openSketch(sketch) };
                        this.toDisposeBeforeCreateNewContextMenu.push(registry.registerCommand(command, handler));
                        this.menuRegistry.registerMenuAction(ArduinoMenus.OPEN_SKETCH__CONTEXT__RECENT_GROUP, {
                            commandId: command.id,
                            label: sketch.name
                        });
                        this.toDisposeBeforeCreateNewContextMenu.push(Disposable.create(() => this.menuRegistry.unregisterMenuAction(command)));
                    }
                    try {
                        const containers = await this.examplesService.builtIns();
                        for (const container of containers) {
                            this.builtInExamples.registerRecursively(container, ArduinoMenus.OPEN_SKETCH__CONTEXT__EXAMPLES_GROUP, this.toDisposeBeforeCreateNewContextMenu);
                        }
                    } catch (e) {
                        console.error('Error when collecting built-in examples.', e);
                    }
                    const options = {
                        menuPath: ArduinoMenus.OPEN_SKETCH__CONTEXT,
                        anchor: {
                            x: parentElement.getBoundingClientRect().left,
                            y: parentElement.getBoundingClientRect().top + parentElement.offsetHeight
                        }
                    }
                    this.contextMenuRenderer.render(options);
                }
            }
        });
    }

    registerMenus(registry: MenuModelRegistry): void {
        registry.registerMenuAction(ArduinoMenus.FILE__SKETCH_GROUP, {
            commandId: OpenSketch.Commands.OPEN_SKETCH.id,
            label: 'Open...',
            order: '1'
        });
    }

    registerKeybindings(registry: KeybindingRegistry): void {
        registry.registerKeybinding({
            command: OpenSketch.Commands.OPEN_SKETCH.id,
            keybinding: 'CtrlCmd+O'
        });
    }

    registerToolbarItems(registry: TabBarToolbarRegistry): void {
        registry.registerItem({
            id: OpenSketch.Commands.OPEN_SKETCH__TOOLBAR.id,
            command: OpenSketch.Commands.OPEN_SKETCH__TOOLBAR.id,
            tooltip: 'Open',
            priority: 4
        });
    }

    async openSketch(toOpen: MaybePromise<Sketch | undefined> = this.selectSketch(), preserveWindow: boolean = false): Promise<void> {
        const sketch = await toOpen;
        if (sketch) {
            if (preserveWindow) {
                return this.openSketchFiles(sketch);
            } else {
                // Rewrite the URL's query. The hash with the workspace path remains the same.
                const url = new URL(window.location.href);
                url.searchParams.delete('sketchUri');
                url.searchParams.set('sketchUri', sketch.uri.toString());
                await this.sketchServiceClient.storeSketchUri(sketch);
                return this.windowService.openNewWindow(url.toString());
            }
        }
    }

    protected async openSketchFiles(sketchOrUri: URI | string | Sketch): Promise<void> {
        const uri = sketchOrUri instanceof URI ? sketchOrUri : typeof sketchOrUri === 'string' ? new URI(sketchOrUri) : new URI(sketchOrUri.uri);
        try {
            const sketch = await this.sketchServiceClient.loadSketch(uri);

            // Rewrite the URL of the current window.
            // Make sure not to modify the `href`, otherwise the window reloads.
            // Instead, push the desired URL, with the updated `sketchUri` query to the history stack.
            const url = new URL(window.location.href);
            url.searchParams.delete('sketchUri');
            url.searchParams.set('sketchUri', uri.toString());
            window.history.pushState({}, '', url.toString());
            await this.sketchServiceClient.storeSketchUri(sketch);

            const { mainFileUri, otherSketchFileUris, additionalFileUris } = sketch;
            const toOpenUris = [mainFileUri, ...otherSketchFileUris, ...additionalFileUris];
            for (const editor of this.editorManager.all) {
                const openedEditorUri = editor.editor.uri.toString();
                if (toOpenUris.indexOf(openedEditorUri) === -1) {
                    editor.close();
                }
            }
            for (const uri of toOpenUris) {
                await this.ensureOpened(uri);
            }
            await this.ensureOpened(mainFileUri, true);
        } catch (e) {
            console.error(e);
            const message = e instanceof Error ? e.message : JSON.stringify(e);
            this.messageService.error(message);
        }
    }

    protected async ensureOpened(uri: string, forceOpen: boolean = false): Promise<any> {
        const widget = this.editorManager.all.find(widget => widget.editor.uri.toString() === uri);
        if (!widget || forceOpen) {
            return this.editorManager.open(new URI(uri));
        }
    }

    protected async selectSketch(): Promise<Sketch | undefined> {
        const config = await this.configService.getConfiguration();
        const defaultPath = await this.fileService.fsPath(new URI(config.sketchDirUri));
        const { filePaths } = await remote.dialog.showOpenDialog({
            defaultPath,
            properties: ['createDirectory', 'openFile'],
            filters: [
                {
                    name: 'Sketch',
                    extensions: ['ino']
                }
            ]
        });
        if (!filePaths.length) {
            return undefined;
        }
        if (filePaths.length > 1) {
            this.logger.warn(`Multiple sketches were selected: ${filePaths}. Using the first one.`);
        }
        const sketchFilePath = filePaths[0];
        const sketchFileUri = await this.fileSystemExt.getUri(sketchFilePath);
        const sketch = await this.sketchServiceClient.getSketchFolder(new URI(sketchFileUri));
        if (sketch) {
            return sketch;
        }
        if (sketchFileUri.endsWith('.ino')) {
            const name = new URI(sketchFileUri).path.name;
            const nameWithExt = this.labelProvider.getName(new URI(sketchFileUri));
            const { response } = await remote.dialog.showMessageBox({
                title: 'Moving',
                type: 'question',
                buttons: ['Cancel', 'OK'],
                message: `The file "${nameWithExt}" needs to be inside a sketch folder named as "${name}".\nCreate this folder, move the file, and continue?`
            });
            if (response === 1) { // OK
                const newSketchUri = new URI(sketchFileUri).parent.resolve(name);
                const exists = await this.fileService.exists(newSketchUri);
                if (exists) {
                    await remote.dialog.showMessageBox({
                        type: 'error',
                        title: 'Error',
                        message: `A folder named "${name}" already exists. Can't open sketch.`
                    });
                    return undefined;
                }
                await this.fileService.createFolder(newSketchUri);
                await this.fileService.move(new URI(sketchFileUri), new URI(newSketchUri.resolve(nameWithExt).toString()));
                return this.sketchServiceClient.getSketchFolder(newSketchUri);
            }
        }
    }

}

export namespace OpenSketch {
    export namespace Commands {
        export const OPEN_SKETCH: Command = {
            id: 'arduino-open-sketch'
        };
        export const OPEN_SKETCH__TOOLBAR: Command = {
            id: 'arduino-open-sketch--toolbar'
        };
    }
    export interface Options {
        readonly sketch: Sketch;
        /**
         * `false` by default.
         */
        readonly preserveWindow?: boolean;
    }
    export namespace Options {
        export function is(arg: Partial<Options> | undefined): arg is Options {
            return !!arg && !!arg.sketch;
        }
    }
}
